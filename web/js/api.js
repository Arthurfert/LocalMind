// --- Communication Back-End (Eel) vers Front-End (JavaScript) ---

var messages = [];
var currentBotMessageElement = null;
var currentBotText = "";
var isGenerating = false;
var currentChatId = null;
var currentChatTitle = "";

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
    isGenerating = false;
    
    // Sauvegarder la discussion
    const dropdownSelected = document.getElementById("dropdown-selected");
    const model = dropdownSelected ? dropdownSelected.textContent : "";
    eel.save_chat(currentChatId, currentChatTitle, messages, model)(id => {
        if (id && id !== currentChatId) {
            currentChatId = id;
            // On met à jour l'historique fraîchement
            if (typeof loadHistory === "function") loadHistory();
        }
    });

    // On réactive les widgets
    const sendBtn = document.getElementById("send-btn");
    const msgInput = document.getElementById("message-input");
    
    // Rétablir l'icône d'envoi
    sendBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 19V5M12 5L5 12M12 5L19 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    `;

    // Si le textarea a du texte, on l'active visuellement
    if (msgInput.value.trim().length > 0) {
        sendBtn.disabled = false;
        sendBtn.style.color = "#ffffff";
        sendBtn.style.backgroundColor = "#ECECEC";
        sendBtn.style.color = "#000000";
    } else {
        sendBtn.disabled = true;
        sendBtn.style.backgroundColor = "#444";
        sendBtn.style.color = "#909090";
    }

    msgInput.disabled = false;
    msgInput.focus();
}

eel.expose(onStreamError);
function onStreamError(err) {
    if(currentBotMessageElement) {
        currentBotMessageElement.innerHTML = marked.parse("`Erreur: " + err + "`");
    }
    isGenerating = false;
    const sendBtn = document.getElementById("send-btn");
    
    sendBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 19V5M12 5L5 12M12 5L19 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
    `;
    
    document.getElementById("message-input").disabled = false;
    if (document.getElementById("message-input").value.trim().length > 0) {
        sendBtn.disabled = false;
        sendBtn.style.backgroundColor = "#ECECEC";
        sendBtn.style.color = "#000000";
    } else {
        sendBtn.disabled = true;
        sendBtn.style.backgroundColor = "#444";
        sendBtn.style.color = "#909090";
    }
}



