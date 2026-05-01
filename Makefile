.PHONY: help install install-deps dev build clean clean-all rebuild info

# Détecte le système d'exploitation
# Teste si on est sur Windows en cherchant cmd.exe
UNAME := $(shell uname 2>/dev/null || echo Windows)

ifeq ($(UNAME),Windows)
	DETECTED_OS := Windows
else ifeq ($(findstring MINGW,$(UNAME)),MINGW)
	DETECTED_OS := Windows
else ifeq ($(findstring CYGWIN,$(UNAME)),CYGWIN)
	DETECTED_OS := Windows
else ifeq ($(findstring MSYS,$(UNAME)),MSYS)
	DETECTED_OS := Windows
else ifeq ($(UNAME),Linux)
	DETECTED_OS := Linux
else
	DETECTED_OS := $(UNAME)
endif

# Configuration spécifique à l'OS
ifeq ($(DETECTED_OS),Windows)
	SHELL := pwsh.exe
	.SHELLFLAGS := -NoProfile -Command
	CARGO_LOCK := src-tauri/Cargo.lock
	RM_RF := Remove-Item -Recurse -Force
	RM_F := Remove-Item -Force
	TEST_PATH := Test-Path
else
	# Linux/Mac
	CARGO_LOCK := src-tauri/Cargo.lock
	RM_RF := rm -rf
	RM_F := rm -f
	TEST_PATH := test -d
endif

# Variables
NODE_MODULES := node_modules

help:
	@echo "LocalMind - Makefile targets"
	@echo "Detected OS: $(DETECTED_OS)"
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
ifeq ($(DETECTED_OS),Windows)
	@if (Test-Path src-tauri\target) { Remove-Item -Recurse -Force src-tauri\target }
else
	@$(RM_RF) src-tauri/target
endif
	@echo "Cleaning completed"

# Nettoie complètement (node_modules et build)
clean-all: clean
	@echo "Complete cleaning..."
ifeq ($(DETECTED_OS),Windows)
	@if (Test-Path node_modules) { Remove-Item -Recurse -Force node_modules }
	@if (Test-Path $(CARGO_LOCK)) { Remove-Item -Force $(CARGO_LOCK) }
else
	@$(RM_RF) node_modules
	@$(RM_F) $(CARGO_LOCK)
endif
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
