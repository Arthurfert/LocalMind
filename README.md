# LocalMind - Ollama Interface with Eel (Web)

A modern, lightweight, and highly customizable desktop interface (HTML/CSS/JS) to interact with your local language models via Ollama and Python.

## Prerequisites

- Python 3.8 or higher
- Ollama installed and running ([Ollama Installation](https://ollama.ai))
- A modern browser (Chrome, Edge) for Eel to render the window
- One or more Ollama models downloaded (e.g., `ollama pull llama3`)

## Features

- Modern graphical interface based on web technologies (Eel)
- Dynamic selection of installed models
- Conversation history
- Real-time response streaming (word by word)
- Dynamic Markdown rendering of responses (using `Marked.js`)
- Asynchronous execution (the interface remains smooth and responsive during generation)
- Native dark mode, easily customizable via CSS
- Cool 3D rotating point sphere animation in the empty state

## Installation & Usage (with Makefile)

A `Makefile` is provided to simplify virtual environment management, dependency installation, and executable compilation.

### 1. Clone the repository
```bash
git clone https://github.com/Arthurfert/LocalMind.git
cd LocalMind
```

### 2. Setup the project (Creates the `venv` and installs modules)
```bash
make setup
```

### 3. Run the application
```bash
make run
```

### 4. Compile an executable (.exe)
```bash
make build
```
*The generated executable will be located in the `dist/` folder.*

### Manual commands (if you don't have `make`)
If you are on Windows and don't have Make installed, here are the equivalent commands:
```powershell
# 1. Create and activate the virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run the app
python main.py

# 4. Build the executable
python build_exe.py
```

## Project Structure

```text
LocalMind/
├── main.py                 # Application entry point (Eel Startup)
├── requirements.txt        # Python dependencies (eel, ollama, etc.)
├── Makefile                # Shortcuts for installation, startup, and build
├── build_exe.py            # Executable creation using PyInstaller
├── web/                    # Front-End folder (UI Interface)
│   ├── index.html          # Application structure
│   ├── style.css           # Design and visual theme
│   └── js/                 # JavaScript Logic
│       ├── api.js          # Communication bridge between Backend / Frontend (Eel handlers)
│       ├── app.js          # Main UI logic and event listeners
│       └── sphere.js       # Background 3D sphere animation logic
├── core/                   # Python Back-End Core
│   ├── api.py              # Backend / Frontend communication bridge
│   └── ollama_client.py    # API Client to communicate with Ollama
└── assets/                 # Static resources
    └── icon.ico            # Application icon
```

## Configuration
By default, the application connects to the local Ollama daemon at `http://localhost:11434`.
To change the URL (if your Ollama is hosted on another server), you can edit the `base_url` value in the `core/ollama_client.py` file.