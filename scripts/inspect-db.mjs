import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const d1Dir = path.resolve('.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
if (!fs.existsSync(d1Dir)) {
  console.log('No miniflare directory found at:', d1Dir);
  process.exit(0);
}

const dbFiles = fs.readdirSync(d1Dir).filter(f => f.endsWith('.sqlite') && !f.startsWith('metadata'));
if (dbFiles.length === 0) {
  console.log('No sqlite db file found');
  process.exit(0);
}

const dbPath = path.join(d1Dir, dbFiles[0]);
console.log('Target SQLite database:', dbPath);

const db = new DatabaseSync(dbPath);

console.log('\n--- Thống kê dữ liệu hiện tại trong Database ---');
const tables = ['accounts', 'orders', 'links', 'withdrawals', 'settings', 'audit', 'auth_users', 'auth_sessions', 'auth_rate', 'auth_oauth'];
const stats = {};

for (const t of tables) {
  try {
    const totalRow = db.prepare(`SELECT COUNT(*) as c FROM ${t}`).get();
    const total = Number(totalRow?.c ?? 0);
    let demo = 0;
    if (t === 'accounts') {
      const r = db.prepare("SELECT COUNT(*) as c FROM accounts WHERE mode = 'demo' OR id LIKE 'demo:%'").get();
      demo = Number(r?.c ?? 0);
    } else if (t === 'orders') {
      const r = db.prepare("SELECT COUNT(*) as c FROM orders WHERE external_key LIKE 'demo:%' OR tracking_id = 'demo' OR account_id LIKE 'demo:%'").get();
      demo = Number(r?.c ?? 0);
    } else if (t === 'links') {
      const r = db.prepare("SELECT COUNT(*) as c FROM links WHERE account_id LIKE 'demo:%' OR affiliate_url LIKE 'DEMO-%'").get();
      demo = Number(r?.c ?? 0);
    } else if (t === 'withdrawals') {
      const r = db.prepare("SELECT COUNT(*) as c FROM withdrawals WHERE account_id LIKE 'demo:%' OR request_key LIKE 'demo:%'").get();
      demo = Number(r?.c ?? 0);
    } else if (t === 'settings') {
      const r = db.prepare("SELECT COUNT(*) as c FROM settings WHERE id LIKE 'demo:%'").get();
      demo = Number(r?.c ?? 0);
    } else if (t === 'audit') {
      const r = db.prepare("SELECT COUNT(*) as c FROM audit WHERE scope LIKE 'demo:%'").get();
      demo = Number(r?.c ?? 0);
    }
    stats[t] = { total, demo, live: total - demo };
    console.log(`${t.padEnd(15)}: Tổng = ${String(total).padEnd(4)} | Demo = ${String(demo).padEnd(4)} | Live/Auth = ${total - demo}`);
  } catch (e) {
    console.log(`${t.padEnd(15)}: Bảng không tồn tại hoặc lỗi: ${e.message}`);
  }
}
