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

use reqwest::{Client, multipart};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::OnceLock;
use std::time::Duration;
use crate::utils::validate_path_in_library;

static HTTP_CLIENT: OnceLock<Client> = OnceLock::new();

#[cfg(not(test))]
fn get_openai_tx_url() -> String { "https://api.openai.com/v1/audio/transcriptions".to_string() }
#[cfg(test)]
fn get_openai_tx_url() -> String { std::env::var("MOCK_OPENAI_TX_URL").unwrap_or_else(|_| "https://api.openai.com/v1/audio/transcriptions".to_string()) }

#[cfg(not(test))]
fn get_assembly_upload_url() -> String { "https://api.assemblyai.com/v2/upload".to_string() }
#[cfg(test)]
fn get_assembly_upload_url() -> String { std::env::var("MOCK_ASSEMBLY_UPLOAD_URL").unwrap_or_else(|_| "https://api.assemblyai.com/v2/upload".to_string()) }

#[cfg(not(test))]
fn get_assembly_tx_url() -> String { "https://api.assemblyai.com/v2/transcript".to_string() }
#[cfg(test)]
fn get_assembly_tx_url() -> String { std::env::var("MOCK_ASSEMBLY_TX_URL").unwrap_or_else(|_| "https://api.assemblyai.com/v2/transcript".to_string()) }

#[cfg(not(test))]
fn get_assembly_poll_url(id: &str) -> String { format!("https://api.assemblyai.com/v2/transcript/{}", id) }
#[cfg(test)]
fn get_assembly_poll_url(id: &str) -> String { 
    if let Ok(base) = std::env::var("MOCK_ASSEMBLY_POLL_URL") {
        format!("{}/{}", base, id)
    } else {
        format!("https://api.assemblyai.com/v2/transcript/{}", id)
    }
}

#[cfg(not(test))]
fn get_google_tx_url(model: &str, key: &str) -> String { format!("https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}", model, key) }
#[cfg(test)]
fn get_google_tx_url(model: &str, key: &str) -> String { 
    if let Ok(url) = std::env::var("MOCK_GOOGLE_TX_URL") {
        url
    } else {
        format!("https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}", model, key)
    }
}


/// Returns a shared, lazily-initialized HTTP client with configured connection pooling and timeout.
fn get_client() -> &'static Client {
    HTTP_CLIENT.get_or_init(|| {
        Client::builder()
            // Set a generous 5-minute timeout for large audio uploads
            .timeout(Duration::from_secs(300))
            .build()
            .unwrap_or_else(|_| Client::new())
    })
}

#[derive(Serialize, Deserialize)]
pub struct TranscriptionResult {
    pub text: String,
}

#[tauri::command]
/// Transcribes an audio file using a cloud transcription provider.
///
/// # Arguments
/// * `provider` - The cloud provider ("openai", "assembly", "google").
/// * `audio_path` - The absolute system path to the audio file.
/// * `api_key` - The API key for authentication.
/// * `model` - Optional transcription model override (e.g., "whisper-1").
/// * `language` - Target language code or "auto".
/// * `prompt` - Optional initial context prompt for Whisper.
///
/// # Errors
/// Returns an error message if the API key is empty, the file cannot be read,
/// or any API calls fail or timeout.
pub async fn transcribe_cloud(
    provider: String,
    audio_path: String,
    api_key: String,
    model: String,
    language: String,
    prompt: String,
) -> Result<String, String> {
    let audio_path = validate_path_in_library(&audio_path)?
        .to_string_lossy()
        .to_string();

    if api_key.trim().is_empty() {
        return Err(format!("API key for {} is missing.", provider));
    }

    let file_metadata = tokio::fs::metadata(&audio_path)
        .await
        .map_err(|e| format!("Failed to read audio file metadata: {}", e))?;
    let file_size = file_metadata.len();

    if provider == "google" && file_size > 20 * 1024 * 1024 {
        return Err("Audio file is too large for Google AI Studio cloud transcription (Max 20MB). Please use local WhisperX instead.".into());
    } else if provider == "openai" && file_size > 25 * 1024 * 1024 {
        return Err("Audio file is too large for OpenAI cloud transcription (Max 25MB). Please use local WhisperX instead.".into());
    } else if provider == "assembly" && file_size > 100 * 1024 * 1024 {
        return Err("Audio file is too large for cloud upload (Max 100MB). Please use local WhisperX instead.".into());
    }

    let client = get_client();

    match provider.as_str() {
        "openai" => {
            let file_bytes = tokio::fs::read(&audio_path)
                .await
                .map_err(|e| format!("Failed to read audio file: {}", e))?;
            let file_name = Path::new(&audio_path)
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();

            let part = multipart::Part::bytes(file_bytes)
                .file_name(file_name)
                .mime_str("audio/ogg")
                .map_err(|e| e.to_string())?;

            let mut form = multipart::Form::new()
                .part("file", part)
                .text("model", if model.is_empty() { "whisper-1".to_string() } else { model });

            if !language.is_empty() && language != "auto" {
                form = form.text("language", language);
            }
            if !prompt.is_empty() {
                form = form.text("prompt", prompt);
            }

            let res = client
                .post(get_openai_tx_url())
                .bearer_auth(&api_key)
                .multipart(form)
                .send()
                .await
                .map_err(|e| format!("OpenAI request failed: {}", e.to_string().replace(&api_key, "REDACTED")))?;

            if !res.status().is_success() {
                let status = res.status();
                let text = res.text().await.unwrap_or_default();
                return Err(format!("OpenAI API error {}: {}", status, text.replace(&api_key, "REDACTED")));
            }

            let parsed: TranscriptionResult = res
                .json()
                .await
                .map_err(|e| format!("Failed to parse OpenAI response: {}", e))?;

            Ok(parsed.text)
        }
        "assembly" => {
            // 1. Upload by streaming from disk directly, saving memory
            let file = tokio::fs::File::open(&audio_path)
                .await
                .map_err(|e| format!("Failed to open audio file: {}", e))?;
            let upload_res = client
                .post(get_assembly_upload_url())
                .header("Authorization", &api_key)
                .body(reqwest::Body::from(file))
                .send()
                .await
                .map_err(|e| format!("AssemblyAI upload failed: {}", e.to_string().replace(&api_key, "REDACTED")))?;

            if !upload_res.status().is_success() {
                let text = upload_res.text().await.unwrap_or_default();
                return Err(format!("AssemblyAI upload error: {}", text.replace(&api_key, "REDACTED")));
            }

            #[derive(Deserialize)]
            struct UploadResponse { upload_url: String }
            let upload_data: UploadResponse = upload_res.json().await.map_err(|e| e.to_string())?;

            // 2. Transcribe
            let mut body = serde_json::json!({
                "audio_url": upload_data.upload_url
            });
            if !model.is_empty() {
                let model_lower = model.to_lowercase();
                let mapped_model = match model_lower.as_str() {
                    "nano" => "universal-2",
                    "best" => "universal-3-5-pro",
                    other => other,
                };
                body.as_object_mut().unwrap().insert("speech_models".to_string(), serde_json::json!([mapped_model]));
            }
            if !language.is_empty() && language != "auto" {
                body.as_object_mut().unwrap().insert("language_code".to_string(), serde_json::Value::String(language));
            }

            let tx_res = client
                .post(get_assembly_tx_url())
                .header("Authorization", &api_key)
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("AssemblyAI transcribe request failed: {}", e.to_string().replace(&api_key, "REDACTED")))?;

            if !tx_res.status().is_success() {
                let text = tx_res.text().await.unwrap_or_default();
                return Err(format!("AssemblyAI transcribe error: {}", text.replace(&api_key, "REDACTED")));
            }

            #[derive(Deserialize)]
            struct TxResponse { id: String }
            let tx_data: TxResponse = tx_res.json().await.map_err(|e| e.to_string())?;

            // 3. Poll with a timeout/limit to prevent infinite loops
            let mut attempts = 0;
            const MAX_ATTEMPTS: u32 = 100; // 300 seconds total

            loop {
                attempts += 1;
                if attempts > MAX_ATTEMPTS {
                    return Err("AssemblyAI transcription timed out (exceeded maximum polling attempts).".to_string());
                }

                tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
                let poll_res = client
                    .get(get_assembly_poll_url(&tx_data.id))
                    .header("Authorization", &api_key)
                    .send()
                    .await
                    .map_err(|e| e.to_string().replace(&api_key, "REDACTED"))?;

                if !poll_res.status().is_success() {
                    let status = poll_res.status();
                    let text = poll_res.text().await.unwrap_or_default();
                    return Err(format!("AssemblyAI poll error {}: {}", status, text.replace(&api_key, "REDACTED")));
                }

                #[derive(Deserialize)]
                struct PollResponse { status: String, text: Option<String>, error: Option<String> }
                let poll_data: PollResponse = poll_res.json().await.map_err(|e| e.to_string())?;

                if poll_data.status == "completed" {
                    return Ok(poll_data.text.unwrap_or_default());
                } else if poll_data.status == "error" {
                    return Err(format!("AssemblyAI error: {:?}", poll_data.error));
                }
            }
        }
        "google" => {
            let file_bytes = tokio::fs::read(&audio_path)
                .await
                .map_err(|e| format!("Failed to read audio file: {}", e))?;
            use base64::{Engine as _, engine::general_purpose::STANDARD};
            let b64 = STANDARD.encode(&file_bytes);

            let body = serde_json::json!({
                "contents": [{
                    "parts": [
                        {"text": "Please transcribe the following audio accurately."},
                        {
                             "inlineData": {
                                 "mimeType": "audio/ogg",
                                 "data": b64
                             }
                        }
                    ]
                }]
            });

            let active_model = map_google_model(&model);

            let url = get_google_tx_url(&active_model, &api_key);

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
            parse_google_transcription_response(&parsed)
        }
        _ => Err(format!("Unknown provider: {}", provider)),
    }
}

#[allow(dead_code)]
pub fn map_assembly_model(model: &str) -> String {
    let model_lower = model.to_lowercase();
    match model_lower.as_str() {
        "nano" => "universal-2".to_string(),
        "best" => "universal-3-5-pro".to_string(),
        _ => model.to_string(),
    }
}

pub fn map_google_model(model: &str) -> String {
    let mut active_model = model;
    if active_model.is_empty() || ["tiny", "base", "small", "medium", "large", "large-v2", "large-v3", "whisper-1"].contains(&active_model) {
        active_model = "gemini-2.5-flash";
    }
    if active_model.starts_with("models/") {
        active_model = &active_model["models/".len()..];
    }
    active_model.to_string()
}

pub fn parse_google_transcription_response(parsed: &serde_json::Value) -> Result<String, String> {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_transcribe_cloud_missing_key() {
        let docs = match dirs::document_dir() {
            Some(d) => d,
            None => return, // Skip test if headless / no document dir
        };
        let path = docs.join("Epi Library").join("Recordings").join("test.ogg");
        
        let res = transcribe_cloud(
            "openai".to_string(),
            path.to_string_lossy().to_string(),
            "   ".to_string(),
            "".to_string(),
            "".to_string(),
            "".to_string(),
        ).await;
        
        assert!(res.is_err());
        assert_eq!(res.unwrap_err(), "API key for openai is missing.");
    }

    #[test]
    fn test_map_assembly_model() {
        assert_eq!(map_assembly_model("nano"), "universal-2");
        assert_eq!(map_assembly_model("best"), "universal-3-5-pro");
        assert_eq!(map_assembly_model("universal-1"), "universal-1");
    }

    #[test]
    fn test_map_google_model() {
        assert_eq!(map_google_model(""), "gemini-2.5-flash");
        assert_eq!(map_google_model("base"), "gemini-2.5-flash");
        assert_eq!(map_google_model("large-v3"), "gemini-2.5-flash");
        assert_eq!(map_google_model("models/gemini-pro"), "gemini-pro");
        assert_eq!(map_google_model("gemini-2.5-pro"), "gemini-2.5-pro");
    }

    #[test]
    fn test_parse_google_transcription_response() {
        let json = serde_json::json!({
            "candidates": [{
                "content": {
                    "parts": [{
                        "text": "Hello world"
                    }]
                }
            }]
        });
        let res = parse_google_transcription_response(&json).unwrap();
        assert_eq!(res, "Hello world");
        
        let empty_json = serde_json::json!({ "candidates": [] });
        assert!(parse_google_transcription_response(&empty_json).is_err());
    }

    #[tokio::test]
    async fn test_transcribe_cloud_success_openai() {
        use std::io::Write;
        let docs_dir = dirs::document_dir().unwrap();
        let lib_dir = docs_dir.join("Epi Library");
        std::fs::create_dir_all(&lib_dir).unwrap();
        let tmp_path = lib_dir.join("fake_audio_openai.ogg");
        let mut f = std::fs::File::create(&tmp_path).unwrap();
        f.write_all(b"fake audio data").unwrap();
        let path = tmp_path.to_string_lossy().to_string();

        let server = httpmock::MockServer::start();
        let mock = server.mock(|when, then| {
            when.method(httpmock::Method::POST);
            then.status(200)
                .header("content-type", "application/json")
                .body(r#"{"text": "OpenAI mock transcript."}"#);
        });

        std::env::set_var("MOCK_OPENAI_TX_URL", server.url("/"));

        let res = transcribe_cloud(
            "openai".to_string(),
            path,
            "key".to_string(),
            "".to_string(),
            "".to_string(),
            "".to_string(),
        ).await;

        std::env::remove_var("MOCK_OPENAI_TX_URL");

        assert!(res.is_ok());
        assert_eq!(res.unwrap(), "OpenAI mock transcript.");
        mock.assert();
    }

    #[tokio::test]
    async fn test_transcribe_cloud_success_google() {
        use std::io::Write;
        let docs_dir = dirs::document_dir().unwrap();
        let lib_dir = docs_dir.join("Epi Library");
        std::fs::create_dir_all(&lib_dir).unwrap();
        let tmp_path = lib_dir.join("fake_audio_google.ogg");
        let mut f = std::fs::File::create(&tmp_path).unwrap();
        f.write_all(b"fake audio data").unwrap();
        let path = tmp_path.to_string_lossy().to_string();

        let server = httpmock::MockServer::start();
        let mock = server.mock(|when, then| {
            when.method(httpmock::Method::POST);
            then.status(200)
                .header("content-type", "application/json")
                .body(r#"{"candidates": [{"content": {"parts": [{"text": "Google mock transcript."}]}}]}"#);
        });

        std::env::set_var("MOCK_GOOGLE_TX_URL", server.url("/"));

        let res = transcribe_cloud(
            "google".to_string(),
            path,
            "key".to_string(),
            "".to_string(),
            "".to_string(),
            "".to_string(),
        ).await;

        std::env::remove_var("MOCK_GOOGLE_TX_URL");

        assert!(res.is_ok());
        assert_eq!(res.unwrap(), "Google mock transcript.");
        mock.assert();
    }
}
