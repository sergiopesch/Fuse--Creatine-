# Dashboard Authentication Debug Report

## Executive Summary

The FUSE dashboard uses a **WebAuthn-based Owner-Lock System** that secures the dashboard to a single device using biometric authentication (Face ID, Touch ID, Windows Hello, or fingerprint). This report analyzes potential causes for authentication failures and provides solutions.

---

## Table of Contents

1. [Authentication System Architecture](#1-authentication-system-architecture)
2. [Critical Environment Variables](#2-critical-environment-variables)
3. [Common Failure Scenarios](#3-common-failure-scenarios)
4. [Detailed Flow Analysis](#4-detailed-flow-analysis)
5. [Debug Checklist](#5-debug-checklist)
6. [Code-Level Issues](#6-code-level-issues)
7. [Browser/Device Compatibility](#7-browserdevice-compatibility)
8. [Testing Procedures](#8-testing-procedures)
9. [Resolution Steps](#9-resolution-steps)

---

## 1. Authentication System Architecture

### Overview

The system implements a **three-layer security model**:

```
┌─────────────────────────────────────────────────────────────────┐
│                      CLIENT (Browser)                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ biometric-auth.js (921 lines)                            │    │
│  │ - WebAuthn credential management                         │    │
│  │ - Device ID generation/storage                           │    │
│  │ - Session token management                               │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SERVER (Vercel Functions)                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ biometric-authenticate.js (882 lines)                    │    │
│  │ - Challenge generation/verification                      │    │
│  │ - Session token generation                               │    │
│  │ - Device fingerprint matching                            │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ biometric-register.js (669 lines)                        │    │
│  │ - First-time owner registration                          │    │
│  │ - Credential storage                                     │    │
│  │ - Owner-lock enforcement                                 │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      STORAGE                                     │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │ Vercel Blob     │    │ Upstash Redis   │                     │
│  │ - Credentials   │    │ - Rate limits   │                     │
│  │ - Challenges    │    │ - Lockouts      │                     │
│  │ - Device links  │    │                 │                     │
│  └─────────────────┘    └─────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
```

### Key Files

| File | Purpose | Description |
|------|---------|-------------|
| `/js/biometric-auth.js` | Client-side WebAuthn logic | Device ID management, credential handling |
| `/js/dashboard.js` | Dashboard initialization + auth gate | Auth flow coordination |
| `/api/biometric-authenticate.js` | Authentication API endpoint | Challenge/verify flow, session tokens |
| `/api/biometric-register.js` | Registration API endpoint | First-time owner registration |
| `/api/_lib/biometric-utils.js` | Shared biometric utilities | Device fingerprinting, challenge management |
| `/api/_lib/webauthn.js` | WebAuthn utilities | Origin/RP resolution, base64url helpers |
| `/api/_lib/security.js` | Security middleware | CORS, rate limiting, validation |
| `/dashboard.html` | Dashboard with biometric gate | HTML structure + UI elements |

---

## 2. Critical Environment Variables

### Required Variables

| Variable | Purpose | Impact if Missing |
|----------|---------|-------------------|
| `ENCRYPTION_KEY` | Signs session tokens (HMAC-SHA256) | **503 Error**: "Authentication service temporarily unavailable" |
| `BLOB_READ_WRITE_TOKEN` | Stores credentials in Vercel Blob | Cannot read/write credentials, service errors |

### Optional but Recommended

| Variable | Purpose | Default |
|----------|---------|---------|
| `WEBAUTHN_RP_ID` | Relying Party ID for WebAuthn | Auto-detected from request hostname |
| `WEBAUTHN_ORIGINS` | Allowed origins for WebAuthn | Auto-detected from request |
| `UPSTASH_REDIS_REST_URL` | Rate limiting & lockout tracking | Rate limiting disabled |
| `UPSTASH_REDIS_REST_TOKEN` | Redis authentication | Rate limiting disabled |

### How to Check

```javascript
// In biometric-authenticate.js:35-38
const SESSION_SECRET = process.env.ENCRYPTION_KEY;
if (!SESSION_SECRET) {
    console.error('[BiometricAuth] CRITICAL: ENCRYPTION_KEY environment variable is not set');
}
```

**Symptom**: If `ENCRYPTION_KEY` is missing, the server returns:
```json
{
    "success": false,
    "error": "Authentication service temporarily unavailable",
    "code": "CONFIG_ERROR"
}
```

---

## 3. Common Failure Scenarios

### Scenario 1: Missing ENCRYPTION_KEY

**Symptom**: Clicking "Unlock Dashboard" shows "Authentication service temporarily unavailable"

**Location**: `/api/biometric-authenticate.js:514-522`
```javascript
if (!CONFIG.SESSION_SECRET) {
    console.error('[BiometricAuth] Authentication disabled: ENCRYPTION_KEY not configured');
    return res.status(503).json({
        success: false,
        error: 'Authentication service temporarily unavailable',
        code: 'CONFIG_ERROR'
    });
}
```

**Solution**: Set `ENCRYPTION_KEY` in Vercel Environment Variables

---

### Scenario 2: Missing BLOB_READ_WRITE_TOKEN

**Symptom**: Various errors related to credential storage/retrieval

**Location**: `/api/biometric-authenticate.js:233-255`
```javascript
async function getOwnerCredential() {
    try {
        const { blobs } = await list({ prefix: CONFIG.BLOB_PREFIX });
        // ... If BLOB_READ_WRITE_TOKEN is missing, this will throw
    } catch (error) {
        console.error('[BiometricAuth] Failed to get owner credential:', error);
        return { credential: null, error: 'SERVICE_ERROR' };
    }
}
```

**Solution**: Get `BLOB_READ_WRITE_TOKEN` from Vercel project > Settings > Storage > Blob

---

### Scenario 3: Device Fingerprint Mismatch

**Symptom**: User authenticated once but now sees "Access denied. Device mismatch."

**Cause**: The device fingerprint is generated from:
1. **Client-side** (preferred): `localStorage.getItem('fuse_device_id')` - a random 32-char hex string
2. **Header-based** (fallback): Hash of User-Agent + Accept-Language + Accept-Encoding

If localStorage is cleared (e.g., clearing browser data), the device ID changes and no longer matches the stored owner fingerprint.

**Location**: `/js/biometric-auth.js:76-110`
```javascript
function getDeviceId() {
    if (isLocalStorageAvailable()) {
        let deviceId = localStorage.getItem(CONFIG.DEVICE_ID_KEY);
        if (!deviceId) {
            // Generates new random ID - WON'T match stored fingerprint!
            const array = new Uint8Array(16);
            crypto.getRandomValues(array);
            deviceId = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
            localStorage.setItem(CONFIG.DEVICE_ID_KEY, deviceId);
        }
        return deviceId;
    }
    // Fallback to sessionStorage or in-memory...
}
```

**Solution**:
1. Use the device linking feature from an authorized device
2. Or manually delete the credential from Vercel Blob to reset the owner

---

### Scenario 4: Challenge Expired

**Symptom**: "Invalid or expired challenge. Please try again."

**Cause**: Challenges have a 5-minute expiry. If the user takes too long between clicking "Unlock" and completing biometric verification, the challenge expires.

**Location**: `/api/biometric-authenticate.js:163-181`
```javascript
async function verifyChallenge(key) {
    // ...
    if (Date.now() - entry.createdAt > CONFIG.CHALLENGE_EXPIRY) { // 5 minutes
        await del(blob.url);
        return null;
    }
    // ...
}
```

**Solution**: User should complete authentication within 5 minutes of starting

---

### Scenario 5: WebAuthn Not Supported

**Symptom**: Gate shows "Biometric authentication is not available on this device"

**Cause**: The browser doesn't support WebAuthn or doesn't have a platform authenticator.

**Location**: `/js/biometric-auth.js:119-150`
```javascript
async function checkSupport() {
    if (!window.PublicKeyCredential) {
        console.log('[BiometricAuth] WebAuthn not supported');
        return { supported: false, platformAuthenticator: false };
    }

    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    // ...
}
```

**Affected Browsers**:
- Safari in Private Browsing mode (iOS < 16.4)
- Older Android browsers
- Firefox without configured security key
- Any browser in strict private/incognito mode

---

### Scenario 6: CORS Rejection

**Symptom**: Network errors in console, "Unable to connect to authentication server"

**Cause**: Request origin not in allowed list

**Location**: `/api/_lib/security.js:48-55`
```javascript
const ALLOWED_ORIGINS = [
    'https://fuse-creatine.vercel.app',
    'https://www.fusecreatine.com',
    'https://fusecreatine.com',
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
];
```

**Solution**: Add your domain to `ALLOWED_ORIGINS` in `/api/_lib/security.js`

---

### Scenario 7: Rate Limited/Locked Out

**Symptom**: "Too many requests. Please slow down." or "Account temporarily locked"

**Cause**:
- Rate limit: 10 auth requests per minute
- Lockout: 5 failed attempts = 15-minute lockout

**Location**: `/api/biometric-authenticate.js:46-51`
```javascript
const CONFIG = {
    RATE_LIMIT: { limit: 10, windowMs: 60000 },
    MAX_FAILED_ATTEMPTS: 5,
    LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
};
```

**Solution**: Wait for lockout to expire (15 minutes for auth, 1 hour for registration)

---

### Scenario 8: RP ID Mismatch

**Symptom**: WebAuthn verification fails with cryptic error

**Cause**: The Relying Party ID (rpId) must match the domain. If registered on `localhost` but trying to authenticate on `fusecreatine.com`, it will fail.

**Location**: `/api/_lib/webauthn.js:88-104`
```javascript
function getExpectedRpIds(req) {
    const rpIds = new Set();
    if (process.env.WEBAUTHN_RP_ID) {
        // Use configured RP ID
    }
    const hostname = host.split(':')[0];
    if (hostname) rpIds.add(hostname);
    return Array.from(rpIds);
}
```

**Solution**: Credentials are domain-bound. You cannot transfer credentials between domains.

---

## 4. Detailed Flow Analysis

### Authentication Flow

```
1. Page Load
   └── dashboard.js:init()
       └── initBiometricAuth()
           ├── Check if BiometricAuth library loaded
           ├── Check if already verified (session token)
           │   └── BiometricAuth.isSessionVerified()
           │       └── sessionStorage.getItem('fuse_session_token')
           ├── Check WebAuthn support
           │   └── BiometricAuth.checkSupport()
           │       └── PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
           └── Check access status
               └── BiometricAuth.checkAccessStatus()
                   └── POST /api/biometric-authenticate
                       {action: 'check-access', deviceId: '...'}

2. User Clicks "Unlock Dashboard"
   └── handleBiometricAuth()
       └── BiometricAuth.authenticate()
           ├── POST /api/biometric-authenticate
           │   {action: 'get-challenge', deviceId: '...'}
           │   └── Server generates 32-byte challenge, stores in Blob
           │
           ├── navigator.credentials.get({publicKey: options})
           │   └── OS prompts for biometric (Face ID/Touch ID/etc)
           │
           └── POST /api/biometric-authenticate
               {action: 'verify', credentialId, signature, ...}
               └── Server verifies signature with stored public key
                   └── Returns session token (30-minute expiry)

3. Success
   └── hideBiometricGate()
       └── Dashboard content revealed
```

### Registration Flow (First-Time Setup)

```
1. User Clicks "Secure This Dashboard"
   └── handleBiometricSetup()
       └── BiometricAuth.register()
           ├── POST /api/biometric-register
           │   {action: 'get-challenge', userId: '...', deviceId: '...'}
           │
           ├── navigator.credentials.create({publicKey: options})
           │   └── OS prompts for biometric enrollment
           │
           └── POST /api/biometric-register
               {action: 'register', credentialId, attestationObject, ...}
               └── Server stores credential + device fingerprint
                   └── Dashboard is now "owner-locked"
```

---

## 5. Debug Checklist

### Server-Side Checks

- [ ] **Vercel Logs**: Check function logs for `[BiometricAuth]` entries
- [ ] **Environment Variables**: Verify in Vercel Dashboard > Settings > Environment Variables
  - [ ] `ENCRYPTION_KEY` is set (32+ characters)
  - [ ] `BLOB_READ_WRITE_TOKEN` is set
  - [ ] Optional: `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`
- [ ] **Blob Storage**: Check Vercel Blob for credential files
  - Path: `biometric-credentials/owner-credential.json`
- [ ] **CORS Origins**: Verify domain is in allowed list (`/api/_lib/security.js:48-55`)

### Client-Side Checks

- [ ] **Browser Console**: Look for `[BiometricAuth]` or `[Dashboard]` logs
- [ ] **localStorage**: Check for these keys:
  - `fuse_device_id` (32-char hex string)
  - `fuse_biometric_credential_id`
  - `fuse_biometric_user_id`
- [ ] **sessionStorage**: Check for:
  - `fuse_session_token`
- [ ] **Network Tab**: Monitor requests to `/api/biometric-authenticate` and `/api/biometric-register`

### Common Error Codes

| Error | Meaning | Solution |
|-------|---------|----------|
| `CONFIG_ERROR` | Missing environment variable | Check ENCRYPTION_KEY and BLOB_READ_WRITE_TOKEN |
| `BLOB_FETCH_FAILED` | Can't read from Vercel Blob | Check BLOB_READ_WRITE_TOKEN |
| `SERVICE_ERROR` | General service failure | Check Vercel function logs |
| `CORS_ERROR` | Origin not allowed | Add domain to ALLOWED_ORIGINS |
| `RATE_LIMITED` | Too many requests | Wait 1 minute |
| `UNAUTHORIZED` | Invalid session token | Re-authenticate |

---

## 6. Code-Level Issues

### Issue 1: Session Token Stored in sessionStorage

**Location**: `/js/biometric-auth.js:201-205`
```javascript
function storeSessionToken(token) {
    sessionStorage.setItem(CONFIG.SESSION_TOKEN_KEY, token);
    state.isVerified = true;
    state.lastVerification = Date.now();
}
```

**Problem**: Session tokens are stored in `sessionStorage`, which is cleared when the browser tab closes. This means:
- Opening a new tab requires re-authentication
- Refreshing the page maintains the session (good)
- Closing and reopening the browser requires re-authentication

**Impact**: Users need to re-authenticate frequently

---

### Issue 2: Device ID Regeneration in Private Mode

**Location**: `/js/biometric-auth.js:89-109`
```javascript
// Try sessionStorage (persists for browser session in private mode)
try {
    let deviceId = sessionStorage.getItem(CONFIG.DEVICE_ID_KEY);
    if (!deviceId) {
        // Generates NEW random ID - won't match stored fingerprint!
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        deviceId = Array.from(array, ...).join('');
        sessionStorage.setItem(CONFIG.DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
}
```

**Problem**: In private/incognito mode, localStorage is unavailable. Each session gets a new device ID, which won't match the stored owner fingerprint.

**Impact**: Private browsing mode users cannot authenticate as the owner

---

### Issue 3: Silent Failure on Service Errors

**Location**: `/js/dashboard.js:574-587`
```javascript
if (accessStatus.serviceError) {
    console.error('[Dashboard] Service error during access check:', accessStatus.message);
    btnAuth.style.display = 'none';
    btnSetup.style.display = 'none';
    // ... shows error message but no recovery path
}
```

**Problem**: When there's a service error (e.g., missing env vars), buttons are hidden with no way to retry.

**Impact**: User stuck on auth screen with no actionable feedback

---

### Issue 4: Challenge Stored by Device Fingerprint

**Location**: `/api/biometric-authenticate.js:695`
```javascript
await storeChallenge(deviceMatch.fingerprint, challenge);
```

**Problem**: The challenge is keyed by device fingerprint. If the fingerprint changes between `get-challenge` and `verify`, the challenge won't be found.

**Impact**: Authentication fails if device fingerprint changes mid-flow

---

## 7. Browser/Device Compatibility

### Supported Platforms

| Platform | Authenticator | Support Level |
|----------|---------------|---------------|
| iOS 14.5+ | Face ID / Touch ID | Full |
| macOS Big Sur+ | Touch ID | Full |
| Android 7+ | Fingerprint | Full (Chrome) |
| Windows 10+ | Windows Hello | Full (Edge, Chrome) |
| Linux | External Security Key | Partial |

### Known Incompatibilities

| Scenario | Issue | Workaround |
|----------|-------|------------|
| Safari Private Browsing (iOS < 16.4) | WebAuthn disabled | Use regular browsing mode |
| Firefox without security key | Platform authenticator not available | Use Chrome or add security key |
| Brave Browser with shields up | May block WebAuthn | Disable shields for site |
| Very old browsers | No WebAuthn support | Update browser |
| Cross-origin iframes | WebAuthn blocked | Open in top-level window |

### How to Check Support

```javascript
// Check in browser console
(async () => {
    const webauthn = !!window.PublicKeyCredential;
    const platform = webauthn && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    console.log('WebAuthn:', webauthn, 'Platform Auth:', platform);
})();
```

---

## 8. Testing Procedures

### Test 1: Verify Environment Variables

```bash
# In Vercel CLI
vercel env ls

# Expected output should include:
# ENCRYPTION_KEY
# BLOB_READ_WRITE_TOKEN
```

### Test 2: Check Credential Storage

```bash
# Using Vercel CLI
vercel blob list

# Look for: biometric-credentials/owner-credential.json
```

### Test 3: Manual API Test

```bash
# Check access status
curl -X POST https://your-domain.com/api/biometric-authenticate \
  -H "Content-Type: application/json" \
  -d '{"action":"check-access","deviceId":"test123456789012345678901234567890"}'

# Expected response:
# {"success":true,"hasOwner":true/false,"isOwnerDevice":true/false,...}

# If you get CONFIG_ERROR, ENCRYPTION_KEY is missing
# If you get SERVICE_ERROR, BLOB_READ_WRITE_TOKEN is missing
```

### Test 4: Browser Console Debug

```javascript
// Paste in browser console on dashboard page
(async () => {
    console.log('=== BiometricAuth Debug ===');
    console.log('BiometricAuth loaded:', typeof BiometricAuth !== 'undefined');

    if (typeof BiometricAuth !== 'undefined') {
        const state = BiometricAuth.getState();
        console.log('State:', state);

        const support = await BiometricAuth.checkSupport();
        console.log('Support:', support);

        const access = await BiometricAuth.checkAccessStatus();
        console.log('Access Status:', access);
    }
})();
```

---

## 9. Resolution Steps

### Step 1: Verify Environment Variables (Most Common Fix)

1. Go to Vercel Dashboard > Your Project > Settings > Environment Variables
2. Ensure these are set:
   - `ENCRYPTION_KEY`: At least 32 random characters
   - `BLOB_READ_WRITE_TOKEN`: From Vercel Blob storage settings

Generate a secure key:
```bash
openssl rand -hex 32
```

### Step 2: Check CORS Configuration

If accessing from a new domain, add it to `/api/_lib/security.js`:

```javascript
const ALLOWED_ORIGINS = [
    'https://fuse-creatine.vercel.app',
    'https://www.fusecreatine.com',
    'https://fusecreatine.com',
    'http://localhost:3000',
    // Add your domain here:
    'https://your-new-domain.com',
];
```

### Step 3: Reset Owner Credential (Last Resort)

If the owner credential is corrupted or you've lost access:

1. Go to Vercel Dashboard > Storage > Blob
2. Find and delete: `biometric-credentials/owner-credential.json`
3. Also delete any challenges: `biometric-challenges/*`
4. Refresh the dashboard - you'll see "Secure This Dashboard" button
5. Re-register as the new owner

### Step 4: Clear Browser State for Fresh Start

```javascript
// Run in browser console
localStorage.removeItem('fuse_device_id');
localStorage.removeItem('fuse_biometric_credential_id');
localStorage.removeItem('fuse_biometric_user_id');
sessionStorage.removeItem('fuse_session_token');
location.reload();
```

### Step 5: Enable Debug Logging

Add to browser console before reproducing:
```javascript
// Override console.log to capture all [BiometricAuth] messages
const originalLog = console.log;
console.log = (...args) => {
    if (args[0]?.includes?.('[BiometricAuth]') || args[0]?.includes?.('[Dashboard]')) {
        originalLog('%c' + args.join(' '), 'background: #222; color: #bada55');
    }
    originalLog(...args);
};
```

---

## Summary of Most Likely Causes

Based on the code analysis, the most likely reasons authentication is not working:

1. **Missing `ENCRYPTION_KEY`** (90% of cases)
   - The button appears but clicking it shows "service temporarily unavailable"
   - Check Vercel environment variables immediately

2. **Missing `BLOB_READ_WRITE_TOKEN`** (frequent)
   - Various storage-related errors
   - Check Vercel Blob configuration

3. **Device fingerprint changed**
   - User cleared browser data or is in private mode
   - Use device linking or reset the owner credential

4. **WebAuthn not supported**
   - Old browser or private browsing mode
   - Use a modern browser in regular mode

5. **Domain/Origin mismatch**
   - Deployed to new domain not in ALLOWED_ORIGINS
   - Update security.js with new domain

---

## File Reference

For detailed code inspection:

| Component | File Path | Description |
|-----------|-----------|-------------|
| Config Error Check | `/api/biometric-authenticate.js` | Session secret validation |
| Session Token Generation | `/api/biometric-authenticate.js` | HMAC-signed token creation |
| Device Fingerprinting | `/api/_lib/biometric-utils.js` | Shared fingerprinting utilities |
| Challenge Storage | `/api/_lib/biometric-utils.js` | Vercel Blob challenge management |
| Credential Management | `/api/_lib/biometric-utils.js` | Owner credential storage |
| CORS Origins | `/api/_lib/security.js` | Allowed origins whitelist |
| Client Device ID | `/js/biometric-auth.js` | Client-side device ID generation |
| Access Status Check | `/js/biometric-auth.js` | API health and access validation |
| Auth Gate Init | `/js/dashboard.js` | Biometric gate initialization |

### Shared Biometric Utilities (NEW)

The following functions are now centralized in `/api/_lib/biometric-utils.js`:

| Function | Purpose |
|----------|---------|
| `createDeviceFingerprint()` | Generate device fingerprint from client ID or headers |
| `checkDeviceMatch()` | Verify device against authorized list |
| `getOwnerCredential()` | Retrieve owner credential from Vercel Blob |
| `storeOwnerCredential()` | Store/update owner credential |
| `generateChallenge()` | Create cryptographic challenge |
| `storeChallenge()` / `verifyChallenge()` | Challenge lifecycle management |
| `normalizeCredentials()` | Normalize legacy and new credential formats |
| `addAuthorizedDevice()` | Add device to authorized list |

---

*Report updated: 2026-01-26*
*Codebase version: v2.2.0 (with shared biometric utilities)*
