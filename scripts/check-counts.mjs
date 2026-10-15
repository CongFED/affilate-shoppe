import { DatabaseSync } from 'node:sqlite';

const dbPath = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject/faaf2b0445ab934c3aac48ddf0cdfade8f9bac050be98993748742cdd2cb05fb.sqlite';
const db = new DatabaseSync(dbPath);

console.log('=== THỐNG KÊ DATABASE LOCAL HIỆN TẠI ===');
const tables = ['accounts', 'orders', 'links', 'withdrawals', 'settings', 'audit_logs', 'auth_users', 'auth_sessions'];
for (const t of tables) {
  try {
    const total = db.prepare(`SELECT count(*) as c FROM ${t}`).get().c;
    let live = 0, demo = 0;
    if (['accounts', 'settings'].includes(t)) {
      live = db.prepare(`SELECT count(*) as c FROM ${t} WHERE id LIKE 'live:%'`).get().c;
      demo = db.prepare(`SELECT count(*) as c FROM ${t} WHERE id LIKE 'demo:%'`).get().c;
    } else if (['orders', 'links', 'withdrawals'].includes(t)) {
      live = db.prepare(`SELECT count(*) as c FROM ${t} WHERE account_id LIKE 'live:%'`).get().c;
      demo = db.prepare(`SELECT count(*) as c FROM ${t} WHERE account_id LIKE 'demo:%'`).get().c;
    } else if (t === 'audit_logs') {
      live = db.prepare(`SELECT count(*) as c FROM ${t} WHERE scope='live'`).get().c;
      demo = db.prepare(`SELECT count(*) as c FROM ${t} WHERE scope='demo'`).get().c;
    }
    console.log(`${t.padEnd(16)} | Total: ${String(total).padStart(4)} | Live: ${String(live).padStart(4)} | Demo: ${String(demo).padStart(4)}`);
  } catch (e) {
    console.log(`${t.padEnd(16)} | Error: ${e.message}`);
  }
}
