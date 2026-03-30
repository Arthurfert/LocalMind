# Local LLM GUI - Interface Ollama avec Eel (Web)

Une interface desktop moderne, légère et hautement personnalisable (HTML/CSS/JS) pour interagir avec vos modèles de langage locaux via Ollama et Python.

## Prérequis

- Python 3.8 ou supérieur
- Ollama installé et en cours d'exécution ([Installation Ollama](https://ollama.ai))
- Un navigateur moderne (Chrome, Edge) pour le rendu de la fenêtre par Eel
- Un ou plusieurs modèles Ollama téléchargés (ex: `ollama pull llama3`)

## Fonctionnalités

- Interface graphique moderne basée sur des technologies web (Eel)
- Sélection dynamique des modèles installés
- Historique de la conversation
- Streaming des réponses en temps réel (mot à mot)
- Rendu Markdown dynamique des réponses (grâce à `Marked.js`)
- Exécution asynchrone (l'interface reste fluide pendant la génération)
- Mode sombre natif et facilement modifiable via CSS

## Installation & Utilisation (avec Makefile)

Un `Makefile` est fourni pour simplifier la gestion de l'environnement virtuel, l'installation des dépendances et la compilation de l'exécutable.

### 1. Cloner le repository
```bash
git clone https://github.com/Arthurfert/Local_LLM_GUI.git
cd Local_LLM_GUI
```

### 2. Configurer le projet (Crée le `venv` et installe les modules)
```bash
make setup
```

### 3. Lancer l'application
```bash
make run
```

### 4. Compiler un exécutable (.exe)
```bash
make build
```
*L'exécutable généré se trouvera dans le dossier `dist/`.*

### Commandes manuelles (si vous n'avez pas `make`)
Si vous êtes sous Windows et ne possédez pas Make, voici les commandes équivalentes :
```powershell
# 1. Créer l'environnement et l'activer
python -m venv venv
.\venv\Scripts\Activate.ps1

# 2. Installer les dépendances
pip install -r requirements.txt

# 3. Lancer l'app
python main.py

# 4. Build l'exécutable
python build_exe.py
```

## Structure du projet

```text
Local_LLM_GUI/
├── main.py                 # Point d'entrée de l'application (Démarrage Eel)
├── requirements.txt        # Dépendances Python (eel, ollama, etc.)
├── Makefile                # Raccourcis pour l'installation, le démarrage et le build
├── build_exe.py            # Création de l'exécutable avec PyInstaller
├── Chatbot.spec            # Fichier de configuration de PyInstaller
├── web/                    # Dossier Front-End (Interface UI)
│   ├── index.html          # Structure de l'application
│   ├── style.css           # Design et thème visuel
│   └── script.js           # Logique JS (connectée avec Python)
├── core/                   # Cœur back-end Python
│   ├── api.py              # Pont de communication Backend ↔ Frontend
│   └── ollama_client.py    # Client API pour communiquer avec Ollama
└── assets/                 # Ressources statiques
    └── icon.ico            # Icône de l'application
```

## Configuration
Par défaut, l'application se connecte au démon local d'Ollama sur `http://localhost:11434`.
Pour modifier l'URL (si votre Ollama est hébergé sur un autre serveur), vous pouvez éditer la valeur de `base_url` dans le fichier `core/ollama_client.py`.
