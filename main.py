#!/usr/bin/env python3
"""
Application GUI pour utiliser des LLM en local avec Ollama (Version Eel)
"""

import os
import eel
from core import api  # Import important pour enregistrer les @eel.expose


def main():
    # Chemin vers le dossier web
    web_dir = os.path.join(os.path.dirname(__file__), "web")

    # Indiquer à Eel où chercher les fichiers (HTML/CSS/JS)
    eel.init(web_dir)

    # Lancement fenêtré de l'application (mode 'chrome' ou 'edge')
    try:
        # App mode donne un rendu exact à une application bureautique
        eel.start("index.html", size=(1000, 700), mode="chrome", port=8000)
    except Exception as e:
        print(
            f"Erreur au lancement avec Chrome/Edge. Lancement via navigateur par défaut... {e}"
        )
        try:
            # On tente de le relancer sur un port aléatoire (0) car le 8000
            # est déjà bloqué par la tentative 'chrome' échouée au moment du crash JS
            eel.start("index.html", size=(1000, 700), mode="default", port=0)
        except Exception:
            pass


if __name__ == "__main__":
    main()
