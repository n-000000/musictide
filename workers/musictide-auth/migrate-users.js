#!/usr/bin/env node
/**
 * One-time migration: replace email fields in data/cms-users/*.json with
 * HMAC-SHA256(GLOBAL_SALT, email) tokens.
 *
 * Usage:
 *   GLOBAL_SALT=<64-hex-char-secret> node workers/musictide-auth/migrate-users.js
 *
 * Get the salt:
 *   wrangler secret list --name musictide-auth   # won't show value
 *   # Run: wrangler secret put GLOBAL_SALT --name musictide-auth
 *   # Then copy the value you set.
 *
 * Run from the repo root. Rewrites data/cms-users/*.json in place.
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { createHmac } from 'crypto';

const salt = process.env.GLOBAL_SALT;
if (!salt || !/^[0-9a-f]{64}$/i.test(salt)) {
  console.error('ERROR: set GLOBAL_SALT to the 64-hex-char secret before running');
  process.exit(1);
}

const saltBytes = Buffer.from(salt, 'hex');
const dir = new URL('../../data/cms-users', import.meta.url).pathname;

for (const file of readdirSync(dir).filter(f => f.endsWith('.json'))) {
  const path = join(dir, file);
  const data = JSON.parse(readFileSync(path, 'utf8'));

  if (!data.email) {
    console.log(`skip  ${file} — no email field`);
    continue;
  }

  const token = createHmac('sha256', saltBytes).update(data.email).digest('hex');
  const { name, email, login, ...rest } = data;  // eslint-disable-line no-unused-vars

  const updated = { name, token, ...rest };
  writeFileSync(path, JSON.stringify(updated, null, 2) + '\n');
  console.log(`done  ${file}  ${email} → ${token}...`);
}

console.log('\nNext steps:');
console.log('  git add data/cms-users/ && git commit -m "chore(auth): migrate user files to token schema"');
console.log('  git push origin main   # triggers sync-users webhook → updates KV');
