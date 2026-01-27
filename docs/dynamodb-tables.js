/**
 * FUSE DynamoDB Table Design
 * ==========================
 *
 * Single-table design for optimal DynamoDB performance.
 * Uses composite keys and GSIs for flexible access patterns.
 *
 * Table: fuse-main
 * ================
 * Primary Key: PK (Partition Key), SK (Sort Key)
 *
 * GSI1: gsi1pk, gsi1sk - Secondary access patterns
 * GSI2: gsi2pk, gsi2sk - Tertiary access patterns
 *
 * @version 1.0.0
 */

// =============================================================================
// TABLE CONFIGURATION
// =============================================================================

const TableConfig = {
  tableName: 'fuse-main',

  // Primary key
  partitionKey: 'PK',
  sortKey: 'SK',

  // Global Secondary Indexes
  gsi1: {
    name: 'GSI1',
    partitionKey: 'gsi1pk',
    sortKey: 'gsi1sk',
  },
  gsi2: {
    name: 'GSI2',
    partitionKey: 'gsi2pk',
    sortKey: 'gsi2sk',
  },

  // Billing mode
  billingMode: 'PAY_PER_REQUEST', // On-demand for variable workloads

  // TTL attribute
  ttlAttribute: 'ttl',

  // Stream for change data capture (optional)
  streamEnabled: true,
  streamViewType: 'NEW_AND_OLD_IMAGES',
};

// =============================================================================
// KEY PATTERNS
// =============================================================================

/**
 * Key patterns for all entities in the single-table design.
 *
 * Format: { PK, SK, GSI1PK?, GSI1SK?, GSI2PK?, GSI2SK? }
 */
const KeyPatterns = {

  // ===========================================================================
  // USER ENTITIES
  // ===========================================================================

  User: {
    // Get user by ID
    PK: 'USER#{userId}',
    SK: 'PROFILE',
    // GSI1: Lookup by email hash
    GSI1PK: 'EMAIL#{emailHash}',
    GSI1SK: 'USER',
  },

  Signup: {
    // Get signup by ID
    PK: 'SIGNUP#{signupId}',
    SK: 'METADATA',
    // GSI1: List signups by date (for admin)
    GSI1PK: 'SIGNUPS',
    GSI1SK: '{signupDate}#{signupId}',
    // GSI2: Lookup by email hash
    GSI2PK: 'EMAIL#{emailHash}',
    GSI2SK: 'SIGNUP',
  },

  // ===========================================================================
  // CONSENT & PRIVACY
  // ===========================================================================

  ConsentRecord: {
    // Get all consents for user
    PK: 'USER#{userId}',
    SK: 'CONSENT#{consentType}#{timestamp}',
    // GSI1: Query by consent type (for compliance reports)
    GSI1PK: 'CONSENT_TYPE#{consentType}',
    GSI1SK: '{collectedAt}#{consentId}',
    // GSI2: Query all consents by date (for auditing)
    GSI2PK: 'CONSENTS',
    GSI2SK: '{collectedAt}#{consentId}',
  },

  ConsentSummary: {
    // Get current consent state for user
    PK: 'USER#{userId}',
    SK: 'CONSENT_SUMMARY',
  },

  CookiePreference: {
    // Get by user ID (logged in)
    PK: 'USER#{userId}',
    SK: 'COOKIE_PREFS',
    // GSI1: Lookup by cookie ID (anonymous)
    GSI1PK: 'COOKIE#{cookieId}',
    GSI1SK: 'PREFS',
  },

  CookiePreferenceAnonymous: {
    // Anonymous cookie preferences
    PK: 'COOKIE#{cookieId}',
    SK: 'PREFS',
  },

  CookiePreferenceHistory: {
    // Audit trail of cookie changes
    PK: 'COOKIE#{cookieId}',
    SK: 'HISTORY#{timestamp}#{historyId}',
  },

  // ===========================================================================
  // AUTHENTICATION
  // ===========================================================================

  BiometricCredential: {
    // Get credentials for user
    PK: 'USER#{userId}',
    SK: 'BIOMETRIC#{credentialId}',
    // GSI1: Lookup by credential ID (for authentication)
    GSI1PK: 'CREDENTIAL#{credentialId}',
    GSI1SK: 'METADATA',
  },

  Device: {
    // Get devices for user
    PK: 'USER#{userId}',
    SK: 'DEVICE#{deviceFingerprint}',
    // GSI1: Lookup by device fingerprint
    GSI1PK: 'DEVICE#{deviceFingerprint}',
    GSI1SK: 'METADATA',
  },

  // ===========================================================================
  // AGENTS & ORCHESTRATION
  // ===========================================================================

  Team: {
    // Get team by ID
    PK: 'TEAM#{teamId}',
    SK: 'METADATA',
    // GSI1: List all teams
    GSI1PK: 'TEAMS',
    GSI1SK: 'TEAM#{teamId}',
  },

  Agent: {
    // Get agent within team
    PK: 'TEAM#{teamId}',
    SK: 'AGENT#{agentId}',
    // GSI1: Get agent by ID directly
    GSI1PK: 'AGENT#{agentId}',
    GSI1SK: 'METADATA',
    // GSI2: List agents by status
    GSI2PK: 'AGENT_STATUS#{status}',
    GSI2SK: '{teamId}#{agentId}',
  },

  Task: {
    // Get tasks for team
    PK: 'TEAM#{teamId}',
    SK: 'TASK#{taskId}',
    // GSI1: Query tasks by status
    GSI1PK: 'TASK_STATUS#{status}',
    GSI1SK: '{priorityOrder}#{taskId}',
    // GSI2: Get task by ID directly
    GSI2PK: 'TASK#{taskId}',
    GSI2SK: 'METADATA',
  },

  Decision: {
    // Get decisions for team
    PK: 'TEAM#{teamId}',
    SK: 'DECISION#{decisionId}',
    // GSI1: Queue pending decisions
    GSI1PK: 'DECISION_STATUS#{status}',
    GSI1SK: '{priority}#{createdAt}#{decisionId}',
    // GSI2: Get decision by ID
    GSI2PK: 'DECISION#{decisionId}',
    GSI2SK: 'METADATA',
  },

  Activity: {
    // Get activities for team (with TTL)
    PK: 'TEAM#{teamId}',
    SK: 'ACTIVITY#{timestamp}#{activityId}',
    // GSI1: Recent activities across all teams
    GSI1PK: 'ACTIVITIES',
    GSI1SK: '{timestamp}#{activityId}',
  },

  Communication: {
    // Communications by date (with TTL)
    PK: 'COMM#{date}',
    SK: '{timestamp}#{commId}',
    // GSI1: Thread view
    GSI1PK: 'THREAD#{threadId}',
    GSI1SK: '{timestamp}#{commId}',
  },

  // ===========================================================================
  // WORLD CONTROLLER
  // ===========================================================================

  WorldState: {
    // Single world state record
    PK: 'WORLD',
    SK: 'STATE',
  },

  TeamControl: {
    // Per-team control settings
    PK: 'WORLD',
    SK: 'TEAM_CONTROL#{teamId}',
  },

  PendingAction: {
    // Actions queue
    PK: 'WORLD',
    SK: 'ACTION#{timestamp}#{actionId}',
    // GSI1: Filter by status
    GSI1PK: 'ACTION_STATUS#{status}',
    GSI1SK: '{timestamp}#{actionId}',
  },

  // ===========================================================================
  // COST TRACKING
  // ===========================================================================

  CostRecord: {
    // Individual cost records (with TTL for archival)
    PK: 'COST#{date}',
    SK: '{timestamp}#{recordId}',
    // GSI1: By provider
    GSI1PK: 'COST_PROVIDER#{provider}',
    GSI1SK: '{timestamp}#{recordId}',
    // GSI2: By team
    GSI2PK: 'COST_TEAM#{teamId}',
    GSI2SK: '{timestamp}#{recordId}',
  },

  DailyUsageSummary: {
    PK: 'USAGE#DAILY',
    SK: '{date}',
  },

  MonthlyUsageSummary: {
    PK: 'USAGE#MONTHLY',
    SK: '{month}',
  },

  // ===========================================================================
  // AUDIT
  // ===========================================================================

  AuditLog: {
    // Audit entries by date
    PK: 'AUDIT#{date}',
    SK: '{timestamp}#{logId}',
    // GSI1: By action type
    GSI1PK: 'AUDIT_ACTION#{action}',
    GSI1SK: '{timestamp}#{logId}',
    // GSI2: By user
    GSI2PK: 'AUDIT_USER#{userId}',
    GSI2SK: '{timestamp}#{logId}',
  },
};

// =============================================================================
// ACCESS PATTERNS
// =============================================================================

/**
 * Documented access patterns and the queries that support them.
 */
const AccessPatterns = {

  // ===========================================================================
  // USER ACCESS PATTERNS
  // ===========================================================================

  'Get user by ID': {
    operation: 'GetItem',
    key: { PK: 'USER#{userId}', SK: 'PROFILE' },
  },

  'Get user by email': {
    operation: 'Query',
    index: 'GSI1',
    keyCondition: 'gsi1pk = EMAIL#{emailHash} AND gsi1sk = USER',
  },

  'Get all user data (profile + consents + devices)': {
    operation: 'Query',
    keyCondition: 'PK = USER#{userId}',
    description: 'Returns all items for a user in one query',
  },

  // ===========================================================================
  // SIGNUP ACCESS PATTERNS
  // ===========================================================================

  'Get signup by ID': {
    operation: 'GetItem',
    key: { PK: 'SIGNUP#{signupId}', SK: 'METADATA' },
  },

  'List signups by date (paginated)': {
    operation: 'Query',
    index: 'GSI1',
    keyCondition: 'gsi1pk = SIGNUPS',
    scanDirection: 'DESC', // Most recent first
  },

  'Check if email already signed up': {
    operation: 'Query',
    index: 'GSI2',
    keyCondition: 'gsi2pk = EMAIL#{emailHash} AND gsi2sk = SIGNUP',
  },

  // ===========================================================================
  // CONSENT ACCESS PATTERNS
  // ===========================================================================

  'Get all consents for user': {
    operation: 'Query',
    keyCondition: 'PK = USER#{userId} AND begins_with(SK, CONSENT#)',
  },

  'Get consent summary for user': {
    operation: 'GetItem',
    key: { PK: 'USER#{userId}', SK: 'CONSENT_SUMMARY' },
  },

  'Get consent history for specific type': {
    operation: 'Query',
    keyCondition: 'PK = USER#{userId} AND begins_with(SK, CONSENT#{consentType}#)',
  },

  'Report: All consents of type in date range': {
    operation: 'Query',
    index: 'GSI1',
    keyCondition: 'gsi1pk = CONSENT_TYPE#{type} AND gsi1sk BETWEEN {startDate} AND {endDate}',
  },

  'Report: All consents in date range (compliance)': {
    operation: 'Query',
    index: 'GSI2',
    keyCondition: 'gsi2pk = CONSENTS AND gsi2sk BETWEEN {startDate} AND {endDate}',
  },

  // ===========================================================================
  // COOKIE PREFERENCE ACCESS PATTERNS
  // ===========================================================================

  'Get cookie prefs for logged-in user': {
    operation: 'GetItem',
    key: { PK: 'USER#{userId}', SK: 'COOKIE_PREFS' },
  },

  'Get cookie prefs by cookie ID (anonymous)': {
    operation: 'Query',
    index: 'GSI1',
    keyCondition: 'gsi1pk = COOKIE#{cookieId} AND gsi1sk = PREFS',
  },

  'Get cookie preference history': {
    operation: 'Query',
    keyCondition: 'PK = COOKIE#{cookieId} AND begins_with(SK, HISTORY#)',
  },

  // ===========================================================================
  // AUTHENTICATION ACCESS PATTERNS
  // ===========================================================================

  'Get all credentials for user': {
    operation: 'Query',
    keyCondition: 'PK = USER#{userId} AND begins_with(SK, BIOMETRIC#)',
  },

  'Lookup credential by ID (for auth)': {
    operation: 'Query',
    index: 'GSI1',
    keyCondition: 'gsi1pk = CREDENTIAL#{credentialId}',
  },

  'Get all devices for user': {
    operation: 'Query',
    keyCondition: 'PK = USER#{userId} AND begins_with(SK, DEVICE#)',
  },

  'Lookup device by fingerprint': {
    operation: 'Query',
    index: 'GSI1',
    keyCondition: 'gsi1pk = DEVICE#{fingerprint}',
  },

  // ===========================================================================
  // AGENT ACCESS PATTERNS
  // ===========================================================================

  'Get team with all agents': {
    operation: 'Query',
    keyCondition: 'PK = TEAM#{teamId}',
    description: 'Returns team metadata + all agents + tasks + decisions',
  },

  'List all teams': {
    operation: 'Query',
    index: 'GSI1',
    keyCondition: 'gsi1pk = TEAMS',
  },

  'Get agent by ID': {
    operation: 'Query',
    index: 'GSI1',
    keyCondition: 'gsi1pk = AGENT#{agentId}',
  },

  'List agents by status': {
    operation: 'Query',
    index: 'GSI2',
    keyCondition: 'gsi2pk = AGENT_STATUS#{status}',
  },

  // ===========================================================================
  // TASK ACCESS PATTERNS
  // ===========================================================================

  'Get all tasks for team': {
    operation: 'Query',
    keyCondition: 'PK = TEAM#{teamId} AND begins_with(SK, TASK#)',
  },

  'Get task by ID': {
    operation: 'Query',
    index: 'GSI2',
    keyCondition: 'gsi2pk = TASK#{taskId}',
  },

  'Get pending tasks (sorted by priority)': {
    operation: 'Query',
    index: 'GSI1',
    keyCondition: 'gsi1pk = TASK_STATUS#pending',
    description: 'Sorted by priorityOrder for queue display',
  },

  'Get in-progress tasks': {
    operation: 'Query',
    index: 'GSI1',
    keyCondition: 'gsi1pk = TASK_STATUS#in_progress',
  },

  // ===========================================================================
  // DECISION ACCESS PATTERNS
  // ===========================================================================

  'Get pending decisions (approval queue)': {
    operation: 'Query',
    index: 'GSI1',
    keyCondition: 'gsi1pk = DECISION_STATUS#pending',
    description: 'Returns decisions needing approval, sorted by priority',
  },

  'Get decision by ID': {
    operation: 'Query',
    index: 'GSI2',
    keyCondition: 'gsi2pk = DECISION#{decisionId}',
  },

  // ===========================================================================
  // ACTIVITY & COMMUNICATION ACCESS PATTERNS
  // ===========================================================================

  'Get recent activities for team': {
    operation: 'Query',
    keyCondition: 'PK = TEAM#{teamId} AND begins_with(SK, ACTIVITY#)',
    scanDirection: 'DESC',
    limit: 100,
  },

  'Get recent activities across all teams': {
    operation: 'Query',
    index: 'GSI1',
    keyCondition: 'gsi1pk = ACTIVITIES',
    scanDirection: 'DESC',
    limit: 100,
  },

  'Get communications for date': {
    operation: 'Query',
    keyCondition: 'PK = COMM#{date}',
    scanDirection: 'DESC',
  },

  'Get communication thread': {
    operation: 'Query',
    index: 'GSI1',
    keyCondition: 'gsi1pk = THREAD#{threadId}',
  },

  // ===========================================================================
  // WORLD CONTROLLER ACCESS PATTERNS
  // ===========================================================================

  'Get world state': {
    operation: 'GetItem',
    key: { PK: 'WORLD', SK: 'STATE' },
  },

  'Get all world data (state + team controls + pending actions)': {
    operation: 'Query',
    keyCondition: 'PK = WORLD',
  },

  'Get pending actions': {
    operation: 'Query',
    keyCondition: 'PK = WORLD AND begins_with(SK, ACTION#)',
  },

  'Get pending actions by status': {
    operation: 'Query',
    index: 'GSI1',
    keyCondition: 'gsi1pk = ACTION_STATUS#{status}',
  },

  // ===========================================================================
  // COST TRACKING ACCESS PATTERNS
  // ===========================================================================

  'Get cost records for date': {
    operation: 'Query',
    keyCondition: 'PK = COST#{date}',
  },

  'Get cost records by provider': {
    operation: 'Query',
    index: 'GSI1',
    keyCondition: 'gsi1pk = COST_PROVIDER#{provider} AND gsi1sk BETWEEN {start} AND {end}',
  },

  'Get cost records by team': {
    operation: 'Query',
    index: 'GSI2',
    keyCondition: 'gsi2pk = COST_TEAM#{teamId} AND gsi2sk BETWEEN {start} AND {end}',
  },

  'Get daily usage summary': {
    operation: 'GetItem',
    key: { PK: 'USAGE#DAILY', SK: '{date}' },
  },

  'Get daily summaries for range': {
    operation: 'Query',
    keyCondition: 'PK = USAGE#DAILY AND SK BETWEEN {startDate} AND {endDate}',
  },

  'Get monthly usage summary': {
    operation: 'GetItem',
    key: { PK: 'USAGE#MONTHLY', SK: '{month}' },
  },

  // ===========================================================================
  // AUDIT ACCESS PATTERNS
  // ===========================================================================

  'Get audit logs for date': {
    operation: 'Query',
    keyCondition: 'PK = AUDIT#{date}',
    scanDirection: 'DESC',
  },

  'Get audit logs by action type': {
    operation: 'Query',
    index: 'GSI1',
    keyCondition: 'gsi1pk = AUDIT_ACTION#{action} AND gsi1sk BETWEEN {start} AND {end}',
  },

  'Get audit logs for user': {
    operation: 'Query',
    index: 'GSI2',
    keyCondition: 'gsi2pk = AUDIT_USER#{userId}',
    scanDirection: 'DESC',
  },
};

// =============================================================================
// TERRAFORM / CLOUDFORMATION TEMPLATE
// =============================================================================

const CloudFormationTemplate = {
  AWSTemplateFormatVersion: '2010-09-09',
  Description: 'FUSE DynamoDB Table',

  Resources: {
    FuseMainTable: {
      Type: 'AWS::DynamoDB::Table',
      Properties: {
        TableName: 'fuse-main',
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

        TimeToLiveSpecification: {
          AttributeName: 'ttl',
          Enabled: true,
        },

        StreamSpecification: {
          StreamViewType: 'NEW_AND_OLD_IMAGES',
        },

        PointInTimeRecoverySpecification: {
          PointInTimeRecoveryEnabled: true,
        },

        Tags: [
          { Key: 'Application', Value: 'FUSE' },
          { Key: 'Environment', Value: '${Environment}' },
        ],
      },
    },
  },

  Outputs: {
    TableName: {
      Value: { Ref: 'FuseMainTable' },
      Export: { Name: 'FuseMainTableName' },
    },
    TableArn: {
      Value: { 'Fn::GetAtt': ['FuseMainTable', 'Arn'] },
      Export: { Name: 'FuseMainTableArn' },
    },
    StreamArn: {
      Value: { 'Fn::GetAtt': ['FuseMainTable', 'StreamArn'] },
      Export: { Name: 'FuseMainTableStreamArn' },
    },
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Generate key for an entity
 */
function generateKey(entity, params) {
  const pattern = KeyPatterns[entity];
  if (!pattern) {
    throw new Error(`Unknown entity: ${entity}`);
  }

  const key = {
    PK: interpolate(pattern.PK, params),
    SK: interpolate(pattern.SK, params),
  };

  if (pattern.GSI1PK) {
    key.gsi1pk = interpolate(pattern.GSI1PK, params);
    key.gsi1sk = interpolate(pattern.GSI1SK, params);
  }

  if (pattern.GSI2PK) {
    key.gsi2pk = interpolate(pattern.GSI2PK, params);
    key.gsi2sk = interpolate(pattern.GSI2SK, params);
  }

  return key;
}

function interpolate(template, params) {
  return template.replace(/\{(\w+)\}/g, (_, key) => params[key] || `{${key}}`);
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  TableConfig,
  KeyPatterns,
  AccessPatterns,
  CloudFormationTemplate,
  generateKey,
};
