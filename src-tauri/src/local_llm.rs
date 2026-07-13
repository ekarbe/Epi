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

/// Returns a shared, lazily-initialized HTTP client with configured connection pooling and timeout.
fn get_client() -> &'static Client {
    HTTP_CLIENT.get_or_init(|| {
        Client::builder()
            .timeout(Duration::from_secs(300)) // 5 minutes for local inference default
            .build()
            .unwrap_or_else(|_| Client::new())
    })
}

#[derive(serde::Deserialize)]
struct OllamaModelTag {
    name: String,
}

#[derive(serde::Deserialize)]
struct OllamaTagsResponse {
    models: Option<Vec<OllamaModelTag>>,
}

pub fn parse_ollama_tags_response(res_body: &str) -> Result<Vec<String>, String> {
    let data: OllamaTagsResponse = serde_json::from_str(res_body).map_err(|e| e.to_string())?;
    
    if let Some(models) = data.models {
        Ok(models.into_iter().map(|m| m.name).collect())
    } else {
        Ok(vec![])
    }
}

#[tauri::command]
pub async fn get_local_models(ollama_url: String) -> Result<Vec<String>, String> {
    let client = get_client();
    let clean_url = ollama_url.trim_end_matches('/');
    
    let res = client
        .get(format!("{}/api/tags", clean_url))
        .timeout(Duration::from_secs(5))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch models: {}", e))?;
        
    if !res.status().is_success() {
        return Err(format!("Ollama returned status: {}", res.status()));
    }
    
    let body = res.text().await.map_err(|e| e.to_string())?;
    parse_ollama_tags_response(&body)
}

#[derive(serde::Serialize)]
struct OllamaOptions {
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    num_ctx: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    top_p: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    top_k: Option<u32>,
}

#[derive(serde::Serialize)]
struct OllamaGenerateRequest {
    model: String,
    prompt: String,
    system: String,
    stream: bool,
    options: OllamaOptions,
}

#[derive(serde::Deserialize)]
struct OllamaGenerateResponse {
    response: Option<String>,
    error: Option<String>,
}

pub fn parse_ollama_generate_response(res_body: &str) -> Result<String, String> {
    let data: OllamaGenerateResponse = serde_json::from_str(res_body).map_err(|e| e.to_string())?;
    
    if let Some(err) = data.error {
        return Err(err);
    }
    
    if let Some(response) = data.response {
        Ok(response)
    } else {
        Err("Invalid response format received from Ollama.".to_string())
    }
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn generate_local_summary(
    ollama_url: String,
    model: String,
    transcript: String,
    prompt_template: String,
    system: String,
    temperature: Option<f64>,
    num_ctx: Option<u32>,
    top_p: Option<f64>,
    top_k: Option<u32>,
    timeout_ms: Option<u64>,
    log_path: Option<String>,
) -> Result<String, String> {
    let client = get_client();
    let clean_url = ollama_url.trim_end_matches('/');
    let prompt = prompt_template.replace("{{transcript}}", &transcript);
    
    let body = OllamaGenerateRequest {
        model,
        prompt,
        system,
        stream: false,
        options: OllamaOptions {
            temperature,
            num_ctx,
            top_p,
            top_k,
        },
    };
    
    let timeout = timeout_ms.unwrap_or(300000);

    if let Some(path) = &log_path {
        if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(path) {
            use std::io::Write;
            let _ = writeln!(f, "--- LLM REQUEST ---");
            if let Ok(json) = serde_json::to_string_pretty(&body) {
                let _ = f.write_all(json.as_bytes());
            }
            let _ = writeln!(f, "\n-------------------\n");
        }
    }
    
    let res = client
        .post(format!("{}/api/generate", clean_url))
        .timeout(Duration::from_millis(timeout))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to Ollama at {}: {}", clean_url, e))?;
        
    if !res.status().is_success() {
        let err_text = res.text().await.unwrap_or_default();
        if let Some(path) = &log_path {
            if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(path) {
                use std::io::Write;
                let _ = writeln!(f, "--- LLM ERROR ---");
                let _ = f.write_all(err_text.as_bytes());
                let _ = writeln!(f, "\n-------------------\n");
            }
        }
        return Err(format!("Ollama error: {}", err_text));
    }
    
    let body_text = res.text().await.map_err(|e| e.to_string())?;

    if let Some(path) = &log_path {
        if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(path) {
            use std::io::Write;
            let _ = writeln!(f, "--- LLM RESPONSE ---");
            let _ = f.write_all(body_text.as_bytes());
            let _ = writeln!(f, "\n-------------------\n");
        }
    }

    parse_ollama_generate_response(&body_text)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_ollama_tags_response() {
        let json = r#"{"models": [{"name": "llama3"}, {"name": "mistral"}]}"#;
        let res = parse_ollama_tags_response(json).unwrap();
        assert_eq!(res, vec!["llama3", "mistral"]);
        
        let empty = r#"{"models": []}"#;
        let res_empty = parse_ollama_tags_response(empty).unwrap();
        assert!(res_empty.is_empty());
    }

    #[test]
    fn test_parse_ollama_generate_response() {
        let json = r#"{"response": "Summary content", "done": true}"#;
        let res = parse_ollama_generate_response(json).unwrap();
        assert_eq!(res, "Summary content");
        
        let err_json = r#"{"error": "Model not found"}"#;
        let res_err = parse_ollama_generate_response(err_json);
        assert_eq!(res_err.unwrap_err(), "Model not found");
    }

    #[tokio::test]
    async fn test_get_local_models_success() {
        let server = httpmock::MockServer::start();
        let mock = server.mock(|when, then| {
            when.method(httpmock::Method::GET)
                .path("/api/tags");
            then.status(200)
                .header("content-type", "application/json")
                .body(r#"{"models": [{"name": "llama3"}, {"name": "mistral"}]}"#);
        });

        let res = get_local_models(server.url("/")).await;
        assert!(res.is_ok());
        assert_eq!(res.unwrap(), vec!["llama3", "mistral"]);
        mock.assert();
    }

    #[tokio::test]
    async fn test_generate_local_summary_success() {
        let server = httpmock::MockServer::start();
        let mock = server.mock(|when, then| {
            when.method(httpmock::Method::POST)
                .path("/api/generate");
            then.status(200)
                .header("content-type", "application/json")
                .body(r#"{"response": "Local mock summary", "done": true}"#);
        });

        let res = generate_local_summary(
            server.url("/"),
            "llama3".to_string(),
            "transcript".to_string(),
            "prompt {{transcript}}".to_string(),
            "system".to_string(),
            None,
            None,
            None,
            None,
            None,
            None,
        ).await;

        assert!(res.is_ok());
        assert_eq!(res.unwrap(), "Local mock summary");
        mock.assert();
    }
}
