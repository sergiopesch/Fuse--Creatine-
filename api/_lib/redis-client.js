const { Redis } = require('@upstash/redis');

const REDIS_ENV_PAIRS = [
    ['UPSTASH_REDIS_KV_REST_API_URL', 'UPSTASH_REDIS_KV_REST_API_TOKEN'],
];

function getRedisConfig() {
    for (const [urlKey, tokenKey] of REDIS_ENV_PAIRS) {
        const url = process.env[urlKey];
        const token = process.env[tokenKey];
        if (url && token) {
            return { url, token, urlKey, tokenKey };
        }
    }

    return null;
}

function createRedisClient() {
    const config = getRedisConfig();
    if (!config) return null;
    if (typeof Redis !== 'function' && typeof Redis.fromEnv === 'function') {
        return Redis.fromEnv();
    }
    return new Redis({ url: config.url, token: config.token });
}

function hasRedisConfig() {
    return Boolean(getRedisConfig());
}

module.exports = {
    createRedisClient,
    getRedisConfig,
    hasRedisConfig,
};
