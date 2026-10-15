import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import vm from 'node:vm';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

class D1{
  constructor(){
    this.db = new DatabaseSync(':memory:');
    this.db.exec('PRAGMA foreign_keys=ON');
    for(const file of fs.readdirSync('drizzle').filter(x=>x.endsWith('.sql')).sort()){
      this.db.exec(fs.readFileSync('drizzle/'+file, 'utf8'));
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
  async batch(statements){
    this.db.exec('BEGIN');
    try {
      const r = [];
      for(const s of statements) r.push(await s.run());
      this.db.exec('COMMIT');
      return r;
    } catch(e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
}

async function fixture(){
  const DB = new D1(), env = { DB };
  let fetcher = () => { throw new Error('Unexpected fetch'); };
  const ctx = vm.createContext({
    console,
    crypto: globalThis.crypto,
    TextEncoder,
    TextDecoder,
    URL,
    URLSearchParams,
    AbortSignal,
    Date,
    atob,
    btoa,
    fetch: (...args) => fetcher(...args)
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

  const service = await mod('lib/auth-service.ts');
  await service.evaluate();
  const core = await mod('lib/auth-core.ts');
  return { DB, env, setFetch: f => fetcher = f, ...service.namespace, ...core.namespace };
}

const password = 'DemoPassword-2026-only';

test('Email signup/login/session: hash passwords, preserve verified legacy ownership, revoke logout, reject expired tokens', async () => {
  const s = await fixture(), legacy = { userId: 'old-owner', email: 'owner@example.test', displayName: 'Owner', fullName: 'Owner' };
  const owner = await s.registerAccount('OWNER@example.test', password, 'Chủ website', legacy);
  assert.equal(owner.userId, 'old-owner');
  assert.equal(owner.role, 'customer');
  assert.equal(owner.status, 'active');

  const row = s.DB.db.prepare('SELECT * FROM auth_users WHERE id=?').get(owner.userId);
  assert.notEqual(row.password_hash, password);
  assert.match(row.password_hash, /pbkdf2/);

  assert.equal((await s.loginAccount('owner@example.test', password)).userId, owner.userId);
  await assert.rejects(() => s.loginAccount('owner@example.test', 'WrongPassword-2026'), /chưa đúng/);
  await assert.rejects(() => s.loginAccount('missing@example.test', password), /chưa đúng/);
  await assert.rejects(() => s.registerAccount('owner@example.test', password, 'Duplicate'), /Không thể tạo/);
  await assert.rejects(() => s.registerAccount('other@example.test', 'short', 'Other'), /12/);

  const another = await s.registerAccount('someone@example.test', password, 'Khách khác', legacy);
  assert.notEqual(another.userId, legacy.userId);

  const cookie = await s.issueSession(owner.userId);
  const token = s.readCookie(cookie, s.SESSION_COOKIE);
  assert.ok(cookie.includes('HttpOnly; Secure; SameSite=Lax'));
  assert.equal((await s.sessionUser(token)).userId, owner.userId);

  const stored = s.DB.db.prepare('SELECT token_hash FROM auth_sessions').get();
  assert.notEqual(stored.token_hash, token);

  await s.destroySession(token);
  assert.equal(await s.sessionUser(token), null);

  const expCookie = await s.issueSession(owner.userId);
  const expToken = s.readCookie(expCookie, s.SESSION_COOKIE);
  s.DB.db.exec('UPDATE auth_sessions SET expires_at=0');
  assert.equal(await s.sessionUser(expToken), null);
  assert.equal(await s.sessionUser('forged-token'), null);
});

test('Locked account protection: locked user cannot log in and active sessions are rejected', async () => {
  const s = await fixture();
  const user = await s.registerAccount('locked@example.test', password, 'Khách bị khóa');
  const cookie = await s.issueSession(user.userId);
  const token = s.readCookie(cookie, s.SESSION_COOKIE);
  assert.equal((await s.sessionUser(token)).userId, user.userId);

  // Lock account
  s.DB.db.prepare("UPDATE auth_users SET status='locked', locked_reason='Vi phạm gian lận hoàn tiền' WHERE id=?").run(user.userId);

  // 1. Session user must return null for locked user
  assert.equal(await s.sessionUser(token), null);

  // 2. Login attempt must throw locked error
  await assert.rejects(() => s.loginAccount('locked@example.test', password), /bị khóa/);

  // 3. isAdmin helper must return false for locked user
  assert.equal(s.isAdmin({ ...user, role: 'admin', status: 'locked' }), false);

  // 4. Unlock account allows session again
  s.DB.db.prepare("UPDATE auth_users SET status='active', locked_reason=NULL WHERE id=?").run(user.userId);
  assert.equal((await s.sessionUser(token)).userId, user.userId);
  assert.equal((await s.loginAccount('locked@example.test', password)).userId, user.userId);
});

test('Rate limits and CSRF origin checks reject repeated credentials and cross-origin requests', async () => {
  const s = await fixture();
  const req = new Request(s.appOrigin() + '/api/auth/login', { method: 'POST', headers: { origin: s.appOrigin(), 'cf-connecting-ip': '192.0.2.5' } });
  s.requireSameOrigin(req);
  assert.throws(() => s.requireSameOrigin(new Request(s.appOrigin(), { headers: { origin: 'https://evil.example' } })), /không hợp lệ/);
  assert.throws(() => s.requireSameOrigin(new Request(s.appOrigin())), /không hợp lệ/);
  for (let i = 0; i < 10; i++) await s.authRateLimit(req, 'a@example.test');
  await assert.rejects(() => s.authRateLimit(req, 'a@example.test'), /15 phút/);
});

test('Google is disabled without credentials; with credentials state is cookie-bound, expiring and one-use', async () => {
  const s = await fixture();
  assert.equal(s.googleReady(), false);
  await assert.rejects(() => s.beginGoogle(), /chưa được cấu hình/);

  s.env.GOOGLE_CLIENT_ID = 'test-client';
  s.env.GOOGLE_CLIENT_SECRET = 'test-only';
  const auth = await s.beginGoogle(), url = new URL(auth.url), state = url.searchParams.get('state');

  assert.equal(url.origin, 'https://accounts.google.com');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('redirect_uri'), s.appOrigin() + '/api/auth/google/callback');

  await assert.rejects(() => s.finishGoogle(new Request(s.appOrigin() + '/api/auth/google/callback?state=' + state + '&code=test')), /không hợp lệ/);
  const rejected = new Request(s.appOrigin() + '/api/auth/google/callback?state=' + state + '&error=access_denied', { headers: { cookie: s.OAUTH_COOKIE + '=' + state } });
  await assert.rejects(() => s.finishGoogle(rejected), /chưa hoàn tất/);
  await assert.rejects(() => s.finishGoogle(rejected), /hết hạn/);
});

test('Google validates RSA signature, audience and nonce; keeps a stable sub and refuses email collision takeover', async () => {
  const s = await fixture();
  s.env.GOOGLE_CLIENT_ID = 'test-client';
  s.env.GOOGLE_CLIENT_SECRET = 'test-only';

  const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  jwk.kid = 'key1';
  const enc = o => Buffer.from(JSON.stringify(o)).toString('base64url');

  async function attempt({ sub = 'google-stable-1', email = 'google@example.test', nonceWrong = false, audWrong = false, badSig = false } = {}) {
    const auth = await s.beginGoogle(), url = new URL(auth.url), state = url.searchParams.get('state'),
      claims = {
        iss: 'https://accounts.google.com',
        aud: audWrong ? 'evil-client' : 'test-client',
        sub,
        email,
        email_verified: true,
        name: 'Google User',
        nonce: nonceWrong ? 'bad' : url.searchParams.get('nonce'),
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 300
      };
    const text = enc({ alg: 'RS256', kid: 'key1' }) + '.' + enc(claims),
      signature = Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(text))).toString('base64url');

    s.setFetch(async (input, options) => {
      if (String(input).includes('/token')) {
        assert.equal(options.body.get('client_secret'), 'test-only');
        assert.ok(options.body.get('code_verifier'));
        return Response.json({ id_token: text + '.' + (badSig ? 'AAAA' : signature) });
      }
      return Response.json({ keys: [jwk] });
    });

    return s.finishGoogle(new Request(s.appOrigin() + '/api/auth/google/callback?state=' + state + '&code=test', { headers: { cookie: s.OAUTH_COOKIE + '=' + state } }));
  }

  await assert.rejects(() => attempt({ nonceWrong: true }), /xác minh/);
  await assert.rejects(() => attempt({ audWrong: true }), /xác minh/);
  await assert.rejects(() => attempt({ badSig: true }), /Chữ ký/);

  const user = await attempt();
  assert.equal(user.emailVerified, true);
  assert.equal(user.role, 'customer');
  assert.equal(user.status, 'active');
  assert.equal((await attempt()).userId, user.userId);

  await s.registerAccount('collision@example.test', password, 'Email Owner');
  await assert.rejects(() => attempt({ sub: 'attacker-sub', email: 'collision@example.test' }), /đã có tài khoản/);
});

test('Change password lifecycle and admin username alias resolution', async () => {
  const s = await fixture();
  // Register user
  const user = await s.registerAccount('changepass@example.test', 'OldPassword123', 'Khách đổi pass');
  assert.equal((await s.loginAccount('changepass@example.test', 'OldPassword123')).userId, user.userId);

  // Wrong current password rejects
  await assert.rejects(() => s.changePassword(user.userId, 'WrongPass123', 'NewPassword123'), /hiện tại chưa chính xác/);

  // Duplicate password rejects
  await assert.rejects(() => s.changePassword(user.userId, 'OldPassword123', 'OldPassword123'), /không được trùng/);

  // Short password rejects
  await assert.rejects(() => s.changePassword(user.userId, 'OldPassword123', 'short'), /8/);

  // Successful change
  const res = await s.changePassword(user.userId, 'OldPassword123', 'NewPassword123');
  assert.equal(res.ok, true);

  // Old password now fails, new password succeeds
  await assert.rejects(() => s.loginAccount('changepass@example.test', 'OldPassword123'), /chưa đúng/);
  assert.equal((await s.loginAccount('changepass@example.test', 'NewPassword123')).userId, user.userId);

  // Admin alias test
  assert.equal(s.normalizeEmail('admin'), 'admin@hoanly.vn');
  assert.equal(s.normalizeEmail('ADMIN'), 'admin@hoanly.vn');
  assert.equal(s.normalizeEmail('  admin  '), 'admin@hoanly.vn');
});
