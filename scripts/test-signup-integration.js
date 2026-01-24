#!/usr/bin/env node
'use strict';

const crypto = require('crypto');

const BASE_URL = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const MAX_ATTEMPTS = Number.parseInt(process.env.MAX_ATTEMPTS || '6', 10);
const TIMEOUT_MS = Number.parseInt(process.env.REQUEST_TIMEOUT_MS || '12000', 10);

if (!ADMIN_TOKEN) {
    console.error('Missing ADMIN_TOKEN. Set it before running the integration test.');
    process.exit(1);
}

if (typeof fetch !== 'function') {
    console.error('Global fetch is not available. Use Node.js 18+.');
    process.exit(1);
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithTimeout = async (url, options = {}, timeoutMs = TIMEOUT_MS) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
    }
};

const makeUniqueEmail = () => {
    const stamp = Date.now().toString(36);
    const rand = crypto.randomBytes(2).toString('hex');
    return `flex.${stamp}.${rand}@gainmail.com`;
};

const run = async () => {
    const email = makeUniqueEmail();
    const payload = {
        fullName: 'Flex McGains',
        email,
        mainInterest: 'Running a real integration test to confirm storage and admin retrieval.',
        policyVersion: 'v1.0',
        consentToContact: true,
    };

    console.log(`Submitting signup to ${BASE_URL}/api/signup`);
    const submitResponse = await fetchWithTimeout(`${BASE_URL}/api/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    const submitBody = await submitResponse.json().catch(() => ({}));

    if (!submitResponse.ok) {
        console.error('Signup failed:', submitResponse.status, submitBody);
        process.exit(1);
    }

    console.log('Signup stored. Verifying via admin endpoint...');

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        const url = new URL(`${BASE_URL}/api/admin-signups`);
        url.searchParams.set('limit', '200');
        url.searchParams.set('email', email);

        const adminResponse = await fetchWithTimeout(url.toString(), {
            headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
            cache: 'no-store',
        });

        const adminBody = await adminResponse.json().catch(() => ({}));

        if (adminResponse.status === 401) {
            console.error('Admin access denied. Check ADMIN_TOKEN.');
            process.exit(1);
        }

        if (adminResponse.ok) {
            const signups = Array.isArray(adminBody.signups) ? adminBody.signups : [];
            const match = signups.find((signup) => signup.email === email);
            if (match) {
                console.log('Integration test passed. Signup found in admin list.');
                console.log(match);
                process.exit(0);
            }
        } else {
            console.warn('Admin lookup failed:', adminResponse.status, adminBody);
        }

        if (attempt < MAX_ATTEMPTS) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
            console.log(`Retrying in ${delay}ms... (attempt ${attempt + 1}/${MAX_ATTEMPTS})`);
            await wait(delay);
        }
    }

    console.error('Integration test failed: signup not found after retries.');
    process.exit(1);
};

run().catch((error) => {
    console.error('Integration test error:', error);
    process.exit(1);
});
