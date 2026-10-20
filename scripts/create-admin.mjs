#!/usr/bin/env node
// Creates (or updates) a SnipMemory platform admin.
//   node scripts/create-admin.mjs 9876543210 "Admin Name" 'a-long-password' [--remote] [--env production]
import { execFileSync } from 'node:child_process';
import { pbkdf2Sync, randomBytes, randomUUID } from 'node:crypto';

const [phoneArg, name, password, ...flags] = process.argv.slice(2);
if (!phoneArg || !name || !password || password.length < 12) {
  console.error('Usage: node scripts/create-admin.mjs <10-digit phone> "<name>" "<password, 12+ chars>" [--remote] [--env production]');
  process.exit(1);
}
const phone = `+91${phoneArg.replace(/\D/g, '').slice(-10)}`;
// Same format as worker/src/lib/crypto.ts hashSecret
const hash = (secret) => {
  const salt = randomBytes(16);
  return `pbkdf2$100000$${salt.toString('hex')}$${pbkdf2Sync(secret, salt, 100000, 32, 'sha256').toString('hex')}`;
};
const esc = (s) => s.replace(/'/g, "''");
const sql = `INSERT INTO users (id, phone, name, pin_hash, password_hash, is_platform_admin, created_at)
VALUES ('usr_${randomUUID().replace(/-/g, '').slice(0, 16)}', '${phone}', '${esc(name)}', '${hash(randomBytes(8).toString('hex'))}', '${hash(password)}', 1, ${Date.now()})
ON CONFLICT(phone) DO UPDATE SET password_hash = excluded.password_hash, is_platform_admin = 1;`;
const target = flags.includes('--remote') ? ['--remote'] : ['--local'];
const envIdx = flags.indexOf('--env');
const env = envIdx >= 0 ? ['--env', flags[envIdx + 1]] : [];
execFileSync('npx', ['wrangler', 'd1', 'execute', 'snipmemory', ...target, ...env, '--command', sql], { stdio: 'inherit' });
console.log(`Admin ready: ${phone}. Log in at /admin`);
