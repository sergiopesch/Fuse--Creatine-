# FUSE Creatine — Technical Documentation

> Technical documentation for the FUSE Creatine platform architecture, data models, and planned infrastructure.
>
> **Note:** FUSE Creatine is at the idea/concept stage. All statistics on the marketing site represent aspirational targets. No pricing has been finalised.

## Documentation Index

### Architecture

| Document | Description | Status |
|----------|-------------|--------|
| [AWS Services](./architecture/aws-services.md) | Planned AWS migration and services | Planned |
| [Data Model](./architecture/data-model.md) | Complete data model documentation | Planned |
| [DynamoDB Design](./architecture/dynamodb-design.md) | Single-table DynamoDB architecture | Planned |

### Privacy & Compliance

| Document | Description | Status |
|----------|-------------|--------|
| [Consent Management](./architecture/consent-management.md) | GDPR/CCPA consent system | Planned |
| [Cookie Preferences](./architecture/cookie-preferences.md) | Cookie consent and tracking | Planned |

### Reference Files

| File | Description |
|------|-------------|
| [data-model.js](./data-model.js) | JavaScript schema definitions |
| [dynamodb-tables.js](./dynamodb-tables.js) | DynamoDB key patterns and access patterns |

---

## Current vs Planned Architecture

### Current State (Production)

```
                                    ┌─────────────────┐
                                    │   Vercel Edge   │
                                    │    Network      │
                                    └────────┬────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
                    ▼                        ▼                        ▼
           ┌───────────────┐        ┌───────────────┐        ┌───────────────┐
           │    Static     │        │   Serverless  │        │   Vercel      │
           │    Assets     │        │   Functions   │        │    Blob       │
           │  (CDN Cached) │        │   (Node.js)   │        │   Storage     │
           └───────────────┘        └───────┬───────┘        └───────────────┘
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    │                       │                       │
                    ▼                       ▼                       ▼
           ┌───────────────┐       ┌───────────────┐       ┌───────────────┐
           │   Anthropic   │       │    Upstash    │       │   In-Memory   │
           │   Claude API  │       │     Redis     │       │    Stores     │
           │               │       │ (Rate Limit)  │       │   (Volatile)  │
           └───────────────┘       └───────────────┘       └───────────────┘
```

**Current Storage:**
- Vercel Blob: User signups, biometric credentials
- Upstash Redis: Rate limiting, session state
- In-Memory: Agent state, cost tracking, audit logs (lost on cold start)

### Planned State (AWS Migration)

```
                                    ┌─────────────────┐
                                    │   CloudFront    │
                                    │      CDN        │
                                    └────────┬────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
                    ▼                        ▼                        ▼
           ┌───────────────┐        ┌───────────────┐        ┌───────────────┐
           │      S3       │        │  API Gateway  │        │   Lambda      │
           │  Static Host  │        │   + Lambda    │        │  @Edge        │
           └───────────────┘        └───────┬───────┘        └───────────────┘
                                            │
           ┌────────────────────────────────┼────────────────────────────────┐
           │                │               │               │                │
           ▼                ▼               ▼               ▼                ▼
    ┌─────────────┐  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │  DynamoDB   │  │ ElastiCache │ │   Bedrock   │ │     S3      │ │    SES      │
    │  (Primary)  │  │   (Redis)   │ │  (Claude)   │ │  (Assets)   │ │  (Email)    │
    └─────────────┘  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

**Planned Storage:**
- DynamoDB: All structured data (users, agents, tasks, consents, costs, audit)
- ElastiCache Redis: Rate limiting, sessions, caching
- S3: Static assets, file uploads, archived data

---

## Quick Links

- [Main README](../README.md) - Project overview
- [Research Docs](../research/README.md) - Product research
- [API Reference](#api-reference) - Endpoint documentation

---

## Implementation Status

| Feature | Current | Planned |
|---------|---------|---------|
| User Signups | Vercel Blob | DynamoDB |
| Biometric Auth | Redis (fuse-redis) | DynamoDB + Redis cache |
| Agent State | In-Memory | DynamoDB |
| Cost Tracking | In-Memory | DynamoDB |
| Audit Logs | In-Memory | DynamoDB (7-year retention) |
| Consent Management | Not implemented | DynamoDB |
| Cookie Preferences | Client-side only | DynamoDB |
| Rate Limiting | Upstash Redis | ElastiCache Redis |
| File Storage | Vercel Blob | S3 |

---

## Getting Started with Docs

These documents describe the **planned** architecture. Implementation has not begun.

To review:
1. Start with [AWS Services](./architecture/aws-services.md) for the overall plan
2. Review [Data Model](./architecture/data-model.md) for entity schemas
3. Check [DynamoDB Design](./architecture/dynamodb-design.md) for database patterns

---

*Last updated: January 2026 — v2.4.0 branding update*
