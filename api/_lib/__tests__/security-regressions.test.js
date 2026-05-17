const mockRedis = {
    incr: jest.fn(async () => 1),
    expire: jest.fn(async () => 1),
    ttl: jest.fn(async () => 60),
    setex: jest.fn(async () => 'OK'),
    get: jest.fn(async () => null),
    del: jest.fn(async () => 1),
};

jest.mock('@upstash/redis', () => ({
    Redis: {
        fromEnv: jest.fn(() => mockRedis),
    },
}));

function createRes() {
    return {
        headers: {},
        statusCode: 200,
        body: null,
        setHeader(name, value) {
            this.headers[name.toLowerCase()] = value;
        },
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.body = payload;
            return this;
        },
        end() {
            this.ended = true;
            return this;
        },
    };
}

describe('security regressions', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        process.env = {
            ...originalEnv,
            NODE_ENV: 'production',
            UPSTASH_REDIS_REST_URL: 'https://redis.example',
            UPSTASH_REDIS_REST_TOKEN: 'redis-token',
            RESEND_API_KEY: 'resend-token',
            ENCRYPTION_KEY: 'x'.repeat(32),
        };
        delete process.env.FUSE_PUBLIC_URL;
        delete process.env.PUBLIC_APP_URL;
        delete process.env.SITE_URL;
        delete process.env.VERCEL_URL;
        global.fetch = jest.fn(async () => ({
            ok: false,
            json: async () => ({ message: 'provider down' }),
        }));
    });

    afterEach(() => {
        process.env = originalEnv;
        delete global.fetch;
    });

    it('does not return a direct magic link when email delivery fails', async () => {
        const handler = require('../../magic-link');
        const req = {
            method: 'POST',
            url: '/api/magic-link',
            headers: { origin: 'https://fusecreatine.com' },
            body: { action: 'send' },
            socket: { remoteAddress: '203.0.113.10' },
        };
        const res = createRes();

        await handler(req, res);

        expect(res.statusCode).toBe(503);
        expect(res.body.success).toBe(false);
        expect(res.body.magicLinkUrl).toBeUndefined();
        expect(mockRedis.del).toHaveBeenCalledWith(expect.stringMatching(/^magic:token:/));
    });

    it('rejects magic link creation for untrusted host-only requests', async () => {
        const handler = require('../../magic-link');
        const req = {
            method: 'POST',
            url: '/api/magic-link',
            headers: {
                host: 'evil.example',
                'x-forwarded-proto': 'https',
            },
            body: { action: 'send' },
            socket: { remoteAddress: '203.0.113.10' },
        };
        const res = createRes();

        await handler(req, res);

        expect(res.statusCode).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.magicLinkUrl).toBeUndefined();
    });

    it('keeps agent workspace paths inside the configured workspace', () => {
        const { _test } = require('../agent-tools');

        expect(_test.getWorkspacePath('notes/file.md')).toMatch(/agent-workspace.*notes.*file\.md$/);
        expect(() => _test.getWorkspacePath('../secrets.txt')).toThrow(
            'Path escapes workspace boundary'
        );
        expect(() => _test.getWorkspacePath('safe/../../secrets.txt')).toThrow(
            'Path escapes workspace boundary'
        );
    });

    it('escapes workspace file patterns before building regular expressions', () => {
        const { _test } = require('../agent-tools');
        const regex = _test.patternToRegex('report[1].*.md');

        expect(regex.test('report[1].final.md')).toBe(true);
        expect(regex.test('report1.final.md')).toBe(false);
    });
});
