# AWS Services Architecture

> Planned AWS infrastructure for the FUSE platform.

**Status:** Planning Phase - Not Yet Implemented

---

## Table of Contents

- [Overview](#overview)
- [Service Selection](#service-selection)
- [Migration Strategy](#migration-strategy)
- [Cost Estimates](#cost-estimates)
- [Environment Variables](#environment-variables)
- [Implementation Phases](#implementation-phases)

---

## Overview

### Why AWS?

The current Vercel-based infrastructure works well for the frontend and basic APIs, but has limitations:

| Issue | Current State | AWS Solution |
|-------|---------------|--------------|
| Data Persistence | In-memory stores lost on cold start | DynamoDB (persistent) |
| Complex Queries | Vercel Blob (key-value only) | DynamoDB (GSIs, queries) |
| Cost at Scale | Pay-per-request can be expensive | Reserved capacity options |
| Compliance | Limited audit trail | DynamoDB Streams + S3 archival |
| Global Distribution | Vercel Edge (good) | CloudFront + Lambda@Edge |

### Hybrid Approach (Recommended)

Keep Vercel for what it does well, add AWS for data layer:

```
┌──────────────────────────────────────────────────────────────────┐
│                         VERCEL (Keep)                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   Static    │  │  Serverless │  │    Edge     │              │
│  │   Hosting   │  │  Functions  │  │   Network   │              │
│  └─────────────┘  └──────┬──────┘  └─────────────┘              │
└──────────────────────────┼───────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                          AWS (Add)                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  DynamoDB   │  │     S3      │  │  Bedrock    │              │
│  │  (Data)     │  │  (Assets)   │  │  (Claude)   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└──────────────────────────────────────────────────────────────────┘
```

---

## Service Selection

### Primary Services

| Service | Purpose | Priority |
|---------|---------|----------|
| **DynamoDB** | Primary database for all structured data | High |
| **S3** | Asset storage, backups, data archival | High |
| **Bedrock** | Managed Claude API (same models, AWS billing) | Medium |

### Optional Services

| Service | Purpose | When to Add |
|---------|---------|-------------|
| **ElastiCache (Redis)** | Replace Upstash for lower latency | If Upstash costs increase |
| **CloudFront** | CDN for assets | If global performance needed |
| **SES** | Transactional emails | When email features added |
| **Cognito** | User authentication | If moving away from WebAuthn |
| **Lambda** | Full serverless migration | If leaving Vercel |

---

## Service Details

### DynamoDB

Single-table design for all application data.

**Table:** `fuse-main`

```
Primary Key: PK (Partition Key), SK (Sort Key)
GSI1: gsi1pk, gsi1sk
GSI2: gsi2pk, gsi2sk
```

**Entities Stored:**
- Users & Signups
- Consent Records & Summaries
- Cookie Preferences
- Biometric Credentials & Devices
- Agent Teams, Agents, Tasks, Decisions
- Activities & Communications
- Cost Records & Usage Summaries
- Audit Logs

**Configuration:**
```
Billing Mode: PAY_PER_REQUEST (on-demand)
TTL: Enabled (for auto-cleanup)
Streams: Enabled (for change data capture)
Point-in-Time Recovery: Enabled
```

**Estimated Costs:**
- On-demand: ~$1.25 per million writes, ~$0.25 per million reads
- Storage: ~$0.25 per GB/month
- Estimated monthly: $10-50 depending on usage

See [DynamoDB Design](./dynamodb-design.md) for detailed schema.

---

### S3

Object storage for assets and archives.

**Buckets:**

| Bucket | Purpose | Lifecycle |
|--------|---------|-----------|
| `fuse-assets` | Product images, marketing assets | Standard |
| `fuse-uploads` | User uploads (if any) | Intelligent-Tiering |
| `fuse-backups` | DynamoDB exports, audit archives | Glacier after 90 days |

**Configuration:**
```
Versioning: Enabled (assets, uploads)
Encryption: SSE-S3 (default) or SSE-KMS
Public Access: Blocked (use CloudFront for public assets)
```

**Estimated Costs:**
- Storage: ~$0.023 per GB/month (Standard)
- Requests: ~$0.0004 per 1,000 GET requests
- Estimated monthly: $5-20 depending on assets

---

### Bedrock (Claude)

AWS-managed access to Claude models.

**Why Bedrock vs Direct Anthropic API:**
- Consolidated AWS billing
- VPC endpoints (no public internet)
- IAM-based access control
- Same Claude models (Claude 3.5 Haiku, Sonnet, Opus)

**Available Models:**
```
anthropic.claude-3-5-haiku-20241022-v1:0
anthropic.claude-3-5-sonnet-20241022-v2:0
anthropic.claude-3-opus-20240229-v1:0
```

**Pricing (same as Anthropic):**
| Model | Input | Output |
|-------|-------|--------|
| Claude 3.5 Haiku | $0.80/M tokens | $4.00/M tokens |
| Claude 3.5 Sonnet | $3.00/M tokens | $15.00/M tokens |
| Claude 3 Opus | $15.00/M tokens | $75.00/M tokens |

---

## Migration Strategy

### Phase 1: Add DynamoDB (No Breaking Changes)

1. Create DynamoDB table
2. Add AWS SDK to project (already done in package.json)
3. Implement repository layer (already done in `api/_lib/db/`)
4. Dual-write: Write to both Vercel Blob and DynamoDB
5. Validate data consistency
6. Switch reads to DynamoDB
7. Remove Vercel Blob writes

**Risk:** Low - Existing system continues working during migration

### Phase 2: Add S3 for Assets

1. Create S3 bucket with CloudFront distribution
2. Upload existing assets
3. Update asset URLs in code
4. Set up CI/CD for asset deployment

**Risk:** Low - Static assets, easy to test

### Phase 3: Migrate to Bedrock (Optional)

1. Set up Bedrock model access
2. Update API calls to use Bedrock SDK
3. Update cost tracking for Bedrock pricing
4. Remove direct Anthropic API calls

**Risk:** Medium - API differences require testing

### Phase 4: Add ElastiCache (Optional)

1. Create ElastiCache Redis cluster
2. Update rate limiting to use ElastiCache
3. Migrate sessions from Upstash
4. Remove Upstash dependency

**Risk:** Medium - Session migration needs careful handling

---

## Cost Estimates

### Monthly Costs (Estimated)

| Service | Low Usage | Medium Usage | High Usage |
|---------|-----------|--------------|------------|
| DynamoDB | $10 | $30 | $100 |
| S3 | $5 | $15 | $50 |
| Bedrock | $50 | $200 | $500 |
| ElastiCache | $0 | $50 | $100 |
| Data Transfer | $5 | $20 | $50 |
| **Total** | **$70** | **$315** | **$800** |

### Comparison with Current

| Current Service | Monthly Cost | AWS Equivalent | AWS Cost |
|-----------------|--------------|----------------|----------|
| Vercel (Hobby) | $0 | Keep Vercel | $0 |
| Anthropic API | $50-200 | Bedrock | Same |
| Upstash Redis | $10-30 | ElastiCache | $50+ |
| Vercel Blob | $0-20 | S3 | $5-20 |
| **New: DynamoDB** | - | DynamoDB | $10-100 |

**Note:** AWS adds cost but provides better persistence, compliance, and scalability.

---

## Environment Variables

### Required for AWS

```bash
# AWS Credentials (use IAM roles in production)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=eu-west-2

# DynamoDB
DYNAMODB_TABLE_NAME=fuse-main

# S3 (when implemented)
S3_ASSETS_BUCKET=fuse-assets
S3_UPLOADS_BUCKET=fuse-uploads

# Bedrock (when implemented)
BEDROCK_MODEL_ID=anthropic.claude-3-5-haiku-20241022-v1:0
```

### Local Development

```bash
# Use DynamoDB Local for development
DYNAMODB_ENDPOINT=http://localhost:8000
```

### IAM Permissions Required

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query",
        "dynamodb:BatchGetItem",
        "dynamodb:BatchWriteItem"
      ],
      "Resource": [
        "arn:aws:dynamodb:eu-west-2:*:table/fuse-main",
        "arn:aws:dynamodb:eu-west-2:*:table/fuse-main/index/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::fuse-*/*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel"
      ],
      "Resource": "arn:aws:bedrock:*::foundation-model/anthropic.*"
    }
  ]
}
```

---

## Implementation Phases

### Phase 1: Foundation (Current)
- [x] Design data model
- [x] Design DynamoDB schema
- [x] Create repository layer code
- [x] Add AWS SDK dependencies
- [ ] Create DynamoDB table (CloudFormation/Terraform)
- [ ] Configure IAM roles
- [ ] Test locally with DynamoDB Local

### Phase 2: Data Migration
- [ ] Implement dual-write for signups
- [ ] Migrate existing Vercel Blob data
- [ ] Validate data consistency
- [ ] Switch to DynamoDB reads
- [ ] Remove Vercel Blob dependency

### Phase 3: Enhanced Features
- [ ] Implement consent management API
- [ ] Implement cookie preferences API
- [ ] Add audit logging to all endpoints
- [ ] Add cost tracking persistence

### Phase 4: Optional Enhancements
- [ ] Set up S3 for assets
- [ ] Configure CloudFront CDN
- [ ] Migrate to Bedrock
- [ ] Add ElastiCache

---

## Next Steps

When ready to implement:

1. **Create AWS Account** (if not exists)
   - Set up billing alerts
   - Create IAM admin user

2. **Deploy Infrastructure**
   ```bash
   # Use the CloudFormation template in dynamodb-tables.js
   aws cloudformation deploy \
     --template-file infrastructure/dynamodb.yml \
     --stack-name fuse-database
   ```

3. **Configure Environment**
   - Add AWS credentials to Vercel
   - Test connection from serverless functions

4. **Begin Migration**
   - Start with dual-writes
   - Monitor for errors
   - Gradually switch reads

---

*Document Status: Planning*
*Last Updated: January 2026*
