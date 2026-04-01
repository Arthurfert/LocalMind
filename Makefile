# Makefile pour Local LLM GUI

# Détection de l'OS pour utiliser les bons chemins Windows ou Linux/Mac
ifeq ($(OS),Windows_NT)
    PYTHON = venv\Scripts\python.exe
    PIP = venv\Scripts\pip.exe
    RM = python -c "import shutil, sys; [shutil.rmtree(d, ignore_errors=True) for d in sys.argv[1:]]"
    RM_FILE = python -c "import os, sys; [os.remove(f) if os.path.exists(f) else None for f in sys.argv[1:]]"
else
    PYTHON = venv/bin/python
    PIP = venv/bin/pip
    RM = rm -rf
    RM_FILE = rm -f
endif

.PHONY: all setup run build clean

all: setup run

# Création de l'environnement virtuel
venv:
	python -m venv venv

# Installation des paquets
setup: venv
	$(PYTHON) -m pip install --upgrade pip
	$(PIP) install -r requirements.txt

# Lancer l'application
run:
	$(PYTHON) main.py

# Compiler le projet en .exe via le script Python
build:
	$(PYTHON) build_exe.py

# Nettoyer les fichiers compilés et l'environnement local
clean:
	-$(RM) build
	-$(RM) dist
	-$(RM_FILE) Chatbot.spec
