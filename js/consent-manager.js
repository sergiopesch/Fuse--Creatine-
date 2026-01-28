/**
 * FUSE Creatine - Cookie Consent Manager
 *
 * Compliant with:
 * - EU GDPR (General Data Protection Regulation)
 * - UK GDPR (Post-Brexit UK Data Protection)
 * - USA CCPA/CPRA (California Consumer Privacy Act)
 * - ePrivacy Directive (Cookie Law)
 *
 * @version 1.0.0
 * @date 2026-01-26
 */

(function () {
    'use strict';

    // Configuration
    const CONFIG = {
        STORAGE_KEY: 'fuse_cookie_consent',
        CONSENT_VERSION: '1.0',
        BANNER_DELAY: 500, // ms delay before showing banner
        EXPIRY_DAYS: 365, // How long consent is valid
    };

    // Cookie categories with descriptions
    const COOKIE_CATEGORIES = {
        necessary: {
            name: 'Strictly Necessary',
            description: 'Essential for the website to function. These cannot be disabled.',
            required: true,
            cookies: [
                {
                    name: 'Authentication tokens',
                    purpose: 'Keep you logged in securely',
                    duration: 'Session',
                },
                {
                    name: 'Security tokens',
                    purpose: 'Protect against cross-site attacks',
                    duration: 'Session',
                },
                {
                    name: 'Consent preferences',
                    purpose: 'Remember your cookie choices',
                    duration: '1 year',
                },
            ],
        },
        analytics: {
            name: 'Analytics & Performance',
            description:
                'Help us understand how visitors interact with our website to improve user experience.',
            required: false,
            cookies: [
                {
                    name: 'Vercel Analytics',
                    purpose: 'Anonymous page view analytics',
                    duration: 'Session',
                },
            ],
        },
        functional: {
            name: 'Functional',
            description: 'Enable enhanced functionality and personalization.',
            required: false,
            cookies: [
                {
                    name: 'Dashboard preferences',
                    purpose: 'Remember your layout preferences',
                    duration: 'Persistent',
                },
                {
                    name: 'Theme preferences',
                    purpose: 'Remember dark/light mode choice',
                    duration: 'Persistent',
                },
            ],
        },
        marketing: {
            name: 'Marketing & Advertising',
            description:
                'Used to deliver relevant advertisements and track campaign effectiveness.',
            required: false,
            cookies: [], // Currently none, but structure ready for future
        },
    };

    // Consent Manager Class
    class ConsentManager {
        constructor() {
            this.consent = this.loadConsent();
            this.region = null;
            this.bannerElement = null;
            this.modalElement = null;
            this.initialized = false;
        }

        /**
         * Initialize the consent manager
         */
        async init() {
            if (this.initialized) return;
            this.initialized = true;

            // Detect user region for compliance requirements
            await this.detectRegion();

            // Check if we need to show the banner
            if (!this.hasValidConsent()) {
                setTimeout(() => this.showBanner(), CONFIG.BANNER_DELAY);
            } else {
                // Apply existing consent
                this.applyConsent();
            }

            // Set up global access
            window.FuseConsent = this;

            // Listen for preference link clicks
            this.setupPreferenceLinks();
        }

        /**
         * Detect user's region based on timezone and language
         * This is a privacy-friendly approach that doesn't require IP geolocation
         */
        async detectRegion() {
            try {
                const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                const _language = navigator.language || navigator.userLanguage;

                // EU/EEA timezones
                const euTimezones = [
                    'Europe/Amsterdam',
                    'Europe/Andorra',
                    'Europe/Athens',
                    'Europe/Belgrade',
                    'Europe/Berlin',
                    'Europe/Bratislava',
                    'Europe/Brussels',
                    'Europe/Bucharest',
                    'Europe/Budapest',
                    'Europe/Copenhagen',
                    'Europe/Dublin',
                    'Europe/Helsinki',
                    'Europe/Lisbon',
                    'Europe/Ljubljana',
                    'Europe/Luxembourg',
                    'Europe/Madrid',
                    'Europe/Malta',
                    'Europe/Monaco',
                    'Europe/Oslo',
                    'Europe/Paris',
                    'Europe/Prague',
                    'Europe/Riga',
                    'Europe/Rome',
                    'Europe/San_Marino',
                    'Europe/Sofia',
                    'Europe/Stockholm',
                    'Europe/Tallinn',
                    'Europe/Vienna',
                    'Europe/Vilnius',
                    'Europe/Warsaw',
                    'Europe/Zagreb',
                    'Atlantic/Canary',
                    'Atlantic/Madeira',
                    'Atlantic/Azores',
                ];

                // UK timezones
                const ukTimezones = [
                    'Europe/London',
                    'Europe/Belfast',
                    'Europe/Isle_of_Man',
                    'Europe/Guernsey',
                    'Europe/Jersey',
                ];

                // US timezones
                const usTimezones = [
                    'America/New_York',
                    'America/Chicago',
                    'America/Denver',
                    'America/Los_Angeles',
                    'America/Anchorage',
                    'America/Phoenix',
                    'America/Detroit',
                    'America/Indiana',
                    'Pacific/Honolulu',
                    'America/Boise',
                    'America/Kentucky',
                ];

                // California-specific detection (for CCPA)
                const isCaliforniaLikely = timezone === 'America/Los_Angeles';

                if (
                    euTimezones.some(
                        tz => timezone.startsWith(tz.split('/')[0]) && timezone.includes('Europe')
                    )
                ) {
                    this.region = 'EU';
                } else if (ukTimezones.includes(timezone)) {
                    this.region = 'UK';
                } else if (usTimezones.some(tz => timezone.startsWith(tz.split('/')[0]))) {
                    this.region = isCaliforniaLikely ? 'US-CA' : 'US';
                } else {
                    // Default to strict (GDPR-like) for unknown regions
                    this.region = 'OTHER';
                }
            } catch (e) {
                // Default to strict compliance if detection fails
                this.region = 'OTHER';
            }
        }

        /**
         * Load consent from localStorage
         */
        loadConsent() {
            try {
                const stored = localStorage.getItem(CONFIG.STORAGE_KEY);
                if (stored) {
                    const parsed = JSON.parse(stored);
                    // Validate structure
                    if (parsed.version && parsed.timestamp && parsed.categories) {
                        return parsed;
                    }
                }
            } catch (e) {
                console.warn('Failed to load consent preferences:', e);
            }
            return null;
        }

        /**
         * Save consent to localStorage
         */
        saveConsent(categories) {
            const consent = {
                version: CONFIG.CONSENT_VERSION,
                timestamp: new Date().toISOString(),
                categories: categories,
                region: this.region,
                expiresAt: new Date(
                    Date.now() + CONFIG.EXPIRY_DAYS * 24 * 60 * 60 * 1000
                ).toISOString(),
            };

            try {
                localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(consent));
                this.consent = consent;
            } catch (e) {
                console.error('Failed to save consent preferences:', e);
            }
        }

        /**
         * Check if we have valid, non-expired consent
         */
        hasValidConsent() {
            if (!this.consent) return false;

            // Check version match
            if (this.consent.version !== CONFIG.CONSENT_VERSION) return false;

            // Check expiry
            if (this.consent.expiresAt && new Date(this.consent.expiresAt) < new Date()) {
                return false;
            }

            return true;
        }

        /**
         * Get consent status for a category
         */
        hasConsent(category) {
            if (category === 'necessary') return true; // Always allowed
            if (!this.consent || !this.consent.categories) return false;
            return this.consent.categories[category] === true;
        }

        /**
         * Create and show the consent banner
         */
        showBanner() {
            if (this.bannerElement) return;

            const isGDPR = ['EU', 'UK', 'OTHER'].includes(this.region);
            const isCCPA = this.region === 'US-CA';

            const banner = document.createElement('div');
            banner.id = 'cookie-consent-banner';
            banner.className = 'consent-banner';
            banner.setAttribute('role', 'dialog');
            banner.setAttribute('aria-label', 'Cookie consent');
            banner.setAttribute('aria-modal', 'false');

            // Different messaging based on region
            let mainMessage, primaryAction, secondaryAction;

            if (isGDPR) {
                mainMessage = `We use cookies and similar technologies to enhance your experience. Some are essential for the site to work, while others help us improve our services and understand how you use our site.`;
                primaryAction = 'Accept All';
                secondaryAction = 'Reject Non-Essential';
            } else if (isCCPA) {
                mainMessage = `We use cookies to enhance your experience and analyze site traffic. Under California law, you have the right to opt out of the "sale" or "sharing" of your personal information.`;
                primaryAction = 'Accept All';
                secondaryAction = 'Do Not Sell My Info';
            } else {
                mainMessage = `We use cookies to enhance your browsing experience and analyze site traffic. You can customize your preferences or accept all cookies.`;
                primaryAction = 'Accept All';
                secondaryAction = 'Reject Non-Essential';
            }

            banner.innerHTML = `
                <div class="consent-banner-content">
                    <div class="consent-banner-text">
                        <h3 class="consent-banner-title">Cookie Preferences</h3>
                        <p class="consent-banner-message">${mainMessage}</p>
                        <a href="/privacy.html#cookies" class="consent-banner-link">Learn more in our Privacy Policy</a>
                    </div>
                    <div class="consent-banner-actions">
                        <button type="button" class="consent-btn consent-btn-primary" data-action="accept-all">
                            ${primaryAction}
                        </button>
                        <button type="button" class="consent-btn consent-btn-secondary" data-action="reject-non-essential">
                            ${secondaryAction}
                        </button>
                        <button type="button" class="consent-btn consent-btn-tertiary" data-action="customize">
                            Customize
                        </button>
                    </div>
                </div>
            `;

            // Add event listeners
            banner
                .querySelector('[data-action="accept-all"]')
                .addEventListener('click', () => this.acceptAll());
            banner
                .querySelector('[data-action="reject-non-essential"]')
                .addEventListener('click', () => this.rejectNonEssential());
            banner
                .querySelector('[data-action="customize"]')
                .addEventListener('click', () => this.showPreferencesModal());

            document.body.appendChild(banner);
            this.bannerElement = banner;

            // Animate in
            requestAnimationFrame(() => {
                banner.classList.add('consent-banner-visible');
            });
        }

        /**
         * Hide the consent banner
         */
        hideBanner() {
            if (!this.bannerElement) return;

            this.bannerElement.classList.remove('consent-banner-visible');
            setTimeout(() => {
                if (this.bannerElement && this.bannerElement.parentNode) {
                    this.bannerElement.parentNode.removeChild(this.bannerElement);
                }
                this.bannerElement = null;
            }, 300);
        }

        /**
         * Show the preferences modal for granular control
         */
        showPreferencesModal() {
            if (this.modalElement) return;

            const modal = document.createElement('div');
            modal.id = 'cookie-preferences-modal';
            modal.className = 'consent-modal';
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-label', 'Cookie preferences');
            modal.setAttribute('aria-modal', 'true');

            // Get current preferences
            const currentConsent = this.consent?.categories || {};

            let categoriesHTML = '';
            for (const [key, category] of Object.entries(COOKIE_CATEGORIES)) {
                const isChecked = key === 'necessary' || currentConsent[key] === true;
                const isDisabled = category.required;

                let cookieListHTML = '';
                if (category.cookies.length > 0) {
                    cookieListHTML = `
                        <div class="consent-cookie-list">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Cookie/Storage</th>
                                        <th>Purpose</th>
                                        <th>Duration</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${category.cookies
                                        .map(
                                            cookie => `
                                        <tr>
                                            <td>${cookie.name}</td>
                                            <td>${cookie.purpose}</td>
                                            <td>${cookie.duration}</td>
                                        </tr>
                                    `
                                        )
                                        .join('')}
                                </tbody>
                            </table>
                        </div>
                    `;
                } else {
                    cookieListHTML = `<p class="consent-no-cookies">No cookies in this category currently.</p>`;
                }

                categoriesHTML += `
                    <div class="consent-category ${category.required ? 'consent-category-required' : ''}">
                        <div class="consent-category-header">
                            <label class="consent-toggle">
                                <input type="checkbox"
                                       name="consent-${key}"
                                       ${isChecked ? 'checked' : ''}
                                       ${isDisabled ? 'disabled' : ''}
                                       data-category="${key}">
                                <span class="consent-toggle-slider"></span>
                            </label>
                            <div class="consent-category-info">
                                <h4>${category.name} ${category.required ? '<span class="consent-required-badge">Always Active</span>' : ''}</h4>
                                <p>${category.description}</p>
                            </div>
                            <button type="button" class="consent-expand-btn" aria-label="Expand details">
                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                    <path d="M2 4L6 8L10 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                </svg>
                            </button>
                        </div>
                        <div class="consent-category-details">
                            ${cookieListHTML}
                        </div>
                    </div>
                `;
            }

            modal.innerHTML = `
                <div class="consent-modal-backdrop"></div>
                <div class="consent-modal-content">
                    <div class="consent-modal-header">
                        <h2>Cookie Preferences</h2>
                        <button type="button" class="consent-modal-close" aria-label="Close">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                                <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                        </button>
                    </div>
                    <div class="consent-modal-body">
                        <p class="consent-modal-intro">
                            We respect your privacy. Choose which cookies you'd like to allow.
                            Your choices will be saved and you can change them at any time by
                            clicking "Cookie Preferences" in the footer.
                        </p>
                        <div class="consent-categories">
                            ${categoriesHTML}
                        </div>
                    </div>
                    <div class="consent-modal-footer">
                        <button type="button" class="consent-btn consent-btn-secondary" data-action="reject-all">
                            Reject All Non-Essential
                        </button>
                        <button type="button" class="consent-btn consent-btn-primary" data-action="save-preferences">
                            Save Preferences
                        </button>
                        <button type="button" class="consent-btn consent-btn-tertiary" data-action="accept-all">
                            Accept All
                        </button>
                    </div>
                </div>
            `;

            // Add event listeners
            modal
                .querySelector('.consent-modal-backdrop')
                .addEventListener('click', () => this.hidePreferencesModal());
            modal
                .querySelector('.consent-modal-close')
                .addEventListener('click', () => this.hidePreferencesModal());
            modal.querySelector('[data-action="reject-all"]').addEventListener('click', () => {
                this.rejectNonEssential();
                this.hidePreferencesModal();
            });
            modal
                .querySelector('[data-action="save-preferences"]')
                .addEventListener('click', () => this.savePreferences());
            modal.querySelector('[data-action="accept-all"]').addEventListener('click', () => {
                this.acceptAll();
                this.hidePreferencesModal();
            });

            // Expand/collapse category details
            modal.querySelectorAll('.consent-expand-btn').forEach(btn => {
                btn.addEventListener('click', e => {
                    const category = e.target.closest('.consent-category');
                    category.classList.toggle('consent-category-expanded');
                });
            });

            // Handle escape key
            const handleEscape = e => {
                if (e.key === 'Escape') {
                    this.hidePreferencesModal();
                    document.removeEventListener('keydown', handleEscape);
                }
            };
            document.addEventListener('keydown', handleEscape);

            document.body.appendChild(modal);
            this.modalElement = modal;

            // Prevent body scroll
            document.body.style.overflow = 'hidden';

            // Animate in
            requestAnimationFrame(() => {
                modal.classList.add('consent-modal-visible');
            });

            // Focus first interactive element
            modal.querySelector('.consent-modal-close').focus();
        }

        /**
         * Hide the preferences modal
         */
        hidePreferencesModal() {
            if (!this.modalElement) return;

            document.body.style.overflow = '';
            this.modalElement.classList.remove('consent-modal-visible');

            setTimeout(() => {
                if (this.modalElement && this.modalElement.parentNode) {
                    this.modalElement.parentNode.removeChild(this.modalElement);
                }
                this.modalElement = null;
            }, 300);
        }

        /**
         * Accept all cookies
         */
        acceptAll() {
            const categories = {};
            for (const key of Object.keys(COOKIE_CATEGORIES)) {
                categories[key] = true;
            }
            this.saveConsent(categories);
            this.hideBanner();
            this.hidePreferencesModal();
            this.applyConsent();
            this.dispatchConsentEvent('all');
        }

        /**
         * Reject non-essential cookies
         */
        rejectNonEssential() {
            const categories = {};
            for (const [key, category] of Object.entries(COOKIE_CATEGORIES)) {
                categories[key] = category.required;
            }
            this.saveConsent(categories);
            this.hideBanner();
            this.hidePreferencesModal();
            this.applyConsent();
            this.dispatchConsentEvent('essential-only');
        }

        /**
         * Save current preferences from modal
         */
        savePreferences() {
            const categories = {};
            const checkboxes = this.modalElement.querySelectorAll('[data-category]');

            checkboxes.forEach(checkbox => {
                const category = checkbox.dataset.category;
                categories[category] = checkbox.checked;
            });

            this.saveConsent(categories);
            this.hideBanner();
            this.hidePreferencesModal();
            this.applyConsent();
            this.dispatchConsentEvent('custom');
        }

        /**
         * Apply consent preferences (load/unload scripts)
         */
        applyConsent() {
            // Analytics
            if (this.hasConsent('analytics')) {
                this.loadAnalytics();
            } else {
                this.unloadAnalytics();
            }

            // Functional
            if (!this.hasConsent('functional')) {
                // Could clear functional storage here if needed
            }

            // Marketing (currently none, but ready for future)
            if (!this.hasConsent('marketing')) {
                // Would unload marketing scripts here
            }
        }

        /**
         * Load Vercel Analytics
         */
        loadAnalytics() {
            // Check if already loaded
            if (document.querySelector('script[src="/_vercel/insights/script.js"]')) {
                return;
            }

            // Create Vercel Analytics
            window.va =
                window.va ||
                function () {
                    (window.vaq = window.vaq || []).push(arguments);
                };

            const script = document.createElement('script');
            script.defer = true;
            script.src = '/_vercel/insights/script.js';
            script.dataset.consent = 'analytics';
            document.head.appendChild(script);
        }

        /**
         * Unload/disable analytics
         */
        unloadAnalytics() {
            // Remove analytics script if present
            const script = document.querySelector('script[src="/_vercel/insights/script.js"]');
            if (script) {
                script.remove();
            }

            // Clear Vercel Analytics queues
            if (window.va) {
                delete window.va;
            }
            if (window.vaq) {
                delete window.vaq;
            }

            // Note: Some data may have already been sent before user opted out
            // This is acceptable under most regulations as long as we stop future collection
        }

        /**
         * Dispatch custom event for consent changes
         */
        dispatchConsentEvent(type) {
            const event = new CustomEvent('fuseConsentUpdate', {
                detail: {
                    type: type,
                    consent: this.consent,
                    region: this.region,
                },
            });
            document.dispatchEvent(event);
        }

        /**
         * Set up preference links in footer
         */
        setupPreferenceLinks() {
            document.addEventListener('click', e => {
                if (e.target.matches('[data-cookie-preferences], .cookie-preferences-link')) {
                    e.preventDefault();
                    this.showPreferencesModal();
                }
            });
        }

        /**
         * Reset all consent (for testing or user request)
         */
        resetConsent() {
            localStorage.removeItem(CONFIG.STORAGE_KEY);
            this.consent = null;
            this.unloadAnalytics();
            this.showBanner();
        }

        /**
         * Get current consent state (for debugging/admin)
         */
        getConsentState() {
            return {
                hasConsent: this.hasValidConsent(),
                consent: this.consent,
                region: this.region,
                categories: COOKIE_CATEGORIES,
            };
        }
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            const manager = new ConsentManager();
            manager.init();
        });
    } else {
        const manager = new ConsentManager();
        manager.init();
    }

    // Export for global access
    window.ConsentManager = ConsentManager;
    window.COOKIE_CATEGORIES = COOKIE_CATEGORIES;
})();
