use serde_json::{json, Value};
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{ChildStdin, ChildStdout, Command};
use tokio::sync::Mutex;

pub struct McpServer {
    #[allow(dead_code)]
    pub server_type: String,
    pub stdin: Mutex<ChildStdin>,
    pub stdout: Mutex<BufReader<ChildStdout>>,
    msg_id: Mutex<u64>,
}

#[derive(Clone)]
pub struct McpManager {
    servers: Arc<Mutex<HashMap<String, Arc<McpServer>>>>,
}

impl McpManager {
    pub fn new() -> Self {
        Self {
            servers: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn connect_stdio(
        &self,
        name: String,
        command: String,
        auto_approve: bool,
    ) -> Result<bool, String> {
        let mut parts = command.split_whitespace();
        let program = parts.next().ok_or("Commande vide")?;
        let mut args: Vec<&str> = parts.collect();

        if auto_approve {
            args.push("--auto-approve");
        }

        let mut cmd = Command::new(program);
        cmd.args(args)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());

        #[cfg(target_os = "windows")]
        {
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            cmd.creation_flags(CREATE_NO_WINDOW);
        }

        let mut child = cmd
            .spawn()
            .map_err(|e| format!("Erreur au lancement du serveur {}: {}", name, e))?;

        let stdin = child.stdin.take().unwrap();
        let stdout = child.stdout.take().unwrap();
        let reader = BufReader::new(stdout);

        let server_arc = Arc::new(McpServer {
            server_type: "stdio".to_string(),
            stdin: Mutex::new(stdin),
            stdout: Mutex::new(reader),
            msg_id: Mutex::new(0),
        });

        // Envoi Initialize
        let init_req = json!({
            "jsonrpc": "2.0",
            "id": Self::next_id(&server_arc).await,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "localmind", "version": "1.0.0"}
            }
        });

        let res = Self::send_request(&server_arc, init_req).await;
        if res.is_some() {
            let notif = json!({"jsonrpc": "2.0", "method": "notifications/initialized"});
            {
                let mut stdin_lock = server_arc.stdin.lock().await;
                let mut out = serde_json::to_string(&notif).unwrap();
                out.push('\n');
                let _ = stdin_lock.write_all(out.as_bytes()).await;
                let _ = stdin_lock.flush().await;
            } // stdin_lock goes out of scope here

            self.servers.lock().await.insert(name.clone(), server_arc);
            println!("Serveur MCP '{}' prêt", name);
            Ok(true)
        } else {
            Err("Echec de l'initialisation MCP".to_string())
        }
    }

    async fn next_id(server: &McpServer) -> u64 {
        let mut id = server.msg_id.lock().await;
        *id += 1;
        *id
    }

    async fn send_request(server: &McpServer, req: Value) -> Option<Value> {
        let req_id = req.get("id")?.clone();
        let mut out = serde_json::to_string(&req).unwrap_or_default();
        out.push('\n');

        let mut stdin_guard = server.stdin.lock().await;
        if stdin_guard.write_all(out.as_bytes()).await.is_err() {
            return None;
        }
        if stdin_guard.flush().await.is_err() {
            return None;
        }
        drop(stdin_guard); // Libérer stdin immédiatement

        let mut stdout_guard = server.stdout.lock().await;
        let mut line = String::new();
        loop {
            line.clear();
            match stdout_guard.read_line(&mut line).await {
                Ok(0) => break, // EOF
                Ok(_) => {
                    if let Ok(res) = serde_json::from_str::<Value>(&line) {
                        if res.get("id") == Some(&req_id) {
                            return Some(res);
                        }
                    }
                }
                Err(_) => break,
            }
        }
        None
    }

    pub async fn list_all_tools(&self) -> (Vec<Value>, HashMap<String, String>) {
        let mut tools_formatted = Vec::new();
        let mut map = HashMap::new();
        let servers = self.servers.lock().await;

        for (name, server) in servers.iter() {
            let req = json!({
                "jsonrpc": "2.0",
                "id": Self::next_id(server).await,
                "method": "tools/list"
            });
            if let Some(res) = Self::send_request(server, req).await {
                if let Some(tools) = res
                    .get("result")
                    .and_then(|r| r.get("tools"))
                    .and_then(|t| t.as_array())
                {
                    for tool in tools {
                        let t_name = tool
                            .get("name")
                            .and_then(|n| n.as_str())
                            .unwrap_or("")
                            .to_string();
                        let desc = tool
                            .get("description")
                            .and_then(|d| d.as_str())
                            .unwrap_or("")
                            .to_string();
                        let params = tool.get("inputSchema").cloned().unwrap_or(json!({}));

                        map.insert(t_name.clone(), name.clone());
                        tools_formatted.push(json!({
                            "type": "function",
                            "function": {
                                "name": t_name,
                                "description": desc,
                                "parameters": params
                            }
                        }));
                    }
                }
            }
        }
        (tools_formatted, map)
    }

    pub async fn call_tool(
        &self,
        server_name: &str,
        tool_name: &str,
        args: Value,
    ) -> Option<Value> {
        let servers = self.servers.lock().await;
        let server = servers.get(server_name)?;

        let req = json!({
            "jsonrpc": "2.0",
            "id": Self::next_id(server).await,
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": args
            }
        });

        if let Some(res) = Self::send_request(server, req).await {
            return res.get("result").cloned();
        }
        None
    }
}
