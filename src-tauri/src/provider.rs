use async_trait::async_trait;
use serde_json::Value;

#[async_trait]
pub trait ProviderClient: Send + Sync {
    async fn get_available_models(&self) -> Result<Vec<String>, String>;
    fn abort(&self);
    async fn chat_stream(
        &self,
        model: &str,
        messages: Vec<Value>,
        tools: Option<Vec<Value>>,
        chunk_callback: Box<dyn Fn(String) + Send + Sync + 'static>,
    ) -> Result<(String, Vec<Value>), String>;
}

// Implementations for specific providers live here. We provide a blanket impl in the
// `ollama` module (implemented there) which satisfies this trait.
