use async_trait::async_trait;
use crate::provider::ProviderClient;
use futures_util::StreamExt;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use reqwest::{Client, RequestBuilder};
use serde_json::Value;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum ProviderKind {
    OpenApiCompatible,
    OpenAi,
    Anthropic,
}

impl ProviderKind {
    fn from_str(value: &str) -> Self {
        match value.to_lowercase().as_str() {
            "openai" => Self::OpenAi,
            "anthropic" => Self::Anthropic,
            _ => Self::OpenApiCompatible,
        }
    }

    fn default_base_url(self) -> &'static str {
        match self {
            Self::OpenAi => "https://api.openai.com",
            Self::Anthropic => "https://api.anthropic.com",
            Self::OpenApiCompatible => "http://localhost:11434",
        }
    }

    fn default_models_path(self) -> &'static str {
        "/v1/models"
    }

    fn default_chat_path(self) -> &'static str {
        match self {
            Self::Anthropic => "/v1/messages",
            Self::OpenAi | Self::OpenApiCompatible => "/v1/chat/completions",
        }
    }

    fn default_auth_mode(self) -> &'static str {
        match self {
            Self::Anthropic => "x-api-key",
            Self::OpenAi => "bearer",
            Self::OpenApiCompatible => "none",
        }
    }
}

#[derive(Clone)]
pub struct OpenApiClient {
    provider: ProviderKind,
    base_url: String,
    models_path: String,
    chat_path: String,
    auth_mode: String,
    api_key: Option<String>,
    client: Client,
    pub is_aborted: Arc<AtomicBool>,
}

impl OpenApiClient {
    pub fn from_settings(settings: &Value) -> Self {
        let provider_settings = settings
            .get("providers")
            .and_then(|p| p.as_array())
            .and_then(|providers| providers.first())
            .cloned()
            .unwrap_or_else(|| settings.clone());

        let provider = provider_settings
            .get("provider")
            .and_then(|v| v.as_str())
            .map(ProviderKind::from_str)
            .unwrap_or(ProviderKind::OpenApiCompatible);

        let base_url = provider_settings
            .get("base_url")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| provider.default_base_url().to_string());

        let models_path = provider_settings
            .get("models_path")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| provider.default_models_path().to_string());

        let chat_path = provider_settings
            .get("chat_path")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| provider.default_chat_path().to_string());

        let auth_mode = provider_settings
            .get("auth_mode")
            .and_then(|v| v.as_str())
            .map(|s| s.to_lowercase())
            .unwrap_or_else(|| provider.default_auth_mode().to_string());

        let api_key = provider_settings
            .get("api_key")
            .and_then(|v| v.as_str())
            .map(|s| s.trim().to_string())
            .filter(|value| !value.is_empty());

        let mut headers = HeaderMap::new();
        if provider == ProviderKind::Anthropic {
            headers.insert(
                HeaderName::from_static("anthropic-version"),
                HeaderValue::from_static("2023-06-01"),
            );
        }

        let client = Client::builder()
            .default_headers(headers)
            .build()
            .unwrap_or_else(|_| Client::new());

        Self {
            provider,
            base_url: base_url.trim_end_matches('/').to_string(),
            models_path,
            chat_path,
            auth_mode,
            api_key,
            client,
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

    fn auth_request(&self, request: RequestBuilder) -> RequestBuilder {
        let token = match &self.api_key {
            Some(value) if !value.is_empty() => value.as_str(),
            _ => return request,
        };

        match self.auth_mode.as_str() {
            "bearer" | "oauth" => request.bearer_auth(token),
            "x-api-key" => request.header("x-api-key", token),
            mode if mode.starts_with("header:") => {
                let header_name = mode.trim_start_matches("header:").trim();
                if header_name.is_empty() {
                    request
                } else {
                    match HeaderName::from_bytes(header_name.as_bytes()) {
                        Ok(name) => request.header(name, token),
                        Err(_) => request,
                    }
                }
            }
            _ => request,
        }
    }

    async fn fetch_models_generic(&self) -> Result<Vec<String>, String> {
        let mut candidates = Vec::new();
        if !self.models_path.trim().is_empty() {
            candidates.push(self.join_url(&self.models_path));
        }
        candidates.push(self.join_url("/v1/models"));
        candidates.push(self.join_url("/models"));

        for url in candidates {
            let request = self.auth_request(self.client.get(&url));
            let resp = request.send().await;
            if let Ok(r) = resp {
                if !r.status().is_success() {
                    continue;
                }
                if let Ok(json) = r.json::<Value>().await {
                    if let Some(arr) = json.get("data").and_then(|d| d.as_array()) {
                        let mut out = Vec::new();
                        for item in arr {
                            if let Some(id) = item.get("id").and_then(|v| v.as_str()) {
                                out.push(id.to_string());
                            }
                        }
                        if !out.is_empty() {
                            return Ok(out);
                        }
                    }

                    if let Some(arr) = json.get("models").and_then(|m| m.as_array()) {
                        let mut out = Vec::new();
                        for item in arr {
                            if let Some(name) = item.get("name").and_then(|v| v.as_str()) {
                                out.push(name.to_string());
                            }
                        }
                        if !out.is_empty() {
                            return Ok(out);
                        }
                    }
                }
            }
        }

        Err("Aucun modèle trouvé via les endpoints connus".to_string())
    }

    fn to_anthropic_messages(&self, messages: Vec<Value>) -> (Option<String>, Vec<Value>) {
        let mut system_parts = Vec::new();
        let mut anthropic_messages = Vec::new();

        for message in messages {
            let role = message.get("role").and_then(|v| v.as_str()).unwrap_or("");
            let content = message.get("content");
            let content_text = match content {
                Some(Value::String(text)) => text.clone(),
                Some(value) => serde_json::to_string(value).unwrap_or_default(),
                None => String::new(),
            };

            match role {
                "system" => {
                    if !content_text.trim().is_empty() {
                        system_parts.push(content_text);
                    }
                }
                "user" | "assistant" => {
                    anthropic_messages.push(serde_json::json!({
                        "role": role,
                        "content": content_text,
                    }));
                }
                "tool" => {
                    if !content_text.trim().is_empty() {
                        let tool_name = message.get("name").and_then(|v| v.as_str()).unwrap_or("outil");
                        anthropic_messages.push(serde_json::json!({
                            "role": "user",
                            "content": format!("Résultat de l'outil {}: {}", tool_name, content_text),
                        }));
                    }
                }
                _ => {}
            }
        }

        let system = if system_parts.is_empty() {
            None
        } else {
            Some(system_parts.join("\n\n"))
        };

        (system, anthropic_messages)
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
        let (payload, url) = if self.provider == ProviderKind::Anthropic {
            let (system, anthropic_messages) = self.to_anthropic_messages(messages);
            let mut payload = serde_json::json!({
                "model": model,
                "max_tokens": 4096,
                "messages": anthropic_messages,
                "stream": true
            });
            if let Some(system_text) = system {
                payload["system"] = Value::String(system_text);
            }
            (payload, self.join_url(&self.chat_path))
        } else {
            (
                serde_json::json!({
                    "model": model,
                    "messages": messages,
                    "stream": true
                }),
                self.join_url(&self.chat_path),
            )
        };

        let request = self.auth_request(self.client.post(&url)).json(&payload);
        let resp = request
            .send()
            .await
            .map_err(|e| format!("Erreur requête: {}", e))?;

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
                        for line in text.lines().filter(|line| !line.is_empty()) {
                            let trimmed = line.trim();
                            if trimmed.starts_with("data: [DONE]") || trimmed == "[DONE]" {
                                break;
                            }

                            let line = trimmed.strip_prefix("data: ").unwrap_or(trimmed);
                            if let Ok(json) = serde_json::from_str::<Value>(line) {
                                if self.provider == ProviderKind::Anthropic {
                                    if let Some(delta) = json.get("delta") {
                                        if let Some(content) = delta.get("text").and_then(|v| v.as_str()) {
                                            full_response.push_str(content);
                                            (chunk_callback)(content.to_string());
                                            continue;
                                        }
                                    }
                                    if let Some(content) = json.get("content").and_then(|v| v.as_str()) {
                                        full_response.push_str(content);
                                        (chunk_callback)(content.to_string());
                                        continue;
                                    }
                                } else {
                                    if let Some(choices) = json.get("choices").and_then(|c| c.as_array()) {
                                        if let Some(first) = choices.first() {
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
                                }
                            } else if !line.is_empty() {
                                full_response.push_str(line);
                                (chunk_callback)(line.to_string());
                            }
                        }
                    }
                }
                Err(e) => {
                    return Err(format!("Erreur stream: {}", e));
                }
            }
        }

        Ok((full_response, tool_calls))
    }
}
