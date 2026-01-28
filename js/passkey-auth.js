/**
 * FUSE Passkey Authentication Client
 * Modern passkey authentication with WebAuthn
 *
 * Features:
 * - Passkey registration and authentication
 * - Conditional UI (autofill) support
 * - Cross-device sync support
 * - Session management
 *
 * @version 1.0.0
 */

const PasskeyAuth = (() => {
    'use strict';

    // ============================================
    // CONFIGURATION
    // ============================================

    const CONFIG = {
        RP_NAME: 'FUSE Command Center',
        RP_ID: window.location.hostname,
        API_BASE: '/api',
        SESSION_TOKEN_KEY: 'fuse_passkey_session',
        USER_EMAIL_KEY: 'fuse_passkey_email',
        SESSION_DURATION: 30 * 60 * 1000, // 30 minutes
    };

    // ============================================
    // STATE
    // ============================================

    const state = {
        isSupported: false,
        platformAuthenticator: false,
        conditionalUISupported: false,
        isAuthenticated: false,
        user: null,
        authenticatorType: 'Passkey',
    };

    // ============================================
    // UTILITY FUNCTIONS
    // ============================================

    /**
     * Convert ArrayBuffer to Base64URL string
     */
    function bufferToBase64URL(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }

    /**
     * Convert Base64URL string to ArrayBuffer
     */
    function base64URLToBuffer(base64url) {
        const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
        const padding = '='.repeat((4 - (base64.length % 4)) % 4);
        const binary = atob(base64 + padding);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    /**
     * Detect platform authenticator type
     */
    function detectAuthenticatorType() {
        const ua = navigator.userAgent.toLowerCase();
        const platform = navigator.platform?.toLowerCase() || '';

        if (/iphone|ipad|ipod/.test(ua)) return 'Face ID / Touch ID';
        if (/mac/.test(platform) || /macintosh/.test(ua)) return 'Touch ID';
        if (/android/.test(ua)) return 'Fingerprint / Face Unlock';
        if (/win/.test(platform)) return 'Windows Hello';
        return 'Passkey';
    }

    // ============================================
    // FEATURE DETECTION
    // ============================================

    /**
     * Check if passkeys are supported
     */
    async function checkSupport() {
        // Basic WebAuthn support
        if (!window.PublicKeyCredential) {
            console.log('[PasskeyAuth] WebAuthn not supported');
            return {
                supported: false,
                platformAuthenticator: false,
                conditionalUI: false,
            };
        }

        state.isSupported = true;

        // Check platform authenticator
        try {
            state.platformAuthenticator =
                await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        } catch {
            state.platformAuthenticator = false;
        }

        // Check conditional UI support
        try {
            if (PublicKeyCredential.isConditionalMediationAvailable) {
                state.conditionalUISupported =
                    await PublicKeyCredential.isConditionalMediationAvailable();
            }
        } catch {
            state.conditionalUISupported = false;
        }

        state.authenticatorType = detectAuthenticatorType();

        console.log('[PasskeyAuth] Support check:', {
            supported: state.isSupported,
            platformAuthenticator: state.platformAuthenticator,
            conditionalUI: state.conditionalUISupported,
            type: state.authenticatorType,
        });

        return {
            supported: state.isSupported,
            platformAuthenticator: state.platformAuthenticator,
            conditionalUI: state.conditionalUISupported,
            type: state.authenticatorType,
        };
    }

    // ============================================
    // SESSION MANAGEMENT
    // ============================================

    /**
     * Store session token
     */
    function storeSession(token, email) {
        try {
            sessionStorage.setItem(CONFIG.SESSION_TOKEN_KEY, token);
            if (email) {
                localStorage.setItem(CONFIG.USER_EMAIL_KEY, email);
            }
            state.isAuthenticated = true;
        } catch (e) {
            console.warn('[PasskeyAuth] Failed to store session:', e);
        }
    }

    /**
     * Get stored session token
     */
    function getSessionToken() {
        try {
            return sessionStorage.getItem(CONFIG.SESSION_TOKEN_KEY);
        } catch {
            return null;
        }
    }

    /**
     * Get stored email
     */
    function getStoredEmail() {
        try {
            return localStorage.getItem(CONFIG.USER_EMAIL_KEY);
        } catch {
            return null;
        }
    }

    /**
     * Clear session
     */
    function clearSession() {
        try {
            sessionStorage.removeItem(CONFIG.SESSION_TOKEN_KEY);
            state.isAuthenticated = false;
            state.user = null;
        } catch (e) {
            console.warn('[PasskeyAuth] Failed to clear session:', e);
        }
    }

    /**
     * Verify current session with server
     */
    async function verifySession() {
        const token = getSessionToken();
        if (!token) return { valid: false };

        try {
            const response = await fetch(`${CONFIG.API_BASE}/passkey-authenticate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'verify-session',
                    sessionToken: token,
                }),
            });

            const data = await response.json();

            if (data.success && data.verified) {
                state.isAuthenticated = true;
                state.user = {
                    id: data.userId,
                    email: data.email,
                };
                return {
                    valid: true,
                    user: state.user,
                    expiresIn: data.expiresIn,
                };
            }

            clearSession();
            return { valid: false };
        } catch (error) {
            console.error('[PasskeyAuth] Session verification failed:', error);
            return { valid: false, error: error.message };
        }
    }

    // ============================================
    // REGISTRATION
    // ============================================

    /**
     * Register a new passkey
     * @param {string} email - User email
     * @param {string} displayName - Optional display name
     * @param {function} onProgress - Progress callback
     */
    async function register(email, displayName, onProgress) {
        if (!state.isSupported) {
            throw new Error('Passkeys are not supported on this device');
        }

        if (!email || typeof email !== 'string') {
            throw new Error('Email is required');
        }

        onProgress?.('Starting registration...');

        // Step 1: Start registration - get challenge
        let startResponse;
        try {
            const response = await fetch(`${CONFIG.API_BASE}/passkey-register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'start',
                    email: email.trim(),
                    displayName: displayName || email.split('@')[0],
                }),
            });

            startResponse = await response.json();

            if (!startResponse.success) {
                throw new Error(startResponse.error || 'Failed to start registration');
            }
        } catch (error) {
            if (error.message.includes('Failed to fetch')) {
                throw new Error('Cannot connect to server. Please check your connection.');
            }
            throw error;
        }

        onProgress?.(`Waiting for ${state.authenticatorType}...`);

        // Haptic feedback
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }

        // Step 2: Create credential with WebAuthn
        const publicKeyCredentialCreationOptions = {
            challenge: base64URLToBuffer(startResponse.challenge),
            rp: {
                name: CONFIG.RP_NAME,
                id: CONFIG.RP_ID,
            },
            user: {
                id: new TextEncoder().encode(startResponse.user.id),
                name: startResponse.user.name,
                displayName: startResponse.user.displayName,
            },
            pubKeyCredParams: [
                { alg: -7, type: 'public-key' }, // ES256
                { alg: -257, type: 'public-key' }, // RS256
            ],
            authenticatorSelection: {
                authenticatorAttachment: 'platform',
                userVerification: 'required',
                residentKey: 'required',
                requireResidentKey: true,
            },
            timeout: 60000,
            attestation: 'none',
            excludeCredentials: (startResponse.excludeCredentials || []).map(cred => ({
                id: base64URLToBuffer(cred.id),
                type: 'public-key',
                transports: cred.transports,
            })),
        };

        let credential;
        try {
            credential = await navigator.credentials.create({
                publicKey: publicKeyCredentialCreationOptions,
            });
        } catch (error) {
            if (error.name === 'NotAllowedError') {
                throw new Error('Passkey creation was cancelled');
            }
            if (error.name === 'InvalidStateError') {
                throw new Error('This passkey is already registered');
            }
            if (error.name === 'NotSupportedError') {
                throw new Error('Your device does not support passkeys');
            }
            throw error;
        }

        onProgress?.('Saving passkey...');

        // Step 3: Complete registration - send credential to server
        const attestationResponse = credential.response;
        const completeData = {
            action: 'complete',
            sessionId: startResponse.sessionId,
            userId: startResponse.user.id,
            credentialId: bufferToBase64URL(credential.rawId),
            rawId: bufferToBase64URL(credential.rawId),
            type: credential.type,
            clientDataJSON: bufferToBase64URL(attestationResponse.clientDataJSON),
            attestationObject: bufferToBase64URL(attestationResponse.attestationObject),
            authenticatorAttachment: credential.authenticatorAttachment,
        };

        // Add transports if available
        if (attestationResponse.getTransports) {
            completeData.transports = attestationResponse.getTransports();
        }

        const completeResponse = await fetch(`${CONFIG.API_BASE}/passkey-register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(completeData),
        });

        const result = await completeResponse.json();

        if (!result.success) {
            throw new Error(result.error || 'Registration failed');
        }

        // Store session
        if (result.sessionToken) {
            storeSession(result.sessionToken, email);
        }

        // Success haptic
        if (navigator.vibrate) {
            navigator.vibrate([50, 50, 100]);
        }

        console.log('[PasskeyAuth] Registration successful');

        return {
            success: true,
            message: result.message || 'Passkey registered successfully!',
            credentialId: result.credentialId,
            credentialName: result.credentialName,
            backedUp: result.backedUp,
            isNewUser: startResponse.isNewUser,
        };
    }

    // ============================================
    // AUTHENTICATION
    // ============================================

    /**
     * Authenticate with a passkey
     * @param {string} email - Optional email to filter credentials
     * @param {function} onProgress - Progress callback
     */
    async function authenticate(email, onProgress) {
        if (!state.isSupported) {
            throw new Error('Passkeys are not supported on this device');
        }

        onProgress?.('Starting authentication...');

        // Step 1: Get challenge from server
        let startResponse;
        try {
            const response = await fetch(`${CONFIG.API_BASE}/passkey-authenticate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'start',
                    email: email?.trim() || undefined,
                }),
            });

            startResponse = await response.json();

            if (!startResponse.success) {
                throw new Error(startResponse.error || 'Failed to start authentication');
            }
        } catch (error) {
            if (error.message.includes('Failed to fetch')) {
                throw new Error('Cannot connect to server. Please check your connection.');
            }
            throw error;
        }

        onProgress?.(`Waiting for ${state.authenticatorType}...`);

        // Haptic feedback
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }

        // Step 2: Get credential with WebAuthn
        const publicKeyCredentialRequestOptions = {
            challenge: base64URLToBuffer(startResponse.challenge),
            rpId: CONFIG.RP_ID,
            userVerification: 'required',
            timeout: 60000,
        };

        // Add allowCredentials if provided (not for discoverable credentials)
        if (startResponse.allowCredentials && startResponse.allowCredentials.length > 0) {
            publicKeyCredentialRequestOptions.allowCredentials = startResponse.allowCredentials.map(
                cred => ({
                    id: base64URLToBuffer(cred.id),
                    type: 'public-key',
                    transports: cred.transports || ['internal', 'hybrid'],
                })
            );
        }

        let assertion;
        try {
            assertion = await navigator.credentials.get({
                publicKey: publicKeyCredentialRequestOptions,
            });
        } catch (error) {
            if (error.name === 'NotAllowedError') {
                throw new Error('Authentication was cancelled');
            }
            if (error.name === 'InvalidStateError') {
                throw new Error('No passkey found. Please register first.');
            }
            throw error;
        }

        onProgress?.('Verifying...');

        // Step 3: Verify with server
        const verifyData = {
            action: 'complete',
            sessionId: startResponse.sessionId,
            credentialId: bufferToBase64URL(assertion.rawId),
            rawId: bufferToBase64URL(assertion.rawId),
            type: assertion.type,
            authenticatorData: bufferToBase64URL(assertion.response.authenticatorData),
            clientDataJSON: bufferToBase64URL(assertion.response.clientDataJSON),
            signature: bufferToBase64URL(assertion.response.signature),
            userHandle: assertion.response.userHandle
                ? bufferToBase64URL(assertion.response.userHandle)
                : undefined,
        };

        const verifyResponse = await fetch(`${CONFIG.API_BASE}/passkey-authenticate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(verifyData),
        });

        const result = await verifyResponse.json();

        if (!result.success) {
            throw new Error(result.error || 'Authentication failed');
        }

        // Store session
        if (result.sessionToken) {
            storeSession(result.sessionToken, result.email);
        }

        state.isAuthenticated = true;
        state.user = {
            id: result.userId,
            email: result.email,
            displayName: result.displayName,
        };

        // Success haptic
        if (navigator.vibrate) {
            navigator.vibrate([50, 50, 100]);
        }

        console.log('[PasskeyAuth] Authentication successful');

        return {
            success: true,
            message: result.message || 'Welcome back!',
            user: state.user,
        };
    }

    /**
     * Authenticate using conditional UI (autofill)
     * Call this on page load to enable passkey autofill
     */
    async function authenticateConditional() {
        if (!state.conditionalUISupported) {
            console.log('[PasskeyAuth] Conditional UI not supported');
            return null;
        }

        try {
            // Get challenge for conditional authentication
            const response = await fetch(`${CONFIG.API_BASE}/passkey-authenticate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'start',
                    conditional: true,
                }),
            });

            const startResponse = await response.json();
            if (!startResponse.success) {
                return null;
            }

            // Start conditional UI authentication
            const assertion = await navigator.credentials.get({
                publicKey: {
                    challenge: base64URLToBuffer(startResponse.challenge),
                    rpId: CONFIG.RP_ID,
                    userVerification: 'required',
                    timeout: 300000, // 5 minutes for conditional
                },
                mediation: 'conditional',
            });

            // Verify with server
            const verifyData = {
                action: 'complete',
                sessionId: startResponse.sessionId,
                credentialId: bufferToBase64URL(assertion.rawId),
                rawId: bufferToBase64URL(assertion.rawId),
                type: assertion.type,
                authenticatorData: bufferToBase64URL(assertion.response.authenticatorData),
                clientDataJSON: bufferToBase64URL(assertion.response.clientDataJSON),
                signature: bufferToBase64URL(assertion.response.signature),
                userHandle: assertion.response.userHandle
                    ? bufferToBase64URL(assertion.response.userHandle)
                    : undefined,
            };

            const verifyResponse = await fetch(`${CONFIG.API_BASE}/passkey-authenticate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(verifyData),
            });

            const result = await verifyResponse.json();

            if (result.success && result.sessionToken) {
                storeSession(result.sessionToken, result.email);
                state.isAuthenticated = true;
                state.user = {
                    id: result.userId,
                    email: result.email,
                    displayName: result.displayName,
                };
                return {
                    success: true,
                    user: state.user,
                };
            }

            return null;
        } catch (error) {
            // Conditional UI errors are usually not critical
            console.log('[PasskeyAuth] Conditional UI authentication:', error.message);
            return null;
        }
    }

    // ============================================
    // USER MANAGEMENT
    // ============================================

    /**
     * Check if user has passkeys registered
     */
    async function checkUser(email) {
        if (!email) {
            return { hasPasskeys: false };
        }

        try {
            const response = await fetch(`${CONFIG.API_BASE}/passkey-authenticate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'check-user',
                    email: email.trim(),
                }),
            });

            const data = await response.json();
            return {
                hasPasskeys: data.hasPasskeys || false,
                passkeyCount: data.passkeyCount || 0,
                message: data.message,
            };
        } catch (error) {
            console.error('[PasskeyAuth] Check user failed:', error);
            return { hasPasskeys: false, error: error.message };
        }
    }

    /**
     * List user's passkeys (requires authentication)
     */
    async function listPasskeys() {
        const token = getSessionToken();
        if (!token) {
            throw new Error('Authentication required');
        }

        const response = await fetch(`${CONFIG.API_BASE}/passkey-register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'list',
                sessionToken: token,
            }),
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Failed to list passkeys');
        }

        return data.passkeys || [];
    }

    /**
     * Delete a passkey (requires authentication)
     */
    async function deletePasskey(credentialId) {
        const token = getSessionToken();
        if (!token) {
            throw new Error('Authentication required');
        }

        const response = await fetch(`${CONFIG.API_BASE}/passkey-register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'delete',
                sessionToken: token,
                credentialId,
            }),
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Failed to delete passkey');
        }

        return { success: true };
    }

    /**
     * Logout
     */
    async function logout() {
        const token = getSessionToken();

        // Notify server (optional - for audit logging)
        try {
            await fetch(`${CONFIG.API_BASE}/passkey-authenticate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'logout',
                    sessionToken: token,
                }),
            });
        } catch {
            // Ignore errors - logout is primarily client-side
        }

        clearSession();
        return { success: true };
    }

    // ============================================
    // PUBLIC API
    // ============================================

    return {
        // Feature detection
        checkSupport,

        // Session management
        verifySession,
        getSessionToken,
        getStoredEmail,
        clearSession,

        // Registration
        register,

        // Authentication
        authenticate,
        authenticateConditional,

        // User management
        checkUser,
        listPasskeys,
        deletePasskey,
        logout,

        // State access
        getState: () => ({ ...state }),

        // Configuration
        CONFIG,
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PasskeyAuth;
}
