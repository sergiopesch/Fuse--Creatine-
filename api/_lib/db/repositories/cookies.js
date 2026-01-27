/**
 * Cookie Preferences Repository
 * ==============================
 *
 * Manages cookie consent for both authenticated and anonymous users.
 * Supports IAB TCF, GPC, and jurisdiction-specific requirements.
 */

const db = require('../client');

// =============================================================================
// COOKIE CATEGORIES
// =============================================================================

const CookieCategories = {
  ESSENTIAL: 'essential',       // Required for site function
  FUNCTIONAL: 'functional',     // Enhanced functionality
  ANALYTICS: 'analytics',       // Usage tracking
  MARKETING: 'marketing',       // Advertising & remarketing
  PREFERENCES: 'preferences',   // User preferences
};

// Default cookie preferences
const DEFAULT_PREFERENCES = {
  essential: { enabled: true, locked: true },
  functional: { enabled: false },
  analytics: { enabled: false },
  marketing: { enabled: false },
  preferences: { enabled: false },
};

// Granular cookie controls
const GranularCookies = {
  GOOGLE_ANALYTICS: 'googleAnalytics',
  HOTJAR: 'hotjar',
  INTERCOM: 'intercom',
  HUBSPOT: 'hubspot',
  FACEBOOK_PIXEL: 'facebookPixel',
  GOOGLE_ADS: 'googleAds',
  LINKEDIN_INSIGHT: 'linkedinInsight',
};

// =============================================================================
// CORE OPERATIONS
// =============================================================================

/**
 * Get cookie preferences for a user (logged in)
 */
async function getPreferencesForUser(userId) {
  const item = await db.getItem({
    PK: db.pk('USER', userId),
    SK: 'COOKIE_PREFS',
  });

  if (!item) {
    return null;
  }

  return item;
}

/**
 * Get cookie preferences by cookie ID (anonymous)
 */
async function getPreferencesByCookieId(cookieId) {
  // Try anonymous first
  let item = await db.getItem({
    PK: db.pk('COOKIE', cookieId),
    SK: 'PREFS',
  });

  if (item) {
    return item;
  }

  // Try GSI1 lookup (might be linked to a user)
  const result = await db.queryGSI1({
    KeyConditionExpression: 'gsi1pk = :pk AND gsi1sk = :sk',
    ExpressionAttributeValues: {
      ':pk': db.pk('COOKIE', cookieId),
      ':sk': 'PREFS',
    },
    Limit: 1,
  });

  return result.items[0] || null;
}

/**
 * Save cookie preferences (anonymous user)
 */
async function saveAnonymousPreferences({
  cookieId,
  preferences,
  granularPreferences = {},
  bannerDismissed = true,
  preferencesCustomized = false,
  tcfString,
  gpcEnabled = false,
  doNotTrack = false,
  ipAddress,
  userAgent,
  country,
  region,
}) {
  const now = db.timestamp();

  const item = {
    // Keys
    PK: db.pk('COOKIE', cookieId),
    SK: 'PREFS',

    // Identity
    id: cookieId,
    idType: 'anonymous',
    cookieId,

    // Preferences
    preferences: mergeWithDefaults(preferences),
    granularPreferences,

    // Banner state
    bannerShown: true,
    bannerDismissed,
    bannerDismissedAt: bannerDismissed ? now : null,
    preferencesCustomized,

    // Compliance
    tcfString: tcfString || null,
    gpcEnabled,
    doNotTrack,

    // Metadata
    createdAt: now,
    updatedAt: now,
    ipAddress: maskIp(ipAddress),
    userAgent,
    country,
    region,

    // TTL: 13 months (EU cookie law)
    ttl: db.TTL.ONE_YEAR() + db.ttl(30),

    // Entity type
    _entityType: 'COOKIE_PREFERENCE',
  };

  await db.putItem(item);
  return item;
}

/**
 * Save cookie preferences (logged in user)
 */
async function saveUserPreferences({
  userId,
  cookieId,
  preferences,
  granularPreferences = {},
  bannerDismissed = true,
  preferencesCustomized = false,
  tcfString,
  gpcEnabled = false,
  doNotTrack = false,
  ipAddress,
  userAgent,
  country,
  region,
}) {
  const now = db.timestamp();

  const item = {
    // Keys
    PK: db.pk('USER', userId),
    SK: 'COOKIE_PREFS',

    // GSI1: Lookup by cookie ID
    gsi1pk: db.pk('COOKIE', cookieId),
    gsi1sk: 'PREFS',

    // Identity
    id: userId,
    idType: 'user',
    userId,
    cookieId,

    // Preferences
    preferences: mergeWithDefaults(preferences),
    granularPreferences,

    // Banner state
    bannerShown: true,
    bannerDismissed,
    bannerDismissedAt: bannerDismissed ? now : null,
    preferencesCustomized,

    // Compliance
    tcfString: tcfString || null,
    gpcEnabled,
    doNotTrack,

    // Metadata
    createdAt: now,
    updatedAt: now,
    ipAddress: maskIp(ipAddress),
    userAgent,
    country,
    region,

    // Entity type
    _entityType: 'COOKIE_PREFERENCE',
  };

  await db.putItem(item);

  // Record history
  await recordPreferenceChange(cookieId, userId, null, item.preferences, 'preferences_page', ipAddress, userAgent);

  return item;
}

/**
 * Update cookie preferences
 */
async function updatePreferences(idType, id, updates, metadata = {}) {
  const now = db.timestamp();

  // Get current preferences for history
  const current = idType === 'user'
    ? await getPreferencesForUser(id)
    : await getPreferencesByCookieId(id);

  const key = idType === 'user'
    ? { PK: db.pk('USER', id), SK: 'COOKIE_PREFS' }
    : { PK: db.pk('COOKIE', id), SK: 'PREFS' };

  // Merge preferences
  const newPreferences = mergeWithDefaults({
    ...current?.preferences,
    ...updates.preferences,
  });

  const updateData = {
    preferences: newPreferences,
    updatedAt: now,
    preferencesCustomized: true,
  };

  if (updates.granularPreferences) {
    updateData.granularPreferences = {
      ...current?.granularPreferences,
      ...updates.granularPreferences,
    };
  }

  if (updates.tcfString !== undefined) {
    updateData.tcfString = updates.tcfString;
  }

  const result = await db.updateItem(key, updateData);

  // Record history
  if (current) {
    await recordPreferenceChange(
      current.cookieId,
      current.userId,
      current.preferences,
      newPreferences,
      metadata.source || 'preferences_page',
      metadata.ipAddress,
      metadata.userAgent
    );
  }

  return result;
}

/**
 * Link anonymous preferences to user account
 */
async function linkPreferencesToUser(cookieId, userId) {
  const anonymous = await getPreferencesByCookieId(cookieId);

  if (!anonymous) {
    return null;
  }

  // Create user preferences from anonymous
  const userPrefs = await saveUserPreferences({
    userId,
    cookieId,
    preferences: anonymous.preferences,
    granularPreferences: anonymous.granularPreferences,
    bannerDismissed: anonymous.bannerDismissed,
    preferencesCustomized: anonymous.preferencesCustomized,
    tcfString: anonymous.tcfString,
    gpcEnabled: anonymous.gpcEnabled,
    doNotTrack: anonymous.doNotTrack,
    ipAddress: anonymous.ipAddress,
    userAgent: anonymous.userAgent,
    country: anonymous.country,
    region: anonymous.region,
  });

  // Delete anonymous record
  await db.deleteItem({
    PK: db.pk('COOKIE', cookieId),
    SK: 'PREFS',
  });

  return userPrefs;
}

// =============================================================================
// PREFERENCE HISTORY
// =============================================================================

/**
 * Record preference change for audit trail
 */
async function recordPreferenceChange(
  cookieId,
  userId,
  previousPreferences,
  newPreferences,
  changeSource,
  ipAddress,
  userAgent
) {
  const historyId = db.uuid();
  const now = db.timestamp();

  const item = {
    PK: db.pk('COOKIE', cookieId),
    SK: db.sk('HISTORY', now, historyId),

    historyId,
    cookieId,
    userId,
    previousPreferences,
    newPreferences,
    changedAt: now,
    changeSource,
    ipAddress: maskIp(ipAddress),
    userAgent,

    // TTL: Keep history for 2 years
    ttl: db.ttl(365 * 2),

    _entityType: 'COOKIE_PREFERENCE_HISTORY',
  };

  await db.putItem(item);
  return item;
}

/**
 * Get preference change history
 */
async function getPreferenceHistory(cookieId, limit = 50) {
  const result = await db.query({
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: {
      ':pk': db.pk('COOKIE', cookieId),
      ':prefix': 'HISTORY#',
    },
    ScanIndexForward: false,
    Limit: limit,
  });

  return result.items;
}

// =============================================================================
// CONSENT CHECKS
// =============================================================================

/**
 * Check if a specific cookie category is enabled
 */
async function isCategoryEnabled(cookieIdOrUserId, category, isUser = false) {
  const prefs = isUser
    ? await getPreferencesForUser(cookieIdOrUserId)
    : await getPreferencesByCookieId(cookieIdOrUserId);

  if (!prefs) {
    // No preferences = only essential allowed
    return category === CookieCategories.ESSENTIAL;
  }

  return prefs.preferences?.[category]?.enabled === true;
}

/**
 * Check if a specific granular cookie is enabled
 */
async function isGranularCookieEnabled(cookieIdOrUserId, cookieName, isUser = false) {
  const prefs = isUser
    ? await getPreferencesForUser(cookieIdOrUserId)
    : await getPreferencesByCookieId(cookieIdOrUserId);

  if (!prefs) {
    return false;
  }

  // Check granular first
  if (prefs.granularPreferences?.[cookieName] !== undefined) {
    return prefs.granularPreferences[cookieName];
  }

  // Fall back to category
  const categoryMap = {
    [GranularCookies.GOOGLE_ANALYTICS]: CookieCategories.ANALYTICS,
    [GranularCookies.HOTJAR]: CookieCategories.ANALYTICS,
    [GranularCookies.INTERCOM]: CookieCategories.FUNCTIONAL,
    [GranularCookies.HUBSPOT]: CookieCategories.MARKETING,
    [GranularCookies.FACEBOOK_PIXEL]: CookieCategories.MARKETING,
    [GranularCookies.GOOGLE_ADS]: CookieCategories.MARKETING,
    [GranularCookies.LINKEDIN_INSIGHT]: CookieCategories.MARKETING,
  };

  const category = categoryMap[cookieName];
  return category ? prefs.preferences?.[category]?.enabled === true : false;
}

/**
 * Get all enabled cookies for client-side initialization
 */
async function getEnabledCookies(cookieIdOrUserId, isUser = false) {
  const prefs = isUser
    ? await getPreferencesForUser(cookieIdOrUserId)
    : await getPreferencesByCookieId(cookieIdOrUserId);

  const enabled = {
    categories: {},
    granular: {},
    gpcEnabled: prefs?.gpcEnabled || false,
    doNotTrack: prefs?.doNotTrack || false,
  };

  // Categories
  for (const category of Object.values(CookieCategories)) {
    enabled.categories[category] =
      category === CookieCategories.ESSENTIAL ||
      prefs?.preferences?.[category]?.enabled === true;
  }

  // Granular (only if category is enabled)
  for (const cookie of Object.values(GranularCookies)) {
    enabled.granular[cookie] = await isGranularCookieEnabled(
      cookieIdOrUserId,
      cookie,
      isUser
    );
  }

  return enabled;
}

// =============================================================================
// JURISDICTION HELPERS
// =============================================================================

/**
 * Determine if consent banner should be shown based on jurisdiction
 */
function shouldShowBanner(country, region, existingPrefs) {
  // Always show if no existing preferences
  if (!existingPrefs) {
    return true;
  }

  // Already dismissed
  if (existingPrefs.bannerDismissed) {
    return false;
  }

  // Jurisdiction-specific rules
  const gdprCountries = [
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
    'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
    'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'GB', 'IS', 'LI',
    'NO', 'CH',
  ];

  // CCPA regions
  const ccpaRegions = ['CA']; // California

  if (gdprCountries.includes(country)) {
    return true; // GDPR requires explicit consent
  }

  if (country === 'US' && ccpaRegions.includes(region)) {
    return true; // CCPA opt-out notice
  }

  // Other jurisdictions - show for transparency
  return true;
}

/**
 * Get default preferences based on jurisdiction
 */
function getJurisdictionDefaults(country, region, gpcEnabled, doNotTrack) {
  const defaults = { ...DEFAULT_PREFERENCES };

  // Respect GPC signal
  if (gpcEnabled) {
    defaults.marketing = { enabled: false };
    defaults.analytics = { enabled: false };
  }

  // Respect DNT signal
  if (doNotTrack) {
    defaults.analytics = { enabled: false };
  }

  return defaults;
}

// =============================================================================
// HELPERS
// =============================================================================

function mergeWithDefaults(preferences) {
  const merged = { ...DEFAULT_PREFERENCES };

  for (const [key, value] of Object.entries(preferences || {})) {
    if (key === 'essential') {
      // Essential is always enabled and locked
      merged.essential = { enabled: true, locked: true };
    } else if (merged[key] !== undefined) {
      merged[key] = {
        ...merged[key],
        ...value,
        consentedAt: value.enabled ? (value.consentedAt || db.timestamp()) : null,
      };
    }
  }

  return merged;
}

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
  CookieCategories,
  GranularCookies,
  DEFAULT_PREFERENCES,

  // Core operations
  getPreferencesForUser,
  getPreferencesByCookieId,
  saveAnonymousPreferences,
  saveUserPreferences,
  updatePreferences,
  linkPreferencesToUser,

  // History
  recordPreferenceChange,
  getPreferenceHistory,

  // Consent checks
  isCategoryEnabled,
  isGranularCookieEnabled,
  getEnabledCookies,

  // Jurisdiction
  shouldShowBanner,
  getJurisdictionDefaults,
};
