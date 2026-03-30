// --- Communication Back-End (Eel) vers Front-End (JavaScript) ---

let messages = [];
let currentBotMessageElement = null;
let currentBotText = "";

// Exposer les fonctions JS à Python via Eel
eel.expose(onStreamChunk);
function onStreamChunk(chunk) {
    if(!currentBotMessageElement) return;
    
    // Si c'est le premier bout, on retire le "..." de chargement
    if(currentBotText === "" && currentBotMessageElement.innerHTML.includes('...')) {
        currentBotMessageElement.innerHTML = "";
    }
    
    currentBotText += chunk;
    currentBotMessageElement.innerHTML = marked.parse(currentBotText);
    
    // Descendre le scroll
    const chatMessages = document.getElementById("chat-messages");
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

eel.expose(onStreamEnd);
function onStreamEnd() {
    // Le stream est fini, on stocke le message final dans l'historique
    messages.push({role: "assistant", content: currentBotText});
    currentBotMessageElement = null;
    
    // On réactive les widgets
    const sendBtn = document.getElementById("send-btn");
    const msgInput = document.getElementById("message-input");
    
    sendBtn.disabled = msgInput.value.trim().length === 0;
    msgInput.disabled = false;
    msgInput.focus();
}

eel.expose(onStreamError);
function onStreamError(err) {
    if(currentBotMessageElement) {
        currentBotMessageElement.innerHTML = marked.parse("`Erreur: " + err + "`");
    }
    document.getElementById("send-btn").disabled = false;
    document.getElementById("message-input").disabled = false;
}

// --- Logique Front-End ---

document.addEventListener("DOMContentLoaded", () => {
    const messageInput = document.getElementById("message-input");
    const sendBtn = document.getElementById("send-btn");
    const modelSelect = document.getElementById("model-select");
    const newChatBtn = document.getElementById("new-chat-btn");
    const emptyState = document.getElementById("empty-state");
    const chatMessages = document.getElementById("chat-messages");
    
    // Nouveaux éléments pour les fichiers
    const addFileBtn = document.getElementById("add-file-btn");
    const fileInput = document.getElementById("file-input");
    const attachmentsPreview = document.getElementById("attachments-preview");
    let selectedImagesBase64 = [];
    
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
            
            modelSelect.innerHTML = "";
            if (!models || models.length === 0) {
                const opt = document.createElement("option");
                opt.textContent = "Aucun modèle trouvé";
                modelSelect.appendChild(opt);
                sendBtn.disabled = true;
            } else {
                models.forEach(m => {
                    const opt = document.createElement("option");
                    opt.value = m;
                    opt.textContent = m; // Affichera le nom brut, ex: 'llama3'
                    modelSelect.appendChild(opt);
                });
                // Évalue si on a du texte de prêt pour activer l'envoi
                sendBtn.disabled = messageInput.value.trim() === "";
            }
        } catch (error) {
            console.error("Erreur de chargement des modèles :", error);
        }
    }

    // Auto-resize de l'input box
    messageInput.addEventListener("input", function() {
        this.style.height = "auto";
        this.style.height = (this.scrollHeight) + "px";
        
        // Activer / désactiver le bouton d'envoi
        if(this.value.trim() !== "" && modelSelect.value !== "") {
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

    loadModels();

    newChatBtn.addEventListener("click", () => {
        messages = [];
        chatMessages.innerHTML = "";
        emptyState.style.display = "flex";
    });

    async function sendMessage() {
        const text = messageInput.value.trim();
        const model = modelSelect.value;
        
        if (!text || !model) return;
        
        // Disable UI
        sendBtn.disabled = true;
        sendBtn.style.backgroundColor = "#444";
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
            sendBtn.disabled = false;
            messageInput.disabled = false;
        }
    }

    sendBtn.addEventListener("click", sendMessage);

    messageInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
});
