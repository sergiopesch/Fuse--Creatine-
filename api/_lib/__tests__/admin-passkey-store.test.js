const {
    __resetAdminPasskeyStoreForTests,
    consumeAdminPasskeyChallenge,
    generateAdminPasskeyChallenge,
    getAdminPasskeyCredential,
    getAdminPasskeyCredentials,
    hasAdminPasskeyCredentials,
    storeAdminPasskeyChallenge,
    storeAdminPasskeyCredential,
    updateAdminPasskeyUsage,
} = require('../admin-passkey-store');

describe('admin passkey store', () => {
    beforeEach(() => {
        __resetAdminPasskeyStoreForTests();
    });

    test('stores and consumes one-time challenges', async () => {
        const challenge = generateAdminPasskeyChallenge();
        await storeAdminPasskeyChallenge('session-1', challenge, 'authenticate', {
            username: 'sergiopesch',
        });

        const consumed = await consumeAdminPasskeyChallenge('session-1', 'authenticate');
        expect(consumed.challenge).toBe(challenge);
        expect(consumed.metadata.username).toBe('sergiopesch');

        const secondAttempt = await consumeAdminPasskeyChallenge('session-1', 'authenticate');
        expect(secondAttempt).toBeNull();
    });

    test('stores and updates admin passkey credentials', async () => {
        expect(await hasAdminPasskeyCredentials()).toBe(false);

        await storeAdminPasskeyCredential({
            credentialId: 'credential-1',
            publicKey: 'public-key',
            counter: 1,
            transports: ['internal'],
        });

        expect(await hasAdminPasskeyCredentials()).toBe(true);
        expect(await getAdminPasskeyCredentials()).toHaveLength(1);
        expect(await getAdminPasskeyCredential('credential-1')).toMatchObject({
            credentialId: 'credential-1',
            counter: 1,
        });

        await updateAdminPasskeyUsage('credential-1', 2);
        expect(await getAdminPasskeyCredential('credential-1')).toMatchObject({
            counter: 2,
            useCount: 1,
        });
    });
});
