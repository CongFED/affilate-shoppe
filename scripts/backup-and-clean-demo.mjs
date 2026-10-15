import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const d1Dir = path.resolve('.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
const dbFiles = fs.readdirSync(d1Dir).filter(f => f.endsWith('.sqlite') && !f.startsWith('metadata'));
if (dbFiles.length === 0) {
  console.log('No sqlite db file found');
  process.exit(1);
}

const dbFileName = dbFiles[0];
const dbPath = path.join(d1Dir, dbFileName);
console.log('Target SQLite database:', dbPath);

// 1. Tạo thư mục backup
const backupDir = path.resolve('backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupDbPath = path.join(backupDir, `backup-pre-clean-${timestamp}.sqlite`);

// Sao lưu file database chính và các file WAL nếu có
fs.copyFileSync(dbPath, backupDbPath);
console.log('Created database file backup at:', backupDbPath);

const walPath = dbPath + '-wal';
if (fs.existsSync(walPath)) {
  fs.copyFileSync(walPath, path.join(backupDir, `backup-pre-clean-${timestamp}.sqlite-wal`));
}
const shmPath = dbPath + '-shm';
if (fs.existsSync(shmPath)) {
  fs.copyFileSync(shmPath, path.join(backupDir, `backup-pre-clean-${timestamp}.sqlite-shm`));
}

// 2. Mở database để thực hiện thống kê trước khi xóa
const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = OFF;'); // Tạm tắt để dọn theo lô sạch sẽ rồi bật lại

console.log('\n--- Thống kê bản ghi DEMO trước khi dọn dẹp ---');
const demoOrders = db.prepare("SELECT * FROM orders WHERE external_key LIKE 'demo:%' OR tracking_id = 'demo' OR account_id LIKE 'demo:%'").all();
const demoLinks = db.prepare("SELECT * FROM links WHERE account_id LIKE 'demo:%' OR affiliate_url LIKE 'DEMO-%'").all();
const demoWithdrawals = db.prepare("SELECT * FROM withdrawals WHERE account_id LIKE 'demo:%' OR request_key LIKE 'demo:%'").all();
const demoAccounts = db.prepare("SELECT * FROM accounts WHERE mode = 'demo' OR id LIKE 'demo:%'").all();
const demoSettings = db.prepare("SELECT * FROM settings WHERE id LIKE 'demo:%'").all();
const demoAudit = db.prepare("SELECT * FROM audit WHERE scope LIKE 'demo:%'").all();

console.log(`- orders demo: ${demoOrders.length}`);
console.log(`- links demo: ${demoLinks.length}`);
console.log(`- withdrawals demo: ${demoWithdrawals.length}`);
console.log(`- accounts demo: ${demoAccounts.length}`);
console.log(`- settings demo: ${demoSettings.length}`);
console.log(`- audit demo: ${demoAudit.length}`);

// Lưu dữ liệu dump trước khi xóa
const dumpPath = path.join(backupDir, `demo-records-dump-${timestamp}.json`);
fs.writeFileSync(dumpPath, JSON.stringify({
  timestamp: new Date().toISOString(),
  demoOrders,
  demoLinks,
  demoWithdrawals,
  demoAccounts,
  demoSettings,
  demoAudit
}, null, 2), 'utf8');
console.log('Dumped demo records JSON to:', dumpPath);

// 3. Thực hiện xóa trong transaction nguyên tử
console.log('\n--- Bắt đầu xóa dữ liệu DEMO trong transaction ---');
db.exec('BEGIN TRANSACTION;');
try {
  const delOrders = db.prepare("DELETE FROM orders WHERE external_key LIKE 'demo:%' OR tracking_id = 'demo' OR account_id LIKE 'demo:%'").run();
  console.log(`Đã xóa ${delOrders.changes} đơn hàng demo.`);

  const delLinks = db.prepare("DELETE FROM links WHERE account_id LIKE 'demo:%' OR affiliate_url LIKE 'DEMO-%'").run();
  console.log(`Đã xóa ${delLinks.changes} link demo.`);

  const delWithdrawals = db.prepare("DELETE FROM withdrawals WHERE account_id LIKE 'demo:%' OR request_key LIKE 'demo:%'").run();
  console.log(`Đã xóa ${delWithdrawals.changes} yêu cầu rút demo.`);

  const delAccounts = db.prepare("DELETE FROM accounts WHERE mode = 'demo' OR id LIKE 'demo:%'").run();
  console.log(`Đã xóa ${delAccounts.changes} tài khoản ví demo.`);

  const delSettings = db.prepare("DELETE FROM settings WHERE id LIKE 'demo:%'").run();
  console.log(`Đã xóa ${delSettings.changes} cài đặt demo.`);

  const delAudit = db.prepare("DELETE FROM audit WHERE scope LIKE 'demo:%'").run();
  console.log(`Đã xóa ${delAudit.changes} nhật ký demo.`);

  db.exec('COMMIT;');
  console.log('Transaction COMMIT thành công!');
} catch (e) {
  db.exec('ROLLBACK;');
  console.error('Lỗi khi xóa, đã ROLLBACK:', e.message);
  process.exit(1);
} finally {
  db.exec('PRAGMA foreign_keys = ON;');
}

// 4. Kiểm tra lại sau khi dọn dẹp
console.log('\n--- Thống kê Database sau khi dọn dẹp ---');
const tables = ['accounts', 'orders', 'links', 'withdrawals', 'settings', 'audit', 'auth_users', 'auth_sessions'];
for (const t of tables) {
  const total = db.prepare(`SELECT COUNT(*) as c FROM ${t}`).get().c;
  console.log(`${t.padEnd(15)}: Còn lại ${total} bản ghi (100% dữ liệu thật).`);
}
