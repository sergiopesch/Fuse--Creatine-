/**
 * FUSE CEO Authentication Client
 * Simple session-based authentication for CEO dashboard.
 *
 * @version 1.0.0
 */

const CEOAuth = (() => {
    'use strict';

    const CONFIG = {
        API_BASE: '/api/ceo-auth',
        SESSION_KEY: 'fuse_ceo_session',
        LOGIN_URL: '/login.html',
    };

    /**
     * Get stored session token
     */
    function getSessionToken() {
        return sessionStorage.getItem(CONFIG.SESSION_KEY);
    }

    /**
     * Store session token
     */
    function storeSession(token) {
        sessionStorage.setItem(CONFIG.SESSION_KEY, token);
    }

    /**
     * Clear session
     */
    function clearSession() {
        sessionStorage.removeItem(CONFIG.SESSION_KEY);
    }

    /**
     * Verify session token with server
     */
    async function verifySession(token) {
        if (!token) return false;

        try {
            const res = await fetch(CONFIG.API_BASE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'verify-session', sessionToken: token }),
            });
            const data = await res.json();
            return data.success && data.verified;
        } catch (error) {
            console.warn('[CEOAuth] Session verification failed:', error);
            return false;
        }
    }

    /**
     * Check if user is authenticated. Redirects to login if not.
     * @param {boolean} redirect - Whether to redirect if not authenticated
     * @returns {Promise<boolean>}
     */
    async function checkAuth(redirect = true) {
        // Check for auth token in URL (magic link redirect)
        const urlParams = new URLSearchParams(window.location.search);
        const authToken = urlParams.get('auth_token');

        if (authToken) {
            try {
                const res = await fetch(CONFIG.API_BASE, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'verify-magic-link', token: authToken }),
                });
                const data = await res.json();

                // Clear token from URL
                const url = new URL(window.location);
                url.searchParams.delete('auth_token');
                window.history.replaceState({}, '', url.toString());

                if (data.success && data.sessionToken) {
                    storeSession(data.sessionToken);
                    return true;
                }
            } catch (error) {
                console.error('[CEOAuth] Magic link verification failed:', error);
            }

            // Clear token from URL on failure
            const url = new URL(window.location);
            url.searchParams.delete('auth_token');
            window.history.replaceState({}, '', url.toString());
        }

        // Check existing session
        const token = getSessionToken();
        if (token) {
            const valid = await verifySession(token);
            if (valid) {
                return true;
            }
            clearSession();
        }

        // Not authenticated
        if (redirect) {
            window.location.href = CONFIG.LOGIN_URL;
        }
        return false;
    }

    /**
     * Logout - clear session and redirect to login
     */
    function logout() {
        clearSession();
        window.location.href = CONFIG.LOGIN_URL;
    }

    /**
     * Get authentication status without redirect
     */
    async function isAuthenticated() {
        const token = getSessionToken();
        if (!token) return false;
        return await verifySession(token);
    }

    return {
        checkAuth,
        isAuthenticated,
        logout,
        clearSession,
        getSessionToken,
        CONFIG,
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CEOAuth;
}
