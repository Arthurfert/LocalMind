# Makefile pour Local LLM GUI

# Détection de l'OS pour utiliser les bons chemins Windows ou Linux/Mac
ifeq ($(OS),Windows_NT)
    PYTHON = venv\Scripts\python.exe
    PIP = venv\Scripts\pip.exe
    RM = rmdir /s /q
    RM_FILE = del /q
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
	-$(RM) __pycache__
	-$(RM) core\__pycache__
	-$(RM) venv
	-$(RM_FILE) Chatbot.spec
