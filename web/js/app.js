// --- Logique Front-End ---

document.addEventListener("DOMContentLoaded", () => {
    const messageInput = document.getElementById("message-input");
    const sendBtn = document.getElementById("send-btn");
    
    // Éléments de la modal de suppression
    const deleteModal = document.getElementById("delete-modal");
    const confirmDeleteBtn = document.getElementById("confirm-delete-btn");
    const cancelDeleteBtn = document.getElementById("cancel-delete-btn");

    // Modal des paramètres
    const settingsBtn = document.getElementById("settings-btn");
    const settingsModal = document.getElementById("settings-modal");
    const closeSettingsBtn = document.getElementById("close-settings-btn");
    const saveSettingsBtn = document.getElementById("save-settings-btn");
    const userNameInput = document.getElementById("user-name-input");
    const greetingTitle = document.getElementById("greeting-title");

    let currentUsername = "";

    async function updateGreeting() {
        try {
            const settings = await eel.get_settings()();
            currentUsername = settings.username || "";
            const hour = new Date().getHours();
            const timeGreeting = (hour >= 19 || hour < 5) ? "Bonsoir" : "Bonjour";
            
            if (currentUsername.trim() !== "") {
                greetingTitle.textContent = `${timeGreeting}, ${currentUsername}`;
            } else {
                greetingTitle.textContent = timeGreeting;
            }
        } catch (error) {
            console.error("Erreur lors du chargement des paramètres:", error);
        }
    }
    
    // Initialisation
    updateGreeting();

    if (settingsBtn) {
        settingsBtn.addEventListener("click", () => {
            userNameInput.value = currentUsername;
            settingsModal.style.display = "flex";
            void settingsModal.offsetWidth;
            settingsModal.classList.add("show");
        });
    }

    const closeSettings = () => {
        settingsModal.classList.remove("show");
        setTimeout(() => {
            settingsModal.style.display = "none";
        }, 200);
    };

    if (closeSettingsBtn) closeSettingsBtn.addEventListener("click", closeSettings);

    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener("click", async () => {
            const newName = userNameInput.value.trim();
            try {
                let settings = await eel.get_settings()();
                if (!settings) settings = {};
                settings.username = newName;
                await eel.save_settings(settings)();
                await updateGreeting();
                closeSettings();
            } catch (error) {
                console.error("Erreur lors de l'enregistrement des paramètres:", error);
            }
        });
    }

    function showCustomConfirm(callback) {
        deleteModal.style.display = "flex";
        // Force reflow pour l'animation
        void deleteModal.offsetWidth;
        deleteModal.classList.add("show");
        
        const cleanup = () => {
            deleteModal.classList.remove("show");
            setTimeout(() => {
                deleteModal.style.display = "none";
            }, 200);
            confirmDeleteBtn.removeEventListener("click", onConfirm);
            cancelDeleteBtn.removeEventListener("click", onCancel);
        };
        
        const onConfirm = () => { cleanup(); callback(true); };
        const onCancel = () => { cleanup(); callback(false); };
        
        confirmDeleteBtn.addEventListener("click", onConfirm);
        cancelDeleteBtn.addEventListener("click", onCancel);
    }
    
    // Nouveaux éléments du menu déroulant
    const modelDropdown = document.getElementById("model-dropdown");
    const dropdownSelected = document.getElementById("dropdown-selected");
    const dropdownOptions = document.getElementById("dropdown-options");
    let currentModel = "";

    const newChatBtn = document.getElementById("new-chat-btn");
    const emptyState = document.getElementById("empty-state");
    const chatMessages = document.getElementById("chat-messages");
    
    // Nouveaux éléments pour les fichiers
    const addFileBtn = document.getElementById("add-file-btn");
    const fileInput = document.getElementById("file-input");
    const attachmentsPreview = document.getElementById("attachments-preview");
    var selectedImagesBase64 = [];
    
    const sidebar = document.getElementById("sidebar");
    const closeSidebarBtn = document.getElementById("close-sidebar-btn");
    const openSidebarBtn = document.getElementById("open-sidebar-btn");

    // Gestion du volet latéral
    closeSidebarBtn.addEventListener("click", () => {
        sidebar.classList.add("collapsed");
    });
    openSidebarBtn.addEventListener("click", () => {
        sidebar.classList.remove("collapsed");
    });

    // Gestion de l'ajout d'images
    addFileBtn.addEventListener("click", () => {
        fileInput.click();
    });

    fileInput.addEventListener("change", (e) => {
        const files = e.target.files;
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const reader = new FileReader();
            reader.onload = function(event) {
                // Enlever le préfixe data:image/...;base64,
                const base64String = event.target.result.split(',')[1];
                selectedImagesBase64.push(base64String);
                
                // Mettre à jour l'UI avec une petite étiquette
                const chip = document.createElement("div");
                chip.className = "attachment-chip";
                chip.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M4 16L8.586 11.414C8.96106 11.0391 9.46967 10.8284 10 10.8284C10.5303 10.8284 11.0389 11.0391 11.414 11.414L16 16M14 14L15.586 12.414C15.9611 12.0391 16.4697 11.8284 17 11.8284C17.5303 11.8284 18.0389 12.0391 18.414 12.414L20 14M14 8H14.01M6 20H18C19.1046 20 20 19.1046 20 18V6C20 4.89543 19.1046 4 18 4H6C4.89543 4 4 4.89543 4 6V18C4 19.1046 4.89543 20 6 20Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Image ${selectedImagesBase64.length}
                    <button type="button" title="Retirer">&times;</button>
                `;
                
                // Gérer la suppression
                const index = selectedImagesBase64.length - 1;
                chip.querySelector("button").addEventListener("click", () => {
                    selectedImagesBase64.splice(index, 1);
                    chip.remove();
                });
                
                attachmentsPreview.appendChild(chip);
            };
            reader.readAsDataURL(file);
        }
        // Reset l'input pour pouvoir sélectionner le même fichier deux fois de suite si besoin
        e.target.value = '';
    });

    function addMessageToUI(role, content) {
        // Cacher le logo si c'est le premier message
        if (emptyState.style.display !== "none") {
            emptyState.style.display = "none";
        }

        const msgDiv = document.createElement("div");
        msgDiv.className = `message ${role}`;
        
        if(role === 'assistant') {
            msgDiv.innerHTML = marked.parse(content);
        } else {
            msgDiv.textContent = content; // texte brut pour l'utilisateur
        }

        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return msgDiv;
    }

    async function loadModels() {
        try {
            const models = await eel.get_models()();
            
            dropdownOptions.innerHTML = "";
            if (!models || models.length === 0) {
                dropdownSelected.textContent = "Aucun modèle trouvé";
                sendBtn.disabled = true;
            } else {
                currentModel = models[0];
                dropdownSelected.textContent = currentModel;
                
                models.forEach(m => {
                    const opt = document.createElement("div");
                    opt.className = "dropdown-option";
                    opt.textContent = m;
                    opt.addEventListener("click", (e) => {
                        e.stopPropagation(); // Évite que ça remonte au parent
                        currentModel = m;
                        dropdownSelected.textContent = m;
                        dropdownOptions.classList.remove("show");
                        
                        // Active/Désactive l'envoi si du texte est présent
                        if(messageInput.value.trim() !== "" && currentModel !== "") {
                            sendBtn.disabled = false;
                            sendBtn.style.color = "#000000";
                            sendBtn.style.backgroundColor = "#ECECEC";
                        } else {
                            sendBtn.disabled = true;
                            sendBtn.style.backgroundColor = "#444";
                            sendBtn.style.color = "#909090";
                        }
                    });
                    dropdownOptions.appendChild(opt);
                });
                
                // Évalue si on a du texte de prêt pour activer l'envoi
                sendBtn.disabled = messageInput.value.trim() === "";
            }
        } catch (error) {
            console.error("Erreur de chargement des modèles :", error);
        }
    }

    // Gestion du clic pour ouvrir/fermer le menu
    dropdownSelected.addEventListener("click", () => {
        dropdownOptions.classList.toggle("show");
    });

    // Fermer le menu si on clique ailleurs
    document.addEventListener("click", (e) => {
        if (!modelDropdown.contains(e.target)) {
            dropdownOptions.classList.remove("show");
        }
    });

    // Auto-resize de l'input box
    messageInput.addEventListener("input", function() {
        this.style.height = "auto";
        this.style.height = (this.scrollHeight) + "px";
        
        // Activer / désactiver le bouton d'envoi
        if(this.value.trim() !== "" && currentModel !== "") {
            sendBtn.disabled = false;
            sendBtn.style.color = "#ffffff";
            sendBtn.style.backgroundColor = "#ECECEC";
            sendBtn.style.color = "#000000";
        } else {
            sendBtn.disabled = true;
            sendBtn.style.backgroundColor = "#444";
            sendBtn.style.color = "#909090";
        }
    });

    // Fonction pour charger une discussion spécifique de l'historique
    window.loadChat = async function(chatId) {
        try {
            const chatData = await eel.load_chat(chatId)();
            if (chatData) {
                currentChatId = chatData.id;
                currentChatTitle = chatData.title;
                messages = chatData.messages;
                
                // Mettre à jour l'interface
                chatMessages.innerHTML = "";
                emptyState.style.display = "none";
                
                messages.forEach(msg => {
                    addMessageToUI(msg.role, msg.content);
                });
                
                // Mettre en surbrillance dans la liste
                document.querySelectorAll('.history-item').forEach(item => {
                    item.style.backgroundColor = item.dataset.id === chatId ? "rgba(255, 255, 255, 0.1)" : "";
                });
            }
        } catch (error) {
            console.error("Erreur de chargement du chat:", error);
        }
    };

    // Fonction globale pour recharger la liste depuis Python
    window.loadHistory = async function() {
        const historyList = document.getElementById("history-list");
        if (!historyList) return;
        
        try {
            const chats = await eel.get_chats()();
            historyList.innerHTML = "";
            
            if (chats.length === 0) {
                const empty = document.createElement("div");
                empty.className = "history-item";
                empty.style.color = "var(--text-secondary)";
                empty.textContent = "Aucune discussion";
                historyList.appendChild(empty);
                return;
            }
            
            chats.forEach(chat => {
                const div = document.createElement("div");
                div.className = "history-item";
                div.dataset.id = chat.id;
                
                // Titre de la discussion
                const titleSpan = document.createElement("span");
                titleSpan.className = "history-item-title";
                titleSpan.textContent = chat.title;
                div.appendChild(titleSpan);
                
                // Bouton supprimer interactif
                const deleteBtn = document.createElement("button");
                deleteBtn.className = "delete-chat-btn";
                deleteBtn.title = "Supprimer la discussion";
                deleteBtn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M19 7L18.1327 19.1425C18.0579 20.1891 17.187 21 16.1378 21H7.86224C6.81296 21 5.94208 20.1891 5.86732 19.1425L5 7M10 11V17M14 11V17M15 7V4C15 3.44772 14.5523 3 14 3H10C9.44772 3 9 3.44772 9 4V7M4 7H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                `;
                
                deleteBtn.addEventListener("click", (e) => {
                    e.stopPropagation(); // Évite que le clic n'ouvre la discussion
                    showCustomConfirm(async (confirmed) => {
                        if(confirmed) {
                            const success = await eel.delete_chat(chat.id)();
                            if(success) {
                                if(currentChatId === chat.id) {
                                    document.getElementById("new-chat-btn").click(); // Remise à zéro si c'est la discussion active
                                }
                                window.loadHistory(); // Rafraîchit la liste
                            }
                        }
                    });
                });
                div.appendChild(deleteBtn);
                
                if (chat.id === currentChatId) {
                    div.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
                }
                
                div.addEventListener("click", () => {
                    if (isGenerating) return; // Empêche de changer de chat pendant la génération
                    window.loadChat(chat.id);
                });
                
                historyList.appendChild(div);
            });
        } catch (error) {
            console.error("Erreur lors du chargement de l'historique :", error);
        }
    };

    loadModels();
    window.loadHistory();

    newChatBtn.addEventListener("click", () => {
        messages = [];
        currentChatId = null;
        currentChatTitle = "";
        chatMessages.innerHTML = "";
        emptyState.style.display = "flex";
        
        // Retirer la surbrillance de l'historique
        document.querySelectorAll('.history-item').forEach(item => {
            item.style.backgroundColor = "";
        });
    });

    async function sendMessage() {
        const text = messageInput.value.trim();
        const model = currentModel;

        if (!text || !model) return;
        
        if (!currentChatTitle) {
            currentChatTitle = text.length > 30 ? text.substring(0, 30) + '...' : text;
        }
        sendBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="6" width="12" height="12" fill="currentColor"/>
            </svg>
        `;
        sendBtn.disabled = false; // Le garder actif pour pouvoir cliquer
        sendBtn.style.backgroundColor = "#c0392b"; // Rouge pour signifier "Arrêter"
        sendBtn.style.color = "#ffffff";
        
        messageInput.disabled = true;
        messageInput.value = "";
        messageInput.style.height = "auto";
        
        // User message
        addMessageToUI("user", text);
        messages.push({role: "user", content: text});
        
        // Bot loading message
        currentBotMessageElement = addMessageToUI("assistant", "...");
        currentBotText = "";
        
        // Copier les images et vider l'interface avant l'envoi
        const imagesToSend = selectedImagesBase64.length > 0 ? [...selectedImagesBase64] : null;
        selectedImagesBase64 = [];
        attachmentsPreview.innerHTML = "";
        
        try {
            await eel.send_message(model, messages, imagesToSend)();
        } catch (error) {
            console.error("Erreur:", error);
            currentBotMessageElement.textContent = "Erreur système: " + error;
            isGenerating = false;
            // Retour au bouton normal
            sendBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 19V5M12 5L5 12M12 5L19 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            `;
            sendBtn.style.backgroundColor = "#444";
            sendBtn.style.color = "#909090";
            messageInput.disabled = false;
        }
    }

    sendBtn.addEventListener("click", () => {
        if (isGenerating) {
            // Arrêter la génération
            eel.abort_generation()();
        } else {
            sendMessage();
        }
    });

    messageInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (!isGenerating && !sendBtn.disabled) {
                sendMessage();
            }
        }
    });
});





