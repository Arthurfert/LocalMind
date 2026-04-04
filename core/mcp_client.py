import asyncio
import json
import subprocess
import threading


class MCPManager:
    def __init__(self):
        self.servers = {}

    def connect_stdio(self, name, command):
        """
        Démarre un processus en arrière-plan pour communiquer via stdin/stdout (JSON-RPC MCP).
        """
        parts = command.split()
        try:
            process = subprocess.Popen(
                parts,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                bufsize=1,
            )
            self.servers[name] = {"type": "stdio", "process": process, "msg_id": 0}
            print(f"Serveur MCP '{name}' démarré (PID: {process.pid})")

            # Initialization
            init_req = {
                "jsonrpc": "2.0",
                "id": self._next_id(name),
                "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "localmind", "version": "1.0.0"},
                },
            }
            res = self._send_request(name, init_req)
            if res and process.stdin:
                # Send initialized notification
                notif = {"jsonrpc": "2.0", "method": "notifications/initialized"}
                process.stdin.write(json.dumps(notif) + "\n")
                process.stdin.flush()

            return True
        except Exception as e:
            print(f"Erreur au lancement du serveur {name}: {e}")
            return False

    def _next_id(self, name):
        self.servers[name]["msg_id"] += 1
        return self.servers[name]["msg_id"]

    def _send_request(self, name, req):
        server = self.servers[name]
        try:
            stdin = server["process"].stdin
            stdout = server["process"].stdout
            if stdin and stdout:
                stdin.write(json.dumps(req) + "\n")
                stdin.flush()
                # Wait for response with the matching id
                req_id = req.get("id")
                while True:
                    line = stdout.readline()
                    if not line:
                        break
                    try:
                        res = json.loads(line)
                        if res.get("id") == req_id:
                            return res
                    except json.JSONDecodeError:
                        continue
        except Exception as e:
            print(f"Erreur de communication avec {name}: {e}")
        return None

    def list_all_tools(self):
        """
        Récupère et formate tous les outils de tous les serveurs au format Ollama.
        """
        tools_formated = []
        for name in list(self.servers.keys()):
            for tool in self.list_tools(name):
                tools_formated.append(
                    {
                        "type": "function",
                        "function": {
                            "name": tool.get("name"),
                            "description": tool.get("description", ""),
                            "parameters": tool.get("inputSchema", {}),
                        },
                        "_mcp_server": name,  # metadata pour savoir à quel serveur l'envoyer
                    }
                )
        return tools_formated

    def list_tools(self, name):
        """
        Demande la liste des outils (requête JSON-RPC).
        """
        if name not in self.servers:
            return []

        server = self.servers[name]
        if server["type"] == "stdio":
            req = {"jsonrpc": "2.0", "id": self._next_id(name), "method": "tools/list"}
            res = self._send_request(name, req)
            if res:
                return res.get("result", {}).get("tools", [])
        return []

    def call_tool(self, server_name, tool_name, args):
        """
        Appelle un outil (requête JSON-RPC).
        """
        if server_name not in self.servers:
            return None

        server = self.servers[server_name]
        if server["type"] == "stdio":
            req = {
                "jsonrpc": "2.0",
                "id": self._next_id(server_name),
                "method": "tools/call",
                "params": {"name": tool_name, "arguments": args},
            }
            res = self._send_request(server_name, req)
            if res:
                return res.get("result", {})
        return None


mcp_manager = MCPManager()
