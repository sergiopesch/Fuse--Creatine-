/**
 * FUSE Agent Chat Widget
 * A friendly British AI assistant for FUSE
 */

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        maxMessageLength: 2000,
        maxRetries: 2,
        retryDelay: 1000,
        typingIndicatorDelay: 300
    };

    // Chat state
    let isOpen = false;
    let isLoading = false;
    let conversationHistory = [];
    let retryCount = 0;
    let byokMode = false;
    let userApiKey = localStorage.getItem('fuse_chat_api_key') || '';

    // DOM Elements (populated on init)
    let chatWidget, chatToggle, chatWindow, chatMessages, chatInput, chatForm, chatClose;

    // Greeting messages (randomly selected)
    const greetings = [
        "Hello! I'm the FUSE Agent. How can I help you today?",
        "Hi there! Welcome to FUSE. What would you like to know?",
        "Good day! I'm here to answer any questions about FUSE. Fire away!",
        "Hello! Lovely to meet you. Ask me anything about FUSE and our coffee-optimised creatine."
    ];

    // Quick action suggestions
    const quickActions = [
        { label: "What is FUSE?", message: "What is FUSE?" },
        { label: "How does it work?", message: "How does the technology work?" },
        { label: "Dosing guide", message: "How much creatine should I take?" },
        { label: "Is it safe?", message: "Is creatine safe to take?" }
    ];

    // Error messages based on error codes
    const errorMessages = {
        'RATE_LIMITED': "You're sending messages a bit quickly. Please wait a moment and try again.",
        'API_RATE_LIMITED': "I'm receiving a lot of questions right now. Please try again in a moment.",
        'SERVICE_UNAVAILABLE': "I'm temporarily unavailable. Please try again shortly.",
        'API_KEY_REQUIRED': "Please enter your Anthropic API key to start chatting.",
        'API_KEY_MISSING': "The chat service is not configured. Please check the server configuration.",
        'API_KEY_INVALID': "Invalid API key format. Please check your key starts with 'sk-ant-'.",
        'AUTH_FAILED': "Your API key appears to be invalid or expired. Please check it and try again.",
        'CONFIG_ERROR': "I'm having technical difficulties. Please try again later.",
        'NETWORK_ERROR': "I couldn't connect. Please check your internet and try again.",
        'VALIDATION_ERROR': "There was an issue with your message. Please try rephrasing it.",
        'INVALID_MESSAGE': "I couldn't understand that message. Could you try again?",
        'default': "I'm having a bit of trouble right now. Please try again in a moment."
    };

    /**
     * Check API health and detect BYOK mode
     */
    async function checkApiHealth() {
        try {
            const response = await fetch('/api/health');
            const data = await response.json();

            // Check if we're in BYOK mode
            if (data.byok?.enabled || data.mode === 'byok') {
                byokMode = true;
                console.log('[FUSE Chat] Running in BYOK mode - users provide their own API key');
                if (userApiKey) {
                    console.log('[FUSE Chat] User API key found in storage');
                }
                return { byokMode: true, hasStoredKey: !!userApiKey };
            }

            if (data.status === 'degraded' || !data.apiKey?.validFormat) {
                console.warn('[FUSE Chat] API configuration issue detected:');
                if (data.issues) {
                    data.issues.forEach(issue => console.warn('  -', issue));
                }
            } else {
                console.log('[FUSE Chat] API health check passed - server key configured');
            }

            return { byokMode: false, serverConfigured: data.apiKey?.validFormat };
        } catch (error) {
            console.warn('[FUSE Chat] Could not check API health:', error.message);
            return { byokMode: false, error: error.message };
        }
    }

    /**
     * Show API key input UI
     */
    function showApiKeyInput(message = 'Enter your Anthropic API key to start chatting:') {
        removeApiKeyInput();

        const container = document.createElement('div');
        container.className = 'chat-api-key-form';
        container.id = 'chatApiKeyForm';
        container.innerHTML = `
            <p class="chat-api-key-message">${message}</p>
            <div class="chat-api-key-input-row">
                <input
                    type="password"
                    id="chatApiKeyInput"
                    class="chat-api-key-input"
                    placeholder="sk-ant-api03-..."
                    value="${userApiKey}"
                    autocomplete="off"
                />
                <button type="button" id="chatApiKeySave" class="chat-api-key-btn">Save</button>
            </div>
            <p class="chat-api-key-hint">
                Get your key from <a href="https://console.anthropic.com/" target="_blank" rel="noopener">console.anthropic.com</a>
            </p>
        `;

        chatMessages.appendChild(container);
        scrollToBottom();

        // Add event listeners
        const input = document.getElementById('chatApiKeyInput');
        const saveBtn = document.getElementById('chatApiKeySave');

        saveBtn.addEventListener('click', () => saveApiKey(input.value));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveApiKey(input.value);
            }
        });

        input.focus();
    }

    /**
     * Remove API key input UI
     */
    function removeApiKeyInput() {
        const existing = document.getElementById('chatApiKeyForm');
        if (existing) {
            existing.remove();
        }
    }

    /**
     * Save API key
     */
    function saveApiKey(key) {
        const trimmedKey = key?.trim() || '';

        if (!trimmedKey) {
            addMessage('Please enter an API key.', 'assistant', true);
            return;
        }

        if (!trimmedKey.startsWith('sk-ant-')) {
            addMessage('Invalid key format. Your API key should start with "sk-ant-".', 'assistant', true);
            return;
        }

        userApiKey = trimmedKey;
        localStorage.setItem('fuse_chat_api_key', trimmedKey);

        removeApiKeyInput();
        addMessage('API key saved! You can now start chatting.', 'assistant');
        addQuickActions();

        console.log('[FUSE Chat] API key saved successfully');
    }

    /**
     * Clear stored API key
     */
    function clearApiKey() {
        userApiKey = '';
        localStorage.removeItem('fuse_chat_api_key');
        console.log('[FUSE Chat] API key cleared');
    }

    /**
     * Initialize the chat widget
     */
    function init() {
        // Get DOM elements
        chatWidget = document.getElementById('fuseChat');
        chatToggle = document.getElementById('chatToggle');
        chatWindow = document.getElementById('chatWindow');
        chatMessages = document.getElementById('chatMessages');
        chatInput = document.getElementById('chatInput');
        chatForm = document.getElementById('chatForm');
        chatClose = document.getElementById('chatClose');

        if (!chatWidget) {
            console.warn('FUSE Chat: Widget container not found');
            return;
        }

        // Event listeners
        chatToggle.addEventListener('click', toggleChat);
        chatClose.addEventListener('click', closeChat);
        chatForm.addEventListener('submit', handleSubmit);

        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isOpen) {
                closeChat();
            }
        });

        // Close when clicking outside (on mobile)
        chatWidget.addEventListener('click', (e) => {
            if (e.target === chatWidget && isOpen) {
                closeChat();
            }
        });

        // Auto-resize textarea
        chatInput.addEventListener('input', autoResizeInput);

        // Character count validation
        chatInput.addEventListener('input', validateInput);

        // Handle enter key (submit on Enter, new line on Shift+Enter)
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                chatForm.dispatchEvent(new Event('submit'));
            }
        });

        // Check API health on initialization (for developer debugging)
        checkApiHealth();

        console.log('FUSE Chat: Initialized');
    }

    /**
     * Validate input length
     */
    function validateInput() {
        const length = chatInput.value.length;
        if (length > CONFIG.maxMessageLength) {
            chatInput.value = chatInput.value.substring(0, CONFIG.maxMessageLength);
        }
    }

    /**
     * Toggle chat window
     */
    function toggleChat() {
        if (isOpen) {
            closeChat();
        } else {
            openChat();
        }
    }

    /**
     * Open chat window
     */
    function openChat() {
        isOpen = true;
        chatWidget.classList.add('open');
        chatToggle.setAttribute('aria-expanded', 'true');
        chatWindow.setAttribute('aria-hidden', 'false');

        // Add initial greeting if first time
        if (conversationHistory.length === 0) {
            const greeting = greetings[Math.floor(Math.random() * greetings.length)];
            addMessage(greeting, 'assistant');

            // In BYOK mode without a stored key, show API key input
            if (byokMode && !userApiKey) {
                showApiKeyInput();
            } else {
                addQuickActions();
            }
        }

        // Focus input
        setTimeout(() => {
            if (byokMode && !userApiKey) {
                const keyInput = document.getElementById('chatApiKeyInput');
                if (keyInput) keyInput.focus();
            } else {
                chatInput.focus();
            }
        }, CONFIG.typingIndicatorDelay);
    }

    /**
     * Close chat window
     */
    function closeChat() {
        isOpen = false;
        chatWidget.classList.remove('open');
        chatToggle.setAttribute('aria-expanded', 'false');
        chatWindow.setAttribute('aria-hidden', 'true');
    }

    /**
     * Handle form submission
     */
    async function handleSubmit(e) {
        e.preventDefault();

        const message = chatInput.value.trim();
        if (!message || isLoading) return;

        // Validate message length
        if (message.length > CONFIG.maxMessageLength) {
            addMessage(
                `Message is too long. Please keep it under ${CONFIG.maxMessageLength} characters.`,
                'assistant',
                true
            );
            return;
        }

        // Clear input
        chatInput.value = '';
        autoResizeInput();

        // Remove quick actions if present
        removeQuickActions();

        // Add user message
        addMessage(message, 'user');

        // Reset retry count
        retryCount = 0;

        // Send to API
        await sendMessage(message);
    }

    /**
     * Send message to API with retry logic
     */
    async function sendMessage(message, isRetry = false) {
        isLoading = true;

        if (!isRetry) {
            showTypingIndicator();
        }

        try {
            // Build request body - include API key if in BYOK mode
            const requestBody = {
                messages: [{ role: 'user', content: message }],
                conversationHistory: conversationHistory.slice(-10)
            };

            // Add user API key if available (BYOK mode)
            if (userApiKey) {
                requestBody.apiKey = userApiKey;
            }

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            const data = await response.json();

            hideTypingIndicator();

            if (response.ok && data.message) {
                addMessage(data.message, 'assistant');
                retryCount = 0;
            } else {
                // Handle specific error codes
                const errorCode = data.code || 'default';
                const errorMsg = errorMessages[errorCode] || errorMessages['default'];

                // Log configuration hints for developers
                if (data.hint) {
                    console.warn('[FUSE Chat] Configuration issue:', data.error);
                    console.warn('[FUSE Chat] Hint:', data.hint);
                }

                // Check if API key is required - show input form
                if (data.requiresKey || errorCode === 'API_KEY_REQUIRED') {
                    byokMode = true;
                    addMessage(errorMsg, 'assistant', true);
                    showApiKeyInput('Please enter your API key:');
                    isLoading = false;
                    return;
                }

                // Handle auth failures for user keys - might need a new key
                if (errorCode === 'AUTH_FAILED' && userApiKey) {
                    addMessage(errorMsg, 'assistant', true);
                    showApiKeyInput('Your API key may be invalid. Please check it:');
                    isLoading = false;
                    return;
                }

                // Check if we should retry (don't retry config errors)
                const isConfigError = errorCode === 'API_KEY_MISSING' || errorCode === 'API_KEY_INVALID' || errorCode === 'API_KEY_REQUIRED';
                if (!isConfigError && shouldRetry(response.status, errorCode) && retryCount < CONFIG.maxRetries) {
                    retryCount++;
                    showTypingIndicator();
                    setTimeout(() => {
                        sendMessage(message, true);
                    }, CONFIG.retryDelay * retryCount);
                    return;
                }

                addMessage(errorMsg, 'assistant', true);
            }
        } catch (error) {
            console.error('Chat error:', error);
            hideTypingIndicator();

            // Retry on network errors
            if (retryCount < CONFIG.maxRetries) {
                retryCount++;
                showTypingIndicator();
                setTimeout(() => {
                    sendMessage(message, true);
                }, CONFIG.retryDelay * retryCount);
                return;
            }

            addMessage(
                "Sorry, I couldn't connect. Please check your internet and try again.",
                'assistant',
                true
            );
        }

        isLoading = false;
    }

    /**
     * Determine if request should be retried
     */
    function shouldRetry(status, errorCode) {
        // Don't retry client errors or rate limits
        if (status === 400 || status === 429) return false;
        if (errorCode === 'VALIDATION_ERROR' || errorCode === 'INVALID_MESSAGE') return false;
        if (errorCode === 'RATE_LIMITED' || errorCode === 'API_RATE_LIMITED') return false;

        // Retry server errors and network issues
        return status >= 500 || status === 503;
    }

    /**
     * Add message to chat
     */
    function addMessage(content, role, isError = false) {
        const messageEl = document.createElement('div');
        messageEl.className = `chat-message chat-message-${role}${isError ? ' chat-message-error' : ''}`;

        const contentEl = document.createElement('div');
        contentEl.className = 'chat-message-content';
        contentEl.textContent = content;

        messageEl.appendChild(contentEl);
        chatMessages.appendChild(messageEl);

        // Store in history (don't store error messages or greeting)
        if (!isError && role !== 'assistant' || (role === 'assistant' && conversationHistory.length > 0)) {
            conversationHistory.push({ role, content });
        }

        // Scroll to bottom
        scrollToBottom();
    }

    /**
     * Add quick action buttons
     */
    function addQuickActions() {
        const actionsEl = document.createElement('div');
        actionsEl.className = 'chat-quick-actions';
        actionsEl.id = 'chatQuickActions';

        quickActions.forEach(action => {
            const btn = document.createElement('button');
            btn.className = 'chat-quick-btn';
            btn.textContent = action.label;
            btn.type = 'button';
            btn.addEventListener('click', () => {
                if (isLoading) return;
                removeQuickActions();
                chatInput.value = action.message;
                chatForm.dispatchEvent(new Event('submit'));
            });
            actionsEl.appendChild(btn);
        });

        chatMessages.appendChild(actionsEl);
        scrollToBottom();
    }

    /**
     * Remove quick actions
     */
    function removeQuickActions() {
        const actionsEl = document.getElementById('chatQuickActions');
        if (actionsEl) {
            actionsEl.remove();
        }
    }

    /**
     * Show typing indicator
     */
    function showTypingIndicator() {
        // Remove existing indicator first
        hideTypingIndicator();

        const indicator = document.createElement('div');
        indicator.className = 'chat-typing';
        indicator.id = 'chatTyping';
        indicator.setAttribute('aria-label', 'FUSE Agent is typing');
        indicator.innerHTML = `
            <span></span>
            <span></span>
            <span></span>
        `;
        chatMessages.appendChild(indicator);
        scrollToBottom();
    }

    /**
     * Hide typing indicator
     */
    function hideTypingIndicator() {
        const indicator = document.getElementById('chatTyping');
        if (indicator) {
            indicator.remove();
        }
    }

    /**
     * Scroll chat to bottom
     */
    function scrollToBottom() {
        requestAnimationFrame(() => {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        });
    }

    /**
     * Auto-resize input textarea
     */
    function autoResizeInput() {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose API for external use
    window.FUSEChat = {
        open: openChat,
        close: closeChat,
        toggle: toggleChat,
        isOpen: () => isOpen,
        clearHistory: () => {
            conversationHistory = [];
            if (chatMessages) {
                chatMessages.innerHTML = '';
            }
        },
        checkHealth: checkApiHealth,
        // BYOK API key management
        setApiKey: saveApiKey,
        clearApiKey: () => {
            clearApiKey();
            if (chatMessages) {
                chatMessages.innerHTML = '';
                conversationHistory = [];
            }
        },
        hasApiKey: () => !!userApiKey,
        isByokMode: () => byokMode
    };

})();
