// --- Communication Back-End (Tauri IPC) vers Front-End ---

const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

var messages = [];
var currentBotMessageElement = null;
var currentBotText = "";
var isGenerating = false;
var currentChatId = null;
var currentChatTitle = "";

// Écouter les événements de stream de Tauri
listen('stream-chunk', (event) => {
    onStreamChunk(event.payload);
});
listen('stream-end', () => {
    onStreamEnd();
});
listen('stream-error', (event) => {
    onStreamError(event.payload);
});

function onStreamChunk(chunk) {
    if(!currentBotMessageElement) return;
    
    currentBotText += chunk;
    const contentDiv = currentBotMessageElement.querySelector('.message-content');
    if (contentDiv) {
        contentDiv.innerHTML = marked.parse(currentBotText);
    } else {
        currentBotMessageElement.innerHTML = marked.parse(currentBotText);
    }
    
    // Descendre le scroll
    const chatMessages = document.getElementById("chat-messages");
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function onStreamEnd() {
    if (window._currentSphereAnimation) {
        window._currentSphereAnimation.stop();
        window._currentSphereAnimation = null;
    }
    if (currentBotMessageElement) {
        const sphereContainer = currentBotMessageElement.querySelector('.loading-sphere-container');
        if (sphereContainer) {
            sphereContainer.remove();
        }
    }
    // Le stream est fini, on stocke le message final dans l'historique
    messages.push({role: "assistant", content: currentBotText});
    currentBotMessageElement = null;
    isGenerating = false;
    
    // Sauvegarder la discussion
    const dropdownSelected = document.getElementById("dropdown-selected");
    const model = dropdownSelected ? dropdownSelected.textContent : "";
    
    invoke('save_chat', { chatId: currentChatId, title: currentChatTitle, messages: messages, model: model }).then(id => {
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

function onStreamError(err) {
    if (window._currentSphereAnimation) {
        window._currentSphereAnimation.stop();
        window._currentSphereAnimation = null;
    }
    if(currentBotMessageElement) {
        const sphereContainer = currentBotMessageElement.querySelector('.loading-sphere-container');
        if (sphereContainer) sphereContainer.remove();
        
        const contentDiv = currentBotMessageElement.querySelector('.message-content');
        if (contentDiv) {
            contentDiv.innerHTML = marked.parse("`Erreur: " + err + "`");
        } else {
            currentBotMessageElement.innerHTML = marked.parse("`Erreur: " + err + "`");
        }
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



