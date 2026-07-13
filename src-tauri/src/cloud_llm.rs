// Epi - Local-first Meeting Intelligence
// Copyright (C) 2026  Eike Christian Karbe
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.
//

use reqwest::Client;
use std::sync::OnceLock;
use std::time::Duration;

static HTTP_CLIENT: OnceLock<Client> = OnceLock::new();

#[cfg(not(test))]
fn get_openai_url() -> String { "https://api.openai.com/v1/chat/completions".to_string() }
#[cfg(test)]
fn get_openai_url() -> String { std::env::var("MOCK_OPENAI_URL").unwrap_or_else(|_| "https://api.openai.com/v1/chat/completions".to_string()) }

#[cfg(not(test))]
fn get_anthropic_url() -> String { "https://api.anthropic.com/v1/messages".to_string() }
#[cfg(test)]
fn get_anthropic_url() -> String { std::env::var("MOCK_ANTHROPIC_URL").unwrap_or_else(|_| "https://api.anthropic.com/v1/messages".to_string()) }

#[cfg(not(test))]
fn get_google_url(model: &str, key: &str) -> String { format!("https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}", model, key) }
#[cfg(test)]
fn get_google_url(model: &str, key: &str) -> String { 
    if let Ok(url) = std::env::var("MOCK_GOOGLE_URL") {
        url
    } else {
        format!("https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}", model, key)
    }
}


/// Returns a shared, lazily-initialized HTTP client with configured connection pooling and timeout.
fn get_client() -> &'static Client {
    HTTP_CLIENT.get_or_init(|| {
        Client::builder()
            .timeout(Duration::from_secs(60))
            .build()
            .unwrap_or_else(|_| Client::new())
    })
}

#[tauri::command]
/// Generates a summary of the provided transcript using a cloud LLM provider.
///
/// # Arguments
/// * `provider` - The name of the cloud LLM provider ("openai", "anthropic", "google").
/// * `transcript` - The raw text of the meeting transcript to summarize.
/// * `prompt_template` - A prompt template, where `{{transcript}}` is replaced by the actual transcript.
/// * `api_key` - The API key for authentication.
/// * `model` - Optional model name override.
///
/// # Errors
/// Returns an error message if the API key is empty, the request fails, or response parsing fails.
pub async fn generate_cloud_summary(
    provider: String,
    transcript: String,
    prompt_template: String,
    api_key: String,
    model: String,
) -> Result<String, String> {
    if api_key.trim().is_empty() {
        return Err(format!("API key for {} is missing.", provider));
    }

    let prompt = prompt_template.replace("{{transcript}}", &transcript);
    let client = get_client();

    match provider.as_str() {
        "openai" => {
            let active_model = if model.is_empty() { "gpt-4o-mini" } else { &model };
            
            let body = serde_json::json!({
                "model": active_model,
                "messages": [
                    {
                        "role": "system",
                        "content": "You are a helpful assistant."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            });

            let res = client
                .post(get_openai_url())
                .bearer_auth(&api_key)
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("OpenAI request failed: {}", e.to_string().replace(&api_key, "REDACTED")))?;

            if !res.status().is_success() {
                let status = res.status();
                let text = res.text().await.unwrap_or_default();
                return Err(format!("OpenAI API error {}: {}", status, text.replace(&api_key, "REDACTED")));
            }

            let parsed: serde_json::Value = res
                .json()
                .await
                .map_err(|e| format!("Failed to parse OpenAI response: {}", e))?;

            let choices = parsed["choices"].as_array().ok_or("No choices found in OpenAI response")?;
            if choices.is_empty() {
                return Err("OpenAI response choices array is empty".into());
            }

            let text = choices[0]["message"]["content"]
                .as_str()
                .ok_or("OpenAI message content is missing or invalid")?
                .to_string();

            Ok(text)
        }
        "anthropic" => {
            let active_model = if model.is_empty() { "claude-haiku-4-5" } else { &model };
            
            let body = serde_json::json!({
                "model": active_model,
                "max_tokens": 4096,
                "messages": [
                    {
                        "role": "user",
                        "content": prompt
                    }
                ]
            });

            let res = client
                .post(get_anthropic_url())
                .header("x-api-key", &api_key)
                .header("anthropic-version", "2023-06-01")
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("Anthropic request failed: {}", e.to_string().replace(&api_key, "REDACTED")))?;

            if !res.status().is_success() {
                let status = res.status();
                let text = res.text().await.unwrap_or_default();
                return Err(format!("Anthropic API error {}: {}", status, text.replace(&api_key, "REDACTED")));
            }

            let parsed: serde_json::Value = res
                .json()
                .await
                .map_err(|e| format!("Failed to parse Anthropic response: {}", e))?;

            let content = parsed["content"].as_array().ok_or("No content array found in Anthropic response")?;
            if content.is_empty() {
                return Err("Anthropic response content array is empty".into());
            }

            let text = content[0]["text"]
                .as_str()
                .ok_or("Anthropic content text is missing or invalid")?
                .to_string();

            Ok(text)
        }
        "google" => {
            let mut active_model = model.as_str();
            if active_model.is_empty() {
                active_model = "gemini-2.5-flash";
            }
            if active_model.starts_with("models/") {
                active_model = &active_model["models/".len()..];
            }

            let body = serde_json::json!({
                "contents": [{
                    "parts": [
                        {"text": prompt}
                    ]
                }]
            });

            let url = get_google_url(active_model, &api_key);

            let res = client
                .post(&url)
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("Google AI request failed: {}", e.to_string().replace(&api_key, "REDACTED")))?;

            if !res.status().is_success() {
                let text = res.text().await.unwrap_or_default();
                return Err(format!("Google AI Studio error: {}", text.replace(&api_key, "REDACTED")));
            }

            let parsed: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
            
            let candidates = parsed["candidates"].as_array().ok_or("No candidates found in Google response")?;
            if candidates.is_empty() {
                return Err("Google response contains empty candidates (possibly blocked by safety filters).".into());
            }

            let text = candidates[0]["content"]["parts"][0]["text"]
                .as_str()
                .ok_or("Google response content part text is missing or invalid")?
                .to_string();

            Ok(text)
        }
        _ => Err(format!("Unknown LLM provider: {}", provider)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{OnceLock, Mutex};
    
    static TEST_MUTEX: OnceLock<Mutex<()>> = OnceLock::new();
    fn get_test_mutex() -> &'static Mutex<()> {
        TEST_MUTEX.get_or_init(|| Mutex::new(()))
    }

    #[tokio::test]
    async fn test_generate_cloud_summary_missing_key() {
        let res = generate_cloud_summary(
            "openai".to_string(),
            "transcript".to_string(),
            "prompt".to_string(),
            "".to_string(),
            "gpt-4".to_string(),
        ).await;
        assert!(res.is_err());
        assert_eq!(res.unwrap_err(), "API key for openai is missing.");
    }

    #[tokio::test]
    async fn test_generate_cloud_summary_missing_key_whitespace() {
        let res = generate_cloud_summary(
            "anthropic".to_string(),
            "transcript".to_string(),
            "prompt".to_string(),
            "   ".to_string(),
            "claude-3".to_string(),
        ).await;
        assert!(res.is_err());
        assert_eq!(res.unwrap_err(), "API key for anthropic is missing.");
    }

    #[tokio::test]
    async fn test_generate_cloud_summary_unknown_provider() {
        let res = generate_cloud_summary(
            "unknown".to_string(),
            "transcript".to_string(),
            "prompt".to_string(),
            "key".to_string(),
            "model".to_string(),
        ).await;
        assert!(res.is_err());
        assert_eq!(res.unwrap_err(), "Unknown LLM provider: unknown");
    }

    #[tokio::test]
    async fn test_generate_cloud_summary_invalid_key_redaction_openai() {
        let _guard = get_test_mutex().lock().unwrap();
        let res = generate_cloud_summary(
            "openai".to_string(),
            "transcript".to_string(),
            "prompt".to_string(),
            "FAKE_KEY_123".to_string(),
            "gpt-4".to_string(),
        ).await;
        assert!(res.is_err());
        let err = res.unwrap_err();
        assert!(!err.contains("FAKE_KEY_123")); 
        assert!(err.contains("REDACTED") || err.contains("error") || err.contains("failed"));
    }

    #[tokio::test]
    async fn test_generate_cloud_summary_invalid_key_redaction_anthropic() {
        let _guard = get_test_mutex().lock().unwrap();
        let res = generate_cloud_summary(
            "anthropic".to_string(),
            "transcript".to_string(),
            "prompt".to_string(),
            "FAKE_KEY_123".to_string(),
            "".to_string(),
        ).await;
        assert!(res.is_err());
        let err = res.unwrap_err();
        assert!(!err.contains("FAKE_KEY_123")); 
    }

    #[tokio::test]
    async fn test_generate_cloud_summary_invalid_key_redaction_google() {
        let _guard = get_test_mutex().lock().unwrap();
        let res = generate_cloud_summary(
            "google".to_string(),
            "transcript".to_string(),
            "prompt".to_string(),
            "FAKE_KEY_123".to_string(),
            "models/gemini-1.5".to_string(),
        ).await;
        assert!(res.is_err());
        let err = res.unwrap_err();
        assert!(!err.contains("FAKE_KEY_123")); 
    }

    #[tokio::test]
    async fn test_generate_cloud_summary_success_openai() {
        let _guard = get_test_mutex().lock().unwrap();
        let server = httpmock::MockServer::start();
        let mock = server.mock(|when, then| {
            when.method(httpmock::Method::POST);
            then.status(200)
                .header("content-type", "application/json")
                .body(r#"{"choices": [{"message": {"content": "This is a mock summary."}}]}"#);
        });

        std::env::set_var("MOCK_OPENAI_URL", server.url("/"));

        let res = generate_cloud_summary(
            "openai".to_string(),
            "transcript".to_string(),
            "prompt {{transcript}}".to_string(),
            "key".to_string(),
            "gpt-4".to_string(),
        ).await;

        std::env::remove_var("MOCK_OPENAI_URL");

        assert!(res.is_ok());
        assert_eq!(res.unwrap(), "This is a mock summary.");
        mock.assert();
    }

    #[tokio::test]
    async fn test_generate_cloud_summary_success_anthropic() {
        let _guard = get_test_mutex().lock().unwrap();
        let server = httpmock::MockServer::start();
        let mock = server.mock(|when, then| {
            when.method(httpmock::Method::POST);
            then.status(200)
                .header("content-type", "application/json")
                .body(r#"{"content": [{"text": "Anthropic mock summary."}]}"#);
        });

        std::env::set_var("MOCK_ANTHROPIC_URL", server.url("/"));

        let res = generate_cloud_summary(
            "anthropic".to_string(),
            "transcript".to_string(),
            "prompt {{transcript}}".to_string(),
            "key".to_string(),
            "claude-3".to_string(),
        ).await;

        std::env::remove_var("MOCK_ANTHROPIC_URL");

        assert!(res.is_ok());
        assert_eq!(res.unwrap(), "Anthropic mock summary.");
        mock.assert();
    }

    #[tokio::test]
    async fn test_generate_cloud_summary_success_google() {
        let _guard = get_test_mutex().lock().unwrap();
        let server = httpmock::MockServer::start();
        let mock = server.mock(|when, then| {
            when.method(httpmock::Method::POST);
            then.status(200)
                .header("content-type", "application/json")
                .body(r#"{"candidates": [{"content": {"parts": [{"text": "Google mock summary."}]}}]}"#);
        });

        std::env::set_var("MOCK_GOOGLE_URL", server.url("/"));

        let res = generate_cloud_summary(
            "google".to_string(),
            "transcript".to_string(),
            "prompt {{transcript}}".to_string(),
            "key".to_string(),
            "models/gemini".to_string(),
        ).await;

        std::env::remove_var("MOCK_GOOGLE_URL");

        assert!(res.is_ok());
        assert_eq!(res.unwrap(), "Google mock summary.");
        mock.assert();
    }
}
