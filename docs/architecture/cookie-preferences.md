# Cookie Preferences System

> Cookie consent management for GDPR, CCPA, and ePrivacy compliance.

**Status:** Planning Phase - Not Yet Implemented

---

## Table of Contents

- [Overview](#overview)
- [Cookie Categories](#cookie-categories)
- [Compliance Features](#compliance-features)
- [Technical Implementation](#technical-implementation)
- [UI Specifications](#ui-specifications)

---

## Overview

### What Cookies Does FUSE Use?

| Category | Cookies | Purpose |
|----------|---------|---------|
| Essential | Session, CSRF | Site functionality |
| Functional | Preferences | Remember user choices |
| Analytics | Google Analytics | Usage statistics |
| Marketing | Facebook Pixel | Advertising |

### Storage Approach

- **Anonymous users:** Cookie ID stored in browser, preferences in DynamoDB
- **Logged-in users:** Preferences linked to user account
- **Cross-device:** Preferences sync when user logs in

---

## Cookie Categories

### Essential (Required)

Cannot be disabled. Required for basic functionality.

| Cookie | Purpose | Duration |
|--------|---------|----------|
| `fuse_session` | Session management | Session |
| `fuse_csrf` | Security token | Session |
| `fuse_cookie_consent` | Remember consent choice | 13 months |

### Functional

Enhanced features that remember user preferences.

| Cookie | Purpose | Duration |
|--------|---------|----------|
| `fuse_prefs` | UI preferences | 1 year |
| `fuse_lang` | Language preference | 1 year |
| `fuse_theme` | Dark/light mode | 1 year |

### Analytics

Track usage to improve the site.

| Cookie | Purpose | Duration | Service |
|--------|---------|----------|---------|
| `_ga` | Visitor ID | 2 years | Google Analytics |
| `_gid` | Session ID | 24 hours | Google Analytics |
| `_gat` | Rate limiting | 1 minute | Google Analytics |

### Marketing

Advertising and remarketing.

| Cookie | Purpose | Duration | Service |
|--------|---------|----------|---------|
| `_fbp` | Facebook tracking | 3 months | Facebook Pixel |
| `_gcl_au` | Conversion tracking | 3 months | Google Ads |

---

## Compliance Features

### Global Privacy Control (GPC)

Automatically respect GPC browser signal:

```javascript
// Detect GPC signal
const gpcEnabled = navigator.globalPrivacyControl === true;

if (gpcEnabled) {
  // Disable non-essential cookies by default
  preferences.analytics = { enabled: false };
  preferences.marketing = { enabled: false };
}
```

### Do Not Track (DNT)

Respect DNT header (though non-binding):

```javascript
const dntEnabled = navigator.doNotTrack === '1';

if (dntEnabled) {
  // Disable analytics by default
  preferences.analytics = { enabled: false };
}
```

### IAB TCF 2.0

Optional support for IAB Transparency & Consent Framework:

```javascript
// Store TCF consent string
{
  tcfString: "CPXxRfAPXxRfAAfKABENB-CgAAAAAAAAAAYgAAAAAAAA",
  tcfVersion: 2
}
```

### Jurisdiction Detection

Different defaults based on location:

| Region | Default Behavior |
|--------|-----------------|
| EU/UK (GDPR) | All non-essential OFF |
| California (CCPA) | All OFF, opt-out required |
| Other | All OFF (conservative) |

---

## Technical Implementation

### Data Model

```javascript
// CookiePreference entity
{
  // Identity
  id: "uuid",
  idType: "user" | "anonymous",
  userId: "uuid | null",        // If logged in
  cookieId: "uuid",             // Browser cookie ID

  // Preferences by category
  preferences: {
    essential: { enabled: true, locked: true },
    functional: { enabled: false, consentedAt: null },
    analytics: { enabled: false, consentedAt: null },
    marketing: { enabled: false, consentedAt: null }
  },

  // Granular controls (optional)
  granularPreferences: {
    googleAnalytics: true,
    facebookPixel: false,
    googleAds: false
  },

  // Banner state
  bannerShown: true,
  bannerDismissed: true,
  bannerDismissedAt: "2026-01-27T10:00:00Z",
  preferencesCustomized: true,

  // Compliance
  tcfString: null,
  gpcEnabled: false,
  doNotTrack: false,

  // Metadata
  country: "GB",
  createdAt: "2026-01-27T10:00:00Z",
  updatedAt: "2026-01-27T10:00:00Z"
}
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/cookies` | GET | Get current preferences |
| `/api/cookies` | POST | Save preferences |
| `/api/cookies/enabled` | GET | Get enabled cookies for client |

### Client-Side Implementation

```javascript
// js/cookie-manager.js

class CookieManager {
  constructor() {
    this.cookieId = this.getOrCreateCookieId();
    this.preferences = null;
  }

  getOrCreateCookieId() {
    let id = this.getCookie('fuse_cookie_id');
    if (!id) {
      id = crypto.randomUUID();
      this.setCookie('fuse_cookie_id', id, 365 * 13 / 12); // 13 months
    }
    return id;
  }

  async loadPreferences() {
    // Try server first (if we have a cookie ID)
    try {
      const response = await fetch(`/api/cookies?id=${this.cookieId}`);
      if (response.ok) {
        this.preferences = await response.json();
        return this.preferences;
      }
    } catch (e) {
      console.warn('Failed to load preferences from server');
    }

    // Fall back to localStorage
    const stored = localStorage.getItem('fuse_cookie_prefs');
    if (stored) {
      this.preferences = JSON.parse(stored);
    }

    return this.preferences;
  }

  async savePreferences(prefs) {
    this.preferences = {
      cookieId: this.cookieId,
      preferences: prefs,
      bannerDismissed: true,
      gpcEnabled: navigator.globalPrivacyControl === true,
      doNotTrack: navigator.doNotTrack === '1'
    };

    // Save to server
    try {
      await fetch('/api/cookies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.preferences)
      });
    } catch (e) {
      console.warn('Failed to save preferences to server');
    }

    // Also save locally as backup
    localStorage.setItem('fuse_cookie_prefs', JSON.stringify(this.preferences));

    // Apply preferences
    this.applyPreferences();
  }

  applyPreferences() {
    const prefs = this.preferences?.preferences || {};

    // Analytics
    if (prefs.analytics?.enabled) {
      this.enableGoogleAnalytics();
    } else {
      this.disableGoogleAnalytics();
    }

    // Marketing
    if (prefs.marketing?.enabled) {
      this.enableFacebookPixel();
    } else {
      this.disableFacebookPixel();
    }
  }

  enableGoogleAnalytics() {
    if (window.gtag) return; // Already loaded

    // Load GA script
    const script = document.createElement('script');
    script.src = `https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID`;
    script.async = true;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    window.gtag = function() { dataLayer.push(arguments); };
    gtag('js', new Date());
    gtag('config', 'GA_MEASUREMENT_ID', { anonymize_ip: true });
  }

  disableGoogleAnalytics() {
    // Set opt-out
    window['ga-disable-GA_MEASUREMENT_ID'] = true;

    // Delete existing cookies
    this.deleteCookie('_ga');
    this.deleteCookie('_gid');
    this.deleteCookie('_gat');
  }

  enableFacebookPixel() {
    if (window.fbq) return;

    // Load FB Pixel
    !function(f,b,e,v,n,t,s) {
      if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)
    }(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');

    fbq('init', 'FB_PIXEL_ID');
    fbq('track', 'PageView');
  }

  disableFacebookPixel() {
    this.deleteCookie('_fbp');
    window.fbq = function() {}; // Disable
  }

  // Cookie helpers
  setCookie(name, value, days) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  }

  getCookie(name) {
    return document.cookie.split('; ').reduce((r, v) => {
      const parts = v.split('=');
      return parts[0] === name ? decodeURIComponent(parts[1]) : r;
    }, null);
  }

  deleteCookie(name) {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  }
}

// Global instance
window.cookieManager = new CookieManager();
```

---

## UI Specifications

### Cookie Banner

**Position:** Fixed bottom or bottom-left
**Trigger:** First visit without saved preferences
**Dismiss:** After any choice made

```
┌─────────────────────────────────────────────────────────────────┐
│  🍪 We use cookies                                              │
│                                                                 │
│  We use cookies to enhance your experience. Some are essential, │
│  others help us improve our site.                               │
│                                                                 │
│  [Accept All]  [Reject All]  [Customize]     [Privacy Policy]  │
└─────────────────────────────────────────────────────────────────┘
```

**States:**
- Initial: Shows banner
- After "Accept All": All categories enabled
- After "Reject All": Only essential enabled
- After "Customize": Opens preference panel

### Preference Panel

**Position:** Modal overlay
**Trigger:** "Customize" button or settings link
**Save:** Explicit save button

```
┌─────────────────────────────────────────────────────────────────┐
│  Cookie Preferences                                      [X]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ☑ Essential Cookies                              [Always On]  │
│    Required for the website to function properly                │
│                                                                 │
│  ───────────────────────────────────────────────────────────── │
│                                                                 │
│  ☐ Functional Cookies                                   [Off]  │
│    Enable enhanced features and personalisation                 │
│                                                                 │
│  ───────────────────────────────────────────────────────────── │
│                                                                 │
│  ☐ Analytics Cookies                                    [Off]  │
│    Help us understand how visitors use our site                │
│    ├ Google Analytics                                    ☐     │
│                                                                 │
│  ───────────────────────────────────────────────────────────── │
│                                                                 │
│  ☐ Marketing Cookies                                    [Off]  │
│    Used to show relevant advertisements                         │
│    ├ Facebook Pixel                                      ☐     │
│    ├ Google Ads                                          ☐     │
│                                                                 │
│  ───────────────────────────────────────────────────────────── │
│                                                                 │
│  [Save Preferences]                      [Reject All] [Accept All] │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Footer Link

Always accessible link to manage preferences:

```html
<footer>
  <a href="#" onclick="cookieManager.showPreferences(); return false;">
    Cookie Preferences
  </a>
</footer>
```

---

## CSS Specifications

```css
/* Cookie Banner */
.cookie-banner {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bg-surface);
  border-top: 1px solid var(--border-color);
  padding: 1.5rem;
  z-index: 9999;
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.15);
}

.cookie-banner__content {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.cookie-banner__actions {
  display: flex;
  gap: 0.75rem;
  flex-shrink: 0;
}

/* Preference Modal */
.cookie-modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.cookie-modal__content {
  background: var(--bg-surface);
  border-radius: 12px;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
}

/* Toggle Switch */
.cookie-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.cookie-toggle__switch {
  position: relative;
  width: 48px;
  height: 24px;
  background: var(--bg-muted);
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.2s;
}

.cookie-toggle__switch.active {
  background: var(--color-primary);
}

.cookie-toggle__switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  background: white;
  border-radius: 50%;
  transition: transform 0.2s;
}

.cookie-toggle__switch.active::after {
  transform: translateX(24px);
}
```

---

## Implementation Checklist

- [ ] Create cookie banner HTML/CSS
- [ ] Create preference panel HTML/CSS
- [ ] Implement CookieManager JavaScript class
- [ ] Create `/api/cookies` GET endpoint
- [ ] Create `/api/cookies` POST endpoint
- [ ] Integrate with Google Analytics (conditional load)
- [ ] Integrate with Facebook Pixel (conditional load)
- [ ] Add GPC detection
- [ ] Add DNT detection
- [ ] Add jurisdiction detection (optional)
- [ ] Add TCF support (optional)
- [ ] Test across browsers
- [ ] Test cookie deletion on opt-out

---

*Document Status: Planning*
*Last Updated: January 2026*
