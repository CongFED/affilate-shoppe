import { spawnSync } from 'node:child_process';
import { passwordHash } from '../lib/auth-core.ts';
import fs from 'node:fs';
import path from 'node:path';

async function run() {
  const hash = await passwordHash('admin123');
  const tempSql = path.resolve('.temp-set-admin.sql');
  const sql = `UPDATE auth_users SET password_hash = '${hash}', role = 'admin', status = 'active' WHERE email = 'admin@hoanly.vn';`;
  fs.writeFileSync(tempSql, sql, 'utf8');

  try {
    const res = spawnSync('pnpm', [
      'exec', 'wrangler', 'd1', 'execute', 'DB',
      '--local',
      '--config', 'dist/server/wrangler.json',
      '--persist-to', '.wrangler/state',
      '--file', tempSql
    ], { shell: true, encoding: 'utf8' });

    console.log(res.stdout || res.stderr);
    console.log('✓ Successfully set admin@hoanly.vn password to admin123');
  } finally {
    if (fs.existsSync(tempSql)) fs.unlinkSync(tempSql);
  }
}

run();
