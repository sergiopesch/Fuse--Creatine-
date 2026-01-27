/**
 * Consent Repository
 * ==================
 *
 * GDPR/CCPA compliant consent management with full audit trail.
 * Handles consent records, summaries, and compliance reporting.
 */

const db = require('../client');

// =============================================================================
// CONSENT TYPES
// =============================================================================

const ConsentTypes = {
    MARKETING: 'marketing',
    ANALYTICS: 'analytics',
    FUNCTIONAL: 'functional',
    ESSENTIAL: 'essential',
    THIRD_PARTY: 'third_party',
    NEWSLETTER: 'newsletter',
    PRODUCT_UPDATES: 'product_updates',
    DATA_PROCESSING: 'data_processing',
};

const LegalBasis = {
    CONSENT: 'consent',
    CONTRACT: 'contract',
    LEGAL_OBLIGATION: 'legal_obligation',
    VITAL_INTERESTS: 'vital_interests',
    PUBLIC_TASK: 'public_task',
    LEGITIMATE_INTERESTS: 'legitimate_interests',
};

const CollectionMethods = {
    SIGNUP_FORM: 'signup_form',
    COOKIE_BANNER: 'cookie_banner',
    PREFERENCES_PAGE: 'preferences_page',
    CHECKOUT: 'checkout',
    API: 'api',
    IMPORT: 'import',
};

// =============================================================================
// CONSENT RECORDS
// =============================================================================

/**
 * Record a new consent (grant or revoke)
 *
 * Creates an immutable consent record for audit trail.
 * Also updates the consent summary for fast reads.
 */
async function recordConsent({
    userId,
    consentType,
    granted,
    legalBasis = LegalBasis.CONSENT,
    purpose,
    dataCategories = [],
    processingActivities = [],
    thirdParties = [],
    retentionPeriod = '2 years',
    policyVersion,
    termsVersion,
    collectionMethod,
    ipAddress,
    userAgent,
    expiresAt,
}) {
    const consentId = db.uuid();
    const now = db.timestamp();

    // Create consent record (immutable)
    const consentRecord = {
        // Keys
        PK: db.pk('USER', userId),
        SK: db.sk('CONSENT', consentType, now),

        // GSI1: Query by consent type
        gsi1pk: db.pk('CONSENT_TYPE', consentType),
        gsi1sk: db.sk(now, consentId),

        // GSI2: Query all consents by date
        gsi2pk: 'CONSENTS',
        gsi2sk: db.sk(now, consentId),

        // Data
        consentId,
        userId,
        consentType,
        granted,
        legalBasis,
        purpose,
        dataCategories,
        processingActivities,
        thirdParties,
        retentionPeriod,
        policyVersion,
        termsVersion,
        collectionMethod,
        collectedAt: now,
        ipAddress: maskIp(ipAddress),
        userAgent,
        expiresAt,
        createdAt: now,

        // Entity type for filtering
        _entityType: 'CONSENT_RECORD',
    };

    // Update consent summary
    await updateConsentSummary(userId, consentType, {
        granted,
        grantedAt: granted ? now : null,
        expiresAt,
        policyVersion,
    });

    // Transactional write: both consent record and summary update
    await db.transactWrite([
        { put: consentRecord },
        {
            update: {
                key: { PK: db.pk('USER', userId), SK: 'CONSENT_SUMMARY' },
                expression: `SET #consents.#type = :consent, lastUpdated = :now, lastConsentChange = :now`,
                names: { '#consents': 'consents', '#type': consentType },
                values: {
                    ':consent': {
                        granted,
                        grantedAt: granted ? now : null,
                        expiresAt: expiresAt || null,
                    },
                    ':now': now,
                },
            },
        },
    ]);

    return consentRecord;
}

/**
 * Grant consent for a specific type
 */
async function grantConsent(userId, consentType, options = {}) {
    return recordConsent({
        userId,
        consentType,
        granted: true,
        ...options,
    });
}

/**
 * Revoke consent for a specific type
 */
async function revokeConsent(userId, consentType, options = {}) {
    return recordConsent({
        userId,
        consentType,
        granted: false,
        revocationMethod: options.collectionMethod || 'preferences_page',
        ...options,
    });
}

/**
 * Get all consent records for a user
 */
async function getConsentHistory(userId, consentType = null) {
    const keyCondition = {
        KeyConditionExpression: consentType
            ? 'PK = :pk AND begins_with(SK, :skPrefix)'
            : 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
            ':pk': db.pk('USER', userId),
            ':skPrefix': consentType ? `CONSENT#${consentType}#` : 'CONSENT#',
        },
    };

    const result = await db.query(keyCondition);
    return result.items;
}

/**
 * Get latest consent record for a specific type
 */
async function getLatestConsent(userId, consentType) {
    const result = await db.query({
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
            ':pk': db.pk('USER', userId),
            ':skPrefix': `CONSENT#${consentType}#`,
        },
        ScanIndexForward: false, // Most recent first
        Limit: 1,
    });

    return result.items[0] || null;
}

// =============================================================================
// CONSENT SUMMARY
// =============================================================================

/**
 * Get current consent summary for a user
 */
async function getConsentSummary(userId) {
    const item = await db.getItem({
        PK: db.pk('USER', userId),
        SK: 'CONSENT_SUMMARY',
    });

    if (!item) {
        // Return default summary if none exists
        return createDefaultSummary(userId);
    }

    return item;
}

/**
 * Initialize consent summary for a new user
 */
async function initializeConsentSummary(userId, initialConsents = {}) {
    const now = db.timestamp();

    const summary = {
        PK: db.pk('USER', userId),
        SK: 'CONSENT_SUMMARY',
        userId,
        consents: {
            [ConsentTypes.ESSENTIAL]: { granted: true, grantedAt: now }, // Always granted
            [ConsentTypes.MARKETING]: { granted: initialConsents.marketing || false },
            [ConsentTypes.ANALYTICS]: { granted: initialConsents.analytics || false },
            [ConsentTypes.FUNCTIONAL]: { granted: initialConsents.functional || false },
            [ConsentTypes.THIRD_PARTY]: { granted: initialConsents.thirdParty || false },
            [ConsentTypes.NEWSLETTER]: { granted: initialConsents.newsletter || false },
            [ConsentTypes.PRODUCT_UPDATES]: { granted: initialConsents.productUpdates || false },
        },
        hasMinimumConsent: true,
        canProcessData: initialConsents.dataProcessing !== false,
        canSendMarketing: initialConsents.marketing || false,
        lastUpdated: now,
        lastConsentChange: now,
        policyVersionAccepted: initialConsents.policyVersion || '1.0',
        _entityType: 'CONSENT_SUMMARY',
    };

    await db.putItem(summary);
    return summary;
}

/**
 * Update consent summary (internal)
 */
async function updateConsentSummary(userId, consentType, data) {
    const now = db.timestamp();

    // Recalculate derived flags
    const summary = await getConsentSummary(userId);
    const updatedConsents = {
        ...summary.consents,
        [consentType]: data,
    };

    const canSendMarketing =
        updatedConsents[ConsentTypes.MARKETING]?.granted ||
        updatedConsents[ConsentTypes.NEWSLETTER]?.granted;

    return {
        consents: updatedConsents,
        canSendMarketing,
        lastUpdated: now,
        lastConsentChange: now,
        policyVersionAccepted: data.policyVersion || summary.policyVersionAccepted,
    };
}

function createDefaultSummary(userId) {
    return {
        userId,
        consents: {
            [ConsentTypes.ESSENTIAL]: { granted: true },
            [ConsentTypes.MARKETING]: { granted: false },
            [ConsentTypes.ANALYTICS]: { granted: false },
            [ConsentTypes.FUNCTIONAL]: { granted: false },
            [ConsentTypes.THIRD_PARTY]: { granted: false },
            [ConsentTypes.NEWSLETTER]: { granted: false },
            [ConsentTypes.PRODUCT_UPDATES]: { granted: false },
        },
        hasMinimumConsent: true,
        canProcessData: false,
        canSendMarketing: false,
    };
}

// =============================================================================
// COMPLIANCE HELPERS
// =============================================================================

/**
 * Check if user has valid consent for a specific purpose
 */
async function hasValidConsent(userId, consentType) {
    const summary = await getConsentSummary(userId);
    const consent = summary.consents?.[consentType];

    if (!consent?.granted) {
        return false;
    }

    // Check expiration
    if (consent.expiresAt && new Date(consent.expiresAt) < new Date()) {
        return false;
    }

    return true;
}

/**
 * Check multiple consents at once
 */
async function checkConsents(userId, consentTypes) {
    const summary = await getConsentSummary(userId);
    const results = {};

    for (const type of consentTypes) {
        const consent = summary.consents?.[type];
        results[type] =
            consent?.granted && (!consent.expiresAt || new Date(consent.expiresAt) >= new Date());
    }

    return results;
}

/**
 * Get all users with a specific consent (for compliance reporting)
 */
async function getUsersWithConsent(consentType, options = {}) {
    const { startDate, endDate, limit = 100 } = options;

    const keyCondition = {
        KeyConditionExpression: startDate
            ? 'gsi1pk = :type AND gsi1sk BETWEEN :start AND :end'
            : 'gsi1pk = :type',
        ExpressionAttributeValues: {
            ':type': db.pk('CONSENT_TYPE', consentType),
            ...(startDate && { ':start': startDate }),
            ...(endDate && { ':end': endDate }),
        },
        Limit: limit,
    };

    const result = await db.queryGSI1(keyCondition);
    return result.items;
}

/**
 * Generate consent report for compliance
 */
async function generateConsentReport(options = {}) {
    const { startDate, endDate } = options;

    const keyCondition = {
        KeyConditionExpression: startDate
            ? 'gsi2pk = :consents AND gsi2sk BETWEEN :start AND :end'
            : 'gsi2pk = :consents',
        ExpressionAttributeValues: {
            ':consents': 'CONSENTS',
            ...(startDate && { ':start': startDate }),
            ...(endDate && { ':end': endDate }),
        },
    };

    const result = await db.queryGSI2(keyCondition);

    // Aggregate by type and status
    const report = {
        totalRecords: result.items.length,
        byType: {},
        byLegalBasis: {},
        grantsVsRevokes: { grants: 0, revokes: 0 },
    };

    for (const record of result.items) {
        // By type
        if (!report.byType[record.consentType]) {
            report.byType[record.consentType] = { grants: 0, revokes: 0 };
        }
        if (record.granted) {
            report.byType[record.consentType].grants++;
            report.grantsVsRevokes.grants++;
        } else {
            report.byType[record.consentType].revokes++;
            report.grantsVsRevokes.revokes++;
        }

        // By legal basis
        if (record.legalBasis) {
            report.byLegalBasis[record.legalBasis] =
                (report.byLegalBasis[record.legalBasis] || 0) + 1;
        }
    }

    return report;
}

// =============================================================================
// GDPR DATA EXPORT
// =============================================================================

/**
 * Export all consent data for a user (GDPR data portability)
 */
async function exportUserConsents(userId) {
    const [summary, history] = await Promise.all([
        getConsentSummary(userId),
        getConsentHistory(userId),
    ]);

    return {
        exportDate: db.timestamp(),
        userId,
        currentConsents: summary.consents,
        consentHistory: history.map(record => ({
            consentType: record.consentType,
            granted: record.granted,
            purpose: record.purpose,
            legalBasis: record.legalBasis,
            collectedAt: record.collectedAt,
            collectionMethod: record.collectionMethod,
            expiresAt: record.expiresAt,
        })),
    };
}

/**
 * Delete all consent data for a user (GDPR right to erasure)
 */
async function deleteUserConsents(userId) {
    // Get all consent records
    const history = await getConsentHistory(userId);

    // Delete all records
    const deleteKeys = history.map(record => ({
        PK: record.PK,
        SK: record.SK,
    }));

    // Add summary to delete list
    deleteKeys.push({
        PK: db.pk('USER', userId),
        SK: 'CONSENT_SUMMARY',
    });

    if (deleteKeys.length > 0) {
        await db.batchWrite([], deleteKeys);
    }

    return { deleted: deleteKeys.length };
}

// =============================================================================
// HELPERS
// =============================================================================

function maskIp(ip) {
    if (!ip) return null;
    const parts = ip.split('.');
    if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.xxx.xxx`;
    }
    return ip.substring(0, ip.length / 2) + '***';
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
    // Constants
    ConsentTypes,
    LegalBasis,
    CollectionMethods,

    // Core operations
    recordConsent,
    grantConsent,
    revokeConsent,

    // History
    getConsentHistory,
    getLatestConsent,

    // Summary
    getConsentSummary,
    initializeConsentSummary,

    // Compliance
    hasValidConsent,
    checkConsents,
    getUsersWithConsent,
    generateConsentReport,

    // GDPR
    exportUserConsents,
    deleteUserConsents,
};
