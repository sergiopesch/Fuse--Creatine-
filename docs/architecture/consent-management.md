# Consent Management System

> GDPR and CCPA compliant consent management for the FUSE platform.

**Status:** Planning Phase - Not Yet Implemented

---

## Table of Contents

- [Overview](#overview)
- [Compliance Requirements](#compliance-requirements)
- [Consent Types](#consent-types)
- [User Journeys](#user-journeys)
- [API Design](#api-design)
- [Data Storage](#data-storage)
- [UI Components](#ui-components)

---

## Overview

### What is Consent Management?

A system to collect, store, and manage user consent for data processing activities. Required for GDPR (EU), CCPA (California), and other privacy regulations.

### Key Principles

1. **Explicit Consent** - User must actively opt-in (no pre-checked boxes)
2. **Granular Control** - Consent per purpose, not blanket agreement
3. **Easy Withdrawal** - As easy to withdraw as to give
4. **Audit Trail** - Complete history of consent changes
5. **Transparency** - Clear explanation of data usage

---

## Compliance Requirements

### GDPR (EU/UK)

| Requirement | Implementation |
|-------------|----------------|
| Lawful basis | Record legal basis per consent type |
| Purpose limitation | Specific purpose for each consent |
| Data minimization | Only collect what's needed |
| Right to withdraw | Easy consent revocation |
| Right to access | Export user consent data |
| Right to erasure | Delete all consent records |
| Record of processing | Complete audit trail |

### CCPA (California)

| Requirement | Implementation |
|-------------|----------------|
| Right to know | Disclose data collection practices |
| Right to delete | Delete personal information |
| Right to opt-out | Do not sell personal information |
| Non-discrimination | Same service regardless of choice |

### ePrivacy (Cookie Law)

| Requirement | Implementation |
|-------------|----------------|
| Prior consent | Consent before non-essential cookies |
| Clear information | Explain what cookies do |
| Easy withdrawal | Cookie preference center |

---

## Consent Types

### Marketing Consent

| Type | Purpose | Examples |
|------|---------|----------|
| `marketing` | Promotional communications | Email campaigns, offers |
| `newsletter` | Regular newsletter | Weekly digest |
| `product_updates` | Product announcements | New features, launches |

### Data Processing Consent

| Type | Purpose | Examples |
|------|---------|----------|
| `analytics` | Usage analytics | Page views, behavior |
| `functional` | Enhanced features | Personalization |
| `third_party` | Third-party sharing | Partner integrations |
| `data_processing` | General processing | Account creation |

### Essential (Always Required)

| Type | Purpose | Notes |
|------|---------|-------|
| `essential` | Site functionality | Cannot be revoked |

---

## User Journeys

### New User Signup

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Landing    │────▶│   Signup     │────▶│   Consent    │
│    Page      │     │    Form      │     │   Capture    │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                 │
                     ┌───────────────────────────┘
                     ▼
              ┌──────────────┐
              │   Store:     │
              │ - Consent    │
              │ - Policy ver │
              │ - Timestamp  │
              └──────────────┘
```

**Signup Form Consent Collection:**

```html
<form>
  <!-- User details -->
  <input name="email" required>
  <input name="fullName" required>

  <!-- Essential (implied by signup) -->
  <input type="hidden" name="essentialConsent" value="true">

  <!-- Marketing (optional, unchecked by default) -->
  <label>
    <input type="checkbox" name="marketingConsent">
    I'd like to receive product updates and offers
  </label>

  <!-- Policy acceptance (required) -->
  <label>
    <input type="checkbox" name="policyAccepted" required>
    I agree to the <a href="/privacy">Privacy Policy</a> (v1.0)
  </label>
</form>
```

### Cookie Banner Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  First Visit │────▶│   Cookie     │────▶│   Choice     │
│              │     │   Banner     │     │   Made       │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │
         ┌──────────────────┼──────────────────┐
         ▼                  ▼                  ▼
   ┌──────────┐      ┌──────────┐      ┌──────────┐
   │  Accept  │      │  Reject  │      │ Customize│
   │   All    │      │   All    │      │          │
   └────┬─────┘      └────┬─────┘      └────┬─────┘
        │                 │                  │
        ▼                 ▼                  ▼
   ┌──────────────────────────────────────────────┐
   │              Store Preferences               │
   │  - Cookie ID                                 │
   │  - Category selections                       │
   │  - Timestamp                                 │
   │  - Collection method                         │
   └──────────────────────────────────────────────┘
```

### Preference Center

```
┌──────────────────────────────────────────────────────────────┐
│                     Privacy Preferences                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Cookie Preferences                                          │
│  ─────────────────                                          │
│  ☑ Essential Cookies (Required)     [Cannot disable]        │
│    Necessary for the website to function                     │
│                                                              │
│  ☐ Functional Cookies               [Toggle]                │
│    Remember your preferences                                 │
│                                                              │
│  ☐ Analytics Cookies                [Toggle]                │
│    Help us improve our website                              │
│                                                              │
│  ☐ Marketing Cookies                [Toggle]                │
│    Show relevant ads                                        │
│                                                              │
│  Communication Preferences                                   │
│  ─────────────────────────                                  │
│  ☐ Product updates and launches                             │
│  ☐ Weekly newsletter                                        │
│  ☐ Special offers and promotions                            │
│                                                              │
│  [Save Preferences]                                          │
│                                                              │
│  ─────────────────────────────────────────────────────────  │
│  Data Rights                                                 │
│  [Export My Data]  [Delete My Account]                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## API Design

### Consent Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/consent` | GET | Get user's consent summary |
| `/api/consent` | POST | Record new consent |
| `/api/consent/history` | GET | Get consent change history |
| `/api/consent/export` | GET | Export consent data (GDPR) |
| `/api/consent/revoke` | POST | Revoke specific consent |
| `/api/cookies` | GET | Get cookie preferences |
| `/api/cookies` | POST | Save cookie preferences |

### Record Consent

```http
POST /api/consent
Authorization: Bearer {token}
Content-Type: application/json

{
  "consentType": "marketing",
  "granted": true,
  "purpose": "Receive promotional emails about FUSE products",
  "policyVersion": "1.0",
  "collectionMethod": "signup_form"
}
```

Response:

```json
{
  "success": true,
  "consentId": "abc123",
  "consentType": "marketing",
  "granted": true,
  "collectedAt": "2026-01-27T10:30:00Z"
}
```

### Get Consent Summary

```http
GET /api/consent
Authorization: Bearer {token}
```

Response:

```json
{
  "userId": "user123",
  "consents": {
    "essential": {
      "granted": true,
      "grantedAt": "2026-01-01T00:00:00Z"
    },
    "marketing": {
      "granted": true,
      "grantedAt": "2026-01-15T14:22:00Z"
    },
    "analytics": {
      "granted": false
    },
    "newsletter": {
      "granted": true,
      "grantedAt": "2026-01-15T14:22:00Z"
    }
  },
  "canSendMarketing": true,
  "canProcessData": true,
  "policyVersionAccepted": "1.0"
}
```

### Save Cookie Preferences

```http
POST /api/cookies
Content-Type: application/json

{
  "cookieId": "ck_abc123",
  "preferences": {
    "essential": { "enabled": true },
    "functional": { "enabled": true },
    "analytics": { "enabled": false },
    "marketing": { "enabled": false }
  },
  "bannerDismissed": true
}
```

### Export Consent Data (GDPR)

```http
GET /api/consent/export
Authorization: Bearer {token}
```

Response:

```json
{
  "exportDate": "2026-01-27T10:30:00Z",
  "userId": "user123",
  "currentConsents": {
    "marketing": { "granted": true },
    "analytics": { "granted": false }
  },
  "consentHistory": [
    {
      "consentType": "marketing",
      "granted": true,
      "purpose": "Promotional emails",
      "collectedAt": "2026-01-15T14:22:00Z",
      "collectionMethod": "signup_form"
    },
    {
      "consentType": "analytics",
      "granted": true,
      "collectedAt": "2026-01-10T09:00:00Z",
      "collectionMethod": "cookie_banner"
    },
    {
      "consentType": "analytics",
      "granted": false,
      "collectedAt": "2026-01-20T16:45:00Z",
      "collectionMethod": "preferences_page"
    }
  ]
}
```

---

## Data Storage

### ConsentRecord (Immutable)

Each consent change creates a new record (never update/delete):

```javascript
{
  PK: "USER#user123",
  SK: "CONSENT#marketing#2026-01-15T14:22:00Z",

  consentId: "consent_abc123",
  userId: "user123",
  consentType: "marketing",
  granted: true,

  // GDPR requirements
  legalBasis: "consent",
  purpose: "Send promotional emails about FUSE products",
  dataCategories: ["email", "name"],
  processingActivities: ["email_marketing"],
  retentionPeriod: "2 years",

  // Policy tracking
  policyVersion: "1.0",

  // Collection metadata
  collectedAt: "2026-01-15T14:22:00Z",
  collectionMethod: "signup_form",
  ipAddress: "192.168.xxx.xxx",
  userAgent: "Mozilla/5.0...",

  _entityType: "CONSENT_RECORD"
}
```

### ConsentSummary (Computed)

Current state for fast reads:

```javascript
{
  PK: "USER#user123",
  SK: "CONSENT_SUMMARY",

  userId: "user123",
  consents: {
    essential: { granted: true, grantedAt: "2026-01-01T00:00:00Z" },
    marketing: { granted: true, grantedAt: "2026-01-15T14:22:00Z" },
    analytics: { granted: false },
    newsletter: { granted: true, grantedAt: "2026-01-15T14:22:00Z" }
  },

  // Computed flags
  hasMinimumConsent: true,
  canProcessData: true,
  canSendMarketing: true,

  lastUpdated: "2026-01-20T16:45:00Z",
  policyVersionAccepted: "1.0",

  _entityType: "CONSENT_SUMMARY"
}
```

---

## UI Components

### Cookie Banner

```javascript
// js/consent-banner.js

class CookieBanner {
  constructor() {
    this.cookieId = this.getCookieId();
    this.preferences = null;
  }

  async init() {
    // Check if preferences already saved
    this.preferences = await this.loadPreferences();

    if (!this.preferences?.bannerDismissed) {
      this.show();
    } else {
      this.applyPreferences(this.preferences);
    }
  }

  show() {
    const banner = document.createElement('div');
    banner.className = 'cookie-banner';
    banner.innerHTML = `
      <div class="cookie-banner__content">
        <h3>Cookie Preferences</h3>
        <p>We use cookies to enhance your experience.
           By continuing, you agree to our use of cookies.</p>
        <div class="cookie-banner__actions">
          <button class="btn-primary" data-action="accept-all">
            Accept All
          </button>
          <button class="btn-secondary" data-action="reject-all">
            Reject Non-Essential
          </button>
          <button class="btn-link" data-action="customize">
            Customize
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(banner);
    this.attachListeners(banner);
  }

  async acceptAll() {
    await this.savePreferences({
      essential: { enabled: true },
      functional: { enabled: true },
      analytics: { enabled: true },
      marketing: { enabled: true }
    });
  }

  async rejectAll() {
    await this.savePreferences({
      essential: { enabled: true },
      functional: { enabled: false },
      analytics: { enabled: false },
      marketing: { enabled: false }
    });
  }

  applyPreferences(prefs) {
    // Enable/disable tracking scripts based on preferences
    if (prefs.preferences.analytics?.enabled) {
      this.enableAnalytics();
    }
    if (prefs.preferences.marketing?.enabled) {
      this.enableMarketing();
    }
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  const banner = new CookieBanner();
  banner.init();
});
```

### Preference Center Component

```javascript
// js/preference-center.js

class PreferenceCenter {
  constructor(container) {
    this.container = container;
    this.userId = null;
    this.consentSummary = null;
    this.cookiePrefs = null;
  }

  async load() {
    // Load current state
    const [consents, cookies] = await Promise.all([
      this.fetchConsentSummary(),
      this.fetchCookiePreferences()
    ]);

    this.consentSummary = consents;
    this.cookiePrefs = cookies;

    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="preference-center">
        <h2>Privacy Preferences</h2>

        <section class="pref-section">
          <h3>Cookie Preferences</h3>
          ${this.renderCookieToggles()}
        </section>

        <section class="pref-section">
          <h3>Communication Preferences</h3>
          ${this.renderCommunicationToggles()}
        </section>

        <section class="pref-section">
          <h3>Your Data Rights</h3>
          <button class="btn-secondary" data-action="export">
            Export My Data
          </button>
          <button class="btn-danger" data-action="delete">
            Delete My Account
          </button>
        </section>

        <button class="btn-primary" data-action="save">
          Save Preferences
        </button>
      </div>
    `;

    this.attachListeners();
  }

  renderCookieToggles() {
    const categories = [
      { id: 'essential', name: 'Essential', locked: true },
      { id: 'functional', name: 'Functional', locked: false },
      { id: 'analytics', name: 'Analytics', locked: false },
      { id: 'marketing', name: 'Marketing', locked: false }
    ];

    return categories.map(cat => `
      <div class="toggle-row">
        <label>
          <input type="checkbox"
                 name="cookie_${cat.id}"
                 ${this.cookiePrefs?.preferences?.[cat.id]?.enabled ? 'checked' : ''}
                 ${cat.locked ? 'disabled checked' : ''}>
          ${cat.name} Cookies
        </label>
        ${cat.locked ? '<span class="badge">Required</span>' : ''}
      </div>
    `).join('');
  }

  async exportData() {
    const response = await fetch('/api/consent/export', {
      headers: { 'Authorization': `Bearer ${this.token}` }
    });
    const data = await response.json();

    // Download as JSON
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-data-export.json';
    a.click();
  }
}
```

---

## Implementation Checklist

When ready to implement:

- [ ] Create DynamoDB table (see [DynamoDB Design](./dynamodb-design.md))
- [ ] Implement consent repository (`api/_lib/db/repositories/consent.js`) - Done
- [ ] Implement cookie repository (`api/_lib/db/repositories/cookies.js`) - Done
- [ ] Create consent API endpoints
- [ ] Create cookie preferences API endpoints
- [ ] Build cookie banner component
- [ ] Build preference center page
- [ ] Update signup form with consent collection
- [ ] Add audit logging for consent changes
- [ ] Test GDPR data export
- [ ] Test data deletion (right to erasure)

---

*Document Status: Planning*
*Last Updated: January 2026*
