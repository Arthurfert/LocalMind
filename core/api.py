import eel
import threading
import json
import os
import time
from core.ollama_client import OllamaClient
from typing import Any

# Instance globale
ollama = OllamaClient()

# Pylance astuce : comme les fonctions JS sont injectées dynamiquement par Eel à l'exécution,
# Pylance ne peut pas les deviner. On dit à Pylance que `eel` est dynamique.
eel_dynamic: Any = eel

CHATS_DIR = "chats"
os.makedirs(CHATS_DIR, exist_ok=True)

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
                    chats.append({
                        "id": data.get("id", filename.replace(".json", "")),
                        "title": data.get("title", "Nouvelle discussion"),
                        "date": data.get("date", 0),
                        "model": data.get("model", "")
                    })
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
        "messages": messages
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
            full_reply = ollama.chat_stream(
                model=model,
                messages=messages,
                chunk_callback=chunk_callback,
                images=images
            )
            # Fin du stream
            eel_dynamic.onStreamEnd()
        except Exception as e:
            # En cas d'erreur
            eel_dynamic.onStreamError(str(e))

    # Lancement transparent dans le thread
    threading.Thread(target=run_chat, daemon=True).start()
    return True
