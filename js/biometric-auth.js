/**
 * FUSE Elite Biometric Authentication Service
 * Implements secure WebAuthn with owner-lock system
 *
 * Features:
 * - Face ID, Touch ID, Windows Hello, Fingerprint
 * - Owner-lock: First registration locks dashboard to that device
 * - Session token management
 * - Premium animations and haptic feedback
 *
 * @version 2.0.0
 */

const BiometricAuth = (() => {
    'use strict';

    // ============================================
    // CONFIGURATION
    // ============================================

    const CONFIG = {
        RP_NAME: 'FUSE Command Center',
        RP_ID: window.location.hostname,
        API_BASE: '/api',
        CREDENTIAL_STORAGE_KEY: 'fuse_biometric_credential_id',
        USER_ID_KEY: 'fuse_biometric_user_id',
        SESSION_TOKEN_KEY: 'fuse_session_token',
        DEVICE_ID_KEY: 'fuse_device_id',
        SESSION_DURATION: 30 * 60 * 1000, // 30 minutes
        ANIMATION_DURATION: 300,
    };

    // ============================================
    // STATE
    // ============================================

    const state = {
        isSupported: false,
        isRegistered: false,
        isVerified: false,
        isOwner: false,
        hasOwner: false,
        lastVerification: null,
        platformAuthenticator: false,
        authenticatorType: 'Biometric',
        isApplePlatform: false,
        conditionalMediation: false,
        supportsPasskeys: false,
    };

    // ============================================
    // DEVICE FINGERPRINTING
    // ============================================

    // In-memory fallback for private/incognito mode
    let memoryDeviceId = null;

    /**
     * Check if localStorage is available
     */
    function isLocalStorageAvailable() {
        try {
            const test = '__localStorage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }

    /**
     * Generate a consistent device ID for this browser
     * Falls back to sessionStorage or in-memory if localStorage unavailable
     */
    function getDeviceId() {
        // Try localStorage first (persists across sessions)
        if (isLocalStorageAvailable()) {
            let deviceId = localStorage.getItem(CONFIG.DEVICE_ID_KEY);
            if (!deviceId) {
                const array = new Uint8Array(16);
                crypto.getRandomValues(array);
                deviceId = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
                localStorage.setItem(CONFIG.DEVICE_ID_KEY, deviceId);
            }
            return deviceId;
        }

        // Try sessionStorage (persists for browser session in private mode)
        try {
            let deviceId = sessionStorage.getItem(CONFIG.DEVICE_ID_KEY);
            if (!deviceId) {
                const array = new Uint8Array(16);
                crypto.getRandomValues(array);
                deviceId = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
                sessionStorage.setItem(CONFIG.DEVICE_ID_KEY, deviceId);
            }
            console.warn(
                '[BiometricAuth] Using sessionStorage for device ID (private mode detected)'
            );
            return deviceId;
        } catch (e) {
            // Last resort: in-memory (will not persist across page reloads)
            if (!memoryDeviceId) {
                const array = new Uint8Array(16);
                crypto.getRandomValues(array);
                memoryDeviceId = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join(
                    ''
                );
                console.warn('[BiometricAuth] Using in-memory device ID (storage unavailable)');
            }
            return memoryDeviceId;
        }
    }

    // ============================================
    // FEATURE DETECTION
    // ============================================

    /**
     * Check if WebAuthn is supported and if platform authenticator is available
     */
    async function checkSupport() {
        // Check basic WebAuthn support
        if (!window.PublicKeyCredential) {
            console.log('[BiometricAuth] WebAuthn not supported');
            return { supported: false, platformAuthenticator: false };
        }

        // Check for platform authenticator
        try {
            const available =
                await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
            state.isSupported = true;
            state.platformAuthenticator = available;
            state.isApplePlatform = isApplePlatform();
            state.authenticatorType = getPlatformAuthenticatorType();
            state.supportsPasskeys = available && (state.isApplePlatform || isPasskeyCapable());

            if (PublicKeyCredential.isConditionalMediationAvailable) {
                state.conditionalMediation =
                    await PublicKeyCredential.isConditionalMediationAvailable();
            }

            console.log('[BiometricAuth] Platform authenticator available:', available);

            return {
                supported: true,
                platformAuthenticator: available,
                type: state.authenticatorType,
            };
        } catch (error) {
            console.error('[BiometricAuth] Error checking support:', error);
            return { supported: true, platformAuthenticator: false };
        }
    }

    /**
     * Detect whether this is an Apple platform (iOS/macOS)
     */
    function isApplePlatform() {
        const ua = navigator.userAgent.toLowerCase();
        const platform = navigator.platform?.toLowerCase() || '';
        return /iphone|ipad|ipod/.test(ua) || /mac/.test(platform) || /macintosh/.test(ua);
    }

    /**
     * Best-effort passkey capability check
     */
    function isPasskeyCapable() {
        return typeof PublicKeyCredential !== 'undefined';
    }

    /**
     * Require resident keys on Apple to ensure passkey creation
     */
    function shouldRequireResidentKey() {
        return state.isApplePlatform || isApplePlatform();
    }

    /**
     * Detect the type of platform authenticator
     */
    function getPlatformAuthenticatorType() {
        const ua = navigator.userAgent.toLowerCase();
        const platform = navigator.platform?.toLowerCase() || '';

        if (/iphone|ipad|ipod/.test(ua)) {
            return 'Face ID';
        } else if (/mac/.test(platform) || /macintosh/.test(ua)) {
            return 'Touch ID';
        } else if (/android/.test(ua)) {
            return 'Fingerprint';
        } else if (/win/.test(platform)) {
            return 'Windows Hello';
        }
        return 'Biometric';
    }

    // ============================================
    // SESSION MANAGEMENT
    // ============================================

    /**
     * Store session token securely
     */
    function storeSessionToken(token) {
        sessionStorage.setItem(CONFIG.SESSION_TOKEN_KEY, token);
        state.isVerified = true;
        state.lastVerification = Date.now();
    }

    /**
     * Get stored session token
     */
    function getSessionToken() {
        return sessionStorage.getItem(CONFIG.SESSION_TOKEN_KEY);
    }

    /**
     * Clear session
     */
    function clearSession() {
        sessionStorage.removeItem(CONFIG.SESSION_TOKEN_KEY);
        state.isVerified = false;
        state.lastVerification = null;
    }

    /**
     * Verify session with server
     */
    async function verifySession() {
        const token = getSessionToken();
        if (!token) return false;

        try {
            const response = await fetch(`${CONFIG.API_BASE}/biometric-authenticate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'verify-session',
                    sessionToken: token,
                    deviceId: getDeviceId(),
                }),
            });

            const data = await response.json();
            if (data.success && data.verified) {
                state.isVerified = true;
                return true;
            }

            clearSession();
            return false;
        } catch (error) {
            console.warn('[BiometricAuth] Session verification failed:', error);
            return false;
        }
    }

    /**
     * Check if session is verified (local check + optional server verify)
     */
    async function isSessionVerified(serverVerify = false) {
        const token = getSessionToken();
        if (!token) return false;

        if (serverVerify) {
            return await verifySession();
        }

        // Local check - assume valid if token exists
        // Server will reject invalid tokens on API calls
        return true;
    }

    // ============================================
    // ACCESS CHECK
    // ============================================

    /**
     * Check access status - is there an owner? Is this the owner's device?
     */
    async function checkAccessStatus() {
        try {
            const response = await fetch(`${CONFIG.API_BASE}/biometric-authenticate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'check-access',
                    deviceId: getDeviceId(),
                }),
            });

            const data = await response.json();

            // Handle service errors (503) - don't assume "no owner"
            if (!data.success && data.code) {
                console.error('[BiometricAuth] Service error:', data.code);
                return {
                    hasOwner: null, // Unknown - service error
                    isOwnerDevice: null,
                    canRegister: false, // Don't allow registration on service error
                    canAuthenticate: false,
                    message: data.error || 'Service temporarily unavailable',
                    serviceError: true,
                };
            }

            state.hasOwner = data.hasOwner || false;
            state.isOwner = data.isOwnerDevice || false;
            state.isRegistered = data.hasOwner && data.isOwnerDevice;

            return {
                hasOwner: data.hasOwner,
                isOwnerDevice: data.isOwnerDevice,
                canRegister: !data.hasOwner || data.isOwnerDevice,
                canAuthenticate: data.canAuthenticate,
                message: data.message,
                serviceError: false,
            };
        } catch (error) {
            console.error('[BiometricAuth] Access check failed:', error);
            // Network error - don't make assumptions
            return {
                hasOwner: null,
                isOwnerDevice: null,
                canRegister: false,
                canAuthenticate: false,
                message: 'Unable to connect to authentication server',
                serviceError: true,
            };
        }
    }

    // ============================================
    // CREDENTIAL MANAGEMENT
    // ============================================

    /**
     * Check if user has registered credentials locally
     */
    function hasRegisteredCredentials() {
        const { credentialId, userId } = readStoredCredential();
        state.isRegistered = !!(credentialId && userId);
        return state.isRegistered;
    }

    /**
     * Generate a random user ID
     */
    function generateUserId() {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Convert ArrayBuffer to Base64URL
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
     * Convert Base64URL to ArrayBuffer
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
     * Read stored credential information (localStorage first, fallback to sessionStorage)
     */
    function readStoredCredential() {
        try {
            const credentialId = localStorage.getItem(CONFIG.CREDENTIAL_STORAGE_KEY);
            const userId = localStorage.getItem(CONFIG.USER_ID_KEY);
            if (credentialId && userId) {
                return { credentialId, userId, source: 'localStorage' };
            }
        } catch (error) {
            // Ignore storage access errors
        }

        try {
            const credentialId = sessionStorage.getItem(CONFIG.CREDENTIAL_STORAGE_KEY);
            const userId = sessionStorage.getItem(CONFIG.USER_ID_KEY);
            if (credentialId && userId) {
                return { credentialId, userId, source: 'sessionStorage' };
            }
        } catch (error) {
            // Ignore storage access errors
        }

        return { credentialId: null, userId: null, source: null };
    }

    /**
     * Store credentials safely (localStorage preferred, fallback to sessionStorage)
     */
    function storeCredential(credentialId, userId) {
        try {
            localStorage.setItem(CONFIG.CREDENTIAL_STORAGE_KEY, credentialId);
            localStorage.setItem(CONFIG.USER_ID_KEY, userId);
            return;
        } catch (error) {
            // Ignore storage errors and fallback
        }

        try {
            sessionStorage.setItem(CONFIG.CREDENTIAL_STORAGE_KEY, credentialId);
            sessionStorage.setItem(CONFIG.USER_ID_KEY, userId);
        } catch (error) {
            console.warn('[BiometricAuth] Unable to persist credential locally');
        }
    }

    /**
     * Clear stored credentials from available storage
     */
    function clearStoredCredentials() {
        try {
            localStorage.removeItem(CONFIG.CREDENTIAL_STORAGE_KEY);
            localStorage.removeItem(CONFIG.USER_ID_KEY);
        } catch (error) {
            // Ignore storage errors
        }

        try {
            sessionStorage.removeItem(CONFIG.CREDENTIAL_STORAGE_KEY);
            sessionStorage.removeItem(CONFIG.USER_ID_KEY);
        } catch (error) {
            // Ignore storage errors
        }
    }

    /**
     * Clear stored credentials
     */
    function clearCredentials() {
        clearStoredCredentials();
        clearSession();
        state.isRegistered = false;
        state.isVerified = false;
    }

    // ============================================
    // REGISTRATION (Owner Lock)
    // ============================================

    /**
     * Register biometric credentials - locks dashboard to this device
     */
    async function register(onProgress) {
        if (!state.isSupported) {
            throw new Error('WebAuthn is not supported on this device');
        }

        onProgress?.('Checking access...');

        // Check if registration is allowed
        const accessStatus = await checkAccessStatus();
        if (!accessStatus.canRegister) {
            throw new Error(accessStatus.message || 'Registration not allowed');
        }

        // Reuse stored user ID if present (keeps owner stable across devices)
        const storedCredential = readStoredCredential();
        const userId = storedCredential.userId || generateUserId();
        const userIdBuffer = new TextEncoder().encode(userId);

        onProgress?.('Getting secure challenge...');

        // Get challenge from server
        let challenge;
        try {
            const response = await fetch(`${CONFIG.API_BASE}/biometric-register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'get-challenge',
                    userId,
                    deviceId: getDeviceId(),
                }),
            });

            const data = await response.json();

            if (!data.success) {
                if (data.isLocked) {
                    throw new Error('Dashboard is secured by another device. Access denied.');
                }
                throw new Error(data.error || 'Failed to get challenge');
            }

            challenge = base64URLToBuffer(data.challenge);
        } catch (error) {
            if (error.message.includes('secured') || error.message.includes('denied')) {
                throw error;
            }
            throw new Error('Unable to connect to authentication server');
        }

        onProgress?.(`Waiting for ${state.authenticatorType}...`);

        // Trigger haptic feedback if available
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }

        // Create credential options
        const requireResidentKey = shouldRequireResidentKey();
        const publicKeyCredentialCreationOptions = {
            challenge: challenge,
            rp: {
                name: CONFIG.RP_NAME,
                id: CONFIG.RP_ID,
            },
            user: {
                id: userIdBuffer,
                name: 'FUSE Owner',
                displayName: 'Dashboard Owner',
            },
            pubKeyCredParams: [
                { alg: -7, type: 'public-key' }, // ES256 (preferred)
                { alg: -257, type: 'public-key' }, // RS256 (fallback)
            ],
            authenticatorSelection: {
                authenticatorAttachment: 'platform',
                userVerification: 'required',
                residentKey: requireResidentKey ? 'required' : 'preferred',
                requireResidentKey,
            },
            timeout: 60000,
            attestation: 'none',
            extensions: {
                credProps: true,
            },
        };

        try {
            // Prompt for biometric registration
            const credential = await navigator.credentials.create({
                publicKey: publicKeyCredentialCreationOptions,
            });

            onProgress?.('Securing dashboard...');

            // Store credential locally
            const credentialId = bufferToBase64URL(credential.rawId);
            storeCredential(credentialId, userId);

            // Register with server (owner lock)
            const attestationResponse = credential.response;
            const registerData = {
                action: 'register',
                userId,
                credentialId,
                rawId: credentialId,
                type: credential.type,
                clientDataJSON: bufferToBase64URL(attestationResponse.clientDataJSON),
                attestationObject: bufferToBase64URL(attestationResponse.attestationObject),
                deviceId: getDeviceId(),
                clientExtensions: credential.getClientExtensionResults?.() || {},
            };

            const transports = attestationResponse.getTransports?.();
            if (Array.isArray(transports) && transports.length) {
                registerData.transports = transports;
            }

            if (attestationResponse.getAuthenticatorData) {
                registerData.authenticatorData = bufferToBase64URL(
                    attestationResponse.getAuthenticatorData()
                );
            }

            if (attestationResponse.getPublicKey) {
                registerData.publicKey = bufferToBase64URL(attestationResponse.getPublicKey());
            }

            const response = await fetch(`${CONFIG.API_BASE}/biometric-register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(registerData),
            });

            const data = await response.json();

            if (!data.success) {
                clearCredentials();
                throw new Error(data.error || 'Registration failed');
            }

            if (data.userId) {
                storeCredential(credentialId, data.userId);
            }

            state.isRegistered = true;
            state.isOwner = true;
            state.hasOwner = true;

            // Haptic success feedback
            if (navigator.vibrate) {
                navigator.vibrate([50, 50, 100]);
            }

            console.log('[BiometricAuth] Owner registration successful');

            return {
                success: true,
                isOwner: true,
                message: data.message || 'Dashboard secured! Only your biometric can unlock it.',
            };
        } catch (error) {
            console.error('[BiometricAuth] Registration failed:', error);

            if (error.name === 'NotAllowedError') {
                throw new Error(`${state.authenticatorType} verification was cancelled`);
            } else if (error.name === 'NotSupportedError') {
                throw new Error(`This device doesn't support ${state.authenticatorType}`);
            }

            throw error;
        }
    }

    // ============================================
    // AUTHENTICATION
    // ============================================

    /**
     * Authenticate using biometric credentials
     */
    async function authenticate(onProgress) {
        if (!state.isSupported) {
            throw new Error('WebAuthn is not supported on this device');
        }

        const storedCredential = readStoredCredential();
        const credentialId = storedCredential.credentialId;

        onProgress?.('Verifying access...');

        // Get challenge from server
        let challenge, allowCredentials;
        try {
            console.log('[BiometricAuth] Requesting challenge from server...');
            const response = await fetch(`${CONFIG.API_BASE}/biometric-authenticate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'get-challenge',
                    deviceId: getDeviceId(),
                    credentialId,
                }),
            });

            console.log('[BiometricAuth] Server response status:', response.status);

            // Handle non-OK responses
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('[BiometricAuth] Server error:', response.status, errorData);

                if (response.status === 503) {
                    throw new Error(
                        errorData.error ||
                            'Authentication service temporarily unavailable. Server may be misconfigured.'
                    );
                }
                throw new Error(errorData.error || `Server error: ${response.status}`);
            }

            const data = await response.json();
            console.log('[BiometricAuth] Challenge response:', {
                success: data.success,
                hasChallenge: !!data.challenge,
                allowCredentials: data.allowCredentials,
                credentialCount: data.allowCredentials?.length,
            });

            if (!data.success) {
                if (data.isLocked) {
                    throw new Error('Access denied. This dashboard is secured by another device.');
                }
                if (data.requiresSetup) {
                    throw new Error('Dashboard not configured. Please set up biometric access.');
                }
                if (data.code === 'CONFIG_ERROR') {
                    throw new Error('Server configuration error: ENCRYPTION_KEY not set.');
                }
                throw new Error(data.error || 'Authentication failed');
            }

            challenge = base64URLToBuffer(data.challenge);
            allowCredentials = data.allowCredentials;
        } catch (error) {
            console.error('[BiometricAuth] Challenge request failed:', error);
            if (
                error.message.includes('denied') ||
                error.message.includes('secured') ||
                error.message.includes('temporarily unavailable') ||
                error.message.includes('CONFIG_ERROR') ||
                error.message.includes('configuration error')
            ) {
                throw error;
            }
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                throw new Error('Cannot connect to server. Please check your internet connection.');
            }
            throw new Error('Unable to connect to authentication server: ' + error.message);
        }

        onProgress?.(`Waiting for ${state.authenticatorType}...`);

        // Haptic feedback
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }

        const credentialOptions = Array.isArray(allowCredentials) ? allowCredentials : [];
        if (!credentialOptions.length && credentialId) {
            credentialOptions.push({
                id: credentialId,
                type: 'public-key',
                transports: ['internal'],
            });
        }

        if (!credentialOptions.length) {
            throw new Error('No credentials available. Please set up biometric access.');
        }

        // Create authentication options
        const publicKeyCredentialRequestOptions = {
            challenge: challenge,
            rpId: CONFIG.RP_ID,
            allowCredentials: credentialOptions.map(entry => ({
                id: typeof entry.id === 'string' ? base64URLToBuffer(entry.id) : entry.id,
                type: 'public-key',
                transports: entry.transports || ['internal'],
            })),
            userVerification: 'required',
            timeout: 60000,
        };

        try {
            // Prompt for biometric verification
            const assertion = await navigator.credentials.get({
                publicKey: publicKeyCredentialRequestOptions,
            });

            onProgress?.('Verifying identity...');

            const assertionId = bufferToBase64URL(assertion.rawId);
            const userHandle = assertion.response.userHandle
                ? bufferToBase64URL(assertion.response.userHandle)
                : null;

            // Verify with server
            const verifyData = {
                action: 'verify',
                credentialId: assertionId,
                rawId: assertionId,
                type: assertion.type,
                authenticatorData: bufferToBase64URL(assertion.response.authenticatorData),
                clientDataJSON: bufferToBase64URL(assertion.response.clientDataJSON),
                signature: bufferToBase64URL(assertion.response.signature),
                userHandle,
                deviceId: getDeviceId(),
                clientExtensions: assertion.getClientExtensionResults?.() || {},
            };

            const response = await fetch(`${CONFIG.API_BASE}/biometric-authenticate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(verifyData),
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Verification failed');
            }

            // Store session token
            if (data.sessionToken) {
                storeSessionToken(data.sessionToken);
            }

            if (data.userId) {
                storeCredential(assertionId, data.userId);
            } else if (storedCredential.userId) {
                storeCredential(assertionId, storedCredential.userId);
            }

            state.isVerified = true;
            state.lastVerification = Date.now();

            // Success haptic
            if (navigator.vibrate) {
                navigator.vibrate([50, 50, 100]);
            }

            console.log('[BiometricAuth] Authentication successful');

            return {
                success: true,
                verified: true,
                message: data.message || 'Welcome back! Dashboard unlocked.',
            };
        } catch (error) {
            console.error('[BiometricAuth] Authentication failed:', error);

            if (error.name === 'NotAllowedError') {
                throw new Error(`${state.authenticatorType} verification was cancelled`);
            } else if (error.name === 'InvalidStateError') {
                clearCredentials();
                throw new Error('Credentials not found. Please set up biometric access again.');
            }

            throw error;
        }
    }

    // ============================================
    // DEVICE LINKING
    // ============================================

    /**
     * Create a device link code (for authenticated owners to share with new devices)
     */
    async function createDeviceLink() {
        const sessionToken = getSessionToken();
        if (!sessionToken) {
            throw new Error('You must be authenticated to create a device link');
        }

        try {
            const response = await fetch(`${CONFIG.API_BASE}/biometric-authenticate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create-device-link',
                    sessionToken,
                    deviceId: getDeviceId(),
                }),
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to create device link');
            }

            return {
                success: true,
                linkCode: data.linkCode,
                expiresIn: data.expiresIn,
                message: data.message,
            };
        } catch (error) {
            console.error('[BiometricAuth] Create device link failed:', error);
            throw error;
        }
    }

    /**
     * Claim a device link code (for new devices to authorize themselves)
     */
    async function claimDeviceLink(linkCode) {
        if (!linkCode || typeof linkCode !== 'string') {
            throw new Error('Invalid link code');
        }

        try {
            const response = await fetch(`${CONFIG.API_BASE}/biometric-authenticate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'claim-device-link',
                    linkCode: linkCode.toUpperCase().trim(),
                    deviceId: getDeviceId(),
                }),
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Failed to claim device link');
            }

            // Update state
            state.isOwner = true;
            state.hasOwner = true;

            return {
                success: true,
                deviceName: data.deviceName,
                message: data.message,
            };
        } catch (error) {
            console.error('[BiometricAuth] Claim device link failed:', error);
            throw error;
        }
    }

    // ============================================
    // MAGIC LINK AUTHENTICATION
    // ============================================

    /**
     * Request a magic link email to the configured admin address
     */
    async function requestMagicLink() {
        try {
            const response = await fetch(`${CONFIG.API_BASE}/magic-link`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'send',
                    page: 'dashboard'
                })
            });

            const data = await response.json().catch(() => null);
            if (!data || !data.success) {
                throw new Error(data?.error || 'Failed to send magic link.');
            }

            return { success: true, message: data.message, expiresIn: data.expiresIn };
        } catch (error) {
            console.error('[BiometricAuth] Magic link request failed:', error);
            throw error;
        }
    }

    /**
     * Verify a magic link token from the URL
     * @param {string} token - Token from URL query param
     */
    async function verifyMagicLink(token) {
        if (!token || typeof token !== 'string' || token.length < 32) {
            throw new Error('Invalid or expired magic link. Please request a new one.');
        }

        try {
            const response = await fetch(`${CONFIG.API_BASE}/magic-link`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'verify', token: token.trim() })
            });

            const data = await response.json().catch(() => null);
            if (!data || !data.success) {
                throw new Error(data?.error || 'Magic link expired or invalid. Please request a new one.');
            }

            // Store session token from server
            if (data.sessionToken) {
                storeSessionToken(data.sessionToken);
            }

            state.isVerified = true;
            state.isOwner = true;
            state.hasOwner = true;
            state.lastVerification = Date.now();

            return {
                success: true,
                verified: true,
                message: data.message || 'Access granted via magic link!'
            };
        } catch (error) {
            console.error('[BiometricAuth] Magic link verification failed:', error);
            throw error;
        }
    }

    /**
     * Get magic link token from URL if present
     */
    function getMagicLinkToken() {
        try {
            const t = new URLSearchParams(window.location.search).get('magic_token');
            return (t && typeof t === 'string') ? t.trim() : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Remove magic link token from URL without page reload
     */
    function clearMagicLinkToken() {
        const url = new URL(window.location);
        url.searchParams.delete('magic_token');
        window.history.replaceState({}, '', url.toString());
    }

    // ============================================
    // PUBLIC API
    // ============================================

    return {
        // Feature detection
        checkSupport,
        getPlatformAuthenticatorType,

        // Access control
        checkAccessStatus,

        // Credential management
        hasRegisteredCredentials,
        clearCredentials,

        // Registration & Authentication
        register,
        authenticate,

        // Device linking
        createDeviceLink,
        claimDeviceLink,

        // Magic link authentication
        requestMagicLink,
        verifyMagicLink,
        getMagicLinkToken,
        clearMagicLinkToken,

        // Session management
        isSessionVerified,
        verifySession,
        clearSession,
        getSessionToken,

        // State access
        getState: () => ({ ...state }),

        // Configuration
        CONFIG,
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BiometricAuth;
}
