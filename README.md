# LocalMind - Ollama Interface with Tauri (Rust)

A modern, native, and highly customizable desktop interface (HTML/CSS/JS) to interact with your local language models via Ollama and Rust.

## Prerequisites

- Node.js & npm
- Rust & Cargo (with MSVC toolchain on Windows)
- Ollama installed and running ([Ollama Installation](https://ollama.ai))
- One or more Ollama models downloaded (e.g., `ollama pull llama3`)

## Features

- **Lightweight & Fast:** Built with Tauri (Rust) and Vanilla Web Technologies for low RAM usage and responsive asynchronous execution.
- **Smart Chat Interface:** Real-time streaming, dynamic Markdown rendering, conversation history, and on-the-fly model selection.
- **Advanced MCP Integration:** Connect MCP servers and dynamically switch the AI's working directory directly from the UI to precisely control tool execution contexts.

*The MCP integration was primarily developped for [my own MCP server](https://github.com/Arthurfert/MCP-server) logic.*

## Installation & Usage

### 1. Clone the repository
```bash
git clone https://github.com/Arthurfert/LocalMind.git
cd LocalMind
```

### 2. Install Node dependencies
```bash
npm install
```

### 3. Run the application in development mode
```bash
npm run tauri dev
```

### 4. Build the final executable
```bash
npm run tauri build
```
*The generated executable will be located in the src-tauri/target/release/ folder.*

## Project Structure

```text
LocalMind/
├── package.json            # Node.js dependencies and scripts
├── src-tauri/              # Rust Back-End Core (Tauri)
│   ├── Cargo.toml          # Rust dependencies
│   ├── tauri.conf.json     # Tauri configuration
│   └── src/
│       ├── main.rs         # Tauri application entry point
│       ├── lib.rs          # Main Rust logic and IPC handlers
│       ├── mcp/            # Stdio Client to communicate with an MCP server
│       └── ollama/         # API Client to communicate with Ollama
└── web/                    # Front-End folder (UI Interface)
    ├── index.html          # Application structure
    ├── style.css           # Design and visual theme
    └── js/                 # JavaScript Logic
        ├── api.js          # Communication bridge between Backend / Frontend (Tauri IPC)
        ├── app.js          # Main UI logic and event listeners
        └── sphere.js       # Background 3D sphere animation logic
```

## Configuration
By default, the application connects to the local Ollama daemon at http://localhost:11434.
To change the URL (if your Ollama is hosted on another server), you can edit the initialization in the src-tauri/src/lib.rs file.
