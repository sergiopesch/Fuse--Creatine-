/**
 * FUSE Application Data Model
 * ===========================
 *
 * Complete data model documentation for the FUSE Creatine application.
 * This file serves as both documentation and TypeScript-compatible schema definitions.
 *
 * Storage Strategy:
 * - DynamoDB: Primary structured data (users, agents, tasks, consent)
 * - Redis (Upstash): Rate limiting, sessions, biometrics cache
 * - S3: Large files, backups, historical archives
 *
 * @version 1.0.0
 * @lastUpdated 2026-01-27
 */

// =============================================================================
// ENUMS & CONSTANTS
// =============================================================================

const EntityTypes = {
  USER: 'USER',
  SIGNUP: 'SIGNUP',
  CONSENT: 'CONSENT',
  COOKIE_PREFERENCE: 'COOKIE_PREFERENCE',
  BIOMETRIC_CREDENTIAL: 'BIOMETRIC_CREDENTIAL',
  DEVICE: 'DEVICE',
  AGENT: 'AGENT',
  TEAM: 'TEAM',
  TASK: 'TASK',
  DECISION: 'DECISION',
  ACTIVITY: 'ACTIVITY',
  COMMUNICATION: 'COMMUNICATION',
  COST_RECORD: 'COST_RECORD',
  AUDIT_LOG: 'AUDIT_LOG',
  SESSION: 'SESSION',
};

const ConsentTypes = {
  MARKETING: 'marketing',
  ANALYTICS: 'analytics',
  FUNCTIONAL: 'functional',
  ESSENTIAL: 'essential', // Always required, cannot be revoked
  THIRD_PARTY: 'third_party',
  DATA_PROCESSING: 'data_processing',
  NEWSLETTER: 'newsletter',
  PRODUCT_UPDATES: 'product_updates',
};

const CookieCategories = {
  ESSENTIAL: 'essential',       // Required for site function
  FUNCTIONAL: 'functional',     // Enhanced functionality
  ANALYTICS: 'analytics',       // Usage tracking
  MARKETING: 'marketing',       // Advertising & remarketing
  PREFERENCES: 'preferences',   // User preferences
};

const TaskPriorities = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
};

const TaskStatuses = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  BLOCKED: 'blocked',
};

const DecisionStatuses = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  DEFERRED: 'deferred',
};

const AgentStatuses = {
  IDLE: 'idle',
  WORKING: 'working',
  OFFLINE: 'offline',
  ERROR: 'error',
};

const OrchestrationModes = {
  MANUAL: 'manual',
  SUPERVISED: 'supervised',
  AUTONOMOUS: 'autonomous',
};

const WorldStatuses = {
  PAUSED: 'paused',
  MANUAL: 'manual',
  SEMI_AUTO: 'semi_auto',
  AUTONOMOUS: 'autonomous',
};

const AuditActions = {
  // Auth events
  BIOMETRIC_REGISTER_SUCCESS: 'BIOMETRIC_REGISTER_SUCCESS',
  BIOMETRIC_REGISTER_FAILED: 'BIOMETRIC_REGISTER_FAILED',
  BIOMETRIC_AUTH_SUCCESS: 'BIOMETRIC_AUTH_SUCCESS',
  BIOMETRIC_AUTH_FAILED: 'BIOMETRIC_AUTH_FAILED',
  SESSION_CREATED: 'SESSION_CREATED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  DEVICE_LINKED: 'DEVICE_LINKED',

  // User events
  SIGNUP_SUCCESS: 'SIGNUP_SUCCESS',
  SIGNUP_FAILED: 'SIGNUP_FAILED',
  CONSENT_GRANTED: 'CONSENT_GRANTED',
  CONSENT_REVOKED: 'CONSENT_REVOKED',
  COOKIE_PREFERENCES_UPDATED: 'COOKIE_PREFERENCES_UPDATED',

  // Agent events
  TASK_CREATED: 'TASK_CREATED',
  TASK_UPDATED: 'TASK_UPDATED',
  TASK_COMPLETED: 'TASK_COMPLETED',
  DECISION_REQUESTED: 'DECISION_REQUESTED',
  DECISION_RESOLVED: 'DECISION_RESOLVED',

  // World events
  WORLD_PAUSED: 'WORLD_PAUSED',
  WORLD_RESUMED: 'WORLD_RESUMED',
  EMERGENCY_STOP: 'EMERGENCY_STOP',

  // Cost events
  BUDGET_WARNING: 'BUDGET_WARNING',
  BUDGET_EXCEEDED: 'BUDGET_EXCEEDED',
};

// =============================================================================
// CORE USER ENTITIES
// =============================================================================

/**
 * User - Core user identity
 *
 * DynamoDB Key: PK=USER#{userId}, SK=PROFILE
 */
const UserSchema = {
  // Primary identifiers
  userId: 'string:uuid',           // Unique user ID
  email: 'string:email',           // User email (indexed, encrypted at rest)
  emailHash: 'string:sha256',      // SHA-256 hash for lookups

  // Profile
  fullName: 'string:encrypted',    // Encrypted full name
  createdAt: 'string:iso8601',
  updatedAt: 'string:iso8601',

  // Status
  status: ['active', 'suspended', 'deleted'],
  emailVerified: 'boolean',
  emailVerifiedAt: 'string:iso8601:optional',

  // Metadata
  source: 'string',                // How user signed up (waitlist, direct, etc.)
  metadata: 'object:optional',     // Additional flexible metadata

  // Indexes
  _gsi1pk: 'string',               // GSI1: emailHash for lookup
  _gsi1sk: 'string',
};

/**
 * Signup - Waitlist signup record
 *
 * DynamoDB Key: PK=USER#{userId}, SK=SIGNUP#{signupId}
 * Or standalone: PK=SIGNUP#{signupId}, SK=METADATA
 */
const SignupSchema = {
  signupId: 'string:uuid',
  userId: 'string:uuid:optional',  // Linked after user creation

  // Collected data
  email: 'string:encrypted',
  emailHash: 'string:sha256',
  fullName: 'string:encrypted',
  mainInterest: 'string:encrypted',
  company: 'string:encrypted:optional',

  // Consent at signup
  consentToContact: 'boolean',
  policyVersion: 'string',
  consentTimestamp: 'string:iso8601',

  // Metadata
  signupDate: 'string:iso8601',
  ipAddress: 'string:masked',      // Partially masked IP
  userAgent: 'string:optional',
  referrer: 'string:optional',

  // Status
  status: ['pending', 'verified', 'converted', 'unsubscribed'],
  convertedAt: 'string:iso8601:optional',

  // Indexes
  _gsi1pk: 'string',               // GSI1: signupDate for listing
  _gsi1sk: 'string',
};

// =============================================================================
// CONSENT & PRIVACY ENTITIES
// =============================================================================

/**
 * ConsentRecord - Individual consent grant/revoke record
 *
 * DynamoDB Key: PK=USER#{userId}, SK=CONSENT#{consentType}#{timestamp}
 *
 * GDPR/CCPA compliant consent tracking with full audit trail.
 * Each consent change creates a new record (immutable history).
 */
const ConsentRecordSchema = {
  consentId: 'string:uuid',
  userId: 'string:uuid',

  // Consent details
  consentType: Object.values(ConsentTypes),
  granted: 'boolean',              // true = granted, false = revoked

  // Legal basis (GDPR Article 6)
  legalBasis: [
    'consent',                     // User explicitly consented
    'contract',                    // Necessary for contract performance
    'legal_obligation',            // Legal requirement
    'vital_interests',             // Protect vital interests
    'public_task',                 // Public interest
    'legitimate_interests',        // Legitimate business interests
  ],

  // Consent context
  purpose: 'string',               // Clear description of purpose
  dataCategories: 'array:string',  // What data this consent covers
  processingActivities: 'array:string', // What we'll do with it
  thirdParties: 'array:string:optional', // Who we share with
  retentionPeriod: 'string',       // How long we keep it

  // Version control
  policyVersion: 'string',         // Privacy policy version
  termsVersion: 'string:optional', // Terms of service version

  // Collection metadata
  collectedAt: 'string:iso8601',
  collectionMethod: [
    'signup_form',
    'cookie_banner',
    'preferences_page',
    'checkout',
    'api',
    'import',
  ],
  ipAddress: 'string:masked',
  userAgent: 'string:optional',

  // Withdrawal (if revoked)
  revokedAt: 'string:iso8601:optional',
  revocationMethod: 'string:optional',

  // Expiration
  expiresAt: 'string:iso8601:optional', // Auto-expire consent

  // Audit
  createdAt: 'string:iso8601',

  // Indexes
  _gsi1pk: 'string',               // GSI1: consentType for reporting
  _gsi1sk: 'string',
  _gsi2pk: 'string',               // GSI2: collectedAt for compliance reports
  _gsi2sk: 'string',
};

/**
 * ConsentSummary - Current consent state per user (derived/cached)
 *
 * DynamoDB Key: PK=USER#{userId}, SK=CONSENT_SUMMARY
 *
 * Denormalized view of current consent status for fast reads.
 * Updated whenever ConsentRecord changes.
 */
const ConsentSummarySchema = {
  userId: 'string:uuid',

  // Current consent state (computed from ConsentRecords)
  consents: {
    marketing: { granted: 'boolean', grantedAt: 'string:iso8601:optional', expiresAt: 'string:iso8601:optional' },
    analytics: { granted: 'boolean', grantedAt: 'string:iso8601:optional', expiresAt: 'string:iso8601:optional' },
    functional: { granted: 'boolean', grantedAt: 'string:iso8601:optional', expiresAt: 'string:iso8601:optional' },
    third_party: { granted: 'boolean', grantedAt: 'string:iso8601:optional', expiresAt: 'string:iso8601:optional' },
    newsletter: { granted: 'boolean', grantedAt: 'string:iso8601:optional', expiresAt: 'string:iso8601:optional' },
    product_updates: { granted: 'boolean', grantedAt: 'string:iso8601:optional', expiresAt: 'string:iso8601:optional' },
  },

  // Compliance flags
  hasMinimumConsent: 'boolean',    // Essential consent in place
  canProcessData: 'boolean',       // Data processing consent
  canSendMarketing: 'boolean',     // Marketing consent

  // Metadata
  lastUpdated: 'string:iso8601',
  lastConsentChange: 'string:iso8601',
  policyVersionAccepted: 'string',
};

/**
 * CookiePreference - User cookie preferences
 *
 * DynamoDB Key: PK=USER#{userId}, SK=COOKIE_PREFS
 * Or anonymous: PK=COOKIE#{cookieId}, SK=PREFS
 *
 * Stores cookie consent separately as it may apply to anonymous users.
 */
const CookiePreferenceSchema = {
  // Identifier (userId or anonymous cookieId)
  id: 'string:uuid',
  idType: ['user', 'anonymous'],
  userId: 'string:uuid:optional',  // If logged in
  cookieId: 'string:uuid',         // Browser cookie ID

  // Cookie categories
  preferences: {
    essential: {
      enabled: true,               // Always true, cannot be disabled
      locked: true,
    },
    functional: {
      enabled: 'boolean',
      consentedAt: 'string:iso8601:optional',
    },
    analytics: {
      enabled: 'boolean',
      consentedAt: 'string:iso8601:optional',
    },
    marketing: {
      enabled: 'boolean',
      consentedAt: 'string:iso8601:optional',
    },
    preferences: {
      enabled: 'boolean',
      consentedAt: 'string:iso8601:optional',
    },
  },

  // Granular controls (optional)
  granularPreferences: {
    googleAnalytics: 'boolean:optional',
    hotjar: 'boolean:optional',
    intercom: 'boolean:optional',
    hubspot: 'boolean:optional',
    facebookPixel: 'boolean:optional',
    googleAds: 'boolean:optional',
  },

  // Banner interaction
  bannerShown: 'boolean',
  bannerDismissed: 'boolean',
  bannerDismissedAt: 'string:iso8601:optional',
  preferencesCustomized: 'boolean', // Did user customize vs accept all

  // Compliance
  tcfString: 'string:optional',    // IAB TCF consent string
  gpcEnabled: 'boolean',           // Global Privacy Control
  doNotTrack: 'boolean',           // DNT header respected

  // Metadata
  createdAt: 'string:iso8601',
  updatedAt: 'string:iso8601',
  ipAddress: 'string:masked',
  userAgent: 'string',
  country: 'string:optional',      // For jurisdiction-specific rules
  region: 'string:optional',

  // Indexes
  _gsi1pk: 'string',               // GSI1: cookieId for anonymous lookup
  _gsi1sk: 'string',
};

/**
 * CookiePreferenceHistory - Audit trail of cookie preference changes
 *
 * DynamoDB Key: PK=COOKIE#{cookieId}, SK=HISTORY#{timestamp}
 */
const CookiePreferenceHistorySchema = {
  historyId: 'string:uuid',
  cookieId: 'string:uuid',
  userId: 'string:uuid:optional',

  // Previous state
  previousPreferences: 'object',

  // New state
  newPreferences: 'object',

  // Change metadata
  changedAt: 'string:iso8601',
  changeSource: ['banner', 'preferences_page', 'api', 'auto_expire'],
  ipAddress: 'string:masked',
  userAgent: 'string',
};

// =============================================================================
// AUTHENTICATION & DEVICE ENTITIES
// =============================================================================

/**
 * BiometricCredential - WebAuthn credential storage
 *
 * Redis Key: biometric:credential:{userId}
 * DynamoDB Key: PK=USER#{userId}, SK=BIOMETRIC#{credentialId}
 */
const BiometricCredentialSchema = {
  credentialId: 'string:base64url',
  userId: 'string:uuid',

  // WebAuthn data
  publicKey: 'string:base64url',
  counter: 'number',               // Signature counter
  transports: 'array:string',      // ['internal', 'usb', 'ble', 'nfc']

  // Authenticator info
  aaguid: 'string',                // Authenticator GUID
  fmt: 'string',                   // Attestation format
  credentialDeviceType: 'string',
  credentialBackedUp: 'boolean',
  algorithm: 'string',             // e.g., 'ES256'

  // Device info
  deviceName: 'string',
  deviceFingerprint: 'string:sha256',

  // Usage tracking
  createdAt: 'string:iso8601',
  lastUsed: 'string:iso8601',
  useCount: 'number',

  // Status
  status: ['active', 'revoked', 'expired'],
  revokedAt: 'string:iso8601:optional',
  revokedReason: 'string:optional',

  // Metadata
  registeredFromIp: 'string:masked',
  rpId: 'string',                  // Relying Party ID
  version: 'string',               // Schema version
};

/**
 * Device - Authorized device registry
 *
 * DynamoDB Key: PK=USER#{userId}, SK=DEVICE#{deviceFingerprint}
 */
const DeviceSchema = {
  deviceId: 'string:uuid',
  userId: 'string:uuid',
  deviceFingerprint: 'string:sha256',

  // Device info
  name: 'string',                  // e.g., 'iPhone 15 Pro', 'MacBook Pro'
  type: ['mobile', 'tablet', 'desktop', 'unknown'],
  os: 'string',
  browser: 'string',

  // Authorization
  authorizedAt: 'string:iso8601',
  authorizedMethod: ['biometric', 'link_code', 'admin'],
  linkedFrom: 'string:uuid:optional', // Parent device if linked

  // Trust level
  trustLevel: ['primary', 'secondary', 'temporary'],
  expiresAt: 'string:iso8601:optional',

  // Usage
  lastSeen: 'string:iso8601',
  lastIp: 'string:masked',
  sessionCount: 'number',

  // Status
  status: ['active', 'suspended', 'revoked'],
  revokedAt: 'string:iso8601:optional',
  revokedReason: 'string:optional',
};

/**
 * Session - User session tracking
 *
 * Redis Key: session:{sessionId}
 * TTL: 24 hours (configurable)
 */
const SessionSchema = {
  sessionId: 'string:uuid',
  userId: 'string:uuid',
  deviceFingerprint: 'string:sha256',

  // Token data
  tokenHash: 'string:sha256',      // Hash of session token

  // Timestamps
  issuedAt: 'string:iso8601',
  expiresAt: 'string:iso8601',
  lastActivityAt: 'string:iso8601',

  // Session info
  ipAddress: 'string:masked',
  userAgent: 'string',

  // Status
  status: ['active', 'expired', 'revoked'],
  revokedAt: 'string:iso8601:optional',
  revokedReason: 'string:optional',
};

// =============================================================================
// AGENT & ORCHESTRATION ENTITIES
// =============================================================================

/**
 * Team - Agent team definition
 *
 * DynamoDB Key: PK=TEAM#{teamId}, SK=METADATA
 */
const TeamSchema = {
  teamId: 'string',                // e.g., 'developer', 'design', 'sales'

  // Display
  name: 'string',
  badge: 'string',                 // Short badge text
  color: 'string:hex',
  description: 'string',

  // Configuration
  orchestrationStatus: ['paused', 'active'],
  automationLevel: ['stopped', 'manual', 'supervised', 'autonomous'],
  allowedActions: 'array:string',

  // Defaults
  defaultModel: 'string',
  defaultProvider: ['anthropic', 'openai', 'gemini'],

  // Metadata
  createdAt: 'string:iso8601',
  updatedAt: 'string:iso8601',
};

/**
 * Agent - Individual AI agent
 *
 * DynamoDB Key: PK=TEAM#{teamId}, SK=AGENT#{agentId}
 */
const AgentSchema = {
  agentId: 'string:uuid',
  teamId: 'string',

  // Identity
  name: 'string',
  role: 'string',
  avatar: 'string:optional',

  // Configuration
  modelProvider: ['anthropic', 'openai', 'gemini'],
  model: 'string',
  systemPrompt: 'string:optional',

  // State
  status: Object.values(AgentStatuses),
  currentTask: 'string:uuid:optional',

  // Capabilities
  capabilities: 'array:string',
  permissions: 'array:string',

  // Metrics
  tasksCompleted: 'number',
  totalTokensUsed: 'number',
  totalCost: 'number',
  averageTaskTime: 'number',       // milliseconds

  // Metadata
  createdAt: 'string:iso8601',
  updatedAt: 'string:iso8601',
  lastActiveAt: 'string:iso8601:optional',
};

/**
 * Task - Work item for agents
 *
 * DynamoDB Key: PK=TEAM#{teamId}, SK=TASK#{taskId}
 * Or: PK=TASK#{taskId}, SK=METADATA
 */
const TaskSchema = {
  taskId: 'string:uuid',
  teamId: 'string',

  // Task details
  title: 'string',
  description: 'string',
  priority: Object.values(TaskPriorities),
  priorityOrder: 'number',         // For sorting

  // Assignment
  assignedAgents: 'array:string',  // Array of agentIds
  createdBy: 'string',             // userId or 'system'

  // Status
  status: Object.values(TaskStatuses),
  blockedReason: 'string:optional',

  // Progress
  progress: 'number',              // 0-100
  subtasks: [{
    id: 'string',
    title: 'string',
    completed: 'boolean',
  }],

  // Results
  result: 'object:optional',
  output: 'string:optional',
  artifacts: 'array:string:optional', // S3 keys for generated files

  // Timing
  createdAt: 'string:iso8601',
  updatedAt: 'string:iso8601',
  startedAt: 'string:iso8601:optional',
  completedAt: 'string:iso8601:optional',
  dueAt: 'string:iso8601:optional',

  // Cost tracking
  tokensUsed: 'number',
  estimatedCost: 'number',
  actualCost: 'number',

  // Indexes
  _gsi1pk: 'string',               // GSI1: status for filtering
  _gsi1sk: 'string',
  _gsi2pk: 'string',               // GSI2: createdAt for listing
  _gsi2sk: 'string',
};

/**
 * Decision - Pending decision requiring approval
 *
 * DynamoDB Key: PK=TEAM#{teamId}, SK=DECISION#{decisionId}
 */
const DecisionSchema = {
  decisionId: 'string:uuid',
  teamId: 'string',

  // Decision details
  title: 'string',
  description: 'string',
  priority: Object.values(TaskPriorities),
  impact: 'string',                // Description of impact

  // Context
  requestedBy: 'string',           // agentId
  relatedTask: 'string:uuid:optional',
  details: 'object',               // Structured decision details
  options: [{
    id: 'string',
    label: 'string',
    description: 'string',
    recommended: 'boolean',
  }],

  // Status
  status: Object.values(DecisionStatuses),

  // Resolution
  resolvedAt: 'string:iso8601:optional',
  resolvedBy: 'string:optional',   // userId who resolved
  selectedOption: 'string:optional',
  resolution: 'string:optional',   // Free-form resolution notes

  // Timing
  createdAt: 'string:iso8601',
  expiresAt: 'string:iso8601:optional',

  // Indexes
  _gsi1pk: 'string',               // GSI1: status for queue
  _gsi1sk: 'string',
};

/**
 * Activity - Agent activity log entry
 *
 * DynamoDB Key: PK=TEAM#{teamId}, SK=ACTIVITY#{timestamp}#{activityId}
 */
const ActivitySchema = {
  activityId: 'string:uuid',
  teamId: 'string',
  agentId: 'string:uuid',

  // Activity
  message: 'string',
  tag: 'string',                   // Category tag
  type: ['info', 'success', 'warning', 'error'],

  // Context
  relatedTask: 'string:uuid:optional',
  relatedDecision: 'string:uuid:optional',
  metadata: 'object:optional',

  // Timing
  timestamp: 'string:iso8601',

  // TTL for auto-cleanup
  ttl: 'number',                   // DynamoDB TTL
};

/**
 * Communication - Inter-agent communication
 *
 * DynamoDB Key: PK=COMM#{date}, SK={timestamp}#{commId}
 */
const CommunicationSchema = {
  commId: 'string:uuid',

  // Participants
  from: {
    agentId: 'string:uuid',
    teamId: 'string',
  },
  to: {
    agentId: 'string:uuid',
    teamId: 'string',
  },

  // Message
  message: 'string',
  type: ['request', 'response', 'notification', 'handoff'],

  // Context
  relatedTask: 'string:uuid:optional',
  thread: 'string:uuid:optional',  // For conversation threading

  // Timing
  timestamp: 'string:iso8601',

  // TTL
  ttl: 'number',
};

// =============================================================================
// WORLD CONTROLLER ENTITIES
// =============================================================================

/**
 * WorldState - Global orchestration state
 *
 * DynamoDB Key: PK=WORLD, SK=STATE
 * Redis Key: world:state (for fast reads)
 */
const WorldStateSchema = {
  // Global status
  worldStatus: Object.values(WorldStatuses),
  globalPaused: 'boolean',
  pausedAt: 'string:iso8601:optional',
  pausedBy: 'string:optional',
  pauseReason: 'string:optional',

  // Orchestration mode
  orchestrationMode: Object.values(OrchestrationModes),

  // Credit protection
  creditProtection: {
    enabled: 'boolean',
    dailyLimit: 'number',
    monthlyLimit: 'number',
    currentDailySpend: 'number',
    currentMonthlySpend: 'number',
    autoStopOnLimit: 'boolean',
    warningThreshold: 'number',    // 0.0-1.0
    hardStopThreshold: 'number',
  },

  // Emergency controls
  emergencyStop: {
    triggered: 'boolean',
    triggeredAt: 'string:iso8601:optional',
    reason: 'string:optional',
    requiresManualReset: 'boolean',
  },

  // Automation schedule
  automationSchedule: {
    enabled: 'boolean',
    timezone: 'string',
    windows: [{
      start: 'string',             // HH:MM
      end: 'string',
      teams: 'array:string',
      actions: 'array:string',
    }],
  },

  // Metadata
  updatedAt: 'string:iso8601',
  lastHealthCheck: 'string:iso8601',
};

/**
 * TeamControl - Per-team control state
 *
 * DynamoDB Key: PK=WORLD, SK=TEAM_CONTROL#{teamId}
 */
const TeamControlSchema = {
  teamId: 'string',

  // Control state
  paused: 'boolean',
  automationLevel: ['stopped', 'manual', 'supervised', 'autonomous'],
  allowedActions: 'array:string',

  // Pause info
  pausedAt: 'string:iso8601:optional',
  pauseReason: 'string:optional',

  // Last run
  lastRun: 'string:iso8601:optional',

  // Metadata
  updatedAt: 'string:iso8601',
};

/**
 * PendingAction - Queued action awaiting approval
 *
 * DynamoDB Key: PK=WORLD, SK=ACTION#{timestamp}#{actionId}
 */
const PendingActionSchema = {
  actionId: 'string:uuid',
  teamId: 'string',

  // Action details
  actionType: ['think', 'execute', 'communicate', 'report', 'sync', 'research', 'create', 'review'],
  parameters: 'object',
  description: 'string',

  // Cost estimate
  estimatedCost: 'number',
  estimatedTokens: 'number',

  // Status
  status: ['pending_approval', 'queued', 'approved', 'rejected', 'triggered', 'completed'],

  // Resolution
  approvedAt: 'string:iso8601:optional',
  approvedBy: 'string:optional',
  rejectedAt: 'string:iso8601:optional',
  rejectedBy: 'string:optional',
  rejectionReason: 'string:optional',

  // Timing
  queuedAt: 'string:iso8601',
  executedAt: 'string:iso8601:optional',

  // TTL
  ttl: 'number',
};

// =============================================================================
// COST & USAGE TRACKING
// =============================================================================

/**
 * CostRecord - Individual API usage record
 *
 * DynamoDB Key: PK=COST#{date}, SK={timestamp}#{recordId}
 */
const CostRecordSchema = {
  recordId: 'string:uuid',

  // Request info
  provider: ['anthropic', 'openai', 'gemini'],
  model: 'string',
  endpoint: 'string',

  // Token usage
  inputTokens: 'number',
  outputTokens: 'number',
  totalTokens: 'number',

  // Cost
  cost: 'number',
  breakdown: {
    inputCost: 'number',
    outputCost: 'number',
    inputPer1K: 'number',
    outputPer1K: 'number',
  },

  // Context
  teamId: 'string:optional',
  agentId: 'string:uuid:optional',
  taskId: 'string:uuid:optional',

  // Request metadata
  clientIp: 'string:masked',
  success: 'boolean',
  latencyMs: 'number',
  errorCode: 'string:optional',

  // Timing
  timestamp: 'string:iso8601',

  // TTL (keep 90 days in DynamoDB, archive to S3)
  ttl: 'number',

  // Indexes
  _gsi1pk: 'string',               // GSI1: provider for filtering
  _gsi1sk: 'string',
};

/**
 * DailyUsageSummary - Aggregated daily usage
 *
 * DynamoDB Key: PK=USAGE#DAILY, SK={date}
 */
const DailyUsageSummarySchema = {
  date: 'string',                  // YYYY-MM-DD

  // Totals
  requests: 'number',
  inputTokens: 'number',
  outputTokens: 'number',
  totalCost: 'number',

  // Breakdown by provider
  byProvider: {
    anthropic: { requests: 'number', tokens: 'number', cost: 'number' },
    openai: { requests: 'number', tokens: 'number', cost: 'number' },
    gemini: { requests: 'number', tokens: 'number', cost: 'number' },
  },

  // Breakdown by team
  byTeam: {
    [teamId]: { requests: 'number', tokens: 'number', cost: 'number' },
  },

  // Status counts
  successCount: 'number',
  errorCount: 'number',

  // Budget status at end of day
  budgetUsedPercent: 'number',
  budgetRemaining: 'number',

  // Metadata
  updatedAt: 'string:iso8601',
};

/**
 * MonthlyUsageSummary - Aggregated monthly usage
 *
 * DynamoDB Key: PK=USAGE#MONTHLY, SK={month}
 */
const MonthlyUsageSummarySchema = {
  month: 'string',                 // YYYY-MM

  // Same structure as DailyUsageSummary
  requests: 'number',
  inputTokens: 'number',
  outputTokens: 'number',
  totalCost: 'number',
  byProvider: 'object',
  byTeam: 'object',
  successCount: 'number',
  errorCount: 'number',
  budgetUsedPercent: 'number',

  // Monthly specific
  peakDay: 'string',               // Date with highest usage
  peakDayCost: 'number',
  averageDailyCost: 'number',

  // Metadata
  updatedAt: 'string:iso8601',
};

// =============================================================================
// AUDIT & SECURITY
// =============================================================================

/**
 * AuditLog - Security and compliance audit trail
 *
 * DynamoDB Key: PK=AUDIT#{date}, SK={timestamp}#{logId}
 *
 * Immutable audit log for compliance and security monitoring.
 */
const AuditLogSchema = {
  logId: 'string:uuid',

  // Event
  action: Object.values(AuditActions),
  success: 'boolean',

  // Actor
  userId: 'string:uuid:optional',
  deviceFingerprint: 'string:sha256:optional',
  ipAddress: 'string',             // Full IP for security
  userAgent: 'string',

  // Context
  endpoint: 'string',
  method: 'string',                // HTTP method

  // Details (varies by action)
  details: 'object',

  // Error info (if failed)
  errorCode: 'string:optional',
  errorMessage: 'string:optional',

  // Timing
  timestamp: 'string:iso8601',

  // Retention (7 years for compliance)
  ttl: 'number:optional',          // Only if shorter retention needed

  // Indexes
  _gsi1pk: 'string',               // GSI1: action for filtering
  _gsi1sk: 'string',
  _gsi2pk: 'string',               // GSI2: userId for user history
  _gsi2sk: 'string',
};

/**
 * RateLimitState - Rate limiting tracking
 *
 * Redis Key: rate_limit:{type}:{identifier}
 * TTL: Based on window (1 minute to 24 hours)
 */
const RateLimitStateSchema = {
  key: 'string',
  count: 'number',
  windowStart: 'number',           // Unix timestamp
  windowMs: 'number',
  limit: 'number',
  blocked: 'boolean',
  blockedUntil: 'number:optional',
};

/**
 * LockoutState - Security lockout tracking
 *
 * Redis Key: lockout:{type}:{identifier}
 * TTL: Lockout duration
 */
const LockoutStateSchema = {
  key: 'string',
  attempts: 'number',
  maxAttempts: 'number',
  firstAttempt: 'number',          // Unix timestamp
  lastAttempt: 'number',
  locked: 'boolean',
  lockedUntil: 'number:optional',
  lockDurationMs: 'number',
};

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Enums
  EntityTypes,
  ConsentTypes,
  CookieCategories,
  TaskPriorities,
  TaskStatuses,
  DecisionStatuses,
  AgentStatuses,
  OrchestrationModes,
  WorldStatuses,
  AuditActions,

  // User entities
  UserSchema,
  SignupSchema,

  // Consent & Privacy
  ConsentRecordSchema,
  ConsentSummarySchema,
  CookiePreferenceSchema,
  CookiePreferenceHistorySchema,

  // Authentication
  BiometricCredentialSchema,
  DeviceSchema,
  SessionSchema,

  // Agents & Orchestration
  TeamSchema,
  AgentSchema,
  TaskSchema,
  DecisionSchema,
  ActivitySchema,
  CommunicationSchema,

  // World Controller
  WorldStateSchema,
  TeamControlSchema,
  PendingActionSchema,

  // Cost Tracking
  CostRecordSchema,
  DailyUsageSummarySchema,
  MonthlyUsageSummarySchema,

  // Audit & Security
  AuditLogSchema,
  RateLimitStateSchema,
  LockoutStateSchema,
};
