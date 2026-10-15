import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const [command, arg1, arg2, arg3] = process.argv.slice(2);

function runSql(sql) {
  const tempFile = path.resolve('.temp-admin-query.sql');
  try {
    fs.writeFileSync(tempFile, sql, 'utf8');
    const result = spawnSync('pnpm', [
      'exec', 'wrangler', 'd1', 'execute', 'DB',
      '--local',
      '--config', 'dist/server/wrangler.json',
      '--persist-to', '.wrangler/state',
      '--file', tempFile
    ], { shell: true, encoding: 'utf8' });

    if (result.error) throw result.error;
    if (result.status !== 0) {
      console.error(result.stderr || result.stdout);
      process.exit(result.status ?? 1);
    }
    return result.stdout;
  } finally {
    if (fs.existsSync(tempFile)) {
      try { fs.unlinkSync(tempFile); } catch {}
    }
  }
}

async function passwordHash(password, salt = crypto.randomBytes(16).toString('hex')) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 100000 }, key, 256);
  return `pbkdf2-sha256$100000$${salt}$${Array.from(new Uint8Array(bits), b => b.toString(16).padStart(2, '0')).join('')}`;
}

async function main() {
  if (!command || command === 'help') {
    console.log(`
SANDEAL — Quản lý tài khoản Quản trị viên (Admin)
==================================================
Cách sử dụng:

1. Thăng cấp một tài khoản đã có sẵn thành Admin:
   node scripts/manage-admin.mjs promote <email>
   Ví dụ: node scripts/manage-admin.mjs promote admin@hoanly.vn

2. Tạo trực tiếp một tài khoản Admin mới:
   node scripts/manage-admin.mjs create <email> <họ_tên> <mật_khẩu>
   Ví dụ: node scripts/manage-admin.mjs create admin@hoanly.vn "Quản Trị Viên" "AdminPass123456"

3. Xem danh sách người dùng và vai trò:
   node scripts/manage-admin.mjs list
`);
    return;
  }

  if (command === 'list') {
    console.log('--- Danh sách người dùng hiện tại ---');
    const out = runSql("SELECT id, email, name, role, status, created_at FROM auth_users;");
    console.log(out);
    return;
  }

  if (command === 'promote') {
    const email = String(arg1 || '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      console.error('Lỗi: Vui lòng nhập địa chỉ email hợp lệ cần thăng cấp.');
      process.exit(1);
    }
    const sql = `UPDATE auth_users SET role='admin', status='active' WHERE email='${email}';`;
    runSql(sql);
    console.log(`✓ Thành công! Đã cấp quyền Admin cho tài khoản: ${email}`);
    console.log(`\nLưu ý cho môi trường Production (Cloudflare D1 Remote):`);
    console.log(`Chạy lệnh: pnpm exec wrangler d1 execute DB --remote --command "${sql}"`);
    return;
  }

  if (command === 'create') {
    const email = String(arg1 || '').trim().toLowerCase();
    const name = String(arg2 || '').trim();
    const password = String(arg3 || '');

    if (!email || !email.includes('@')) {
      console.error('Lỗi: Email không hợp lệ.');
      process.exit(1);
    }
    if (name.length < 2) {
      console.error('Lỗi: Họ tên phải từ 2 ký tự trở lên.');
      process.exit(1);
    }
    if (password.length < 12 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      console.error('Lỗi: Mật khẩu cần tối thiểu 12 ký tự, gồm cả chữ và số.');
      process.exit(1);
    }

    const hash = await passwordHash(password);
    const userId = 'app:' + crypto.randomUUID();
    const now = new Date().toISOString();

    const sql = `INSERT INTO auth_users(id, email, name, password_hash, role, status, verified, created_at) VALUES('${userId}', '${email}', '${name}', '${hash}', 'admin', 'active', 1, '${now}');`;
    runSql(sql);

    console.log(`✓ Đã tạo thành công tài khoản Admin mới!`);
    console.log(`- Mã người dùng (User ID): ${userId}`);
    console.log(`- Email đăng nhập:         ${email}`);
    console.log(`- Vai trò:                 admin`);
    console.log(`\nBạn có thể đăng nhập ngay tại trang chủ với email và mật khẩu vừa tạo.`);
    console.log(`\nLưu ý cho môi trường Production (Cloudflare D1 Remote):`);
    console.log(`Chạy lệnh: pnpm exec wrangler d1 execute DB --remote --command "${sql}"`);
    return;
  }

  console.error(`Lệnh không hợp lệ: "${command}". Chạy "node scripts/manage-admin.mjs help" để xem hướng dẫn.`);
}

main().catch(err => {
  console.error('Lỗi:', err);
  process.exit(1);
});
