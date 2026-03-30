import eel
import threading
from core.ollama_client import OllamaClient
from typing import Any

# Instance globale
ollama = OllamaClient()

# Pylance astuce : comme les fonctions JS sont injectées dynamiquement par Eel à l'exécution,
# Pylance ne peut pas les deviner. On dit à Pylance que `eel` est dynamique.
eel_dynamic: Any = eel

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
