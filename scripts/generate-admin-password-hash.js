#!/usr/bin/env node

const { generatePasswordHash } = require('../api/_lib/admin-auth');

const password = process.argv[2];

if (!password) {
    console.error('Usage: node scripts/generate-admin-password-hash.js "<password>"');
    process.exit(1);
}

console.log(generatePasswordHash(password));
