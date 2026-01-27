/**
 * FUSE Database Layer
 * ===================
 *
 * Unified export of all database functionality.
 *
 * Usage:
 *   const db = require('./_lib/db');
 *
 *   // Direct client access
 *   await db.getItem({ PK: 'USER#123', SK: 'PROFILE' });
 *
 *   // Repository access
 *   await db.consent.grantConsent(userId, 'marketing', { ... });
 *   await db.cookies.saveUserPreferences({ ... });
 *   await db.agents.createTask({ ... });
 *   await db.audit.log({ ... });
 *   await db.costs.recordUsage({ ... });
 */

const client = require('./client');
const consent = require('./repositories/consent');
const cookies = require('./repositories/cookies');
const agents = require('./repositories/agents');
const audit = require('./repositories/audit');
const costs = require('./repositories/costs');

module.exports = {
    // Re-export client functions directly for convenience
    ...client,

    // Repositories
    consent,
    cookies,
    agents,
    audit,
    costs,

    // Repository aliases
    ConsentRepository: consent,
    CookieRepository: cookies,
    AgentRepository: agents,
    AuditRepository: audit,
    CostRepository: costs,
};
