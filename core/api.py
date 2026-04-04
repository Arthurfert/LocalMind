import eel
import threading
import json
import os
import time
import platform
import subprocess
from core.ollama_client import OllamaClient
from core.mcp_client import mcp_manager
from typing import Any

# Instance globale
ollama = OllamaClient()

# Pylance astuce : comme les fonctions JS sont injectées dynamiquement par Eel à l'exécution,
# Pylance ne peut pas les deviner. On dit à Pylance que `eel` est dynamique.
eel_dynamic: Any = eel

CHATS_DIR = "chats"
os.makedirs(CHATS_DIR, exist_ok=True)

SETTINGS_FILE = "Settings.json"


@eel.expose
def get_settings():
    """Charge les paramètres depuis Settings.json."""
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Erreur de lecture de {SETTINGS_FILE}: {e}")
    return {}


@eel.expose
def save_settings(settings):
    """Sauvegarde les paramètres dans Settings.json."""
    try:
        with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
            json.dump(settings, f, ensure_ascii=False, indent=4)
        return True
    except Exception as e:
        print(f"Erreur lors de la sauvegarde de {SETTINGS_FILE}: {e}")
        return False


@eel.expose
def connect_mcp_server(name, mcp_type, target):
    """Initialise une connexion à un serveur MCP manuel."""
    if name in mcp_manager.servers:
        return True  # Déjà connecté
    print(
        f"Tentative de connexion au serveur MCP [{name}] (Type: {mcp_type}) -> {target}"
    )
    if mcp_type == "stdio":
        return mcp_manager.connect_stdio(name, target)
    else:
        print("Support HTTP/SSE MCP non encore implémenté.")
        return False


def init_mcp_servers_on_start():
    settings = get_settings()
    servers = settings.get("mcp_servers", [])
    for srv in servers:
        connect_mcp_server(srv.get("name"), srv.get("type"), srv.get("target"))


# Lancement des serveurs enregistrés au démarrage du script Python
init_mcp_servers_on_start()


@eel.expose
def get_chats():
    """Récupère la liste des discussions enregistrées."""
    chats = []
    for filename in os.listdir(CHATS_DIR):
        if filename.endswith(".json"):
            filepath = os.path.join(CHATS_DIR, filename)
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    chats.append(
                        {
                            "id": data.get("id", filename.replace(".json", "")),
                            "title": data.get("title", "Nouvelle discussion"),
                            "date": data.get("date", 0),
                            "model": data.get("model", ""),
                        }
                    )
            except Exception as e:
                print(f"Erreur de lecture du fichier {filename}: {e}")
    # Trier par date décroissante
    chats.sort(key=lambda x: x["date"], reverse=True)
    return chats


@eel.expose
def load_chat(chat_id):
    """Charge une discussion spécifique."""
    filepath = os.path.join(CHATS_DIR, f"{chat_id}.json")
    if os.path.exists(filepath):
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            print(f"Erreur de lecture du chat {chat_id}: {e}")
    return None


@eel.expose
def save_chat(chat_id, title, messages, model):
    """Sauvegarde une discussion."""
    if not chat_id:
        chat_id = str(int(time.time() * 1000))

    filepath = os.path.join(CHATS_DIR, f"{chat_id}.json")
    data = {
        "id": chat_id,
        "title": title,
        "date": time.time(),
        "model": model,
        "messages": messages,
    }

    try:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        return chat_id
    except Exception as e:
        print(f"Erreur lors de la sauvegarde du chat {chat_id}: {e}")
        return None


@eel.expose
def delete_chat(chat_id):
    """Supprime une discussion."""
    filepath = os.path.join(CHATS_DIR, f"{chat_id}.json")
    if os.path.exists(filepath):
        try:
            os.remove(filepath)
            return True
        except Exception as e:
            print(f"Erreur lors de la suppression du chat {chat_id}: {e}")
    return False


@eel.expose
def get_models():
    """
    Récupère les modèles locaux.
    """
    return ollama.get_available_models()


@eel.expose
def abort_generation():
    """
    Arrête la génération en cours.
    """
    print("Demande d'arrêt reçue par l'API.")
    ollama.abort()


@eel.expose
def send_message(model, messages, images=None):
    """
    Démarre la discussion avec un modèle en arrière-plan.
    """

    def chunk_callback(chunk):
        # On envoie les morceaux de texte au Javascript au fur et à mesure
        eel_dynamic.onStreamChunk(chunk)

    def run_chat():
        try:
            # Récupérer les outils actifs depuis le MCPManager
            mcp_tools = mcp_manager.list_all_tools()
            payload_tools = []

            # Map name to exact server location internally
            tool_server_map = {}
            for t in mcp_tools:
                # remove metadata _mcp_server for the payload
                clean_tool = {"type": t["type"], "function": t["function"]}
                payload_tools.append(clean_tool)
                tool_server_map[t["function"]["name"]] = t["_mcp_server"]

            current_messages = list(messages)

            while True:
                # Call ollama API
                result = ollama.chat_stream(
                    model=model,
                    messages=current_messages,
                    chunk_callback=chunk_callback,
                    images=images,
                    tools=payload_tools if payload_tools else None,
                )

                content = result.get("content", "")
                tool_calls = result.get("tool_calls", [])

                # If there are tool calls to make
                if tool_calls:
                    # Append the assistant's message with the tool call
                    current_messages.append(
                        {
                            "role": "assistant",
                            "content": content,
                            "tool_calls": tool_calls,
                        }
                    )

                    # Intercept it and process each tool
                    for tc in tool_calls:
                        func_name = tc.get("function", {}).get("name")
                        args = tc.get("function", {}).get("arguments", {})

                        if func_name in tool_server_map:
                            server_name = tool_server_map[func_name]
                            print(
                                f"-> Appel fonction MCP: {func_name} sur {server_name}"
                            )
                            # Execute the tool
                            res = mcp_manager.call_tool(server_name, func_name, args)

                            # Give the results back to the LLM
                            tool_msg = {
                                "role": "tool",
                                "name": func_name,
                                "content": json.dumps(res)
                                if res
                                else "Error: Empty response",
                            }
                            current_messages.append(tool_msg)
                        else:
                            current_messages.append(
                                {
                                    "role": "tool",
                                    "name": func_name,
                                    "content": f"Erreur: Outil '{func_name}' non reconnu.",
                                }
                            )
                    # Loop automatically continues to execute Ollama with the tool results context
                    continue
                else:
                    break  # Finished generating

            # Fin du stream
            eel_dynamic.onStreamEnd()
        except Exception as e:
            # En cas d'erreur
            eel_dynamic.onStreamError(str(e))

    # Lancement transparent dans le thread
    threading.Thread(target=run_chat, daemon=True).start()
    return True
