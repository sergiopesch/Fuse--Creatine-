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
        'AUTH_FAILED': "I'm having technical difficulties. Please try again later.",
        'CONFIG_ERROR': "I'm having technical difficulties. Please try again later.",
        'NETWORK_ERROR': "I couldn't connect. Please check your internet and try again.",
        'VALIDATION_ERROR': "There was an issue with your message. Please try rephrasing it.",
        'INVALID_MESSAGE': "I couldn't understand that message. Could you try again?",
        'default': "I'm having a bit of trouble right now. Please try again in a moment."
    };

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
            addQuickActions();
        }

        // Focus input
        setTimeout(() => {
            chatInput.focus();
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
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: message }],
                    conversationHistory: conversationHistory.slice(-10)
                })
            });

            const data = await response.json();

            hideTypingIndicator();

            if (response.ok && data.message) {
                addMessage(data.message, 'assistant');
                retryCount = 0;
            } else {
                // Handle specific error codes
                const errorCode = data.code || 'default';
                const errorMessage = errorMessages[errorCode] || errorMessages['default'];

                // Check if we should retry
                if (shouldRetry(response.status, errorCode) && retryCount < CONFIG.maxRetries) {
                    retryCount++;
                    showTypingIndicator();
                    setTimeout(() => {
                        sendMessage(message, true);
                    }, CONFIG.retryDelay * retryCount);
                    return;
                }

                addMessage(errorMessage, 'assistant', true);
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
        }
    };

})();
