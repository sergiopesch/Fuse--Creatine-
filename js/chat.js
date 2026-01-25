/**
 * FUSE Agent Chat Widget
 * A friendly British AI assistant for FUSE
 */

(function() {
    'use strict';

    // Chat state
    let isOpen = false;
    let isLoading = false;
    let conversationHistory = [];

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
        }, 300);
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

        // Clear input
        chatInput.value = '';
        autoResizeInput();

        // Remove quick actions if present
        removeQuickActions();

        // Add user message
        addMessage(message, 'user');

        // Send to API
        await sendMessage(message);
    }

    /**
     * Send message to API
     */
    async function sendMessage(message) {
        isLoading = true;
        showTypingIndicator();

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
            } else {
                addMessage(
                    data.error || "I'm having a bit of trouble right now. Please try again in a moment.",
                    'assistant',
                    true
                );
            }
        } catch (error) {
            console.error('Chat error:', error);
            hideTypingIndicator();
            addMessage(
                "Sorry, I couldn't connect. Please check your internet and try again.",
                'assistant',
                true
            );
        }

        isLoading = false;
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

        // Store in history
        conversationHistory.push({ role, content });

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
            btn.addEventListener('click', () => {
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
        const indicator = document.createElement('div');
        indicator.className = 'chat-typing';
        indicator.id = 'chatTyping';
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
        chatMessages.scrollTop = chatMessages.scrollHeight;
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
        toggle: toggleChat
    };

})();
