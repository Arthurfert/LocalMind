# Local LLM GUI - Interface Ollama avec PySide6

Une interface graphique moderne et intuitive pour interagir avec des modèles de langage locaux via Ollama.

## Prérequis

- Python 3.8 ou supérieur
- Ollama installé et en cours d'exécution ([Installation Ollama](https://ollama.ai))
- Un ou plusieurs modèles Ollama téléchargés

## Fonctionnalités

- Interface graphique moderne avec PySide6
- Sélection dynamique des modèles installés
- Historique de conversation
- Traitement asynchrone (l'interface ne se fige pas)
- Gestion des erreurs
- Support de plusieurs modèles Ollama
- Rafraîchissement de la liste des modèles
- Copier/collé des messages, d'une sélection ou d'un bloc de code

Et pleins d'autres [à venir](TODO.md) !

## Installation

1. **Cloner le repository**
```powershell
git clone https://github.com/Arthurfert/Local_LLM_GUI.git
cd Local_LLM_GUI
```

2. **Créer un environnement virtuel (recommandé)**
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

3. **Installer les dépendances**
```powershell
pip install -r requirements.txt
```

4. **Installer et lancer Ollama**

Téléchargez Ollama depuis [ollama.ai](https://ollama.ai) et installez-le.

Téléchargez un modèle (exemple avec llama2) :
```powershell
ollama pull llama2
```

Autres modèles populaires :
- `ollama pull mistral` - Mistral 7B
- `ollama pull codellama` - CodeLlama pour la programmation
- `ollama pull llama3` - Llama 3

## Utilisation

1. **Assurez-vous qu'Ollama est en cours d'exécution**

Ollama devrait se lancer automatiquement. Vérifiez avec :
```powershell
ollama list
```

2. **Lancer l'application**
```powershell
python main.py
```

3. **Utiliser l'interface**
   - Sélectionnez un modèle dans la liste déroulante
   - Tapez votre message dans la zone de texte
   - Cliquez sur "Envoyer" ou appuyez sur Ctrl+Entrée
   - Les réponses s'affichent dans la zone de conversation
   - Utilisez "Effacer" pour réinitialiser la conversation

## Structure du projet

```
Local_LLM_GUI/
├── main.py                 # Point d'entrée de l'application
├── requirements.txt        # Dépendances Python
├── build_exe.py            # Création d'exécutable avec PyInstaller
├── gui/
│   ├── __init__.py
│   └── main_window.py     # Fenêtre principale
├── core/
│   ├── __init__.py
│   └── ollama_client.py   # Client API Ollama
└── assets/
    └── icon.ico           # Icône de l'application
```

## Configuration

Par défaut, l'application se connecte à Ollama sur `http://localhost:11434`.

Pour modifier l'URL d'Ollama, éditez le fichier `core/ollama_client.py` :
```python
def __init__(self, base_url="http://localhost:11434"):
```

## Dépannage

**Problème : "Aucun modèle disponible"**
- Vérifiez qu'Ollama est en cours d'exécution : `ollama list`
- Téléchargez un modèle : `ollama pull llama2`
- Cliquez sur le bouton "Rafraîchir"

**Problème : "Erreur de connexion"**
- Assurez-vous qu'Ollama est lancé
- Vérifiez que le port 11434 est accessible

**Problème : Réponse très lente**
- Les modèles LLM peuvent être lents sur CPU
- Envisagez d'utiliser un modèle plus petit (ex: `ollama pull phi`)
- Fermez les autres applications gourmandes en ressources

## Licence

Ce projet est sous licence MIT - voir le fichier LICENSE pour plus de détails.

## Contribution

Les contributions sont les bienvenues ! N'hésitez pas à ouvrir une issue ou une pull request.

## Auteur

[Arthur Fert](https://github.com/Arthurfert)
