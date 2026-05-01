.PHONY: help install install-deps dev build clean build-release

# Variables
NODE_MODULES := node_modules
CARGO_LOCK := src-tauri/Cargo.lock

help:
	@echo "LocalMind - Makefile targets:"
	@echo ""
	@echo "Installation:"
	@echo "  make install          - Install all dependencies"
	@echo ""
	@echo "Development:"
	@echo "  make dev              - Launch the application in development mode"
	@echo ""
	@echo "Build:"
	@echo "  make build            - Launch the build in development mode"
	@echo "  make build-release    - Launch the optimized build for distribution"
	@echo ""
	@echo "Maintenance:"
	@echo "  make clean            - Remove build and cache files"
	@echo "  make clean-all        - Remove all generated files (node_modules, target/)"
	@echo "  make help             - Display this help"
# Installation complète
install:
	@echo "Installing npm dependencies..."
	npm install
	@echo "Installing Rust dependencies..."
	cargo fetch
	@echo "Installation completed!"

# Mode développement
dev:
	@echo "Launching in development mode..."
	npm run tauri dev

# Build pour développement
build:
	@echo "Build in progress..."
	npm run tauri build
	@echo "Build completed!"

# Build optimisé pour la distribution
build-release:
	@echo "Build release in progress..."
	npm run tauri build --release
	@echo "Build release completed!"

# Nettoie les fichiers build
clean:
	@echo "Cleaning build files..."
	@if exist src-tauri\target (rmdir /s /q src-tauri\target 2>nul || true)
	@echo "Cleaning completed"

# Nettoie complètement (node_modules et build)
clean-all: clean
	@echo "Complete cleaning..."
	@if exist node_modules (rmdir /s /q node_modules 2>nul || true)
	@if exist $(CARGO_LOCK) (del $(CARGO_LOCK) 2>nul || true)
	@echo "Complete cleaning completed"

# Recompile complètement
rebuild: clean-all install build
	@echo "Complete reconstruction completed!"

# Affiche le répertoire courant pour debug
info:
	@echo "Current directory: $(CURDIR)"
	@echo "Node version:"
	@node --version
	@echo "npm version:"
	@npm --version
