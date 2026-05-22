const {
    authenticateAdminRequest,
    createAdminSession,
    generatePasswordHash,
    verifyAdminCredentials,
    verifyAdminSession,
} = require('../admin-auth');

describe('admin auth', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv };
        process.env.ADMIN_USERNAME = 'sergiopesch';
        process.env.ADMIN_SESSION_SECRET = '12345678901234567890123456789012';
        process.env.ADMIN_TOKEN = 'abcdefabcdefabcdefabcdefabcdef12';
        process.env.ADMIN_PASSWORD_HASH = generatePasswordHash('correct-password');
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    test('verifies configured username and scrypt password hash', () => {
        expect(verifyAdminCredentials('sergiopesch', 'correct-password')).toEqual(
            expect.objectContaining({ ok: true, username: 'sergiopesch' })
        );
        expect(verifyAdminCredentials('sergiopesch', 'wrong-password')).toEqual(
            expect.objectContaining({ ok: false })
        );
        expect(verifyAdminCredentials('other', 'correct-password')).toEqual(
            expect.objectContaining({ ok: false })
        );
    });

    test('creates and verifies signed admin sessions', () => {
        const token = createAdminSession('sergiopesch');

        expect(token).toMatch(/^fuse_admin_session\./);
        expect(verifyAdminSession(token)).toBe(true);
        expect(verifyAdminSession(`${token}tampered`)).toBe(false);
    });

    test('authenticates requests with signed session or legacy admin token', () => {
        const session = createAdminSession('sergiopesch');
        const sessionReq = { headers: { authorization: `Bearer ${session}` } };
        const tokenReq = { headers: { authorization: `Bearer ${process.env.ADMIN_TOKEN}` } };
        const badReq = { headers: { authorization: 'Bearer bad-token' } };

        expect(authenticateAdminRequest(sessionReq)).toEqual(
            expect.objectContaining({ authenticated: true, method: 'session' })
        );
        expect(authenticateAdminRequest(tokenReq)).toEqual(
            expect.objectContaining({ authenticated: true, method: 'admin-token' })
        );
        expect(authenticateAdminRequest(badReq)).toEqual(
            expect.objectContaining({ authenticated: false })
        );
    });
});
