# DynamoDB Single-Table Design

> Database schema and access patterns for the FUSE platform.

**Status:** Planning Phase - Not Yet Implemented

---

## Table of Contents

- [Overview](#overview)
- [Table Configuration](#table-configuration)
- [Key Patterns](#key-patterns)
- [Access Patterns](#access-patterns)
- [CloudFormation Template](#cloudformation-template)
- [Local Development](#local-development)

---

## Overview

### Why Single-Table Design?

1. **Fewer round trips** - Get related data in one query
2. **Lower costs** - Fewer read capacity units
3. **Simpler operations** - One table to manage
4. **Transactional support** - All entities in same table

### Key Schema

```
Table: fuse-main

Primary Key:
  - PK (Partition Key): String
  - SK (Sort Key): String

Global Secondary Indexes:
  - GSI1: gsi1pk (PK), gsi1sk (SK)
  - GSI2: gsi2pk (PK), gsi2sk (SK)
```

---

## Table Configuration

```yaml
TableName: fuse-main

BillingMode: PAY_PER_REQUEST  # On-demand pricing

AttributeDefinitions:
  - AttributeName: PK
    AttributeType: S
  - AttributeName: SK
    AttributeType: S
  - AttributeName: gsi1pk
    AttributeType: S
  - AttributeName: gsi1sk
    AttributeType: S
  - AttributeName: gsi2pk
    AttributeType: S
  - AttributeName: gsi2sk
    AttributeType: S

KeySchema:
  - AttributeName: PK
    KeyType: HASH
  - AttributeName: SK
    KeyType: RANGE

GlobalSecondaryIndexes:
  - IndexName: GSI1
    KeySchema:
      - AttributeName: gsi1pk
        KeyType: HASH
      - AttributeName: gsi1sk
        KeyType: RANGE
    Projection:
      ProjectionType: ALL

  - IndexName: GSI2
    KeySchema:
      - AttributeName: gsi2pk
        KeyType: HASH
      - AttributeName: gsi2sk
        KeyType: RANGE
    Projection:
      ProjectionType: ALL

TimeToLiveSpecification:
  AttributeName: ttl
  Enabled: true

StreamSpecification:
  StreamViewType: NEW_AND_OLD_IMAGES  # For change data capture

PointInTimeRecoverySpecification:
  PointInTimeRecoveryEnabled: true  # 35-day backups
```

---

## Key Patterns

### User Entities

| Entity | PK | SK | GSI1PK | GSI1SK |
|--------|----|----|--------|--------|
| User | `USER#{userId}` | `PROFILE` | `EMAIL#{emailHash}` | `USER` |
| Signup | `SIGNUP#{signupId}` | `METADATA` | `SIGNUPS` | `{signupDate}#{signupId}` |

### Consent Entities

| Entity | PK | SK | GSI1PK | GSI1SK | GSI2PK | GSI2SK |
|--------|----|----|--------|--------|--------|--------|
| ConsentRecord | `USER#{userId}` | `CONSENT#{type}#{timestamp}` | `CONSENT_TYPE#{type}` | `{timestamp}#{id}` | `CONSENTS` | `{timestamp}#{id}` |
| ConsentSummary | `USER#{userId}` | `CONSENT_SUMMARY` | - | - | - | - |
| CookiePreference | `USER#{userId}` | `COOKIE_PREFS` | `COOKIE#{cookieId}` | `PREFS` | - | - |
| CookiePreference (anon) | `COOKIE#{cookieId}` | `PREFS` | - | - | - | - |

### Authentication Entities

| Entity | PK | SK | GSI1PK | GSI1SK |
|--------|----|----|--------|--------|
| BiometricCredential | `USER#{userId}` | `BIOMETRIC#{credentialId}` | `CREDENTIAL#{credentialId}` | `METADATA` |
| Device | `USER#{userId}` | `DEVICE#{fingerprint}` | `DEVICE#{fingerprint}` | `METADATA` |

### Agent Entities

| Entity | PK | SK | GSI1PK | GSI1SK | GSI2PK | GSI2SK |
|--------|----|----|--------|--------|--------|--------|
| Team | `TEAM#{teamId}` | `METADATA` | `TEAMS` | `TEAM#{teamId}` | - | - |
| Agent | `TEAM#{teamId}` | `AGENT#{agentId}` | `AGENT#{agentId}` | `METADATA` | `AGENT_STATUS#{status}` | `{teamId}#{agentId}` |
| Task | `TEAM#{teamId}` | `TASK#{taskId}` | `TASK_STATUS#{status}` | `{priorityOrder}#{taskId}` | `TASK#{taskId}` | `METADATA` |
| Decision | `TEAM#{teamId}` | `DECISION#{decisionId}` | `DECISION_STATUS#{status}` | `{priority}#{timestamp}#{id}` | `DECISION#{decisionId}` | `METADATA` |
| Activity | `TEAM#{teamId}` | `ACTIVITY#{timestamp}#{id}` | `ACTIVITIES` | `{timestamp}#{id}` | - | - |

### World Controller Entities

| Entity | PK | SK |
|--------|----|----|
| WorldState | `WORLD` | `STATE` |
| TeamControl | `WORLD` | `TEAM_CONTROL#{teamId}` |
| PendingAction | `WORLD` | `ACTION#{timestamp}#{id}` |

### Cost Entities

| Entity | PK | SK | GSI1PK | GSI1SK | GSI2PK | GSI2SK |
|--------|----|----|--------|--------|--------|--------|
| CostRecord | `COST#{date}` | `{timestamp}#{id}` | `COST_PROVIDER#{provider}` | `{timestamp}#{id}` | `COST_TEAM#{teamId}` | `{timestamp}#{id}` |
| DailySummary | `USAGE#DAILY` | `{date}` | - | - | - | - |
| MonthlySummary | `USAGE#MONTHLY` | `{month}` | - | - | - | - |

### Audit Entities

| Entity | PK | SK | GSI1PK | GSI1SK | GSI2PK | GSI2SK |
|--------|----|----|--------|--------|--------|--------|
| AuditLog | `AUDIT#{date}` | `{timestamp}#{id}` | `AUDIT_ACTION#{action}` | `{timestamp}#{id}` | `AUDIT_USER#{userId}` | `{timestamp}#{id}` |

---

## Access Patterns

### User Operations

| Operation | Query |
|-----------|-------|
| Get user by ID | `GetItem: PK=USER#{userId}, SK=PROFILE` |
| Get user by email | `Query GSI1: gsi1pk=EMAIL#{emailHash}` |
| Get all user data | `Query: PK=USER#{userId}` (returns profile, consents, devices, cookies) |

### Signup Operations

| Operation | Query |
|-----------|-------|
| Get signup by ID | `GetItem: PK=SIGNUP#{signupId}, SK=METADATA` |
| List signups by date | `Query GSI1: gsi1pk=SIGNUPS, ScanIndexForward=false` |
| Check duplicate email | `Query GSI2: gsi2pk=EMAIL#{emailHash}, gsi2sk=SIGNUP` |

### Consent Operations

| Operation | Query |
|-----------|-------|
| Get consent summary | `GetItem: PK=USER#{userId}, SK=CONSENT_SUMMARY` |
| Get consent history | `Query: PK=USER#{userId}, SK begins_with CONSENT#` |
| Get consents by type | `Query GSI1: gsi1pk=CONSENT_TYPE#{type}` |
| Compliance report | `Query GSI2: gsi2pk=CONSENTS, gsi2sk BETWEEN {start} AND {end}` |

### Cookie Preference Operations

| Operation | Query |
|-----------|-------|
| Get prefs (logged in) | `GetItem: PK=USER#{userId}, SK=COOKIE_PREFS` |
| Get prefs (anonymous) | `Query GSI1: gsi1pk=COOKIE#{cookieId}, gsi1sk=PREFS` |
| Get preference history | `Query: PK=COOKIE#{cookieId}, SK begins_with HISTORY#` |

### Agent Operations

| Operation | Query |
|-----------|-------|
| Get team with all data | `Query: PK=TEAM#{teamId}` (returns team, agents, tasks, decisions) |
| List all teams | `Query GSI1: gsi1pk=TEAMS` |
| Get agent by ID | `Query GSI1: gsi1pk=AGENT#{agentId}` |
| Get agents by status | `Query GSI2: gsi2pk=AGENT_STATUS#{status}` |

### Task Operations

| Operation | Query |
|-----------|-------|
| Get tasks for team | `Query: PK=TEAM#{teamId}, SK begins_with TASK#` |
| Get task by ID | `Query GSI2: gsi2pk=TASK#{taskId}` |
| Get pending tasks | `Query GSI1: gsi1pk=TASK_STATUS#pending` |

### Decision Operations

| Operation | Query |
|-----------|-------|
| Get pending decisions | `Query GSI1: gsi1pk=DECISION_STATUS#pending` |
| Get decision by ID | `Query GSI2: gsi2pk=DECISION#{decisionId}` |

### Cost Operations

| Operation | Query |
|-----------|-------|
| Get costs for date | `Query: PK=COST#{date}` |
| Get costs by provider | `Query GSI1: gsi1pk=COST_PROVIDER#{provider}` |
| Get costs by team | `Query GSI2: gsi2pk=COST_TEAM#{teamId}` |
| Get daily summary | `GetItem: PK=USAGE#DAILY, SK={date}` |
| Get monthly summary | `GetItem: PK=USAGE#MONTHLY, SK={month}` |

### Audit Operations

| Operation | Query |
|-----------|-------|
| Get logs for date | `Query: PK=AUDIT#{date}, ScanIndexForward=false` |
| Get logs by action | `Query GSI1: gsi1pk=AUDIT_ACTION#{action}` |
| Get logs for user | `Query GSI2: gsi2pk=AUDIT_USER#{userId}` |

---

## CloudFormation Template

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: FUSE DynamoDB Table

Parameters:
  Environment:
    Type: String
    Default: production
    AllowedValues:
      - development
      - staging
      - production

Resources:
  FuseMainTable:
    Type: AWS::DynamoDB::Table
    Properties:
      TableName: !Sub 'fuse-main-${Environment}'
      BillingMode: PAY_PER_REQUEST

      AttributeDefinitions:
        - AttributeName: PK
          AttributeType: S
        - AttributeName: SK
          AttributeType: S
        - AttributeName: gsi1pk
          AttributeType: S
        - AttributeName: gsi1sk
          AttributeType: S
        - AttributeName: gsi2pk
          AttributeType: S
        - AttributeName: gsi2sk
          AttributeType: S

      KeySchema:
        - AttributeName: PK
          KeyType: HASH
        - AttributeName: SK
          KeyType: RANGE

      GlobalSecondaryIndexes:
        - IndexName: GSI1
          KeySchema:
            - AttributeName: gsi1pk
              KeyType: HASH
            - AttributeName: gsi1sk
              KeyType: RANGE
          Projection:
            ProjectionType: ALL

        - IndexName: GSI2
          KeySchema:
            - AttributeName: gsi2pk
              KeyType: HASH
            - AttributeName: gsi2sk
              KeyType: RANGE
          Projection:
            ProjectionType: ALL

      TimeToLiveSpecification:
        AttributeName: ttl
        Enabled: true

      StreamSpecification:
        StreamViewType: NEW_AND_OLD_IMAGES

      PointInTimeRecoverySpecification:
        PointInTimeRecoveryEnabled: true

      Tags:
        - Key: Application
          Value: FUSE
        - Key: Environment
          Value: !Ref Environment

Outputs:
  TableName:
    Value: !Ref FuseMainTable
    Export:
      Name: !Sub '${AWS::StackName}-TableName'

  TableArn:
    Value: !GetAtt FuseMainTable.Arn
    Export:
      Name: !Sub '${AWS::StackName}-TableArn'

  StreamArn:
    Value: !GetAtt FuseMainTable.StreamArn
    Export:
      Name: !Sub '${AWS::StackName}-StreamArn'
```

### Deploy Command

```bash
aws cloudformation deploy \
  --template-file infrastructure/dynamodb.yml \
  --stack-name fuse-database \
  --parameter-overrides Environment=production
```

---

## Local Development

### DynamoDB Local

Run DynamoDB locally for development:

```bash
# Using Docker
docker run -p 8000:8000 amazon/dynamodb-local

# Or using Java
java -Djava.library.path=./DynamoDBLocal_lib -jar DynamoDBLocal.jar -sharedDb
```

### Environment Variables

```bash
# .env.local
DYNAMODB_ENDPOINT=http://localhost:8000
DYNAMODB_TABLE_NAME=fuse-main-development
AWS_REGION=eu-west-2
AWS_ACCESS_KEY_ID=local
AWS_SECRET_ACCESS_KEY=local
```

### Create Local Table

```javascript
const { CreateTableCommand } = require('@aws-sdk/client-dynamodb');

const params = {
  TableName: 'fuse-main-development',
  BillingMode: 'PAY_PER_REQUEST',
  AttributeDefinitions: [
    { AttributeName: 'PK', AttributeType: 'S' },
    { AttributeName: 'SK', AttributeType: 'S' },
    { AttributeName: 'gsi1pk', AttributeType: 'S' },
    { AttributeName: 'gsi1sk', AttributeType: 'S' },
    { AttributeName: 'gsi2pk', AttributeType: 'S' },
    { AttributeName: 'gsi2sk', AttributeType: 'S' },
  ],
  KeySchema: [
    { AttributeName: 'PK', KeyType: 'HASH' },
    { AttributeName: 'SK', KeyType: 'RANGE' },
  ],
  GlobalSecondaryIndexes: [
    {
      IndexName: 'GSI1',
      KeySchema: [
        { AttributeName: 'gsi1pk', KeyType: 'HASH' },
        { AttributeName: 'gsi1sk', KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    },
    {
      IndexName: 'GSI2',
      KeySchema: [
        { AttributeName: 'gsi2pk', KeyType: 'HASH' },
        { AttributeName: 'gsi2sk', KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    },
  ],
};

await client.send(new CreateTableCommand(params));
```

---

## Reference Implementation

The repository layer is already implemented at:

```
api/_lib/db/
├── client.js           # DynamoDB client
├── index.js            # Exports
└── repositories/
    ├── agents.js       # Agent operations
    ├── audit.js        # Audit logging
    ├── consent.js      # Consent management
    ├── cookies.js      # Cookie preferences
    └── costs.js        # Cost tracking
```

See [data-model.js](../data-model.js) and [dynamodb-tables.js](../dynamodb-tables.js) for detailed schemas.

---

*Document Status: Planning*
*Last Updated: January 2026*
