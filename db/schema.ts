import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const accounts = sqliteTable('accounts', {
 id:text('id').primaryKey(), userId:text('user_id').notNull(), mode:text('mode').notNull(), name:text('name').notNull(), email:text('email').notNull(), trackingId:text('tracking_id').notNull().unique(), bank:text('bank').notNull().default(''), bankNumber:text('bank_number').notNull().default(''), bankName:text('bank_name').notNull().default(''), createdAt:text('created_at').notNull()
});
export const settings = sqliteTable('settings', {
  id: text('id').primaryKey(),
  shareBps: integer('share_bps').notNull().default(8000),
  minWithdraw: integer('min_withdraw').notNull().default(50000),
  shopeeAppId: text('shopee_app_id').notNull().default(''),
  shopeeAppSecret: text('shopee_app_secret').notNull().default(''),
  shopeeEnabled: text('shopee_enabled').notNull().default('false'),
  adminUserIds: text('admin_user_ids').notNull().default('')
});
export const links = sqliteTable('links', {id:text('id').primaryKey(), accountId:text('account_id').notNull().references(()=>accounts.id), originalUrl:text('original_url').notNull(), affiliateUrl:text('affiliate_url').notNull(), trackingId:text('tracking_id').notNull().unique(), createdAt:text('created_at').notNull()});
export const orders = sqliteTable('orders', {id:text('id').primaryKey(), externalKey:text('external_key').notNull().unique(), externalId:text('external_id').notNull(), accountId:text('account_id').notNull().references(()=>accounts.id), trackingId:text('tracking_id').notNull(), product:text('product').notNull(), amount:integer('amount').notNull(), commission:integer('commission').notNull(), cashback:integer('cashback').notNull(), shareBps:integer('share_bps').notNull(), status:text('status').notNull(), settlementRef:text('settlement_ref').notNull().default(''), createdAt:text('created_at').notNull()});
export const withdrawals = sqliteTable('withdrawals', {id:text('id').primaryKey(), requestKey:text('request_key').notNull().unique(), accountId:text('account_id').notNull().references(()=>accounts.id), amount:integer('amount').notNull(), bank:text('bank').notNull(), bankNumber:text('bank_number').notNull(), bankName:text('bank_name').notNull(), status:text('status').notNull(), reference:text('reference').notNull().default(''), note:text('note').notNull().default(''), processedBy:text('processed_by').notNull().default(''), createdAt:text('created_at').notNull(), updatedAt:text('updated_at').notNull()});
export const audit = sqliteTable('audit', {id:text('id').primaryKey(), actor:text('actor').notNull(), scope:text('scope').notNull(), action:text('action').notNull(), detail:text('detail').notNull(), createdAt:text('created_at').notNull()});

export const authUsers = sqliteTable('auth_users', {id:text('id').primaryKey(),email:text('email').notNull().unique(),name:text('name').notNull(),passwordHash:text('password_hash'),googleSub:text('google_sub').unique(),role:text('role').notNull().default('customer'),status:text('status').notNull().default('active'),lockedAt:text('locked_at'),lockedReason:text('locked_reason'),verified:integer('verified').notNull().default(0),createdAt:text('created_at').notNull()});
export const authSessions = sqliteTable('auth_sessions', {tokenHash:text('token_hash').primaryKey(),userId:text('user_id').notNull().references(()=>authUsers.id),expiresAt:integer('expires_at').notNull(),createdAt:text('created_at').notNull()});
export const authRate = sqliteTable('auth_rate', {id:text('id').primaryKey(),attempts:integer('attempts').notNull(),expiresAt:integer('expires_at').notNull()});
export const authOauth = sqliteTable('auth_oauth', {stateHash:text('state_hash').primaryKey(),verifier:text('verifier').notNull(),nonce:text('nonce').notNull(),expiresAt:integer('expires_at').notNull()});
