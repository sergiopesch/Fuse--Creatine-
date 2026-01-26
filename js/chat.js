/**
 * FUSE Agent Chat Widget v2.0
 * Premium chat experience with smooth animations,
 * intelligent email capture, and conversion-focused design
 */

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        maxMessageLength: 2000,
        maxRetries: 2,
        retryDelay: 1000,
        typingIndicatorDelay: 300,
        messagesBeforeEmailPrompt: 3, // Prompt for email after this many exchanges
        emailCaptureDelay: 500
    };

    // Chat state
    let state = {
        isOpen: false,
        isLoading: false,
        showWelcome: true,
        hasShownEmailCapture: false,
        emailCaptured: false,
        messageCount: 0,
        conversationHistory: [],
        retryCount: 0,
        sessionTerminated: false // Security: track if session was terminated
    };

    // DOM Elements
    let elements = {};

    // Welcome messages - make a great first impression
    const welcomeConfig = {
        title: "Hey! I'm the FUSE Agent",
        subtitle: "Your personal guide to optimized creatine supplementation. Ask me anything!",
        features: [
            { icon: "zap", text: "Instant answers about FUSE" },
            { icon: "shield", text: "Science-backed information" },
            { icon: "clock", text: "Available 24/7" }
        ]
    };

    // Quick action suggestions
    const quickActions = [
        { label: "What makes FUSE different?", message: "What makes FUSE different from regular creatine?" },
        { label: "How do I take it?", message: "How should I take FUSE for best results?" },
        { label: "Is it safe?", message: "Is creatine safe? Any side effects?" },
        { label: "When is it launching?", message: "When is FUSE launching? How can I get early access?" }
    ];

    // Error messages
    const errorMessages = {
        'RATE_LIMITED': "Easy there! Give it a moment and try again.",
        'API_RATE_LIMITED': "High demand right now - try again in a sec.",
        'SERVICE_UNAVAILABLE': "Having a moment here. Try again shortly!",
        'AUTH_FAILED': "Technical hiccup on our end. Please try again.",
        'NETWORK_ERROR': "Can't connect - check your internet and retry.",
        'VALIDATION_ERROR': "Didn't quite catch that. Could you rephrase?",
        'default': "Something went wrong. Please try again!"
    };

    // SVG Icons
    const icons = {
        zap: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,
        shield: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
        clock: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
        send: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`,
        close: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
        chat: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`,
        check: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
        sparkle: `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z"/></svg>`,
        mail: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>`,
        arrowRight: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>`
    };

    /**
     * Initialize the chat widget
     */
    function init() {
        elements.chatWidget = document.getElementById('fuseChat');
        if (!elements.chatWidget) {
            console.warn('FUSE Chat: Widget container not found');
            return;
        }

        // Get all DOM elements
        elements.chatToggle = document.getElementById('chatToggle');
        elements.chatWindow = document.getElementById('chatWindow');
        elements.chatMessages = document.getElementById('chatMessages');
        elements.chatInput = document.getElementById('chatInput');
        elements.chatForm = document.getElementById('chatForm');
        elements.chatClose = document.getElementById('chatClose');

        // Event listeners
        elements.chatToggle.addEventListener('click', toggleChat);
        elements.chatClose.addEventListener('click', closeChat);
        elements.chatForm.addEventListener('submit', handleSubmit);

        // Keyboard handling
        document.addEventListener('keydown', handleKeydown);
        elements.chatInput.addEventListener('keydown', handleInputKeydown);
        elements.chatInput.addEventListener('input', handleInputChange);

        // Close on click outside
        elements.chatWidget.addEventListener('click', (e) => {
            if (e.target === elements.chatWidget && state.isOpen) {
                closeChat();
            }
        });

        // Check API health
        checkApiHealth();

        console.log('FUSE Chat: Initialized v2.0');
    }

    /**
     * Handle keyboard events
     */
    function handleKeydown(e) {
        if (e.key === 'Escape' && state.isOpen) {
            closeChat();
        }
    }

    /**
     * Handle input keyboard events
     */
    function handleInputKeydown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            elements.chatForm.dispatchEvent(new Event('submit'));
        }
    }

    /**
     * Handle input changes
     */
    function handleInputChange() {
        autoResizeInput();
        updateCharCount();
    }

    /**
     * Toggle chat window
     */
    function toggleChat() {
        if (state.isOpen) {
            closeChat();
        } else {
            openChat();
        }
    }

    /**
     * Open chat window
     */
    function openChat() {
        state.isOpen = true;
        elements.chatWidget.classList.add('open');
        elements.chatToggle.setAttribute('aria-expanded', 'true');
        elements.chatWindow.setAttribute('aria-hidden', 'false');

        // Show welcome screen or messages
        if (state.showWelcome && state.conversationHistory.length === 0) {
            renderWelcomeScreen();
        }

        // Focus input after animation
        setTimeout(() => {
            if (!state.showWelcome) {
                elements.chatInput.focus();
            }
        }, 350);
    }

    /**
     * Close chat window
     */
    function closeChat() {
        state.isOpen = false;
        elements.chatWidget.classList.remove('open');
        elements.chatToggle.setAttribute('aria-expanded', 'false');
        elements.chatWindow.setAttribute('aria-hidden', 'true');
    }

    /**
     * Render welcome screen
     */
    function renderWelcomeScreen() {
        const welcomeHTML = `
            <div class="chat-welcome" id="chatWelcome">
                <div class="chat-welcome-header">
                    <div class="chat-welcome-avatar">
                        <span class="chat-welcome-avatar-icon">${icons.sparkle}</span>
                    </div>
                    <h3 class="chat-welcome-title">${welcomeConfig.title}</h3>
                    <p class="chat-welcome-subtitle">${welcomeConfig.subtitle}</p>
                </div>

                <div class="chat-welcome-features">
                    ${welcomeConfig.features.map(f => `
                        <div class="chat-welcome-feature">
                            <span class="chat-welcome-feature-icon">${icons[f.icon]}</span>
                            <span>${f.text}</span>
                        </div>
                    `).join('')}
                </div>

                <div class="chat-welcome-actions">
                    <p class="chat-welcome-prompt">Popular questions:</p>
                    ${quickActions.map((action, i) => `
                        <button class="chat-welcome-btn" data-message="${action.message}" style="animation-delay: ${i * 0.05}s">
                            ${action.label}
                            <span class="chat-welcome-btn-arrow">${icons.arrowRight}</span>
                        </button>
                    `).join('')}
                </div>

                <div class="chat-welcome-footer">
                    <button class="chat-start-btn" id="chatStartBtn">
                        Start chatting
                        ${icons.arrowRight}
                    </button>
                </div>
            </div>
        `;

        elements.chatMessages.innerHTML = welcomeHTML;

        // Add event listeners to welcome buttons
        const welcomeBtns = elements.chatMessages.querySelectorAll('.chat-welcome-btn');
        welcomeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const message = btn.dataset.message;
                hideWelcomeAndStart(message);
            });
        });

        const startBtn = document.getElementById('chatStartBtn');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                hideWelcomeAndStart();
            });
        }
    }

    /**
     * Hide welcome screen and start chat
     */
    function hideWelcomeAndStart(initialMessage = null) {
        state.showWelcome = false;

        const welcomeEl = document.getElementById('chatWelcome');
        if (welcomeEl) {
            welcomeEl.classList.add('chat-welcome-exit');
            setTimeout(() => {
                elements.chatMessages.innerHTML = '';

                // Add greeting
                const hour = new Date().getHours();
                const timeGreeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
                addMessage(`Good ${timeGreeting}! I'm here to help you learn about FUSE. What would you like to know?`, 'assistant');

                // If there's an initial message, send it
                if (initialMessage) {
                    setTimeout(() => {
                        addMessage(initialMessage, 'user');
                        sendMessage(initialMessage);
                    }, 300);
                }

                elements.chatInput.focus();
            }, 200);
        }
    }

    /**
     * Handle form submission
     */
    async function handleSubmit(e) {
        e.preventDefault();

        const message = elements.chatInput.value.trim();
        if (!message || state.isLoading) return;

        if (message.length > CONFIG.maxMessageLength) {
            addMessage(`Please keep your message under ${CONFIG.maxMessageLength} characters.`, 'assistant', true);
            return;
        }

        // Clear input
        elements.chatInput.value = '';
        autoResizeInput();
        hideCharCount();

        // If still on welcome screen, hide it first
        if (state.showWelcome) {
            hideWelcomeAndStart(message);
            return;
        }

        // Add user message
        addMessage(message, 'user');

        // Reset retry count
        state.retryCount = 0;

        // Send to API
        await sendMessage(message);
    }

    /**
     * Send message to API
     */
    async function sendMessage(message, isRetry = false) {
        // Security: Don't allow messages if session was terminated
        if (state.sessionTerminated) {
            addMessage("This chat session has ended. Please refresh the page to start a new conversation.", 'assistant', true);
            return;
        }

        state.isLoading = true;

        if (!isRetry) {
            showTypingIndicator();
        }

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [{ role: 'user', content: message }],
                    conversationHistory: state.conversationHistory.slice(-10)
                })
            });

            const data = await response.json();
            hideTypingIndicator();

            if (response.ok && data.message) {
                addMessage(data.message, 'assistant');
                state.retryCount = 0;
                state.messageCount++;

                // Security: Handle session termination signal from server
                if (data.sessionTerminated) {
                    handleSessionTermination();
                } else {
                    // Check if we should prompt for email
                    checkEmailCaptureOpportunity();
                }
            } else {
                handleError(response.status, data.code, message);
            }
        } catch (error) {
            console.error('Chat error:', error);
            hideTypingIndicator();
            handleNetworkError(message);
        }

        state.isLoading = false;
    }

    /**
     * Handle API errors
     */
    function handleError(status, errorCode, originalMessage) {
        const shouldRetry = status >= 500 &&
            errorCode !== 'RATE_LIMITED' &&
            errorCode !== 'API_RATE_LIMITED' &&
            state.retryCount < CONFIG.maxRetries;

        if (shouldRetry) {
            state.retryCount++;
            showTypingIndicator();
            setTimeout(() => sendMessage(originalMessage, true), CONFIG.retryDelay * state.retryCount);
            return;
        }

        const errorMsg = errorMessages[errorCode] || errorMessages['default'];
        addMessage(errorMsg, 'assistant', true);
    }

    /**
     * Handle network errors
     */
    function handleNetworkError(originalMessage) {
        if (state.retryCount < CONFIG.maxRetries) {
            state.retryCount++;
            showTypingIndicator();
            setTimeout(() => sendMessage(originalMessage, true), CONFIG.retryDelay * state.retryCount);
            return;
        }

        addMessage("Can't connect right now. Please check your internet and try again.", 'assistant', true);
    }

    /**
     * Handle session termination (security measure)
     * Called when the server detects suspicious activity
     */
    function handleSessionTermination() {
        state.sessionTerminated = true;

        // Disable the input
        if (elements.chatInput) {
            elements.chatInput.disabled = true;
            elements.chatInput.placeholder = 'Session ended - refresh to start new chat';
        }

        // Disable the submit button
        const submitBtn = elements.chatForm?.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
        }

        // Add visual indication
        if (elements.chatWindow) {
            elements.chatWindow.classList.add('chat-session-terminated');
        }

        // Clear conversation history (security measure)
        state.conversationHistory = [];

        console.log('[FUSE Chat] Session terminated by server');
    }

    /**
     * Add message to chat
     */
    function addMessage(content, role, isError = false) {
        const messageEl = document.createElement('div');
        messageEl.className = `chat-message chat-message-${role}${isError ? ' chat-message-error' : ''}`;

        const bubbleEl = document.createElement('div');
        bubbleEl.className = 'chat-message-bubble';

        const contentEl = document.createElement('div');
        contentEl.className = 'chat-message-content';
        contentEl.textContent = content;

        bubbleEl.appendChild(contentEl);
        messageEl.appendChild(bubbleEl);

        elements.chatMessages.appendChild(messageEl);

        // Store in history (not errors)
        if (!isError) {
            state.conversationHistory.push({ role, content });
        }

        // Scroll to bottom
        scrollToBottom();
    }

    /**
     * Check if we should show email capture
     */
    function checkEmailCaptureOpportunity() {
        if (state.hasShownEmailCapture || state.emailCaptured) return;
        if (state.messageCount < CONFIG.messagesBeforeEmailPrompt) return;

        // Show email capture after a short delay
        setTimeout(() => {
            showEmailCapture();
        }, CONFIG.emailCaptureDelay);
    }

    /**
     * Show email capture inline
     */
    function showEmailCapture() {
        if (state.hasShownEmailCapture) return;
        state.hasShownEmailCapture = true;

        const captureEl = document.createElement('div');
        captureEl.className = 'chat-email-capture';
        captureEl.id = 'chatEmailCapture';
        captureEl.innerHTML = `
            <div class="chat-email-capture-inner">
                <div class="chat-email-capture-header">
                    <span class="chat-email-capture-icon">${icons.mail}</span>
                    <div>
                        <h4>Enjoying the chat?</h4>
                        <p>Get early access to FUSE when we launch!</p>
                    </div>
                </div>
                <form class="chat-email-form" id="chatEmailForm">
                    <div class="chat-email-form-row">
                        <input type="text" id="chatEmailName" placeholder="Your name" class="chat-email-input" required />
                    </div>
                    <div class="chat-email-form-row">
                        <input type="email" id="chatEmailInput" placeholder="your@email.com" class="chat-email-input" required />
                    </div>
                    <div class="chat-email-consent">
                        <label class="chat-email-checkbox-label">
                            <input type="checkbox" id="chatEmailConsent" required />
                            <span class="chat-email-checkbox-custom"></span>
                            <span>I agree to receive updates about FUSE</span>
                        </label>
                    </div>
                    <button type="submit" class="chat-email-submit">
                        Join the waitlist
                        ${icons.arrowRight}
                    </button>
                </form>
                <button class="chat-email-dismiss" id="chatEmailDismiss">Maybe later</button>
            </div>
        `;

        elements.chatMessages.appendChild(captureEl);
        scrollToBottom();

        // Add event listeners
        const form = document.getElementById('chatEmailForm');
        const dismissBtn = document.getElementById('chatEmailDismiss');

        form.addEventListener('submit', handleEmailSubmit);
        dismissBtn.addEventListener('click', () => {
            captureEl.classList.add('chat-email-capture-dismissed');
            setTimeout(() => captureEl.remove(), 300);
        });
    }

    /**
     * Handle email form submission
     */
    async function handleEmailSubmit(e) {
        e.preventDefault();

        const nameInput = document.getElementById('chatEmailName');
        const emailInput = document.getElementById('chatEmailInput');
        const consentInput = document.getElementById('chatEmailConsent');
        const submitBtn = e.target.querySelector('.chat-email-submit');

        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const consent = consentInput.checked;

        if (!name || !email || !consent) return;

        // Show loading state
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span class="chat-email-loading"></span> Joining...`;

        try {
            const response = await fetch('/api/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fullName: name,
                    email: email,
                    mainInterest: 'Chat widget signup',
                    consentToContact: true,
                    policyVersion: '1.0'
                })
            });

            const captureEl = document.getElementById('chatEmailCapture');

            if (response.ok) {
                state.emailCaptured = true;

                // Show success state
                captureEl.innerHTML = `
                    <div class="chat-email-success">
                        <span class="chat-email-success-icon">${icons.check}</span>
                        <h4>You're on the list!</h4>
                        <p>We'll let you know when FUSE launches.</p>
                    </div>
                `;

                // Remove after delay
                setTimeout(() => {
                    captureEl.classList.add('chat-email-capture-dismissed');
                    setTimeout(() => captureEl.remove(), 300);
                }, 3000);

                // Add a message
                setTimeout(() => {
                    addMessage("Thanks for joining! You'll be among the first to know when FUSE launches. Is there anything else you'd like to know?", 'assistant');
                }, 500);
            } else {
                const data = await response.json();
                throw new Error(data.error || 'Failed to join');
            }
        } catch (error) {
            console.error('Signup error:', error);
            submitBtn.disabled = false;
            submitBtn.innerHTML = `Try again ${icons.arrowRight}`;

            // Show error message
            const errorEl = document.createElement('p');
            errorEl.className = 'chat-email-error';
            errorEl.textContent = error.message || 'Something went wrong. Please try again.';
            e.target.appendChild(errorEl);
            setTimeout(() => errorEl.remove(), 3000);
        }
    }

    /**
     * Show typing indicator
     */
    function showTypingIndicator() {
        hideTypingIndicator();

        const indicator = document.createElement('div');
        indicator.className = 'chat-typing';
        indicator.id = 'chatTyping';
        indicator.setAttribute('aria-label', 'FUSE Agent is typing');
        indicator.innerHTML = `
            <div class="chat-typing-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;
        elements.chatMessages.appendChild(indicator);
        scrollToBottom();
    }

    /**
     * Hide typing indicator
     */
    function hideTypingIndicator() {
        const indicator = document.getElementById('chatTyping');
        if (indicator) indicator.remove();
    }

    /**
     * Scroll chat to bottom smoothly
     */
    function scrollToBottom() {
        // Use requestAnimationFrame for smooth scrolling
        requestAnimationFrame(() => {
            const container = elements.chatMessages;
            const scrollHeight = container.scrollHeight;
            const height = container.clientHeight;
            const maxScroll = scrollHeight - height;

            // Smooth scroll animation
            const startScroll = container.scrollTop;
            const distance = maxScroll - startScroll;
            const duration = 200;
            let startTime = null;

            function animateScroll(currentTime) {
                if (!startTime) startTime = currentTime;
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // Ease out cubic
                const easeOut = 1 - Math.pow(1 - progress, 3);
                container.scrollTop = startScroll + (distance * easeOut);

                if (progress < 1) {
                    requestAnimationFrame(animateScroll);
                }
            }

            if (distance > 0) {
                requestAnimationFrame(animateScroll);
            }
        });
    }

    /**
     * Auto-resize input textarea
     */
    function autoResizeInput() {
        const input = elements.chatInput;
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 100) + 'px';
    }

    /**
     * Update character count
     */
    function updateCharCount() {
        const length = elements.chatInput.value.length;
        let counter = document.getElementById('chatCharCount');

        if (!counter) {
            counter = document.createElement('span');
            counter.id = 'chatCharCount';
            counter.className = 'chat-char-count';
            elements.chatForm.appendChild(counter);
        }

        if (length > CONFIG.maxMessageLength * 0.8) {
            counter.textContent = `${length}/${CONFIG.maxMessageLength}`;
            counter.classList.toggle('chat-char-count-warning', length > CONFIG.maxMessageLength * 0.95);
            counter.style.opacity = '1';
        } else {
            counter.style.opacity = '0';
        }
    }

    /**
     * Hide character count
     */
    function hideCharCount() {
        const counter = document.getElementById('chatCharCount');
        if (counter) counter.style.opacity = '0';
    }

    /**
     * Check API health
     */
    async function checkApiHealth() {
        try {
            const response = await fetch('/api/health');
            const data = await response.json();
            if (data.status === 'degraded') {
                console.warn('[FUSE Chat] API degraded:', data.issues);
            }
        } catch (error) {
            console.warn('[FUSE Chat] Health check failed:', error.message);
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose API
    window.FUSEChat = {
        open: openChat,
        close: closeChat,
        toggle: toggleChat,
        isOpen: () => state.isOpen,
        clearHistory: () => {
            state.conversationHistory = [];
            state.messageCount = 0;
            state.hasShownEmailCapture = false;
            state.showWelcome = true;
            state.sessionTerminated = false;

            // Re-enable input if it was disabled
            if (elements.chatInput) {
                elements.chatInput.disabled = false;
                elements.chatInput.placeholder = 'Ask about FUSE...';
            }
            const submitBtn = elements.chatForm?.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = false;
            }
            if (elements.chatWindow) {
                elements.chatWindow.classList.remove('chat-session-terminated');
            }

            if (elements.chatMessages) {
                elements.chatMessages.innerHTML = '';
            }
        },
        checkHealth: checkApiHealth
    };

})();
