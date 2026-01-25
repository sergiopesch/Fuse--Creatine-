/**
 * Health check endpoint for debugging API configuration
 */

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;

    const diagnostics = {
        timestamp: new Date().toISOString(),
        environment: process.env.VERCEL_ENV || 'unknown',
        apiKey: {
            exists: 'ANTHROPIC_API_KEY' in process.env,
            hasValue: !!apiKey,
            length: apiKey?.length || 0,
            isEmpty: apiKey === '',
            isWhitespaceOnly: apiKey?.trim() === '' && apiKey?.length > 0,
            prefix: apiKey ? apiKey.substring(0, 7) + '...' : null,
            validFormat: apiKey?.startsWith('sk-ant-') || false
        },
        nodeVersion: process.version
    };

    return res.status(200).json(diagnostics);
}
