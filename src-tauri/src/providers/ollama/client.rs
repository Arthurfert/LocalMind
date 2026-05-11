use futures_util::StreamExt;
use reqwest::Client;
use serde::Serialize;
use serde_json::Value;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use async_trait::async_trait;
use crate::provider::ProviderClient;

pub const SYSTEM_PROMPT_TEMPLATE: &str = include_str!("system-prompt.md");

#[derive(Clone)]
pub struct OllamaClient {
    base_url: String,
    client: Client,
    pub is_aborted: Arc<AtomicBool>,
}

#[derive(Serialize)]
struct ChatPayload {
    model: String,
    messages: Vec<Value>,
    stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    tools: Option<Vec<Value>>,
}

impl OllamaClient {
    pub fn new(base_url: &str) -> Self {
        Self {
            base_url: base_url.to_string(),
            client: Client::new(),
            is_aborted: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn abort(&self) {
        self.is_aborted.store(true, Ordering::SeqCst);
    }

    pub async fn get_available_models(&self) -> Result<Vec<String>, String> {
        let url = format!("{}/api/tags", self.base_url);
        let resp = self
            .client
            .get(&url)
            .timeout(std::time::Duration::from_secs(5))
            .send()
            .await
            .map_err(|e| format!("Erreur réseau: {}", e))?;

        if !resp.status().is_success() {
            return Err(format!("Erreur HTTP: {}", resp.status()));
        }

        let json: Value = resp.json().await.map_err(|e| e.to_string())?;

        let mut models = Vec::new();
        if let Some(models_array) = json["models"].as_array() {
            for m in models_array {
                if let Some(name) = m["name"].as_str() {
                    models.push(name.to_string());
                }
            }
        }

        Ok(models)
    }

    pub async fn chat_stream(
        &self,
        model: &str,
        mut messages: Vec<Value>,
        tools: Option<Vec<Value>>,
        chunk_callback: Box<dyn Fn(String) + Send + Sync + 'static>,
    ) -> Result<(String, Vec<Value>), String>
    {
        // Construction du message système et ajout en première position
        let current_date = chrono::Local::now().format("%Y-%m-%d").to_string();
        let mut system_prompt = SYSTEM_PROMPT_TEMPLATE
            .replace("{model_name}", model)
            .replace("{current_date}", &current_date);

        if let Some(ref t) = tools {
            let tools_json = serde_json::to_string_pretty(t).unwrap_or_default();
            system_prompt = system_prompt.replace(
                "{tools_info}",
                &tools_json
            );
        } else {
            system_prompt = system_prompt.replace("{tools_info}", "None");
        }

        messages.insert(
            0,
            serde_json::json!({
                "role": "system",
                "content": system_prompt
            }),
        );

        self.is_aborted.store(false, Ordering::SeqCst);

        let payload = ChatPayload {
            model: model.to_string(),
            messages,
            stream: true,
            tools,
        };

        let url = format!("{}/api/chat", self.base_url);
        let response = self
            .client
            .post(&url)
            .json(&payload)
            .send()
            .await
            .map_err(|e| format!("Erreur lors de la requête chat: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("Erreur API Ollama: {}", response.status()));
        }

        let mut full_response = String::new();
        let mut tool_calls = Vec::new();
        let mut stream = response.bytes_stream();

        while let Some(item) = stream.next().await {
            if self.is_aborted.load(Ordering::SeqCst) {
                println!("Génération annulée.");
                break;
            }

            match item {
                Ok(bytes) => {
                    if let Ok(text) = std::str::from_utf8(&bytes) {
                        for line in text.lines().filter(|l| !l.is_empty()) {
                            if let Ok(json) = serde_json::from_str::<Value>(line) {
                                if let Some(msg) = json.get("message") {
                                    if let Some(chunk) = msg.get("content").and_then(|c| c.as_str())
                                    {
                                        full_response.push_str(chunk);
                                        (chunk_callback)(chunk.to_string());
                                    }
                                    if let Some(tc) =
                                        msg.get("tool_calls").and_then(|t| t.as_array())
                                    {
                                        tool_calls.extend(tc.clone());
                                    }
                                }
                            }
                        }
                    }
                }
                Err(e) => {
                    println!("Erreur lors de la lecture du stream: {}", e);
                    break;
                }
            }
        }

        Ok((full_response, tool_calls))
    }
}

#[async_trait]
impl ProviderClient for OllamaClient {
    async fn get_available_models(&self) -> Result<Vec<String>, String> {
        OllamaClient::get_available_models(self).await
    }

    fn abort(&self) {
        OllamaClient::abort(self)
    }

    async fn chat_stream(
        &self,
        model: &str,
        messages: Vec<Value>,
        tools: Option<Vec<Value>>,
        chunk_callback: Box<dyn Fn(String) + Send + Sync + 'static>,
    ) -> Result<(String, Vec<Value>), String> {
        OllamaClient::chat_stream(self, model, messages, tools, chunk_callback).await
    }
}
