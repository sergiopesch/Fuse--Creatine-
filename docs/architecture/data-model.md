# FUSE Data Model

> Complete documentation of all data entities in the FUSE platform.

**Status:** Planning Phase - Not Yet Implemented

---

## Table of Contents

- [Overview](#overview)
- [Entity Relationship Diagram](#entity-relationship-diagram)
- [User Domain](#user-domain)
- [Consent & Privacy Domain](#consent--privacy-domain)
- [Authentication Domain](#authentication-domain)
- [Agent Domain](#agent-domain)
- [Cost & Usage Domain](#cost--usage-domain)
- [Audit Domain](#audit-domain)

---

## Overview

### Design Principles

1. **Privacy by Design** - PII is encrypted, hashed for lookups
2. **Audit Everything** - Full trail for compliance
3. **Serverless Friendly** - Denormalized for single-query reads
4. **GDPR Compliant** - Data export and deletion support

### Entity Summary

| Domain | Entities | Storage |
|--------|----------|---------|
| User | User, Signup | DynamoDB |
| Consent | ConsentRecord, ConsentSummary | DynamoDB |
| Privacy | CookiePreference, CookieHistory | DynamoDB |
| Auth | BiometricCredential, Device, Session | DynamoDB + Redis |
| Agent | Team, Agent, Task, Decision, Activity | DynamoDB |
| Cost | CostRecord, DailySummary, MonthlySummary | DynamoDB |
| Audit | AuditLog | DynamoDB |

---

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER DOMAIN                             │
│  ┌──────────┐      ┌──────────┐      ┌──────────────────┐      │
│  │   User   │──1:N─│  Signup  │      │ BiometricCred    │      │
│  └────┬─────┘      └──────────┘      └────────┬─────────┘      │
│       │                                       │                 │
│       │ 1:N                                   │ N:1             │
│       ▼                                       ▼                 │
│  ┌──────────┐      ┌──────────┐      ┌──────────────────┐      │
│  │ Consent  │      │ Consent  │      │     Device       │      │
│  │ Record   │──N:1─│ Summary  │      └──────────────────┘      │
│  └──────────┘      └──────────┘                                │
│       │                                                         │
│       │ 1:1                                                     │
│       ▼                                                         │
│  ┌──────────────────┐                                          │
│  │ CookiePreference │                                          │
│  └──────────────────┘                                          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        AGENT DOMAIN                             │
│  ┌──────────┐      ┌──────────┐      ┌──────────────────┐      │
│  │   Team   │──1:N─│  Agent   │      │    Activity      │      │
│  └────┬─────┘      └──────────┘      └──────────────────┘      │
│       │                                       ▲                 │
│       │ 1:N                                   │                 │
│       ▼                                       │                 │
│  ┌──────────┐      ┌──────────┐              │                 │
│  │   Task   │      │ Decision │──────────────┘                 │
│  └──────────┘      └──────────┘                                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                     COST & AUDIT DOMAIN                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐      │
│  │  CostRecord  │  │ DailySummary │  │  MonthlySummary  │      │
│  └──────────────┘  └──────────────┘  └──────────────────┘      │
│                                                                 │
│  ┌──────────────────────────────────────────────────────┐      │
│  │                     AuditLog                          │      │
│  └──────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

---

## User Domain

### User

Core user identity.

| Field | Type | Description |
|-------|------|-------------|
| `userId` | UUID | Primary identifier |
| `email` | String (encrypted) | User email |
| `emailHash` | SHA-256 | For duplicate detection |
| `fullName` | String (encrypted) | Full name |
| `status` | Enum | `active`, `suspended`, `deleted` |
| `emailVerified` | Boolean | Email verification status |
| `source` | String | Signup source |
| `createdAt` | ISO8601 | Creation timestamp |
| `updatedAt` | ISO8601 | Last update timestamp |

### Signup

Waitlist registration record.

| Field | Type | Description |
|-------|------|-------------|
| `signupId` | UUID | Primary identifier |
| `userId` | UUID (optional) | Linked user after conversion |
| `email` | String (encrypted) | Signup email |
| `emailHash` | SHA-256 | For duplicate detection |
| `fullName` | String (encrypted) | Full name |
| `mainInterest` | String (encrypted) | Interest/reason for signup |
| `consentToContact` | Boolean | Marketing consent at signup |
| `policyVersion` | String | Privacy policy version |
| `signupDate` | ISO8601 | Signup timestamp |
| `status` | Enum | `pending`, `verified`, `converted`, `unsubscribed` |

---

## Consent & Privacy Domain

### ConsentRecord

Immutable consent audit record (one per consent action).

| Field | Type | Description |
|-------|------|-------------|
| `consentId` | UUID | Primary identifier |
| `userId` | UUID | User reference |
| `consentType` | Enum | Type of consent |
| `granted` | Boolean | `true` = granted, `false` = revoked |
| `legalBasis` | Enum | GDPR legal basis |
| `purpose` | String | Clear description of purpose |
| `dataCategories` | Array | What data this covers |
| `processingActivities` | Array | What we do with data |
| `thirdParties` | Array | Who we share with |
| `retentionPeriod` | String | How long we keep data |
| `policyVersion` | String | Privacy policy version |
| `collectedAt` | ISO8601 | When consent was recorded |
| `collectionMethod` | Enum | How consent was collected |
| `expiresAt` | ISO8601 (optional) | Auto-expiration date |

**Consent Types:**
- `essential` - Required for site function (always granted)
- `marketing` - Marketing communications
- `analytics` - Usage analytics
- `functional` - Enhanced functionality
- `third_party` - Third-party services
- `newsletter` - Newsletter subscription
- `product_updates` - Product update emails
- `data_processing` - General data processing

**Legal Basis (GDPR Article 6):**
- `consent` - Explicit user consent
- `contract` - Necessary for contract
- `legal_obligation` - Legal requirement
- `vital_interests` - Protect vital interests
- `public_task` - Public interest
- `legitimate_interests` - Legitimate business interests

### ConsentSummary

Current consent state (denormalized for fast reads).

| Field | Type | Description |
|-------|------|-------------|
| `userId` | UUID | User reference |
| `consents` | Object | Current state per type |
| `hasMinimumConsent` | Boolean | Essential consent in place |
| `canProcessData` | Boolean | Data processing allowed |
| `canSendMarketing` | Boolean | Marketing allowed |
| `lastUpdated` | ISO8601 | Last change timestamp |
| `policyVersionAccepted` | String | Latest accepted policy |

### CookiePreference

User cookie consent (supports anonymous users).

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Primary identifier |
| `idType` | Enum | `user` or `anonymous` |
| `userId` | UUID (optional) | If logged in |
| `cookieId` | UUID | Browser cookie identifier |
| `preferences` | Object | Category preferences |
| `granularPreferences` | Object | Per-service preferences |
| `bannerDismissed` | Boolean | Banner interaction complete |
| `preferencesCustomized` | Boolean | User made custom choices |
| `tcfString` | String (optional) | IAB TCF consent string |
| `gpcEnabled` | Boolean | Global Privacy Control |
| `doNotTrack` | Boolean | DNT header respected |
| `country` | String | User country (jurisdiction) |

**Cookie Categories:**
- `essential` - Always enabled, cannot disable
- `functional` - Enhanced features
- `analytics` - Usage tracking
- `marketing` - Advertising
- `preferences` - User preferences

---

## Authentication Domain

### BiometricCredential

WebAuthn passkey credential.

| Field | Type | Description |
|-------|------|-------------|
| `credentialId` | Base64URL | WebAuthn credential ID |
| `userId` | UUID | User reference |
| `publicKey` | Base64URL | Public key for verification |
| `counter` | Number | Signature counter |
| `transports` | Array | `internal`, `usb`, `ble`, `nfc` |
| `aaguid` | String | Authenticator GUID |
| `deviceName` | String | Human-readable device name |
| `deviceFingerprint` | SHA-256 | Device identifier |
| `status` | Enum | `active`, `revoked`, `expired` |
| `createdAt` | ISO8601 | Registration timestamp |
| `lastUsed` | ISO8601 | Last authentication |
| `useCount` | Number | Total authentications |

### Device

Authorized device registry.

| Field | Type | Description |
|-------|------|-------------|
| `deviceId` | UUID | Primary identifier |
| `userId` | UUID | User reference |
| `deviceFingerprint` | SHA-256 | Device identifier |
| `name` | String | Device name |
| `type` | Enum | `mobile`, `tablet`, `desktop` |
| `os` | String | Operating system |
| `browser` | String | Browser name |
| `trustLevel` | Enum | `primary`, `secondary`, `temporary` |
| `authorizedAt` | ISO8601 | Authorization timestamp |
| `lastSeen` | ISO8601 | Last activity |
| `status` | Enum | `active`, `suspended`, `revoked` |

### Session

User session (primarily in Redis).

| Field | Type | Description |
|-------|------|-------------|
| `sessionId` | UUID | Session identifier |
| `userId` | UUID | User reference |
| `deviceFingerprint` | SHA-256 | Device identifier |
| `tokenHash` | SHA-256 | Session token hash |
| `issuedAt` | ISO8601 | Token issue time |
| `expiresAt` | ISO8601 | Token expiration |
| `lastActivityAt` | ISO8601 | Last request |
| `status` | Enum | `active`, `expired`, `revoked` |

---

## Agent Domain

### Team

AI agent team definition.

| Field | Type | Description |
|-------|------|-------------|
| `teamId` | String | Team identifier (e.g., `developer`) |
| `name` | String | Display name |
| `badge` | String | Short badge (e.g., `DEV`) |
| `color` | Hex | Display color |
| `orchestrationStatus` | Enum | `paused`, `active` |
| `automationLevel` | Enum | `stopped`, `manual`, `supervised`, `autonomous` |
| `defaultModel` | String | Default AI model |
| `defaultProvider` | Enum | `anthropic`, `openai`, `gemini` |

### Agent

Individual AI agent.

| Field | Type | Description |
|-------|------|-------------|
| `agentId` | UUID | Agent identifier |
| `teamId` | String | Parent team |
| `name` | String | Agent name |
| `role` | String | Agent role |
| `status` | Enum | `idle`, `working`, `offline`, `error` |
| `currentTask` | UUID (optional) | Active task |
| `modelProvider` | Enum | AI provider |
| `model` | String | AI model name |
| `tasksCompleted` | Number | Completed task count |
| `totalTokensUsed` | Number | Lifetime token usage |
| `totalCost` | Number | Lifetime cost |

### Task

Work item for agents.

| Field | Type | Description |
|-------|------|-------------|
| `taskId` | UUID | Task identifier |
| `teamId` | String | Parent team |
| `title` | String | Task title |
| `description` | String | Task description |
| `priority` | Enum | `low`, `medium`, `high`, `critical` |
| `status` | Enum | `pending`, `in_progress`, `completed`, `cancelled`, `blocked` |
| `assignedAgents` | Array | Assigned agent IDs |
| `progress` | Number | 0-100 completion |
| `createdAt` | ISO8601 | Creation time |
| `startedAt` | ISO8601 | Start time |
| `completedAt` | ISO8601 | Completion time |
| `tokensUsed` | Number | Tokens consumed |
| `actualCost` | Number | Cost incurred |

### Decision

Pending decision requiring approval.

| Field | Type | Description |
|-------|------|-------------|
| `decisionId` | UUID | Decision identifier |
| `teamId` | String | Parent team |
| `title` | String | Decision title |
| `description` | String | Decision description |
| `priority` | Enum | Priority level |
| `impact` | String | Impact description |
| `requestedBy` | String | Requesting agent |
| `status` | Enum | `pending`, `approved`, `rejected`, `deferred` |
| `options` | Array | Available choices |
| `resolvedBy` | String | Resolver user ID |
| `resolution` | String | Resolution notes |

### Activity

Agent activity log entry.

| Field | Type | Description |
|-------|------|-------------|
| `activityId` | UUID | Activity identifier |
| `teamId` | String | Parent team |
| `agentId` | UUID | Acting agent |
| `message` | String | Activity message |
| `tag` | String | Category tag |
| `type` | Enum | `info`, `success`, `warning`, `error` |
| `timestamp` | ISO8601 | Activity time |
| `ttl` | Number | Auto-delete timestamp |

---

## Cost & Usage Domain

### CostRecord

Individual API usage record.

| Field | Type | Description |
|-------|------|-------------|
| `recordId` | UUID | Record identifier |
| `provider` | Enum | `anthropic`, `openai`, `gemini` |
| `model` | String | Model name |
| `endpoint` | String | API endpoint |
| `inputTokens` | Number | Input token count |
| `outputTokens` | Number | Output token count |
| `cost` | Number | Calculated cost (USD) |
| `teamId` | String (optional) | Associated team |
| `agentId` | UUID (optional) | Associated agent |
| `taskId` | UUID (optional) | Associated task |
| `success` | Boolean | Request success |
| `latencyMs` | Number | Request latency |
| `timestamp` | ISO8601 | Request time |

### DailyUsageSummary

Aggregated daily usage.

| Field | Type | Description |
|-------|------|-------------|
| `date` | String | YYYY-MM-DD |
| `requests` | Number | Total requests |
| `inputTokens` | Number | Total input tokens |
| `outputTokens` | Number | Total output tokens |
| `totalCost` | Number | Total cost (USD) |
| `successCount` | Number | Successful requests |
| `errorCount` | Number | Failed requests |
| `byProvider` | Object | Breakdown by provider |
| `byTeam` | Object | Breakdown by team |

### MonthlyUsageSummary

Aggregated monthly usage (same structure as daily).

---

## Audit Domain

### AuditLog

Immutable audit trail entry.

| Field | Type | Description |
|-------|------|-------------|
| `logId` | UUID | Log entry identifier |
| `action` | Enum | Action type |
| `success` | Boolean | Action success |
| `severity` | Enum | `debug`, `info`, `warning`, `error`, `critical` |
| `userId` | UUID (optional) | Acting user |
| `deviceFingerprint` | SHA-256 (optional) | Acting device |
| `ipAddress` | String | Client IP |
| `userAgent` | String | Client user agent |
| `endpoint` | String | API endpoint |
| `method` | String | HTTP method |
| `details` | Object | Action-specific details |
| `errorCode` | String (optional) | Error code if failed |
| `timestamp` | ISO8601 | Event time |
| `ttl` | Number | Retention (7 years default) |

**Audit Actions:**
- Authentication: `BIOMETRIC_AUTH_SUCCESS`, `BIOMETRIC_AUTH_FAILED`, etc.
- User: `SIGNUP_SUCCESS`, `USER_CREATED`, `USER_DELETED`
- Consent: `CONSENT_GRANTED`, `CONSENT_REVOKED`
- Agent: `TASK_CREATED`, `DECISION_APPROVED`
- Security: `RATE_LIMIT_EXCEEDED`, `LOCKOUT_TRIGGERED`
- Cost: `BUDGET_WARNING`, `BUDGET_EXCEEDED`

---

## Reference Implementation

See the JavaScript schema definitions:
- [data-model.js](../data-model.js) - Full schema with validation rules
- [dynamodb-tables.js](../dynamodb-tables.js) - DynamoDB key patterns

---

*Document Status: Planning*
*Last Updated: January 2026*
