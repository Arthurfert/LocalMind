use async_trait::async_trait;
use crate::provider::ProviderClient;
use futures_util::StreamExt;
use reqwest::Client;
use serde_json::Value;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

#[derive(Clone)]
pub struct OpenApiClient {
    base_url: String,
    models_path: String,
    chat_path: String,
    client: Client,
    pub is_aborted: Arc<AtomicBool>,
}

impl OpenApiClient {
    pub fn new(base_url: &str, models_path: &str, chat_path: &str) -> Self {
        Self {
            base_url: base_url.trim_end_matches('/').to_string(),
            models_path: models_path.to_string(),
            chat_path: chat_path.to_string(),
            client: Client::new(),
            is_aborted: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn abort(&self) {
        self.is_aborted.store(true, Ordering::SeqCst);
    }

    fn join_url(&self, path: &str) -> String {
        let clean = path.trim();
        if clean.is_empty() {
            return self.base_url.clone();
        }
        if clean.starts_with('/') {
            format!("{}{}", self.base_url, clean)
        } else {
            format!("{}/{}", self.base_url, clean)
        }
    }

    async fn fetch_models_generic(&self) -> Result<Vec<String>, String> {
        // Try a couple common endpoints
        let mut candidates = Vec::new();
        if !self.models_path.trim().is_empty() {
            candidates.push(self.join_url(&self.models_path));
        }
        candidates.push(self.join_url("/v1/models"));
        candidates.push(self.join_url("/models"));

        for url in candidates {
            let resp = self.client.get(&url).send().await;
            if let Ok(r) = resp {
                if !r.status().is_success() {
                    continue;
                }
                if let Ok(json) = r.json::<Value>().await {
                    // OpenAI-style: { data: [{ id: "..."}, ... ] }
                    if let Some(arr) = json.get("data").and_then(|d| d.as_array()) {
                        let mut out = Vec::new();
                        for item in arr {
                            if let Some(id) = item.get("id").and_then(|v| v.as_str()) {
                                out.push(id.to_string());
                            }
                        }
                        if !out.is_empty() { return Ok(out); }
                    }

                    // Ollama-style: { models: [{ name: "..."}, ... ] }
                    if let Some(arr) = json.get("models").and_then(|m| m.as_array()) {
                        let mut out = Vec::new();
                        for item in arr {
                            if let Some(name) = item.get("name").and_then(|v| v.as_str()) {
                                out.push(name.to_string());
                            }
                        }
                        if !out.is_empty() { return Ok(out); }
                    }
                }
            }
        }

        Err("Aucun modèle trouvé via les endpoints connus".to_string())
    }
}

#[async_trait]
impl ProviderClient for OpenApiClient {
    async fn get_available_models(&self) -> Result<Vec<String>, String> {
        self.fetch_models_generic().await
    }

    fn abort(&self) {
        OpenApiClient::abort(self)
    }

    async fn chat_stream(
        &self,
        model: &str,
        messages: Vec<Value>,
        _tools: Option<Vec<Value>>,
        chunk_callback: Box<dyn Fn(String) + Send + Sync + 'static>,
    ) -> Result<(String, Vec<Value>), String> {
        // Build a generic payload compatible with many OpenAPI-like providers
        let payload = serde_json::json!({
            "model": model,
            "messages": messages,
            "stream": true
        });

        let url = self.join_url(&self.chat_path);
        let resp = self.client.post(&url).json(&payload).send().await.map_err(|e| format!("Erreur requête: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("Erreur API OpenAPI: {}", resp.status()));
        }

        let mut full_response = String::new();
        let mut tool_calls = Vec::new();
        let mut stream = resp.bytes_stream();

        while let Some(item) = stream.next().await {
            if self.is_aborted.load(Ordering::SeqCst) {
                break;
            }

            match item {
                Ok(bytes) => {
                    if let Ok(text) = std::str::from_utf8(&bytes) {
                        for line in text.lines().filter(|l| !l.is_empty()) {
                            // Skip SSE done markers
                            if line.trim().starts_with("data: [DONE]") || line.trim() == "[DONE]" { break; }

                            // Try to parse JSON payloads
                            let line = line.trim_start_matches("data: ");
                            if let Ok(json) = serde_json::from_str::<Value>(line) {
                                // OpenAI streaming chunk: { choices: [{ delta: { content: "..." } }] }
                                if let Some(choices) = json.get("choices").and_then(|c| c.as_array()) {
                                    if let Some(first) = choices.get(0) {
                                        if let Some(delta) = first.get("delta") {
                                            if let Some(content) = delta.get("content").and_then(|c| c.as_str()) {
                                                full_response.push_str(content);
                                                (chunk_callback)(content.to_string());
                                                continue;
                                            }
                                        }
                                        if let Some(text) = first.get("text").and_then(|t| t.as_str()) {
                                            full_response.push_str(text);
                                            (chunk_callback)(text.to_string());
                                            continue;
                                        }
                                    }
                                }

                                // Ollama-style: { message: { content: "..." } }
                                if let Some(msg) = json.get("message") {
                                    if let Some(content) = msg.get("content").and_then(|c| c.as_str()) {
                                        full_response.push_str(content);
                                        (chunk_callback)(content.to_string());
                                        if let Some(tc) = msg.get("tool_calls").and_then(|t| t.as_array()) {
                                            tool_calls.extend(tc.clone());
                                        }
                                        continue;
                                    }
                                }
                            } else {
                                // Fallback: treat raw text as content
                                full_response.push_str(line);
                                (chunk_callback)(line.to_string());
                            }
                        }
                    }
                }
                Err(e) => { return Err(format!("Erreur stream: {}", e)); }
            }
        }

        Ok((full_response, tool_calls))
    }
}
