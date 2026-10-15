import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

class D1 {
  constructor(){
    this.db = new DatabaseSync(':memory:');
    this.db.exec('PRAGMA foreign_keys=ON');
    for(const file of fs.readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort()){
      this.db.exec(fs.readFileSync('drizzle/'+file,'utf8'));
    }
  }
  prepare(sql){
    const d = this;
    return {
      args: [],
      bind(...args){ this.args = args; return this; },
      async all(){ return { results: d.db.prepare(sql).all(...this.args) }; },
      async run(){
        const r = d.db.prepare(sql).run(...this.args);
        return { meta: { changes: Number(r.changes) } };
      }
    };
  }
  async batch(stmts){
    this.db.exec('BEGIN');
    try {
      const results = [];
      for(const s of stmts) results.push(await s.run());
      this.db.exec('COMMIT');
      return results;
    } catch(e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
}

async function fixture({ mockShopee = false } = {}){
  const DB = new D1(), env = {
    DB,
    ADMIN_USER_IDS: 'owner',
    ...(mockShopee ? { SHOPEE_APP_ID: 'test_app_id', SHOPEE_APP_SECRET: 'test_app_secret', SHOPEE_ENABLED: 'true' } : {})
  };
  const ctx = vm.createContext({
    console,
    crypto: globalThis.crypto,
    TextEncoder,
    TextDecoder,
    URL,
    AbortSignal,
    Date,
    fetch: async (url, opts) => {
      if (mockShopee && String(url).includes('shopee')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: {
              generateShortLink: {
                shortLink: 'https://shopee.vn/universal-link/product/1/2'
              }
            }
          })
        };
      }
      throw new Error('Unexpected upstream call: ' + url);
    }
  });
  const cache = new Map();
  const envModule = new vm.SyntheticModule(['env'], function(){ this.setExport('env', env); }, { context: ctx });

  async function mod(filename){
    const abs = path.resolve(filename);
    if(cache.has(abs)) return cache.get(abs);
    const source = ts.transpileModule(fs.readFileSync(abs, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
    }).outputText;
    const m = new vm.SourceTextModule(source, { context: ctx, identifier: abs });
    cache.set(abs, m);
    await m.link(async spec => {
      if(spec === 'cloudflare:workers') return envModule;
      const resolved = path.resolve(path.dirname(abs), spec + (spec.endsWith('.ts') ? '' : '.ts'));
      return mod(resolved);
    });
    return m;
  }

  const service = await mod('lib/service.ts');
  await service.evaluate();
  return { DB, env, ...service.namespace };
}

function seedTestOrders(DB, accountId = 'live:owner') {
  const orders = [
    { id: 't_ord_1', external_key: `${accountId}:ORD-1`, external_id: 'ORD-1', product: 'Nồi chiên không dầu Philips', amount: 1590000, commission: 120000, cashback: 96000, share_bps: 8000, status: 'available', settlement_ref: 'TEST-SETTLE-1' },
    { id: 't_ord_2', external_key: `${accountId}:ORD-2`, external_id: 'ORD-2', product: 'Bàn phím cơ không dây', amount: 890000, commission: 70000, cashback: 56000, share_bps: 8000, status: 'available', settlement_ref: 'TEST-SETTLE-2' },
    { id: 't_ord_3', external_key: `${accountId}:ORD-3`, external_id: 'ORD-3', product: 'Chuột Logitech Master 3S', amount: 2190000, commission: 160000, cashback: 128000, share_bps: 8000, status: 'available', settlement_ref: 'TEST-SETTLE-3' },
    { id: 't_ord_4', external_key: `${accountId}:ORD-4`, external_id: 'ORD-4', product: 'Tai nghe Bluetooth chống ồn', amount: 1450000, commission: 110000, cashback: 88000, share_bps: 8000, status: 'available', settlement_ref: 'TEST-SETTLE-4' },
    { id: 't_ord_5', external_key: `${accountId}:ORD-5`, external_id: 'ORD-5', product: 'Cáp sạc Type-C Anker', amount: 190000, commission: 22000, cashback: 17600, share_bps: 8000, status: 'available', settlement_ref: 'TEST-SETTLE-5' },
    { id: 't_ord_6', external_key: `${accountId}:ORD-6`, external_id: 'ORD-6', product: 'Bình giữ nhiệt Lock&Lock', amount: 320000, commission: 30000, cashback: 24000, share_bps: 8000, status: 'approved', settlement_ref: null },
    { id: 't_ord_7', external_key: `${accountId}:ORD-7`, external_id: 'ORD-7', product: 'Áo thun thể thao nam', amount: 180000, commission: 15000, cashback: 12000, share_bps: 8000, status: 'pending', settlement_ref: null }
  ];
  for (const o of orders) {
    DB.db.prepare(`INSERT OR REPLACE INTO orders(id, external_key, external_id, account_id, tracking_id, product, amount, commission, cashback, share_bps, status, settlement_ref, created_at)
      VALUES (?, ?, ?, ?, 'sub_test', ?, ?, ?, ?, ?, ?, ?, '2026-10-15T00:00:00Z')`
    ).run(o.id, o.external_key, o.external_id, accountId, o.product, o.amount, o.commission, o.cashback, o.share_bps, o.status, o.settlement_ref);
  }
}

const owner = { userId: 'owner', email: 'owner@example.test', displayName: 'Owner', fullName: 'Owner', role: 'admin', status: 'active' };
const customer = { userId: 'customer', email: 'customer@example.test', displayName: 'Customer', fullName: 'Customer', role: 'customer', status: 'active' };
const bank = { bank: 'MB Bank', bankNumber: '000012345678', bankName: 'TAI KHOAN TEST' };

test('Full ledger lifecycle: verify zero initial balance, in-memory fixture withdrawal, cancel, process and pay', async () => {
  const s = await fixture();
  // 1. Initial account must be zero with no orders
  let d = await s.init(owner, 'live');
  assert.equal(d.available, 0);
  assert.equal(d.orders.length, 0);

  // 2. Seed test fixture in memory for ledger verification
  seedTestOrders(s.DB, 'live:owner');
  d = await s.snapshot(owner, 'live');
  assert.equal(d.orders.length, 7);
  assert.equal(d.available, 385600);

  const key = crypto.randomUUID();
  await s.execute(owner, 'live', { action: 'withdraw', amount: 100000, requestKey: key, ...bank });
  await s.execute(owner, 'live', { action: 'withdraw', amount: 100000, requestKey: key, ...bank });

  d = await s.snapshot(owner, 'live');
  assert.equal(d.withdrawals.length, 1);
  assert.equal(d.available, 285600);

  await assert.rejects(() => s.execute(owner, 'live', { action: 'withdraw', amount: 300000, requestKey: crypto.randomUUID(), ...bank }), /Số dư/);

  const first = d.withdrawals[0];
  await s.execute(owner, 'live', { action: 'cancelWithdraw', id: first.id });
  assert.equal((await s.snapshot(owner, 'live')).available, 385600);

  await s.execute(owner, 'live', { action: 'withdraw', amount: 50000, requestKey: crypto.randomUUID(), ...bank });
  d = await s.snapshot(owner, 'live');
  const w = d.withdrawals.find(x => x.status === 'pending');

  await s.execute(owner, 'live', { action: 'processWithdraw', id: w.id, status: 'processing' });
  await assert.rejects(() => s.execute(owner, 'live', { action: 'cancelWithdraw', id: w.id }), /Chỉ hủy/);
  await assert.rejects(() => s.execute(owner, 'live', { action: 'processWithdraw', id: w.id, status: 'paid', reference: '' }), /mã giao dịch/);

  await s.execute(owner, 'live', { action: 'processWithdraw', id: w.id, status: 'paid', reference: 'LIVE-TX-001' });
  d = await s.snapshot(owner, 'live');
  assert.equal(d.available, 335600);
  const paidW = d.withdrawals.find(x => x.id === w.id);
  assert.equal(paidW.status, 'paid');
  assert.ok(paidW.processed_by);

  // New customer starts with 0
  assert.equal((await s.init(customer, 'live')).available, 0);
  await assert.rejects(() => s.execute(customer, 'live', { action: 'cancelWithdraw', id: w.id }));
});

test('Atomic reservation accepts only one competing withdrawal when total exceeds balance', async () => {
  const s = await fixture();
  await s.init(owner, 'live');
  seedTestOrders(s.DB, 'live:owner');
  const r = await Promise.allSettled([1, 2].map(() => s.execute(owner, 'live', { action: 'withdraw', amount: 300000, requestKey: crypto.randomUUID(), ...bank })));
  assert.equal(r.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal((await s.snapshot(owner, 'live')).available, 85600);
});

test('Import maps Sub ID, avoids duplicates, snapshots rates, releases only approved commission and blocks unrelated access', async () => {
  const s = await fixture({ mockShopee: true });
  await s.init(owner, 'live');
  seedTestOrders(s.DB, 'live:owner');
  const link = await s.execute(owner, 'live', { action: 'link', url: 'https://shopee.vn/product/1/2' });
  const csv = (com = 20000, status = 'approved', sub = link.result.tracking_id) => `order_id,sub_id,product,amount,commission,status,date\nTEST-001,${sub},San pham test,200000,${com},${status},2026-10-15`;

  await s.execute(owner, 'live', { action: 'import', csv: csv() });
  await s.execute(owner, 'live', { action: 'import', csv: csv() });

  let d = await s.snapshot(owner, 'live');
  assert.equal(d.orders.length, 8);
  const o = d.orders.find(x => x.external_id === 'TEST-001');
  assert.equal(o.cashback, 16000);
  assert.equal(d.available, 385600);

  await s.execute(owner, 'live', { action: 'settings', shareBps: 5000, minWithdraw: 50000 });
  await s.execute(owner, 'live', { action: 'import', csv: csv(30000) });
  d = await s.snapshot(owner, 'live');
  assert.equal(d.orders.find(x => x.id === o.id).cashback, 24000);

  await s.execute(owner, 'live', { action: 'settle', id: o.id, reference: 'SHOPEE-COMM-2026' });
  assert.equal((await s.snapshot(owner, 'live')).available, 409600);

  await s.execute(owner, 'live', { action: 'import', csv: csv(30000) });
  assert.equal((await s.snapshot(owner, 'live')).available, 409600);

  await assert.rejects(() => s.execute(owner, 'live', { action: 'import', csv: csv(10000, 'rejected') }), /mở rút tiền/);
  await assert.rejects(() => s.execute(owner, 'live', { action: 'import', csv: csv(20000, 'approved', 'missing') }), /Sub ID/);

  await s.init(customer, 'live');
  await assert.rejects(() => s.execute(customer, 'live', { action: 'settle', id: o.id, reference: 'HACK' }));
  await assert.rejects(() => s.execute(customer, 'live', { action: 'settings', shareBps: 10000, minWithdraw: 1000 }), /quyền quản trị/);

  // Unconfigured Shopee instance rejects link generation
  const unconfigured = await fixture({ mockShopee: false });
  await assert.rejects(() => unconfigured.execute(owner, 'live', { action: 'link', url: 'https://shopee.vn/product/1/2' }), /Chưa kết nối/);

  const live = await s.snapshot(customer, 'live');
  assert.equal(live.admin, null);
  assert.equal(live.orders.length, 0);
});

test('Strict admin authorization: customers cannot call admin APIs, 2 admins concurrency protection, lock guard', async () => {
  const s = await fixture();
  // Insert users into auth_users
  s.DB.db.prepare("INSERT INTO auth_users(id, email, name, role, status, verified, created_at) VALUES('owner', 'owner@example.test', 'Owner', 'admin', 'active', 1, '2026-10-15T00:00:00Z')").run();
  s.DB.db.prepare("INSERT INTO auth_users(id, email, name, role, status, verified, created_at) VALUES('customer', 'customer@example.test', 'Customer', 'customer', 'active', 1, '2026-10-15T00:00:00Z')").run();

  // 1. Customer cannot call admin APIs
  await assert.rejects(() => s.execute(customer, 'live', { action: 'adminOverview' }), /quyền quản trị/);
  await assert.rejects(() => s.execute(customer, 'live', { action: 'adminUsers' }), /quyền quản trị/);
  await assert.rejects(() => s.execute(customer, 'live', { action: 'adminToggleLock', targetUserId: 'owner', lock: true, reason: 'Hack' }), /quyền quản trị/);

  // 2. Admin overview returns valid database metrics
  const ov = await s.execute(owner, 'live', { action: 'adminOverview' });
  assert.equal(ov.overview.usersCount, 2);
  assert.equal(ov.overview.activeUsers, 2);

  // 3. Admin lock customer account
  const lockRes = await s.execute(owner, 'live', { action: 'adminToggleLock', targetUserId: 'customer', lock: true, reason: 'Vi phạm điều khoản hoàn tiền' });
  assert.ok(lockRes.message.includes('Đã khóa'));
  const lockedCustRow = s.DB.db.prepare("SELECT * FROM auth_users WHERE id='customer'").get();
  assert.equal(lockedCustRow.status, 'locked');
  assert.equal(lockedCustRow.locked_reason, 'Vi phạm điều khoản hoàn tiền');

  // 4. Admin cannot self-lock
  await assert.rejects(() => s.execute(owner, 'live', { action: 'adminToggleLock', targetUserId: 'owner', lock: true, reason: 'Self lock' }), /chính mình/);

  // 5. Admin unlock customer
  await s.execute(owner, 'live', { action: 'adminToggleLock', targetUserId: 'customer', lock: false });
  const unlockedCustRow = s.DB.db.prepare("SELECT * FROM auth_users WHERE id='customer'").get();
  assert.equal(unlockedCustRow.status, 'active');

  // 6. Concurrency protection when 2 admins process the same withdrawal
  // Setup a pending withdrawal
  await s.init(customer, 'live');
  // Inject available balance for customer
  s.DB.db.prepare("INSERT INTO orders(id, external_key, external_id, account_id, tracking_id, product, amount, commission, cashback, share_bps, status, settlement_ref, created_at) VALUES('o1', 'live:test-order', 'SP1', 'live:customer', 'sub1', 'Product', 100000, 10000, 80000, 8000, 'available', 'REF1', '2026-10-15T00:00:00Z')").run();
  await s.execute(customer, 'live', { action: 'withdraw', amount: 50000, requestKey: crypto.randomUUID(), ...bank });
  const wRow = s.DB.db.prepare("SELECT * FROM withdrawals WHERE account_id='live:customer' AND status='pending'").get();
  assert.ok(wRow);

  // Admin 1 moves from pending -> processing
  await s.execute(owner, 'live', { action: 'processWithdraw', id: wRow.id, status: 'processing' });

  // Admin 2 attempts to move from pending -> processing simultaneously
  await assert.rejects(() => s.execute(owner, 'live', { action: 'processWithdraw', id: wRow.id, status: 'processing' }), /Trạng thái đã thay đổi/);

  // Admin marks as paid with reference
  await s.execute(owner, 'live', { action: 'processWithdraw', id: wRow.id, status: 'paid', reference: 'VCB-TX-9999' });
  const paidRow = s.DB.db.prepare("SELECT * FROM withdrawals WHERE id=?").get(wRow.id);
  assert.equal(paidRow.status, 'paid');
  assert.equal(paidRow.reference, 'VCB-TX-9999');

  // Cannot revert a paid withdrawal back to pending or rejected
  await assert.rejects(() => s.execute(owner, 'live', { action: 'processWithdraw', id: wRow.id, status: 'rejected', note: 'Wrong' }), /Trạng thái đã thay đổi/);
});

test('Dynamic Shopee Open API and Admin User IDs configuration lifecycle', async () => {
  const s = await fixture({ mockShopee: true });
  await s.init(owner, 'live');

  // Customer cannot save Shopee config
  await assert.rejects(() => s.execute(customer, 'live', {
    action: 'saveShopeeConfig',
    shopeeAppId: 'new_app_id',
    shopeeAppSecret: 'new_app_secret',
    shopeeEnabled: 'true',
    adminUserIds: 'new_admin_id'
  }), /quyền quản trị/);

  // Admin saves config
  const saveRes = await s.execute(owner, 'live', {
    action: 'saveShopeeConfig',
    shopeeAppId: 'custom_shopee_id',
    shopeeAppSecret: 'custom_shopee_secret',
    shopeeEnabled: 'true',
    adminUserIds: 'new_admin_user, another_admin'
  });
  assert.match(saveRes.message, /thành công/);

  // Verify snapshot reflects custom config
  const d = await s.snapshot(owner, 'live');
  assert.equal(d.settings.shopee_app_id, 'custom_shopee_id');
  assert.equal(d.settings.shopee_app_secret, 'custom_shopee_secret');
  assert.equal(d.settings.shopee_enabled, 'true');
  assert.ok(d.settings.admin_user_ids.includes('new_admin_user'));
  assert.equal(d.connected, true);
  assert.equal(d.integrationEnabled, true);

  // Verify new_admin_user has admin access now
  const newAdminUser = { userId: 'new_admin_user', email: 'newadmin@test.vn', role: 'customer', status: 'active' };
  assert.equal(s.isAdmin(newAdminUser, d.settings), true);

  // Disable Shopee via config
  await s.execute(owner, 'live', {
    action: 'saveShopeeConfig',
    shopeeAppId: 'custom_shopee_id',
    shopeeAppSecret: 'custom_shopee_secret',
    shopeeEnabled: 'false',
    adminUserIds: 'new_admin_user'
  });
  const disabledSnap = await s.snapshot(owner, 'live');
  assert.equal(disabledSnap.integrationEnabled, false);
  await assert.rejects(() => s.execute(owner, 'live', { action: 'link', url: 'https://shopee.vn/product/1/2' }), /Chưa kết nối Shopee Affiliate/);
});

