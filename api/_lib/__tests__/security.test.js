/**
 * Security Module Tests
 * Tests for authentication, rate limiting, and security utilities
 */

const {
    getHeaderValue,
    getClientIp,
    getAuthToken,
    tokensMatch,
    getCorsOrigin,
    checkRateLimit,
    CONFIG,
    ALLOWED_ORIGINS
} = require('../security');

describe('Security Module', () => {
    describe('getHeaderValue', () => {
        it('should return first element for array headers', () => {
            expect(getHeaderValue(['first', 'second'])).toBe('first');
        });

        it('should return string value for string headers', () => {
            expect(getHeaderValue('header-value')).toBe('header-value');
        });

        it('should return empty string for null/undefined', () => {
            expect(getHeaderValue(null)).toBe('');
            expect(getHeaderValue(undefined)).toBe('');
        });

        it('should return empty string for non-string types', () => {
            expect(getHeaderValue(123)).toBe('');
            expect(getHeaderValue({})).toBe('');
        });
    });

    describe('getClientIp', () => {
        it('should return x-forwarded-for IP if present', () => {
            const req = {
                headers: {
                    'x-forwarded-for': '192.168.1.1, 10.0.0.1'
                }
            };
            expect(getClientIp(req)).toBe('192.168.1.1');
        });

        it('should return x-real-ip if x-forwarded-for is not present', () => {
            const req = {
                headers: {
                    'x-real-ip': '10.0.0.2'
                }
            };
            expect(getClientIp(req)).toBe('10.0.0.2');
        });

        it('should return socket remoteAddress as fallback', () => {
            const req = {
                headers: {},
                socket: { remoteAddress: '127.0.0.1' }
            };
            expect(getClientIp(req)).toBe('127.0.0.1');
        });

        it('should return "unknown" if no IP can be determined', () => {
            const req = { headers: {} };
            expect(getClientIp(req)).toBe('unknown');
        });
    });

    describe('getAuthToken', () => {
        it('should extract Bearer token from Authorization header', () => {
            const req = {
                headers: {
                    authorization: 'Bearer test-token-12345'
                }
            };
            expect(getAuthToken(req)).toBe('test-token-12345');
        });

        it('should handle case-insensitive Bearer prefix', () => {
            const req = {
                headers: {
                    authorization: 'bearer test-token-12345'
                }
            };
            expect(getAuthToken(req)).toBe('test-token-12345');
        });

        it('should extract token from x-admin-token header', () => {
            const req = {
                headers: {
                    'x-admin-token': 'admin-token-12345'
                }
            };
            expect(getAuthToken(req)).toBe('admin-token-12345');
        });

        it('should return null if no token is present', () => {
            const req = { headers: {} };
            expect(getAuthToken(req)).toBeNull();
        });
    });

    describe('tokensMatch', () => {
        it('should return true for matching tokens', () => {
            const token = 'a'.repeat(32);
            expect(tokensMatch(token, token)).toBe(true);
        });

        it('should return false for non-matching tokens', () => {
            const token1 = 'a'.repeat(32);
            const token2 = 'b'.repeat(32);
            expect(tokensMatch(token1, token2)).toBe(false);
        });

        it('should return false for tokens shorter than minimum length', () => {
            expect(tokensMatch('short', 'short')).toBe(false);
        });

        it('should return false if either token is null/undefined', () => {
            expect(tokensMatch(null, 'a'.repeat(32))).toBe(false);
            expect(tokensMatch('a'.repeat(32), null)).toBe(false);
            expect(tokensMatch(undefined, 'a'.repeat(32))).toBe(false);
        });

        it('should handle different length tokens safely', () => {
            const short = 'a'.repeat(32);
            const long = 'a'.repeat(64);
            expect(tokensMatch(short, long)).toBe(false);
        });
    });

    describe('getCorsOrigin', () => {
        it('should return allowed origin if in whitelist', () => {
            expect(getCorsOrigin('https://fusecreatine.com')).toBe('https://fusecreatine.com');
        });

        it('should return localhost origin for local development', () => {
            expect(getCorsOrigin('http://localhost:3000')).toBe('http://localhost:3000');
        });

        it('should return null for unknown origins', () => {
            expect(getCorsOrigin('https://malicious-site.com')).toBeNull();
        });

        it('should return first allowed origin for empty/null origin', () => {
            // getCorsOrigin returns first allowed origin as default when origin is missing
            expect(getCorsOrigin('')).toBe(ALLOWED_ORIGINS[0]);
            expect(getCorsOrigin(null)).toBe(ALLOWED_ORIGINS[0]);
        });

        it('should handle vercel preview URLs', () => {
            // Vercel preview URLs ending in .vercel.app are allowed
            const result = getCorsOrigin('https://fuse-creatine-abc123.vercel.app');
            expect(result).toBe('https://fuse-creatine-abc123.vercel.app');
        });
    });

    describe('checkRateLimit', () => {
        // Note: checkRateLimit is async and uses Redis when available
        // Without Redis configured, it returns { limited: false, remaining: limit }

        it('should return not limited when Redis is not configured', async () => {
            const key = 'test-ip-1';
            const result = await checkRateLimit(key, 5, 60000);
            expect(result.limited).toBe(false);
        });

        it('should include remaining count in result', async () => {
            const key = 'test-ip-2';
            const result = await checkRateLimit(key, 5, 60000);
            expect(result).toHaveProperty('remaining');
        });

        it('should include resetAt in result', async () => {
            const key = 'test-ip-3';
            const result = await checkRateLimit(key, 5, 60000);
            expect(result).toHaveProperty('resetAt');
        });
    });

    describe('ALLOWED_ORIGINS', () => {
        it('should include production domain', () => {
            expect(ALLOWED_ORIGINS).toContain('https://fusecreatine.com');
            expect(ALLOWED_ORIGINS).toContain('https://www.fusecreatine.com');
        });

        it('should include localhost for development', () => {
            expect(ALLOWED_ORIGINS).toContain('http://localhost:3000');
            expect(ALLOWED_ORIGINS).toContain('http://localhost:5500');
        });
    });

    describe('CONFIG', () => {
        it('should have sensible rate limit defaults', () => {
            expect(CONFIG.RATE_LIMIT_WINDOW_MS).toBeGreaterThan(0);
            expect(CONFIG.RATE_LIMIT_MAX_REQUESTS).toBeGreaterThan(0);
        });

        it('should have minimum token length requirement', () => {
            expect(CONFIG.MIN_TOKEN_LENGTH).toBeGreaterThanOrEqual(32);
        });
    });
});
