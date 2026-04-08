// const { invoke } = window.__TAURI__.core; // Already imported by api.js
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

    // Onglets des paramètres
    const settingsTabs = document.querySelectorAll(".settings-tab");
    const settingsTabContents = document.querySelectorAll(".settings-tab-content");
    
    settingsTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            settingsTabs.forEach(t => t.classList.remove("active"));
            settingsTabContents.forEach(c => c.classList.remove("active"));
            settingsTabContents.forEach(c => c.style.display = "none");
            
            tab.classList.add("active");
            const content = document.getElementById(`tab-${tab.dataset.tab}`);
            content.classList.add("active");
            content.style.display = "block";
        });
    });

    // Éléments MCP
    const mcpServersList = document.getElementById("mcp-servers-list");
    const mcpEnabledCheckbox = document.getElementById("mcp-enabled-checkbox");
    const mcpAutoApproveGlobalCheckbox = document.getElementById("mcp-auto-approve-global");
    const addMcpBtn = document.getElementById("add-mcp-btn");
    const mcpForm = document.getElementById("mcp-form");
    const saveMcpServerBtn = document.getElementById("save-mcp-server-btn");
    const mcpTypeSelect = document.getElementById("mcp-type");
    const mcpTargetInput = document.getElementById("mcp-target");
    const mcpTargetLabel = document.getElementById("mcp-target-label");

    let currentUsername = "";
    let mcpServers = [];

    function renderMcpServers() {
        mcpServersList.innerHTML = "";
        if (mcpServers.length === 0) {
            mcpServersList.innerHTML = "<div style='color: var(--text-secondary); font-size: 14px;'>Aucun serveur configuré.</div>";
            return;
        }
        
        mcpServers.forEach((server, index) => {
            const div = document.createElement("div");
            div.className = "mcp-item";
            div.innerHTML = `
                <div class="mcp-info">
                    <strong>${server.name}</strong>
                    <span>${server.type === 'stdio' ? 'Commande' : 'URL'}: ${server.target}</span>
                </div>
                <button class="mcp-delete-btn" data-index="${index}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </button>
            `;
            
            div.querySelector(".mcp-delete-btn").addEventListener("click", (e) => {
                mcpServers.splice(index, 1);
                renderMcpServers();
            });
            mcpServersList.appendChild(div);
        });
    }

    mcpTypeSelect.addEventListener("change", () => {
        mcpTargetLabel.textContent = mcpTypeSelect.value === "stdio" ? "Commande :" : "URL (SSE) :";
        mcpTargetInput.placeholder = mcpTypeSelect.value === "stdio" ? "Ex: npx mcp-xxx" : "Ex: http://localhost:8000/sse";
    });

    addMcpBtn.addEventListener("click", () => {
        mcpForm.style.display = mcpForm.style.display === "none" ? "block" : "none";
    });

    saveMcpServerBtn.addEventListener("click", () => {
        const name = document.getElementById("mcp-name").value.trim();
        const type = mcpTypeSelect.value;
        const target = mcpTargetInput.value.trim();
        
        if (name && target) {
            mcpServers.push({ name, type, target });
            document.getElementById("mcp-name").value = "";
            mcpTargetInput.value = "";
            mcpForm.style.display = "none";
            renderMcpServers();
            // Lancement immédiat géré à la sauvegarde globale, ou on peut le relancer ici
            invoke("connect_mcp_server", { name: name, mcpType: type, target: target, autoApprove: mcpAutoApproveGlobalCheckbox.checked });
        }
    });

    async function updateGreeting() {
        try {
            const settings = await invoke("get_settings");
            currentUsername = settings.username || "";
            mcpServers = settings.mcp_servers || [];
            mcpEnabledCheckbox.checked = settings.mcp_enabled || false;
            mcpAutoApproveGlobalCheckbox.checked = settings.mcp_auto_approve || false;
            
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

    async function updateLocationIndicator() {
        try {
            const locPath = document.getElementById('model-location-path');
            if (!locPath) return;
            const dir = await window.__TAURI__.core.invoke('get_current_dir');
            
            const parts = dir.split(/[/\\]/);
            const base = parts.pop() || dir;
            const prefix = parts.length > 0 ? parts.join('\\') + '\\' : '';
            
            locPath.innerHTML = `<span class="path-prefix">${prefix}</span><span class="path-base">${base}</span>`;
            locPath.parentElement.title = dir;
        } catch (e) {
            console.error("Erreur gcwd:", e);
        }
    }
    updateLocationIndicator();
    
    // Rendre l'indicateur cliquable pour changer de dossier
    const locationIndicator = document.getElementById('model-location-indicator');
    if (locationIndicator) {
        locationIndicator.style.cursor = 'pointer';
        locationIndicator.addEventListener('click', async () => {
            try {
                // Utiliser l'API dialog pour choisir un dossier
                const { open } = window.__TAURI__.dialog;
                const newDir = await open({
                    directory: true,
                    multiple: false,
                    title: "Choisir le dossier d'exécution de l'IA"
                });
                
                if (newDir) {
                    await window.__TAURI__.core.invoke('change_current_dir', { newPath: newDir });
                    await updateLocationIndicator();
                    
                    // Informer le modèle du changement s'il y a un historique (via api.js if possible)
                    if (typeof messages !== 'undefined') {
                        messages.push({
                            role: "system",
                            content: `[Notification Système] Le dossier de travail courant a été modifié par l'utilisateur. Le nouveau dossier est: ${newDir}. Tu dois IMPÉRATIVEMENT utiliser ce chemin comme argument 'cwd' de tes outils ou en tant que racine pour construire les chemins absolus (fichiers, recherches). Ne présume plus de l'ancien dossier.`
                        });
                        
                        // Optionnel : afficher un petit message temporaire dans le chat UI
                        const chatMessages = document.getElementById("chat-messages");
                        if (chatMessages && messages.length > 0) {
                            const notif = document.createElement("div");
                            notif.style.textAlign = "center";
                            notif.style.fontSize = "12px";
                            notif.style.color = "var(--accent)";
                            notif.style.margin = "10px 0";
                            notif.textContent = `Dossier de travail et serveurs d'outils redémarrés vers : ${newDir}`;
                            chatMessages.appendChild(notif);
                            chatMessages.scrollTop = chatMessages.scrollHeight;
                        }
                    }

                    // Relancer les serveurs MCP pour qu'ils héritent du nouveau dossier !
                    if (mcpEnabledCheckbox.checked) {
                        for (const srv of mcpServers) {
                            try {
                                await window.__TAURI__.core.invoke("connect_mcp_server", { 
                                    name: srv.name, 
                                    mcpType: srv.type, 
                                    target: srv.target, 
                                    autoApprove: mcpAutoApproveGlobalCheckbox.checked 
                                });
                            } catch (e) {
                                console.error(`Erreur au redémarrage de ${srv.name}`, e);
                            }
                        }
                    }
                }
            } catch(e) {
                console.error("Erreur lors du changement de dossier:", e);
            }
        });
    }

    if (settingsBtn) {
        settingsBtn.addEventListener("click", async () => {
            const settings = await invoke("get_settings");
            mcpEnabledCheckbox.checked = settings.mcp_enabled || false;
            mcpAutoApproveGlobalCheckbox.checked = settings.mcp_auto_approve || false;
            
            userNameInput.value = currentUsername;
            renderMcpServers();
            settingsModal.style.display = "flex";
            void settingsModal.offsetWidth;
            settingsModal.classList.add("show");
        });
    }

    const closeSettings = () => {
        settingsModal.classList.remove("show");
        setTimeout(() => {
            settingsModal.style.display = "none";
            mcpForm.style.display = "none";
        }, 200);
    };

    if (closeSettingsBtn) closeSettingsBtn.addEventListener("click", closeSettings);

    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener("click", async () => {
            const newName = userNameInput.value.trim();
            const mcpEnabled = mcpEnabledCheckbox.checked;
            const mcpAutoApprove = mcpAutoApproveGlobalCheckbox.checked;
            
            try {
                let settings = await invoke("get_settings");
                if (!settings) settings = {};
                settings.username = newName;
                settings.mcp_enabled = mcpEnabled;
                settings.mcp_auto_approve = mcpAutoApprove;
                settings.mcp_servers = mcpServers; // Sauvegarde la liste MCP !
                await invoke("save_settings", { settings: settings });
                
                // Restart servers with new settings
                if (mcpEnabled) {
                    for (const srv of mcpServers) {
                        try {
                            await invoke("connect_mcp_server", { 
                                name: srv.name, 
                                mcpType: srv.type, 
                                target: srv.target, 
                                autoApprove: mcpAutoApprove 
                            });
                        } catch (e) {
                            console.error(`Erreur au redémarrage de ${srv.name}`, e);
                        }
                    }
                }

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
    var selectedFiles = []; // Array of { type: 'image'|'text', data?: base64, name?: string, content?: string }

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
            const isImage = file.type.startsWith("image/");
            const fileNameLower = file.name.toLowerCase();
            const isText = fileNameLower.endsWith(".txt") || fileNameLower.endsWith(".md");
            
            if (!isImage && !isText) {
                alert(`Le fichier ${file.name} n'est pas supporté pour l'injection directe. Seuls les images, .txt et .md sont autorisés.`);
                continue;
            }

            const reader = new FileReader();

            reader.onload = function(event) {
                let attachment;
                let itemName = "";
                if (isImage) {
                    const base64String = event.target.result.split(',')[1];
                    attachment = { type: 'image', data: base64String, name: file.name };
                    itemName = file.name;
                } else {
                    attachment = { type: 'text', content: event.target.result, name: file.name };
                    itemName = file.name;
                }
                // Append the common object
                selectedFiles.push(attachment);
                const currentIndex = selectedFiles.length - 1;

                // Mettre à jour l'UI avec une petite étiquette
                const chip = document.createElement("div");
                chip.className = "attachment-chip";
                
                const iconSvg = isImage 
                    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 16L8.586 11.414C8.96106 11.0391 9.46967 10.8284 10 10.8284C10.5303 10.8284 11.0389 11.0391 11.414 11.414L16 16M14 14L15.586 12.414C15.9611 12.0391 16.4697 11.8284 17 11.8284C17.5303 11.8284 18.0389 12.0391 18.414 12.414L20 14M14 8H14.01M6 20H18C19.1046 20 20 19.1046 20 18V6C20 4.89543 19.1046 4 18 4H6C4.89543 4 4 4.89543 4 6V18C4 19.1046 4.89543 20 6 20Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
                    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

                chip.innerHTML = `
                    ${iconSvg}
                    ${itemName}
                    <button type="button" title="Retirer">&times;</button>
                `;

                // Gérer la suppression
                chip.querySelector("button").addEventListener("click", () => {
                    const idx = selectedFiles.indexOf(attachment);
                    if (idx > -1) {
                        selectedFiles.splice(idx, 1);
                    }
                    chip.remove();
                });

                attachmentsPreview.appendChild(chip);
            };

            if (isImage) {
                reader.readAsDataURL(file);
            } else {
                reader.readAsText(file);
            }
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
        
        let displayContent = content;
        const attachedFiles = [];

        // Extraire les fichiers textes
        const textFileRegex = /\n\n--- (.*?) ---\n[\s\S]*?\n--- Fin de \1 ---/g;
        let match;
        while ((match = textFileRegex.exec(content)) !== null) {
            attachedFiles.push({ name: match[1], type: 'text' });
        }
        displayContent = displayContent.replace(textFileRegex, '');

        // Extraire les images
        const imageRegex = /\n\n\[Image jointe: (.*?)\]/g;
        while ((match = imageRegex.exec(displayContent)) !== null) {
            attachedFiles.push({ name: match[1], type: 'image' });
        }
        displayContent = displayContent.replace(imageRegex, '');

        if(role === 'assistant') {
            msgDiv.innerHTML = `<div class="message-content">${marked.parse(displayContent)}</div>`;
        } else {
            msgDiv.innerHTML = `<div class="message-content">${displayContent}</div>`; // texte brut pour l'utilisateur
        }

        // Ajouter les previews sous le message
        if (attachedFiles.length > 0) {
            const attachmentsContainer = document.createElement("div");
            attachmentsContainer.style.display = "flex";
            attachmentsContainer.style.flexWrap = "wrap";
            attachmentsContainer.style.gap = "8px";
            attachmentsContainer.style.marginTop = "8px";

            attachedFiles.forEach(file => {
                const chip = document.createElement("div");
                chip.className = "attachment-chip";
                chip.style.backgroundColor = "rgba(255, 255, 255, 0.05)";
                chip.style.padding = "4px 8px";
                chip.style.borderRadius = "4px";
                chip.style.fontSize = "0.85em";
                chip.style.display = "flex";
                chip.style.alignItems = "center";
                chip.style.gap = "6px";
                chip.style.color = "#ccc";

                const iconSvg = file.type === 'image'
                    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 16L8.586 11.414C8.96106 11.0391 9.46967 10.8284 10 10.8284C10.5303 10.8284 11.0389 11.0391 11.414 11.414L16 16M14 14L15.586 12.414C15.9611 12.0391 16.4697 11.8284 17 11.8284C17.5303 11.8284 18.0389 12.0391 18.414 12.414L20 14M14 8H14.01M6 20H18C19.1046 20 20 19.1046 20 18V6C20 4.89543 19.1046 4 18 4H6C4.89543 4 4 4.89543 4 6V18C4 19.1046 4.89543 20 6 20Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`
                    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

                chip.innerHTML = `${iconSvg} ${file.name}`;
                attachmentsContainer.appendChild(chip);
            });

            msgDiv.appendChild(attachmentsContainer);
        }

        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return msgDiv;
    }

    async function loadModels() {
        try {
            const models = await invoke("get_models");
            
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
            const chatData = await invoke("load_chat", { chatId: chatId });
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
            const chats = await invoke("get_chats");
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
                            const success = await invoke("delete_chat", { chatId: chat.id });
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
        if (window._currentSphereAnimation) {
            window._currentSphereAnimation.stop();
            window._currentSphereAnimation = null;
        }
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

        let finalPrompt = text;
        const imagesToSendLocal = [];
        
        if (selectedFiles.length > 0) {
            for (const file of selectedFiles) {
                if (file.type === 'image') {
                    imagesToSendLocal.push(file.data);
                    finalPrompt += `\n\n[Image jointe: ${file.name}]`;
                } else if (file.type === 'text') {
                    finalPrompt += `\n\n--- ${file.name} ---\n${file.content}\n--- Fin de ${file.name} ---`;
                }
            }
        }

        // User message
        addMessageToUI("user", finalPrompt);
        
        const currentMessage = { role: "user", content: finalPrompt };
        if (imagesToSendLocal.length > 0) {
            currentMessage.images = imagesToSendLocal;
        }
        messages.push(currentMessage);

        // Bot loading message
        currentBotMessageElement = addMessageToUI("assistant", "");
        const contentDiv = currentBotMessageElement.querySelector('.message-content');
        
        // Ajouter la sphère DANS le message mais en DEHORS du parsing Markdown
        const sphereContainer = document.createElement('div');
        sphereContainer.className = 'loading-sphere-container';
        sphereContainer.innerHTML = "<canvas class='mini-sphere'></canvas>";
        currentBotMessageElement.appendChild(sphereContainer);
        
        // Start miniature animation on it
        const loadingCanvas = currentBotMessageElement.querySelector('.mini-sphere');
        if (loadingCanvas && window.startSphereAnimation) {
            window._currentSphereAnimation = window.startSphereAnimation(loadingCanvas, {
                width: 30,
                height: 30,
                radius: 12,
                numDots: 100,
                projScale: 50,
                dotScale: 1
            });
        }
        
        currentBotText = "";

        // Copier les images et vider l'interface avant l'envoi
        const imagesToSend = imagesToSendLocal.length > 0 ? imagesToSendLocal : null;
        selectedFiles = [];
        attachmentsPreview.innerHTML = "";

        try {
            await invoke("send_message", { model: model, messages: messages, images: imagesToSend || null });
        } catch (error) {
            console.error("Erreur:", error);
            if (window._currentSphereAnimation) {
                window._currentSphereAnimation.stop();
                window._currentSphereAnimation = null;
            }
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
            invoke("abort_generation");
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
