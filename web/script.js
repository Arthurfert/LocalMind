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
    document.getElementById("send-btn").disabled = false;
    const msgInput = document.getElementById("message-input");
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

// --- Logique Front-End (Initialement gérée par le DOM) ---

document.addEventListener("DOMContentLoaded", () => {
    const messageInput = document.getElementById("message-input");
    const sendBtn = document.getElementById("send-btn");
    const modelSelect = document.getElementById("model-select");
    const refreshBtn = document.getElementById("refresh-models");
    const newChatBtn = document.getElementById("new-chat-btn");

    function addMessageToUI(role, content) {
        const chatMessages = document.getElementById("chat-messages");
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
            // L'appel à Eel via "eel.fonction_name()()" 
            // Notez les doubles () : la première renvoie une fonction liée à Python, 
            // la 2ème l'exécute de manière asynchrone (Promesse).
            const models = await eel.get_models()();
            
            modelSelect.innerHTML = "";
            if (!models || models.length === 0) {
                const opt = document.createElement("option");
                opt.textContent = "Aucun modèle local trouvé (Ollama éteint?)";
                modelSelect.appendChild(opt);
            } else {
                models.forEach(m => {
                    const opt = document.createElement("option");
                    opt.value = m;
                    opt.textContent = m;
                    modelSelect.appendChild(opt);
                });
            }
        } catch (error) {
            console.error("Erreur de chargement des modèles :", error);
        }
    }

    // Charger les modèles dès l'ouverture de l'application
    loadModels();
    refreshBtn.addEventListener("click", loadModels);

    newChatBtn.addEventListener("click", () => {
        messages = [];
        document.getElementById("chat-messages").innerHTML = "";
    });

    async function sendMessage() {
        const text = messageInput.value.trim();
        const model = modelSelect.value;
        
        if (!text || !model) return;
        
        // Désactiver l'interface
        sendBtn.disabled = true;
        messageInput.disabled = true;
        messageInput.value = "";
        
        // Ajouter le message utilisateur dans le Front
        addMessageToUI("user", text);
        messages.push({role: "user", content: text});
        
        // Préparer un encart pour la réponse du Bot
        currentBotMessageElement = addMessageToUI("assistant", "...");
        currentBotText = "";
        
        try {
            // Appeler Python !
            await eel.send_message(model, messages, null)();
            // L'envoi va trigger onStreamChunk via Python.
        } catch (error) {
            console.error("Erreur:", error);
            currentBotMessageElement.textContent = "Erreur (vériez si Ollama est lancé): " + error;
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
