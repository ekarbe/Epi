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
use tauri::{AppHandle, Emitter};

static HTTP_CLIENT: OnceLock<Client> = OnceLock::new();
static STREAMING_CLIENT: OnceLock<Client> = OnceLock::new();

/// Name of the event emitted while an Ollama model is being pulled.
pub const PULL_PROGRESS_EVENT: &str = "ollama-pull-progress";

/// Returns a shared, lazily-initialized HTTP client with configured connection pooling and timeout.
fn get_client() -> &'static Client {
    HTTP_CLIENT.get_or_init(|| {
        Client::builder()
            .timeout(Duration::from_secs(300)) // 5 minutes for local inference default
            .build()
            .unwrap_or_else(|_| Client::new())
    })
}

/// Returns a shared HTTP client for long-running streaming requests (model pulls).
///
/// Unlike [`get_client`], it has no total request timeout, because pulling a large model
/// can legitimately take far longer than five minutes. Instead it fails if the connection
/// cannot be established or if the server stops sending data for too long.
fn get_streaming_client() -> &'static Client {
    STREAMING_CLIENT.get_or_init(|| {
        Client::builder()
            .connect_timeout(Duration::from_secs(10))
            .read_timeout(Duration::from_secs(300))
            .build()
            .unwrap_or_else(|_| Client::new())
    })
}

/// Normalizes a user-supplied Ollama base URL by stripping trailing slashes.
fn clean_ollama_url(ollama_url: &str) -> &str {
    ollama_url.trim_end_matches('/')
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
    let clean_url = clean_ollama_url(&ollama_url);

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
    num_predict: Option<i32>,
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
    num_predict: Option<i32>,
    top_p: Option<f64>,
    top_k: Option<u32>,
    timeout_ms: Option<u64>,
    log_path: Option<String>,
) -> Result<String, String> {
    let client = get_client();
    let clean_url = clean_ollama_url(&ollama_url);
    let prompt = prompt_template.replace("{{transcript}}", &transcript);

    let body = OllamaGenerateRequest {
        model,
        prompt,
        system,
        stream: false,
        options: OllamaOptions {
            temperature,
            num_ctx,
            num_predict,
            top_p,
            top_k,
        },
    };

    let timeout = timeout_ms.unwrap_or(300000);

    if let Some(path) = &log_path {
        if let Ok(mut f) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)
        {
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
            if let Ok(mut f) = std::fs::OpenOptions::new()
                .create(true)
                .append(true)
                .open(path)
            {
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
        if let Ok(mut f) = std::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(path)
        {
            use std::io::Write;
            let _ = writeln!(f, "--- LLM RESPONSE ---");
            let _ = f.write_all(body_text.as_bytes());
            let _ = writeln!(f, "\n-------------------\n");
        }
    }

    parse_ollama_generate_response(&body_text)
}

/// Performs a minimal sanity check on an Ollama model name before it is sent to the server.
///
/// Ollama names look like `llama3`, `llama3.2:3b` or `hf.co/user/repo:Q4_K_M`, so only
/// empty names, overly long names and names containing whitespace or control characters
/// are rejected.
pub fn validate_model_name(model_name: &str) -> Result<(), String> {
    if model_name.is_empty() {
        return Err("Model name must not be empty.".to_string());
    }
    if model_name.len() > 256 {
        return Err("Model name is too long.".to_string());
    }
    if model_name
        .chars()
        .any(|c| c.is_whitespace() || c.is_control())
    {
        return Err(format!("Invalid model name: {:?}", model_name));
    }
    Ok(())
}

/// Progress payload emitted on [`PULL_PROGRESS_EVENT`] while a model is being pulled.
#[derive(serde::Serialize, Clone, Debug, PartialEq)]
pub struct PullProgress {
    /// The model being pulled, so listeners can ignore events for other pulls.
    pub model: String,
    /// Download percentage (0-100), if the current status line reports one.
    pub percent: Option<u8>,
    /// The raw status string reported by Ollama (e.g. "pulling manifest", "success").
    pub status: String,
}

#[derive(serde::Deserialize)]
struct OllamaPullLine {
    status: Option<String>,
    total: Option<u64>,
    completed: Option<u64>,
    error: Option<String>,
}

/// Parses a single NDJSON line of Ollama's `/api/pull` stream.
///
/// Returns `Ok(None)` for blank lines, `Ok(Some(progress))` for status lines and
/// `Err(message)` if Ollama reported an error or the line is not valid JSON.
pub fn parse_pull_line(model: &str, line: &str) -> Result<Option<PullProgress>, String> {
    let line = line.trim();
    if line.is_empty() {
        return Ok(None);
    }
    let data: OllamaPullLine = serde_json::from_str(line)
        .map_err(|e| format!("Invalid pull response from Ollama: {}", e))?;

    if let Some(err) = data.error {
        return Err(err);
    }

    let status = data.status.unwrap_or_default();
    let percent = if status == "success" {
        Some(100)
    } else {
        match (data.total, data.completed) {
            (Some(total), Some(completed)) if total > 0 => {
                Some(((completed.min(total) as f64 / total as f64) * 100.0).floor() as u8)
            }
            _ => None,
        }
    };

    Ok(Some(PullProgress {
        model: model.to_string(),
        percent,
        status,
    }))
}

/// Pulls a model from an Ollama server, calling `on_progress` for every status line.
///
/// Resolves once Ollama reports `success`, and fails if the request fails, Ollama
/// reports an error, or the stream ends without a `success` status.
async fn pull_model_with_progress<F>(
    ollama_url: &str,
    model_name: &str,
    mut on_progress: F,
) -> Result<(), String>
where
    F: FnMut(PullProgress),
{
    validate_model_name(model_name)?;
    let clean_url = clean_ollama_url(ollama_url);

    let mut res = get_streaming_client()
        .post(format!("{}/api/pull", clean_url))
        .json(&serde_json::json!({ "name": model_name, "stream": true }))
        .send()
        .await
        .map_err(|e| format!("Failed to connect to Ollama at {}: {}", clean_url, e))?;

    if !res.status().is_success() {
        let status = res.status();
        let err_text = res.text().await.unwrap_or_default();
        let detail = parse_pull_line(model_name, &err_text)
            .err()
            .unwrap_or(err_text);
        return Err(format!("Ollama returned status {}: {}", status, detail));
    }

    let mut buffer: Vec<u8> = Vec::new();
    let mut succeeded = false;
    let mut handle_line = |line: &[u8], succeeded: &mut bool| -> Result<(), String> {
        let line = String::from_utf8_lossy(line);
        if let Some(progress) = parse_pull_line(model_name, &line)? {
            if progress.status == "success" {
                *succeeded = true;
            }
            on_progress(progress);
        }
        Ok(())
    };

    while let Some(chunk) = res
        .chunk()
        .await
        .map_err(|e| format!("Error while pulling model: {}", e))?
    {
        buffer.extend_from_slice(&chunk);
        while let Some(pos) = buffer.iter().position(|&b| b == b'\n') {
            let line: Vec<u8> = buffer.drain(..=pos).collect();
            handle_line(&line, &mut succeeded)?;
        }
    }
    if !buffer.is_empty() {
        handle_line(&buffer, &mut succeeded)?;
    }

    if succeeded {
        Ok(())
    } else {
        Err("Ollama ended the pull without reporting success.".to_string())
    }
}

/// Pulls a model through the Ollama server at `ollama_url`, emitting
/// [`PULL_PROGRESS_EVENT`] events with a [`PullProgress`] payload while downloading.
#[tauri::command]
pub async fn pull_ollama_model(
    app: AppHandle,
    ollama_url: String,
    model_name: String,
) -> Result<(), String> {
    pull_model_with_progress(&ollama_url, &model_name, |progress| {
        let _ = app.emit(PULL_PROGRESS_EVENT, progress);
    })
    .await
}

/// Deletes a model from the Ollama server at `ollama_url`.
#[tauri::command]
pub async fn delete_ollama_model(ollama_url: String, model_name: String) -> Result<(), String> {
    validate_model_name(&model_name)?;
    let clean_url = clean_ollama_url(&ollama_url);

    let res = get_client()
        .delete(format!("{}/api/delete", clean_url))
        .timeout(Duration::from_secs(30))
        .json(&serde_json::json!({ "name": model_name }))
        .send()
        .await
        .map_err(|e| format!("Failed to connect to Ollama at {}: {}", clean_url, e))?;

    if !res.status().is_success() {
        let status = res.status();
        let err_text = res.text().await.unwrap_or_default();
        let detail = parse_pull_line(&model_name, &err_text)
            .err()
            .unwrap_or(err_text);
        return Err(format!("Ollama returned status {}: {}", status, detail));
    }
    Ok(())
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
            when.method(httpmock::Method::GET).path("/api/tags");
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
            when.method(httpmock::Method::POST).path("/api/generate");
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
            None,
        )
        .await;

        assert!(res.is_ok());
        assert_eq!(res.unwrap(), "Local mock summary");
        mock.assert();
    }

    #[test]
    fn test_validate_model_name() {
        assert!(validate_model_name("llama3").is_ok());
        assert!(validate_model_name("hf.co/user/repo:Q4_K_M").is_ok());
        assert!(validate_model_name("").is_err());
        assert!(validate_model_name("llama 3").is_err());
        assert!(validate_model_name("llama3\n").is_err());
        assert!(validate_model_name(&"a".repeat(257)).is_err());
    }

    #[test]
    fn test_parse_pull_line() {
        assert_eq!(parse_pull_line("m", "   ").unwrap(), None);

        let manifest = parse_pull_line("m", r#"{"status":"pulling manifest"}"#)
            .unwrap()
            .unwrap();
        assert_eq!(
            manifest,
            PullProgress {
                model: "m".into(),
                percent: None,
                status: "pulling manifest".into()
            }
        );

        let half = parse_pull_line(
            "m",
            r#"{"status":"pulling abc","digest":"abc","total":200,"completed":100}"#,
        )
        .unwrap()
        .unwrap();
        assert_eq!(half.percent, Some(50));

        let zero_total =
            parse_pull_line("m", r#"{"status":"pulling abc","total":0,"completed":0}"#)
                .unwrap()
                .unwrap();
        assert_eq!(zero_total.percent, None);

        let done = parse_pull_line("m", r#"{"status":"success"}"#)
            .unwrap()
            .unwrap();
        assert_eq!(done.percent, Some(100));

        assert_eq!(
            parse_pull_line(
                "m",
                r#"{"error":"pull model manifest: file does not exist"}"#
            )
            .unwrap_err(),
            "pull model manifest: file does not exist"
        );
        assert!(parse_pull_line("m", "not json").is_err());
    }

    #[tokio::test]
    async fn test_pull_model_reports_progress() {
        let server = httpmock::MockServer::start();
        let mock = server.mock(|when, then| {
            when.method(httpmock::Method::POST)
                .path("/api/pull")
                .json_body_partial(r#"{"name": "llama3"}"#);
            then.status(200)
                .header("content-type", "application/x-ndjson")
                .body(concat!(
                    "{\"status\":\"pulling manifest\"}\n",
                    "{\"status\":\"pulling abc\",\"total\":100,\"completed\":25}\n",
                    "{\"status\":\"pulling abc\",\"total\":100,\"completed\":100}\n",
                    "{\"status\":\"verifying sha256 digest\"}\n",
                    "{\"status\":\"success\"}"
                ));
        });

        let mut events = Vec::new();
        let res = pull_model_with_progress(&server.url("/"), "llama3", |p| events.push(p)).await;
        assert!(res.is_ok(), "{:?}", res);
        mock.assert();

        let percents: Vec<Option<u8>> = events.iter().map(|p| p.percent).collect();
        assert_eq!(percents, vec![None, Some(25), Some(100), None, Some(100)]);
        assert!(events.iter().all(|p| p.model == "llama3"));
        assert_eq!(events.last().unwrap().status, "success");
    }

    #[tokio::test]
    async fn test_pull_model_stream_error() {
        let server = httpmock::MockServer::start();
        server.mock(|when, then| {
            when.method(httpmock::Method::POST).path("/api/pull");
            then.status(200).body(concat!(
                "{\"status\":\"pulling manifest\"}\n",
                "{\"error\":\"pull model manifest: file does not exist\"}\n"
            ));
        });

        let mut events = Vec::new();
        let res = pull_model_with_progress(&server.url("/"), "nope", |p| events.push(p)).await;
        assert_eq!(res.unwrap_err(), "pull model manifest: file does not exist");
        assert_eq!(events.len(), 1);
    }

    #[tokio::test]
    async fn test_pull_model_http_error_and_missing_success() {
        let server = httpmock::MockServer::start();
        server.mock(|when, then| {
            when.method(httpmock::Method::POST)
                .path("/api/pull")
                .json_body_partial(r#"{"name": "bad"}"#);
            then.status(500).body(r#"{"error":"something broke"}"#);
        });
        server.mock(|when, then| {
            when.method(httpmock::Method::POST)
                .path("/api/pull")
                .json_body_partial(r#"{"name": "cut"}"#);
            then.status(200).body("{\"status\":\"pulling manifest\"}\n");
        });

        let err = pull_model_with_progress(&server.url("/"), "bad", |_| {})
            .await
            .unwrap_err();
        assert!(
            err.contains("500") && err.contains("something broke"),
            "{}",
            err
        );

        let err = pull_model_with_progress(&server.url("/"), "cut", |_| {})
            .await
            .unwrap_err();
        assert!(err.contains("without reporting success"), "{}", err);
    }

    #[tokio::test]
    async fn test_pull_model_rejects_invalid_name() {
        let res = pull_model_with_progress("http://127.0.0.1:9", "bad name", |_| {}).await;
        assert!(res.unwrap_err().contains("Invalid model name"));
    }

    #[tokio::test]
    async fn test_delete_ollama_model() {
        let server = httpmock::MockServer::start();
        let ok = server.mock(|when, then| {
            when.method(httpmock::Method::DELETE)
                .path("/api/delete")
                .json_body_partial(r#"{"name": "llama3"}"#);
            then.status(200);
        });
        let missing = server.mock(|when, then| {
            when.method(httpmock::Method::DELETE)
                .path("/api/delete")
                .json_body_partial(r#"{"name": "ghost"}"#);
            then.status(404)
                .body(r#"{"error":"model 'ghost' not found"}"#);
        });

        assert!(delete_ollama_model(server.url("/"), "llama3".into())
            .await
            .is_ok());
        ok.assert();

        let err = delete_ollama_model(server.url("/"), "ghost".into())
            .await
            .unwrap_err();
        assert!(
            err.contains("404") && err.contains("model 'ghost' not found"),
            "{}",
            err
        );
        missing.assert();

        assert!(delete_ollama_model(server.url("/"), "".into())
            .await
            .is_err());
    }
}
