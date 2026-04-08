use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tokio::sync::Mutex;
use std::collections::HashMap;
use tauri::{AppHandle, Emitter, State, Manager};
use std::sync::atomic::{AtomicUsize, Ordering};

mod ollama;
use ollama::OllamaClient;
mod mcp;
use mcp::McpManager;

struct AppState {
    ollama_client: Mutex<OllamaClient>,
    mcp_manager: McpManager,
    pending_confirmations: Mutex<HashMap<usize, tokio::sync::oneshot::Sender<bool>>>,
}

static CONFIRMATION_ID: AtomicUsize = AtomicUsize::new(1);

const CHATS_DIR: &str = "chats";

// -- Paramètres (Settings.json) --
#[tauri::command]
fn get_settings() -> Value {
    let path = Path::new("Settings.json");
    if path.exists() {
        if let Ok(content) = fs::read_to_string(path) {
            if let Ok(json) = serde_json::from_str(&content) {
                return json;
            }
        }
    }
    serde_json::json!({})
}

#[tauri::command]
fn save_settings(settings: Value) -> bool {
    let path = Path::new("Settings.json");
    match serde_json::to_string_pretty(&settings) {
        Ok(json_str) => match fs::write(path, json_str) {
            Ok(_) => true,
            Err(_) => false,
        },
        Err(_) => false,
    }
}

// -- Gestion des discussions --
#[derive(Serialize, Deserialize)]
struct ChatInfo {
    id: String,
    title: String,
    date: u64,
    model: String,
}

#[tauri::command]
fn get_chats() -> Vec<ChatInfo> {
    let mut chats = Vec::new();
    let path = Path::new(CHATS_DIR);
    
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            let file_path = entry.path();
            if file_path.extension().and_then(|e| e.to_str()) == Some("json") {
                if let Ok(content) = fs::read_to_string(&file_path) {
                    if let Ok(json) = serde_json::from_str::<Value>(&content) {
                        let id = json["id"].as_str().unwrap_or("").to_string();
                        let default_id = file_path.file_stem().unwrap().to_str().unwrap().to_string();
                        
                        chats.push(ChatInfo {
                            id: if id.is_empty() { default_id } else { id },
                            title: json["title"].as_str().unwrap_or("Nouvelle discussion").to_string(),
                            date: json["date"].as_u64().unwrap_or(0),
                            model: json["model"].as_str().unwrap_or("").to_string(),
                        });
                    }
                }
            }
        }
    }
    // Trier par date décroissante
    chats.sort_by(|a, b| b.date.cmp(&a.date));
    chats
}

#[tauri::command]
fn load_chat(chat_id: String) -> Value {
    let path_str = format!("{}/{}.json", CHATS_DIR, chat_id);
    if let Ok(content) = fs::read_to_string(path_str) {
        if let Ok(json) = serde_json::from_str(&content) {
            return json;
        }
    }
    serde_json::json!({})
}

#[tauri::command]
fn save_chat(chat_id: Option<String>, title: String, messages: Value, model: String) -> String {
    let _ = fs::create_dir_all(CHATS_DIR);
    
    // Génère un ID (timestamp en ms) si chat_id est vide ou None
    let id = match chat_id {
        Some(ref val) if !val.is_empty() => val.clone(),
        _ => SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis().to_string(),
    };

    let now_sec = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis() as u64;

    let chat_json = serde_json::json!({
        "id": id,
        "title": title,
        "date": now_sec,
        "model": model,
        "messages": messages
    });

    let filename = format!("{}/{}.json", CHATS_DIR, id);
    let _ = fs::write(filename, serde_json::to_string_pretty(&chat_json).unwrap_or_default());
    id
}

#[tauri::command]
fn delete_chat(chat_id: String) -> bool {
    let filename = format!("{}/{}.json", CHATS_DIR, chat_id);
    fs::remove_file(filename).is_ok()
}

#[tauri::command]
fn get_current_dir() -> String {
    match std::env::current_dir() {
        Ok(path) => path.to_string_lossy().into_owned(),
        Err(_) => String::from("Inconnu"),
    }
}

// -- API LLM & MCP --
#[tauri::command]
async fn get_models(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let client = state.ollama_client.lock().await;
    client.get_available_models().await
}

#[tauri::command]
async fn abort_generation(state: State<'_, AppState>) -> Result<(), ()> {
    let client = state.ollama_client.lock().await;
    client.abort();
    Ok(())
}

#[tauri::command]
async fn send_message(
    app: AppHandle,
    state: State<'_, AppState>,
    model: String,
    messages: Vec<Value>,
    _images: Option<Vec<String>> // not yet supported images mapping in Rust client but defined
) -> Result<(), String> {
    
    let client = state.ollama_client.lock().await.clone();
    let mcp = state.mcp_manager.clone();
    
    // Asynchronous call using tauri feature
    tauri::async_runtime::spawn(async move {
        // Stream listener closure
        let mut current_messages = messages;
        
        loop {
            // Retrieve tools enabled from MCP
            let (tools, tool_server_map) = mcp.list_all_tools().await;
            let tools_opt = if tools.is_empty() { None } else { Some(tools) };

            let app_clone = app.clone();
            let chunk_cb = move |chunk: String| {
                let _ = app_clone.emit("stream-chunk", chunk);
            };
            
            let result = client.chat_stream(&model, current_messages.clone(), tools_opt, chunk_cb).await;
            match result {
                Ok((full_text, tool_calls)) => {
                    if tool_calls.is_empty() {
                        let _ = app.emit("stream-end", ());
                        break;
                    } else {
                        // Append assistant response with tools
                        current_messages.push(serde_json::json!({
                            "role": "assistant",
                            "content": full_text,
                            "tool_calls": tool_calls
                        }));
                        
                        // Execute tools
                        for tc in tool_calls {
                            if let Some(func) = tc.get("function") {
                                let func_name = func.get("name").and_then(|n| n.as_str()).unwrap_or("");
                                let mut args = func.get("arguments").cloned().unwrap_or(serde_json::json!({}));
                                
                                if let Some(server_name) = tool_server_map.get(func_name) {
                                    println!("-> Appel fonction MCP: {} sur {}", func_name, server_name);
                                    let mut res = mcp.call_tool(server_name, func_name, args.clone()).await;
                                    
                                    // Gestion de la demande de confirmation
                                    if let Some(r) = &res {
                                        if let Some(demand) = r.get("confirmation_demand").and_then(|d| d.as_str()) {
                                            println!("-> Demande de confirmation reçue : {}", demand);
                                            let req_id = CONFIRMATION_ID.fetch_add(1, Ordering::SeqCst);
                                            let (tx, rx) = tokio::sync::oneshot::channel();
                                            
                                            // Ajout du sender dans l'état
                                            if let Some(s) = app.try_state::<AppState>() {
                                                let mut pending = s.pending_confirmations.lock().await;
                                                pending.insert(req_id, tx);
                                            }
                                            
                                            // Emit to frontend (id, tool_name, demand)
                                            let _ = app.emit("confirmation-demand", serde_json::json!({
                                                "id": req_id,
                                                "tool": func_name,
                                                "message": demand
                                            }));
                                            
                                            // Attendre la réponse
                                            if let Ok(confirmed) = rx.await {
                                                if confirmed {
                                                    println!("-> Confirmed by user.");
                                                    // Add auto-approve to the args or just a dummy field to signify it was approved by the UI
                                                    // Depending on specific MCP logic. Let's just run it again with `_auto_approve_by_user: true` (or the tool handles it implicitly).
                                                    // the user said "it is currently coded as an LLM response `confirmed`"
                                                    if let Some(obj) = args.as_object_mut() {
                                                        obj.insert("confirmed".to_string(), serde_json::json!(true));
                                                    }
                                                    // Recall tool
                                                    res = mcp.call_tool(server_name, func_name, args.clone()).await;
                                                } else {
                                                    println!("-> Refused by user.");
                                                    res = Some(serde_json::json!({
                                                        "content": [{"type": "text", "text": "L'utilisateur a refusé l'exécution de cet outil."}],
                                                        "isError": true
                                                    }));
                                                }
                                            }
                                        }
                                    }
                                    
                                    current_messages.push(serde_json::json!({
                                        "role": "tool",
                                        "name": func_name,
                                        "content": if let Some(r) = res {
                                            serde_json::to_string(&r).unwrap_or_else(|_| "{}".to_string())
                                        } else {
                                            "Error: Empty response".to_string()
                                        }
                                    }));
                                } else {
                                    current_messages.push(serde_json::json!({
                                        "role": "tool",
                                        "name": func_name,
                                        "content": format!("Erreur: Outil '{}' non reconnu.", func_name)
                                    }));
                                }
                            }
                        }
                    }
                }
                Err(e) => {
                    let _ = app.emit("stream-error", e);
                    break;
                }
            }
        }
    });

    Ok(())
}

#[tauri::command]
async fn resolve_confirmation(state: State<'_, AppState>, id: usize, confirmed: bool) -> Result<(), String> {
    let mut pending = state.pending_confirmations.lock().await;
    if let Some(tx) = pending.remove(&id) {
        let _ = tx.send(confirmed);
    }
    Ok(())
}

#[tauri::command]
async fn connect_mcp_server(state: State<'_, AppState>, name: String, mcp_type: String, target: String, auto_approve: bool) -> Result<bool, String> {
    println!("Init MCP Server: {} {} {} (auto_approve: {})", name, mcp_type, target, auto_approve);
    if mcp_type == "stdio" {
        state.mcp_manager.connect_stdio(name, target, auto_approve).await
    } else {
        println!("Support HTTP/SSE MCP non implémenté en Rust pour le moment.");
        Ok(false)
    }
}

// -- Configurations de Tauri --
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            ollama_client: Mutex::new(OllamaClient::new("http://localhost:11434")),
            mcp_manager: McpManager::new(),
            pending_confirmations: Mutex::new(HashMap::new()),
        })
                .setup(|app| {
            let state = app.try_state::<AppState>().unwrap();
            let settings = get_settings();
            let global_auto_approve = settings.get("mcp_auto_approve").and_then(|a| a.as_bool()).unwrap_or(false);
            if let Some(servers) = settings.get("mcp_servers").and_then(|s| s.as_array()) {
                for srv in servers {
                    if let (Some(name), Some(t), Some(target)) = (
                        srv.get("name").and_then(|n| n.as_str()),
                        srv.get("type").and_then(|n| n.as_str()),
                        srv.get("target").and_then(|n| n.as_str())
                    ) {
                        let name_c = name.to_string();
                        let t_c = t.to_string();
                        let target_c = target.to_string();
                        
                        let mcp_manager = state.mcp_manager.clone();
                        
                        tauri::async_runtime::spawn(async move {
                            println!("Auto-Init MCP Server: {} {} {} (auto_approve: {})", name_c, t_c, target_c, global_auto_approve);
                            if t_c == "stdio" {
                                let _ = mcp_manager.connect_stdio(name_c, target_c, global_auto_approve).await;
                            }
                        });
                    }
                }
            }
            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_settings,
            save_settings,
            get_chats,
            load_chat,
            save_chat,
            delete_chat,
            get_current_dir,
            get_models,
            abort_generation,
            send_message,
            connect_mcp_server,
            resolve_confirmation
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

