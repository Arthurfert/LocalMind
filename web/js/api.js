// --- Communication Back-End (Tauri IPC) vers Front-End ---

const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

if (window.marked) {
    marked.setOptions({
        breaks: true,
        gfm: true
    });
}

function renderMarkdown(content) {
    return window.marked ? marked.parse(content) : content;
}

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
listen('confirmation-demand', (event) => {
    onConfirmationDemand(event.payload);
});

function onConfirmationDemand(payload) {
    const { id, tool, message } = payload;
    const modal = document.getElementById("mcp-approval-modal");
    const textEl = document.getElementById("mcp-approval-text");
    const confirmBtn = document.getElementById("confirm-approval-btn");
    const cancelBtn = document.getElementById("cancel-approval-btn");
    
    textEl.textContent = `L'outil "${tool}" demande une confirmation :\n\n${message}`;
    modal.style.display = "flex";
    void modal.offsetWidth;
    modal.classList.add("show");
    
    const cleanup = () => {
        modal.classList.remove("show");
        setTimeout(() => {
            modal.style.display = "none";
        }, 200);
        confirmBtn.onclick = null;
        cancelBtn.onclick = null;
    };
    
    confirmBtn.onclick = () => {
        cleanup();
        invoke('resolve_confirmation', { id: id, confirmed: true });
    };
    
    cancelBtn.onclick = () => {
        cleanup();
        invoke('resolve_confirmation', { id: id, confirmed: false });
    };
}

function onStreamChunk(chunk) {
    if(!currentBotMessageElement) return;
    
    currentBotText += chunk;
    const contentDiv = currentBotMessageElement.querySelector('.message-content');
    if (contentDiv) {
        contentDiv.innerHTML = renderMarkdown(currentBotText);
    } else {
        currentBotMessageElement.innerHTML = renderMarkdown(currentBotText);
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

    // Mettre à jour l'indicateur de répertoire après chaque exécution d'outil potentielle
    try {
        window.__TAURI__.core.invoke('get_current_dir').then(dir => {
            const locPath = document.getElementById('model-location-path');
            if (locPath) {
                const parts = dir.split(/[/\\]/);
                const base = parts.pop() || dir;
                const prefix = parts.length > 0 ? parts.join('\\') + '\\' : '';
                locPath.innerHTML = `<span class="path-prefix">${prefix}</span><span class="path-base">${base}</span>`;
                locPath.parentElement.title = dir;
            }
        }).catch(err => console.error(err));
    } catch(e) {}
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
            contentDiv.innerHTML = renderMarkdown("`Erreur: " + err + "`");
        } else {
            currentBotMessageElement.innerHTML = renderMarkdown("`Erreur: " + err + "`");
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



