/**
 * Audit Repository
 * ================
 *
 * Immutable audit logging for security and compliance.
 * Supports GDPR, SOC2, and other compliance requirements.
 */

const db = require('../client');

// =============================================================================
// AUDIT ACTIONS
// =============================================================================

const AuditActions = {
  // Authentication events
  BIOMETRIC_REGISTER_SUCCESS: 'BIOMETRIC_REGISTER_SUCCESS',
  BIOMETRIC_REGISTER_FAILED: 'BIOMETRIC_REGISTER_FAILED',
  BIOMETRIC_AUTH_SUCCESS: 'BIOMETRIC_AUTH_SUCCESS',
  BIOMETRIC_AUTH_FAILED: 'BIOMETRIC_AUTH_FAILED',
  SESSION_CREATED: 'SESSION_CREATED',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  SESSION_REVOKED: 'SESSION_REVOKED',
  DEVICE_LINKED: 'DEVICE_LINKED',
  DEVICE_REVOKED: 'DEVICE_REVOKED',

  // User events
  SIGNUP_SUCCESS: 'SIGNUP_SUCCESS',
  SIGNUP_FAILED: 'SIGNUP_FAILED',
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DELETED: 'USER_DELETED',

  // Consent events
  CONSENT_GRANTED: 'CONSENT_GRANTED',
  CONSENT_REVOKED: 'CONSENT_REVOKED',
  COOKIE_PREFERENCES_UPDATED: 'COOKIE_PREFERENCES_UPDATED',
  DATA_EXPORT_REQUESTED: 'DATA_EXPORT_REQUESTED',
  DATA_DELETION_REQUESTED: 'DATA_DELETION_REQUESTED',

  // Agent events
  TASK_CREATED: 'TASK_CREATED',
  TASK_UPDATED: 'TASK_UPDATED',
  TASK_COMPLETED: 'TASK_COMPLETED',
  TASK_CANCELLED: 'TASK_CANCELLED',
  DECISION_REQUESTED: 'DECISION_REQUESTED',
  DECISION_APPROVED: 'DECISION_APPROVED',
  DECISION_REJECTED: 'DECISION_REJECTED',
  AGENT_STATUS_CHANGED: 'AGENT_STATUS_CHANGED',

  // World controller events
  WORLD_PAUSED: 'WORLD_PAUSED',
  WORLD_RESUMED: 'WORLD_RESUMED',
  EMERGENCY_STOP: 'EMERGENCY_STOP',
  AUTOMATION_MODE_CHANGED: 'AUTOMATION_MODE_CHANGED',
  TEAM_CONTROL_UPDATED: 'TEAM_CONTROL_UPDATED',

  // Cost events
  BUDGET_WARNING: 'BUDGET_WARNING',
  BUDGET_EXCEEDED: 'BUDGET_EXCEEDED',
  COST_RECORDED: 'COST_RECORDED',

  // Admin events
  ADMIN_LOGIN: 'ADMIN_LOGIN',
  ADMIN_ACTION: 'ADMIN_ACTION',
  CONFIG_CHANGED: 'CONFIG_CHANGED',

  // Security events
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  LOCKOUT_TRIGGERED: 'LOCKOUT_TRIGGERED',
  SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
  PROMPT_INJECTION_BLOCKED: 'PROMPT_INJECTION_BLOCKED',
};

// Severity levels
const Severity = {
  DEBUG: 'debug',
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical',
};

// Default severities for actions
const ACTION_SEVERITY = {
  [AuditActions.BIOMETRIC_AUTH_FAILED]: Severity.WARNING,
  [AuditActions.SIGNUP_FAILED]: Severity.WARNING,
  [AuditActions.EMERGENCY_STOP]: Severity.CRITICAL,
  [AuditActions.BUDGET_EXCEEDED]: Severity.CRITICAL,
  [AuditActions.RATE_LIMIT_EXCEEDED]: Severity.WARNING,
  [AuditActions.LOCKOUT_TRIGGERED]: Severity.WARNING,
  [AuditActions.SUSPICIOUS_ACTIVITY]: Severity.ERROR,
  [AuditActions.PROMPT_INJECTION_BLOCKED]: Severity.ERROR,
};

// =============================================================================
// CORE OPERATIONS
// =============================================================================

/**
 * Log an audit event (immutable)
 */
async function log({
  action,
  success = true,
  userId,
  deviceFingerprint,
  ipAddress,
  userAgent,
  endpoint,
  method,
  details = {},
  errorCode,
  errorMessage,
}) {
  const now = db.timestamp();
  const logId = db.uuid();
  const date = db.dateKey();
  const severity = ACTION_SEVERITY[action] || (success ? Severity.INFO : Severity.WARNING);

  const item = {
    // Keys
    PK: db.pk('AUDIT', date),
    SK: db.sk(now, logId),

    // GSI1: Query by action
    gsi1pk: db.pk('AUDIT_ACTION', action),
    gsi1sk: db.sk(now, logId),

    // GSI2: Query by user
    gsi2pk: userId ? db.pk('AUDIT_USER', userId) : null,
    gsi2sk: userId ? db.sk(now, logId) : null,

    // Data
    logId,
    action,
    success,
    severity,
    userId: userId || null,
    deviceFingerprint: deviceFingerprint || null,
    ipAddress: ipAddress || null,
    userAgent: userAgent || null,
    endpoint: endpoint || null,
    method: method || null,
    details,
    errorCode: errorCode || null,
    errorMessage: errorMessage || null,

    timestamp: now,

    // TTL: 7 years for compliance (can be adjusted)
    ttl: db.TTL.SEVEN_YEARS(),

    _entityType: 'AUDIT_LOG',
  };

  await db.putItem(item);
  return item;
}

/**
 * Log a successful action
 */
async function logSuccess(action, context = {}) {
  return log({
    action,
    success: true,
    ...context,
  });
}

/**
 * Log a failed action
 */
async function logFailure(action, error, context = {}) {
  return log({
    action,
    success: false,
    errorCode: error?.code || error?.name || 'UNKNOWN',
    errorMessage: error?.message || String(error),
    ...context,
  });
}

// =============================================================================
// QUERY OPERATIONS
// =============================================================================

/**
 * Get audit logs for a specific date
 */
async function getLogsByDate(date, options = {}) {
  const { limit = 100, startTime, endTime } = options;

  const params = {
    KeyConditionExpression: startTime
      ? 'PK = :pk AND SK BETWEEN :start AND :end'
      : 'PK = :pk',
    ExpressionAttributeValues: {
      ':pk': db.pk('AUDIT', date),
      ...(startTime && { ':start': startTime }),
      ...(endTime && { ':end': endTime }),
    },
    ScanIndexForward: false,
    Limit: limit,
  };

  const result = await db.query(params);
  return result.items;
}

/**
 * Get audit logs by action type
 */
async function getLogsByAction(action, options = {}) {
  const { limit = 100, startTime, endTime } = options;

  const params = {
    KeyConditionExpression: startTime
      ? 'gsi1pk = :action AND gsi1sk BETWEEN :start AND :end'
      : 'gsi1pk = :action',
    ExpressionAttributeValues: {
      ':action': db.pk('AUDIT_ACTION', action),
      ...(startTime && { ':start': startTime }),
      ...(endTime && { ':end': endTime }),
    },
    ScanIndexForward: false,
    Limit: limit,
  };

  const result = await db.queryGSI1(params);
  return result.items;
}

/**
 * Get audit logs for a user
 */
async function getLogsByUser(userId, options = {}) {
  const { limit = 100, startTime, endTime } = options;

  const params = {
    KeyConditionExpression: startTime
      ? 'gsi2pk = :user AND gsi2sk BETWEEN :start AND :end'
      : 'gsi2pk = :user',
    ExpressionAttributeValues: {
      ':user': db.pk('AUDIT_USER', userId),
      ...(startTime && { ':start': startTime }),
      ...(endTime && { ':end': endTime }),
    },
    ScanIndexForward: false,
    Limit: limit,
  };

  const result = await db.queryGSI2(params);
  return result.items;
}

/**
 * Get recent security events
 */
async function getSecurityEvents(limit = 50) {
  const securityActions = [
    AuditActions.BIOMETRIC_AUTH_FAILED,
    AuditActions.RATE_LIMIT_EXCEEDED,
    AuditActions.LOCKOUT_TRIGGERED,
    AuditActions.SUSPICIOUS_ACTIVITY,
    AuditActions.PROMPT_INJECTION_BLOCKED,
    AuditActions.EMERGENCY_STOP,
  ];

  const results = await Promise.all(
    securityActions.map(action =>
      getLogsByAction(action, { limit: Math.ceil(limit / securityActions.length) })
    )
  );

  // Merge and sort by timestamp
  const allEvents = results.flat();
  allEvents.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return allEvents.slice(0, limit);
}

/**
 * Count events by action in a time range
 */
async function countEventsByAction(action, startDate, endDate) {
  let count = 0;
  let lastKey = null;

  do {
    const result = await db.queryGSI1({
      KeyConditionExpression: 'gsi1pk = :action AND gsi1sk BETWEEN :start AND :end',
      ExpressionAttributeValues: {
        ':action': db.pk('AUDIT_ACTION', action),
        ':start': startDate,
        ':end': endDate,
      },
      Select: 'COUNT',
      ExclusiveStartKey: lastKey,
    });

    count += result.count;
    lastKey = result.lastKey;
  } while (lastKey);

  return count;
}

// =============================================================================
// COMPLIANCE REPORTS
// =============================================================================

/**
 * Generate audit summary for a date range
 */
async function generateAuditSummary(startDate, endDate) {
  const summary = {
    period: { startDate, endDate },
    generatedAt: db.timestamp(),
    totalEvents: 0,
    byAction: {},
    bySeverity: {
      debug: 0,
      info: 0,
      warning: 0,
      error: 0,
      critical: 0,
    },
    successRate: 0,
    uniqueUsers: new Set(),
    securityIncidents: 0,
  };

  // Get all dates in range
  const dates = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(d.toISOString().split('T')[0]);
  }

  let successCount = 0;

  // Query each date
  for (const date of dates) {
    const logs = await db.queryAll({
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: {
        ':pk': db.pk('AUDIT', date),
      },
    });

    for (const log of logs) {
      summary.totalEvents++;

      // By action
      summary.byAction[log.action] = (summary.byAction[log.action] || 0) + 1;

      // By severity
      const severity = log.severity || 'info';
      summary.bySeverity[severity]++;

      // Success rate
      if (log.success) successCount++;

      // Unique users
      if (log.userId) {
        summary.uniqueUsers.add(log.userId);
      }

      // Security incidents
      if (
        log.action === AuditActions.SUSPICIOUS_ACTIVITY ||
        log.action === AuditActions.PROMPT_INJECTION_BLOCKED ||
        log.action === AuditActions.LOCKOUT_TRIGGERED
      ) {
        summary.securityIncidents++;
      }
    }
  }

  // Calculate success rate
  summary.successRate =
    summary.totalEvents > 0
      ? Math.round((successCount / summary.totalEvents) * 100)
      : 100;

  // Convert Set to count
  summary.uniqueUsers = summary.uniqueUsers.size;

  return summary;
}

/**
 * Export audit logs for compliance (GDPR, SOC2)
 */
async function exportAuditLogs(options = {}) {
  const {
    startDate,
    endDate,
    userId,
    actions,
    format = 'json',
  } = options;

  let logs = [];

  if (userId) {
    logs = await getLogsByUser(userId, { startTime: startDate, endTime: endDate, limit: 10000 });
  } else {
    // Get all dates in range
    const dates = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(d.toISOString().split('T')[0]);
    }

    for (const date of dates) {
      const dateLogs = await getLogsByDate(date, { limit: 10000 });
      logs.push(...dateLogs);
    }
  }

  // Filter by actions if specified
  if (actions && actions.length > 0) {
    logs = logs.filter(log => actions.includes(log.action));
  }

  // Format output
  if (format === 'csv') {
    return formatAsCSV(logs);
  }

  return {
    exportDate: db.timestamp(),
    recordCount: logs.length,
    filters: { startDate, endDate, userId, actions },
    logs: logs.map(sanitizeLogForExport),
  };
}

// =============================================================================
// HELPERS
// =============================================================================

function sanitizeLogForExport(log) {
  // Remove internal DynamoDB fields
  const { PK, SK, gsi1pk, gsi1sk, gsi2pk, gsi2sk, ttl, _entityType, ...exportable } = log;
  return exportable;
}

function formatAsCSV(logs) {
  if (logs.length === 0) return '';

  const headers = [
    'timestamp',
    'action',
    'success',
    'severity',
    'userId',
    'ipAddress',
    'endpoint',
    'method',
    'errorCode',
    'errorMessage',
  ];

  const rows = logs.map(log =>
    headers.map(h => {
      const value = log[h];
      if (value === null || value === undefined) return '';
      if (typeof value === 'string' && value.includes(',')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return String(value);
    }).join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

// =============================================================================
// CONVENIENCE METHODS
// =============================================================================

/**
 * Log authentication event
 */
async function logAuth(action, success, context) {
  return log({
    action,
    success,
    ...context,
  });
}

/**
 * Log consent event
 */
async function logConsent(action, userId, consentType, context = {}) {
  return log({
    action,
    success: true,
    userId,
    details: { consentType, ...context.details },
    ...context,
  });
}

/**
 * Log agent event
 */
async function logAgentEvent(action, details, context = {}) {
  return log({
    action,
    success: true,
    details,
    ...context,
  });
}

/**
 * Log security event
 */
async function logSecurityEvent(action, details, context = {}) {
  return log({
    action,
    success: false,
    details,
    ...context,
  });
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  // Constants
  AuditActions,
  Severity,

  // Core operations
  log,
  logSuccess,
  logFailure,

  // Queries
  getLogsByDate,
  getLogsByAction,
  getLogsByUser,
  getSecurityEvents,
  countEventsByAction,

  // Reports
  generateAuditSummary,
  exportAuditLogs,

  // Convenience
  logAuth,
  logConsent,
  logAgentEvent,
  logSecurityEvent,
};
