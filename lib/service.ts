import { env } from 'cloudflare:workers';
import { bankDetails, cashback, csvRows, integerMoney, nextOrderStatus, shopeeUrl } from './domain';
import { createAffiliateLink } from './shopee';
import type { AppUser } from './auth-core';
type Row=Record<string,any>;
const vars=()=>env as unknown as Record<string,string>;
const db=()=>env.DB!;
const id=()=>crypto.randomUUID();
const now=()=>new Date().toISOString();
export async function all(sql:string,...args:unknown[]):Promise<Row[]>{return (await db().prepare(sql).bind(...args).all()).results as Row[];}
async function one(sql:string,...args:unknown[]):Promise<Row|undefined>{return (await all(sql,...args))[0];}

let columnsChecked = false;
async function ensureSettingsColumns() {
 if (columnsChecked) return;
 const cols = [
  'shopee_app_id text DEFAULT "" NOT NULL',
  'shopee_app_secret text DEFAULT "" NOT NULL',
  'shopee_enabled text DEFAULT "false" NOT NULL',
  'admin_user_ids text DEFAULT "" NOT NULL'
 ];
 for (const col of cols) {
  try {
   await db().prepare(`ALTER TABLE settings ADD ${col}`).run();
  } catch {}
 }
 columnsChecked = true;
}

export function getEffectiveConfig(settingsRow?: Row | null) {
 const v = vars();
 const shopeeAppId = String(settingsRow?.shopee_app_id || v.SHOPEE_APP_ID || '').trim();
 const shopeeAppSecret = String(settingsRow?.shopee_app_secret || v.SHOPEE_APP_SECRET || '').trim();
 
 const dbHasCustomConfig = !!(settingsRow?.shopee_app_id?.trim() || settingsRow?.shopee_app_secret?.trim());
 let shopeeEnabled = false;
 if (dbHasCustomConfig && settingsRow?.shopee_enabled !== undefined && settingsRow?.shopee_enabled !== null && settingsRow?.shopee_enabled !== '') {
  shopeeEnabled = String(settingsRow.shopee_enabled) === 'true';
 } else {
  shopeeEnabled = v.SHOPEE_ENABLED === 'true';
 }
 
 const dbAdminIds = String(settingsRow?.admin_user_ids || '').split(',').map(s => s.trim()).filter(Boolean);
 const envAdminIds = String(v.ADMIN_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
 const adminUserIds = Array.from(new Set([...dbAdminIds, ...envAdminIds]));

 const connected = !!(shopeeAppId && shopeeAppSecret);
 const integrationEnabled = shopeeEnabled && connected;

 return {
  shopeeAppId,
  shopeeAppSecret,
  shopeeEnabled,
  adminUserIds,
  connected,
  integrationEnabled
 };
}

async function syncDevVarsFile(config: { shopeeAppId?: string; shopeeAppSecret?: string; shopeeEnabled?: string; adminUserIds?: string }) {
 try {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const devVarsPath = path.resolve(process.cwd(), '.dev.vars');
  if (!fs.existsSync(devVarsPath)) return;
  let content = fs.readFileSync(devVarsPath, 'utf8');
  
  if (config.shopeeAppId !== undefined) {
   if (/^SHOPEE_APP_ID=.*$/m.test(content)) content = content.replace(/^SHOPEE_APP_ID=.*$/m, `SHOPEE_APP_ID=${config.shopeeAppId}`);
   else content += `\nSHOPEE_APP_ID=${config.shopeeAppId}`;
  }
  if (config.shopeeAppSecret !== undefined) {
   if (/^SHOPEE_APP_SECRET=.*$/m.test(content)) content = content.replace(/^SHOPEE_APP_SECRET=.*$/m, `SHOPEE_APP_SECRET=${config.shopeeAppSecret}`);
   else content += `\nSHOPEE_APP_SECRET=${config.shopeeAppSecret}`;
  }
  if (config.shopeeEnabled !== undefined) {
   if (/^SHOPEE_ENABLED=.*$/m.test(content)) content = content.replace(/^SHOPEE_ENABLED=.*$/m, `SHOPEE_ENABLED=${config.shopeeEnabled}`);
   else content += `\nSHOPEE_ENABLED=${config.shopeeEnabled}`;
  }
  if (config.adminUserIds !== undefined) {
   if (/^ADMIN_USER_IDS=.*$/m.test(content)) content = content.replace(/^ADMIN_USER_IDS=.*$/m, `ADMIN_USER_IDS=${config.adminUserIds}`);
   else content += `\nADMIN_USER_IDS=${config.adminUserIds}`;
  }
  fs.writeFileSync(devVarsPath, content, 'utf8');
 } catch {
  // Ignored on non-node or read-only environments
 }
}

export function isAdmin(user:AppUser|null|undefined, settingsRow?: Row | null){
 if(!user||user.status==='locked')return false;
 if(user.role==='admin')return true;
 const cfg = getEffectiveConfig(settingsRow);
 return cfg.adminUserIds.includes(user.userId);
}
function scope(user:AppUser,mode:string='live'){return 'live';}
function accountId(user:AppUser,mode:string='live'){return `live:${user.userId}`;}
function adminCheck(user:AppUser,mode:string='live', settingsRow?: Row | null){if(!isAdmin(user, settingsRow))throw new Error('Bạn chưa được cấp quyền quản trị.');}
async function log(user:AppUser,mode:string,action:string,detail:string){return db().prepare('INSERT INTO audit(id,actor,scope,action,detail,created_at) VALUES(?,?,?,?,?,?)').bind(id(),user.userId,'live',action,detail,now()).run();}

export async function init(user:AppUser,mode:string='live'){
 await ensureSettingsColumns();
 const aid=accountId(user,mode),time=now();
 await db().batch([
  db().prepare('INSERT OR IGNORE INTO accounts(id,user_id,mode,name,email,tracking_id,created_at) VALUES(?,?,?,?,?,?,?)').bind(aid,user.userId,'live',user.fullName??'Bạn',user.email,'u'+id().replaceAll('-','').slice(0,20),time),
  db().prepare('INSERT OR IGNORE INTO settings(id,share_bps,min_withdraw) VALUES(?,8000,50000)').bind('live')
 ]);
 return snapshot(user,mode);
}

export async function snapshot(user:AppUser,mode:string='live'){
 await ensureSettingsColumns();
 const aid=accountId(user,mode),sc='live';
 const [account,rawSettings,links,orders,withdrawals]=await Promise.all([
  one('SELECT * FROM accounts WHERE id=?',aid),
  one('SELECT * FROM settings WHERE id=?',sc),
  all('SELECT * FROM links WHERE account_id=? ORDER BY created_at DESC LIMIT 100',aid),
  all('SELECT * FROM orders WHERE account_id=? ORDER BY created_at DESC',aid),
  all('SELECT * FROM withdrawals WHERE account_id=? ORDER BY created_at DESC',aid)
 ]);
 const cfg = getEffectiveConfig(rawSettings);
 const available=orders.filter(o=>o.status==='available').reduce((s,o)=>s+o.cashback,0)-withdrawals.filter(w=>w.status!=='rejected').reduce((s,w)=>s+w.amount,0);
 let admin:Row|null=null;
 if(isAdmin(user, rawSettings)){
  const [adminOrders,adminWithdrawals,accounts,logs]=await Promise.all([
   all("SELECT o.*,a.name as customer,a.email FROM orders o JOIN accounts a ON o.account_id=a.id WHERE a.mode='live' ORDER BY o.created_at DESC LIMIT 500"),
   all("SELECT w.*,a.name as customer,a.email FROM withdrawals w JOIN accounts a ON w.account_id=a.id WHERE a.mode='live' ORDER BY w.created_at DESC LIMIT 500"),
   all("SELECT a.id,a.name,a.email,a.tracking_id FROM accounts a WHERE a.mode='live'"),
   all('SELECT * FROM audit WHERE scope=? ORDER BY created_at DESC LIMIT 30',sc)
  ]);
  admin={orders:adminOrders,withdrawals:adminWithdrawals,accounts,logs};
 }
 const settings = {
  ...rawSettings,
  share_bps: rawSettings?.share_bps ?? 8000,
  min_withdraw: rawSettings?.min_withdraw ?? 50000,
  shopee_app_id: cfg.shopeeAppId,
  shopee_app_secret: cfg.shopeeAppSecret,
  shopee_enabled: cfg.shopeeEnabled ? 'true' : 'false',
  admin_user_ids: cfg.adminUserIds.join(', ')
 };
 return {
  mode:'live',
  account,
  settings,
  links,
  orders,
  withdrawals,
  available,
  admin,
  isAdmin:isAdmin(user, rawSettings),
  userId:user.userId,
  connected:cfg.connected,
  integrationEnabled:cfg.integrationEnabled
 };
}

export async function execute(user:AppUser,mode:string,body:Row):Promise<Row>{
 await ensureSettingsColumns();
 const aid=accountId(user,mode),sc=scope(user,mode);
 const account=await one('SELECT * FROM accounts WHERE id=?',aid);if(!account)await init(user,mode);
 const action=body.action;
 if(action==='init')return {data:await init(user,mode)};
 if(action==='link'){
  const recent=await one('SELECT COUNT(*) AS n FROM links WHERE account_id=? AND created_at>?',aid,new Date(Date.now()-60000).toISOString());if((recent?.n??0)>=15)throw new Error('Bạn đã tạo nhiều link liên tiếp. Vui lòng thử lại sau một phút.');
  const url=shopeeUrl(body.url),linkId=id(),trackingId='h'+linkId.replaceAll('-','').slice(0,24);
  const setting=await one('SELECT * FROM settings WHERE id=?',sc);
  const cfg=getEffectiveConfig(setting);
  if(!cfg.integrationEnabled||!cfg.shopeeAppId||!cfg.shopeeAppSecret)throw new Error('Chưa kết nối Shopee Affiliate. Quản trị viên cần cấu hình SHOPEE_APP_ID, SHOPEE_APP_SECRET và bật SHOPEE_ENABLED trong trang Quản trị trước khi tạo link.');
  const affiliateUrl=await createAffiliateLink(url,trackingId,cfg.shopeeAppId,cfg.shopeeAppSecret);
  await db().prepare('INSERT INTO links(id,account_id,original_url,affiliate_url,tracking_id,created_at) VALUES(?,?,?,?,?,?)').bind(linkId,aid,url,affiliateUrl,trackingId,now()).run();
  return {message:'Đã tạo link affiliate Shopee.',result:{id:linkId,original_url:url,affiliate_url:affiliateUrl,tracking_id:trackingId}};
 }
 if(action==='bank'){
  const b=bankDetails(body);await db().prepare('UPDATE accounts SET bank=?,bank_number=?,bank_name=? WHERE id=?').bind(b.bank,b.bankNumber,b.bankName,aid).run();return {message:'Đã lưu tài khoản nhận tiền.'};
 }
 if(action==='withdraw'){
  const amount=integerMoney(body.amount),setting=await one('SELECT * FROM settings WHERE id=?',sc),b=bankDetails(body);
  if(amount<(setting?.min_withdraw??50000))throw new Error('Số tiền rút chưa đạt mức tối thiểu.');
  if(typeof body.requestKey!=='string'||!/^[a-f0-9-]{36}$/.test(body.requestKey))throw new Error('Mã yêu cầu không hợp lệ. Vui lòng tải lại trang.');
  const requestKey=aid+':'+body.requestKey,existing=await one('SELECT id FROM withdrawals WHERE request_key=?',requestKey);if(existing)return {message:'Yêu cầu này đã được ghi nhận.'};
  const time=now();
  const r=await db().prepare(`INSERT INTO withdrawals(id,request_key,account_id,amount,bank,bank_number,bank_name,status,reference,note,created_at,updated_at)
   SELECT ?,?,?,?,?,?,?,'pending','','',?,? WHERE
   COALESCE((SELECT SUM(cashback) FROM orders WHERE account_id=? AND status='available'),0)-COALESCE((SELECT SUM(amount) FROM withdrawals WHERE account_id=? AND status!='rejected'),0)>=? ON CONFLICT(request_key) DO NOTHING`).bind(id(),requestKey,aid,amount,b.bank,b.bankNumber,b.bankName,time,time,aid,aid,amount).run();
  if(!r.meta.changes)throw new Error('Số dư khả dụng không đủ hoặc yêu cầu đã được gửi. Vui lòng làm mới ví.');
  await log(user,mode,'Yêu cầu rút tiền',`${amount} VND`);return {message:'Đã gửi yêu cầu. Số tiền được giữ lại để chờ chuyển khoản.'};
 }
 if(action==='cancelWithdraw'){
  const r=await db().prepare("UPDATE withdrawals SET status='rejected',note='Khách hủy yêu cầu',updated_at=? WHERE id=? AND account_id=? AND status='pending'").bind(now(),String(body.id),aid).run();if(!r.meta.changes)throw new Error('Chỉ hủy được yêu cầu đang chờ xử lý.');return {message:'Đã hủy yêu cầu và trả số tiền về số dư khả dụng.'};
 }
 const currentSettings = await one('SELECT * FROM settings WHERE id=?', sc);
 adminCheck(user, mode, currentSettings);
 const ownedClause='',ownedArgs=[];
 if(action==='settings'){
  const rate=integerMoney(body.shareBps,'Tỷ lệ',10000),min=integerMoney(body.minWithdraw,'Mức rút tối thiểu',10000000);if(rate<1||min<1000)throw new Error('Tỷ lệ phải lớn hơn 0 và mức rút tối thiểu từ 1.000đ.');
  
  const hasShopeeFields = body.shopeeAppId !== undefined || body.shopeeAppSecret !== undefined || body.shopeeEnabled !== undefined || body.adminUserIds !== undefined;
  if(hasShopeeFields){
   const shopeeAppId = String(body.shopeeAppId ?? '').trim();
   const shopeeAppSecret = String(body.shopeeAppSecret ?? '').trim();
   const shopeeEnabled = body.shopeeEnabled === true || body.shopeeEnabled === 'true' ? 'true' : 'false';
   const adminUserIds = String(body.adminUserIds ?? '').trim();
   await db().prepare('UPDATE settings SET share_bps=?,min_withdraw=?,shopee_app_id=?,shopee_app_secret=?,shopee_enabled=?,admin_user_ids=? WHERE id=?')
    .bind(rate,min,shopeeAppId,shopeeAppSecret,shopeeEnabled,adminUserIds,sc).run();
   await syncDevVarsFile({ shopeeAppId, shopeeAppSecret, shopeeEnabled, adminUserIds });
   await log(user,mode,'Cập nhật chính sách & Cấu hình Shopee',`Chia ${rate/100}% hoa hồng; rút từ ${min} VND; Shopee: ${shopeeEnabled}`);
   return {message:'Đã lưu chính sách hoàn tiền và cấu hình Shopee thành công!'};
  } else {
   await db().prepare('UPDATE settings SET share_bps=?,min_withdraw=? WHERE id=?').bind(rate,min,sc).run();
   await log(user,mode,'Cập nhật chính sách',`Chia ${rate/100}% hoa hồng; rút từ ${min} VND`);
   return {message:'Đã lưu. Tỷ lệ mới áp dụng cho đơn được nhập mới.'};
  }
 }
 if(action==='saveShopeeConfig' || action==='updateShopeeConfig'){
  const shopeeAppId = String(body.shopeeAppId ?? '').trim();
  const shopeeAppSecret = String(body.shopeeAppSecret ?? '').trim();
  const shopeeEnabled = body.shopeeEnabled === true || body.shopeeEnabled === 'true' ? 'true' : 'false';
  const adminUserIds = String(body.adminUserIds ?? '').trim();
  await db().prepare('UPDATE settings SET shopee_app_id=?,shopee_app_secret=?,shopee_enabled=?,admin_user_ids=? WHERE id=?')
   .bind(shopeeAppId,shopeeAppSecret,shopeeEnabled,adminUserIds,sc).run();
  await syncDevVarsFile({ shopeeAppId, shopeeAppSecret, shopeeEnabled, adminUserIds });
  await log(user,mode,'Cập nhật cấu hình Shopee & Quản trị',`Enabled: ${shopeeEnabled}; App ID: ${shopeeAppId ? 'đã điền' : 'trống'}; Admin IDs: ${adminUserIds}`);
  return {message:'Đã lưu cấu hình Shopee Open API và Quản trị viên thành công!'};
 }
 if(action==='import'){
  const rows=csvRows(String(body.csv??''));if(!rows.length)throw new Error('CSV chưa có dữ liệu.');
  const statements:D1PreparedStatement[]=[];const seen=new Set<string>();const setting=await one('SELECT * FROM settings WHERE id=?',sc);
  for(const [index,row] of rows.entries()){
   if(!row.order_id||row.order_id.length>100||seen.has(row.order_id))throw new Error(`Dòng ${index+2}: mã đơn trống hoặc trùng trong file.`);seen.add(row.order_id);
   const link=await one("SELECT l.*,a.mode FROM links l JOIN accounts a ON l.account_id=a.id WHERE l.tracking_id=? AND a.mode='live'",row.sub_id);
   if(!link)throw new Error(`Dòng ${index+2}: Sub ID chưa khớp link do hệ thống tạo. Không thể xác định khách nhận hoàn tiền.`);
   const amount=integerMoney(row.amount,'Giá trị đơn'),commission=integerMoney(row.commission,'Hoa hồng');
   if(commission>amount||!row.product||row.product.length>250)throw new Error(`Dòng ${index+2}: kiểm tra tên sản phẩm và hoa hồng.`);
   if(!['pending','approved','rejected'].includes(row.status))throw new Error(`Dòng ${index+2}: status chỉ nhận pending, approved, rejected. Mở rút tiền ở bước xác nhận tiền về.`);
   const date=new Date(row.date);if(!Number.isFinite(+date))throw new Error(`Dòng ${index+2}: ngày không hợp lệ.`);
   const key=`live:${row.order_id}`,existing=await one('SELECT * FROM orders WHERE external_key=?',key),bps=existing?.share_bps??setting!.share_bps;
   if(existing&&existing.account_id!==link.account_id)throw new Error(`Dòng ${index+2}: đơn đã thuộc khách khác.`);
   if(existing?.status==='available'){
    if(existing.commission===commission&&existing.amount===amount&&row.status==='approved')continue;
    throw new Error(`Dòng ${index+2}: đơn đã mở rút tiền, cần đối soát riêng để điều chỉnh.`);
   }
   if(existing)nextOrderStatus(existing.status,row.status);
   statements.push(db().prepare(`INSERT INTO orders(id,external_key,external_id,account_id,tracking_id,product,amount,commission,cashback,share_bps,status,settlement_ref,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,'',?)
    ON CONFLICT(external_key) DO UPDATE SET product=excluded.product,amount=excluded.amount,commission=excluded.commission,cashback=excluded.cashback,status=excluded.status WHERE orders.status!='available' AND orders.account_id=excluded.account_id AND NOT(orders.status='approved' AND excluded.status='pending')`).bind(id(),key,row.order_id,link.account_id,row.sub_id,row.product,amount,commission,cashback(commission,bps),bps,row.status,date.toISOString()));
  }
  if(statements.length)await db().batch(statements);await log(user,mode,'Nhập báo cáo',`${rows.length} dòng`);return {message:`Đã đối soát ${rows.length} dòng. Nhập lại cùng mã đơn không cộng tiền trùng.`};
 }
 if(action==='settle'){
  if(typeof body.reference!=='string'||body.reference.trim().length<4||body.reference.length>150)throw new Error('Điền mã đối soát hoặc tham chiếu tiền hoa hồng đã về ngân hàng.');
  const order=await one("SELECT o.* FROM orders o JOIN accounts a ON o.account_id=a.id WHERE o.id=? AND a.mode='live'",String(body.id));
  if(!order||order.status!=='approved')throw new Error('Chỉ mở rút tiền cho đơn đã được duyệt.');
  const r=await db().prepare("UPDATE orders SET status='available',settlement_ref=? WHERE id=? AND status='approved'").bind(body.reference.trim(),order.id).run();if(!r.meta.changes)throw new Error('Đơn vừa được cập nhật. Vui lòng tải lại để đối soát.');await log(user,mode,'Xác nhận hoa hồng đã về',`${order.external_id}; ${body.reference}`);return {message:'Đã xác nhận tiền về. Tiền hoàn của đơn này có thể rút.'};
 }
 if(action==='processWithdraw'){
  const w=await one("SELECT w.* FROM withdrawals w JOIN accounts a ON w.account_id=a.id WHERE w.id=? AND a.mode='live'",String(body.id));
  if(!w)throw new Error('Không tìm thấy yêu cầu.');const status=String(body.status),reference=String(body.reference??'').trim(),note=String(body.note??'').trim();
  if(!(['pending'].includes(w.status)&&['processing','rejected'].includes(status)||w.status==='processing'&&['paid','rejected'].includes(status)))throw new Error('Trạng thái đã thay đổi. Vui lòng tải lại.');
  if(status==='paid'&&(reference.length<4||reference.length>150))throw new Error('Cần mã giao dịch chuyển khoản để xác nhận đã trả.');
  if(status==='rejected'&&(note.length<4||note.length>250))throw new Error('Cần lý do từ chối hoặc xác nhận giao dịch chưa chuyển thành công.');
  const adminActor=user.displayName?`${user.displayName} (${user.email})`:user.email;
  const r=await db().prepare('UPDATE withdrawals SET status=?,reference=?,note=?,processed_by=?,updated_at=? WHERE id=? AND status=?').bind(status,reference,note,adminActor,now(),w.id,w.status).run();if(!r.meta.changes)throw new Error('Yêu cầu đã được người khác cập nhật hoặc trạng thái không còn phù hợp.');
  await log(user,mode,'Xử lý rút tiền',`${w.id}; ${status}; ${reference||note}; Người xử lý: ${adminActor}`);return {message:status==='paid'?'Đã ghi nhận chuyển khoản. Công cụ không tự chuyển tiền.':status==='rejected'?'Đã từ chối và hoàn lại số dư.':'Đã nhận xử lý. Hãy chuyển khoản ngoài hệ thống rồi nhập mã giao dịch.'};
 }
 if(action==='adminOverview'){
  const [uTotal,uActive,uLocked,oCount,cashbackSum,commSum,pWithCount,pWithSum,paidWithSum]=await Promise.all([
   one('SELECT COUNT(*) AS c FROM auth_users'),
   one("SELECT COUNT(*) AS c FROM auth_users WHERE status='active'"),
   one("SELECT COUNT(*) AS c FROM auth_users WHERE status='locked'"),
   one("SELECT COUNT(*) AS c FROM orders o JOIN accounts a ON o.account_id=a.id WHERE a.mode='live'"),
   one("SELECT COALESCE(SUM(o.cashback),0) AS s FROM orders o JOIN accounts a ON o.account_id=a.id WHERE o.status!='rejected' AND a.mode='live'"),
   one("SELECT COALESCE(SUM(o.commission),0) AS s FROM orders o JOIN accounts a ON o.account_id=a.id WHERE o.status!='rejected' AND a.mode='live'"),
   one("SELECT COUNT(*) AS c FROM withdrawals w JOIN accounts a ON w.account_id=a.id WHERE w.status IN ('pending','processing') AND a.mode='live'"),
   one("SELECT COALESCE(SUM(w.amount),0) AS s FROM withdrawals w JOIN accounts a ON w.account_id=a.id WHERE w.status IN ('pending','processing') AND a.mode='live'"),
   one("SELECT COALESCE(SUM(w.amount),0) AS s FROM withdrawals w JOIN accounts a ON w.account_id=a.id WHERE w.status='paid' AND a.mode='live'")
  ]);
  return {overview:{usersCount:Number(uTotal?.c??0),activeUsers:Number(uActive?.c??0),lockedUsers:Number(uLocked?.c??0),ordersCount:Number(oCount?.c??0),totalCashback:Number(cashbackSum?.s??0),totalCommission:Number(commSum?.s??0),pendingWithdrawalsCount:Number(pWithCount?.c??0),pendingWithdrawalsAmount:Number(pWithSum?.s??0),paidWithdrawalsAmount:Number(paidWithSum?.s??0)}};
 }
 if(action==='adminUsers'){
  const q=String(body.query??'').trim().toLowerCase(),statusFilter=String(body.status??'all'),roleFilter=String(body.role??'all');
  const page=Math.max(1,Number(body.page)||1),pageSize=Math.min(100,Math.max(5,Number(body.pageSize)||10)),offset=(page-1)*pageSize;
  let whereClauses:string[]=[],params:unknown[]=[];
  if(q){whereClauses.push('(LOWER(name) LIKE ? OR LOWER(email) LIKE ? OR id LIKE ?)');params.push(`%${q}%`,`%${q}%`,`%${q}%`);}
  if(statusFilter!=='all'){whereClauses.push('status=?');params.push(statusFilter);}
  if(roleFilter!=='all'){whereClauses.push('role=?');params.push(roleFilter);}
  const whereSql=whereClauses.length?'WHERE '+whereClauses.join(' AND '):'';
  const countRow=await one(`SELECT COUNT(*) AS c FROM auth_users ${whereSql}`,...params);
  const total=Number(countRow?.c??0);
  const users=await all(`SELECT id,email,name,role,status,locked_at,locked_reason,created_at FROM auth_users ${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,...params,pageSize,offset);
  const userIds=users.map((u:Row)=>u.id);
  let statsMap:Record<string,Row>={};
  if(userIds.length){
   const placeholders=userIds.map(()=>'?').join(',');
   const accRows=await all(`SELECT a.user_id,
    COALESCE((SELECT COUNT(*) FROM orders o WHERE o.account_id=a.id),0) AS order_count,
    COALESCE((SELECT SUM(o.cashback) FROM orders o WHERE o.account_id=a.id AND o.status='available'),0) -
    COALESCE((SELECT SUM(w.amount) FROM withdrawals w WHERE w.account_id=a.id AND w.status!='rejected'),0) AS available,
    COALESCE((SELECT SUM(o.cashback) FROM orders o WHERE o.account_id=a.id AND o.status IN ('pending','approved')),0) AS pending_cashback,
    COALESCE((SELECT SUM(w.amount) FROM withdrawals w WHERE w.account_id=a.id AND w.status='paid'),0) AS total_withdrawn
    FROM accounts a WHERE a.mode=? AND a.user_id IN (${placeholders})`,mode,...userIds);
   for(const r of accRows)statsMap[r.user_id]=r;
  }
  const enriched=users.map((u:Row)=>({...u,stats:statsMap[u.id]??{order_count:0,available:0,pending_cashback:0,total_withdrawn:0}}));
  return {users:enriched,total,page,pageSize,totalPages:Math.ceil(total/pageSize)||1};
 }
 if(action==='adminUserDetail'){
  const targetUserId=String(body.targetUserId??'').trim();if(!targetUserId)throw new Error('Thiếu mã người dùng.');
  const targetUser=await one('SELECT id,email,name,role,status,locked_at,locked_reason,created_at FROM auth_users WHERE id=?',targetUserId);
  if(!targetUser)throw new Error('Không tìm thấy người dùng.');
  const targetAid=accountId(targetUser as AppUser,mode);
  const [targetAccount,targetOrders,targetWithdrawals]=await Promise.all([
   one('SELECT * FROM accounts WHERE id=?',targetAid),
   all('SELECT * FROM orders WHERE account_id=? ORDER BY created_at DESC LIMIT 50',targetAid),
   all('SELECT * FROM withdrawals WHERE account_id=? ORDER BY created_at DESC LIMIT 50',targetAid)
  ]);
  const available=targetOrders.filter(o=>o.status==='available').reduce((s,o)=>s+o.cashback,0)-targetWithdrawals.filter(w=>w.status!=='rejected').reduce((s,w)=>s+w.amount,0);
  const pendingCashback=targetOrders.filter(o=>['pending','approved'].includes(o.status)).reduce((s,o)=>s+o.cashback,0);
  const paidAmount=targetWithdrawals.filter(w=>w.status==='paid').reduce((s,w)=>s+w.amount,0);
  return {user:targetUser,account:targetAccount,orders:targetOrders,withdrawals:targetWithdrawals,financials:{available,pendingCashback,paidAmount}};
 }
 if(action==='adminToggleLock'){
  const targetUserId=String(body.targetUserId??'').trim(),lock=Boolean(body.lock),reason=String(body.reason??'').trim();
  if(!targetUserId)throw new Error('Thiếu mã người dùng.');
  if(targetUserId===user.userId)throw new Error('Bạn không thể tự khóa tài khoản của chính mình.');
  const targetUser=await one('SELECT * FROM auth_users WHERE id=?',targetUserId);
  if(!targetUser)throw new Error('Không tìm thấy người dùng.');
  if(lock){
   if(!reason||reason.length<4)throw new Error('Vui lòng nhập lý do khóa tài khoản (tối thiểu 4 ký tự).');
   if(targetUser.role==='admin'){
    const activeAdmins=Number((await one("SELECT COUNT(*) AS c FROM auth_users WHERE role='admin' AND status='active'"))?.c??0);
    if(activeAdmins<=1)throw new Error('Không thể khóa quản trị viên duy nhất còn lại.');
   }
   await db().prepare("UPDATE auth_users SET status='locked', locked_at=?, locked_reason=? WHERE id=?").bind(now(),reason,targetUserId).run();
   await db().prepare('DELETE FROM auth_sessions WHERE user_id=?').bind(targetUserId).run();
   await log(user,mode,'Khóa tài khoản',`${targetUser.email} (${targetUserId}): ${reason}`);
   return {message:'Đã khóa tài khoản và hủy các phiên đăng nhập.'};
  }else{
   await db().prepare("UPDATE auth_users SET status='active', locked_at=NULL, locked_reason=NULL WHERE id=?").bind(targetUserId).run();
   await log(user,mode,'Mở khóa tài khoản',`${targetUser.email} (${targetUserId})`);
   return {message:'Đã mở khóa tài khoản.'};
  }
 }
 if(action==='adminWithdrawals'){
  const q=String(body.query??'').trim().toLowerCase(),statusFilter=String(body.status??'all');
  const page=Math.max(1,Number(body.page)||1),pageSize=Math.min(100,Math.max(5,Number(body.pageSize)||10)),offset=(page-1)*pageSize;
  let whereClauses=["a.mode='live'"],params:unknown[]=[];
  if(q){whereClauses.push('(LOWER(w.id) LIKE ? OR LOWER(a.email) LIKE ? OR LOWER(a.name) LIKE ? OR w.bank_number LIKE ? OR LOWER(w.reference) LIKE ?)');params.push(`%${q}%`,`%${q}%`,`%${q}%`,`%${q}%`,`%${q}%`);}
  if(statusFilter!=='all'){whereClauses.push('w.status=?');params.push(statusFilter);}
  const whereSql=whereClauses.join(' AND ');
  const countRow=await one(`SELECT COUNT(*) AS c FROM withdrawals w JOIN accounts a ON w.account_id=a.id WHERE ${whereSql}`,...params);
  const total=Number(countRow?.c??0);
  const withdrawals=await all(`SELECT w.*,a.name AS customer,a.email FROM withdrawals w JOIN accounts a ON w.account_id=a.id WHERE ${whereSql} ORDER BY w.created_at DESC LIMIT ? OFFSET ?`,...params,pageSize,offset);
  return {withdrawals,total,page,pageSize,totalPages:Math.ceil(total/pageSize)||1};
 }
 throw new Error('Thao tác không được hỗ trợ.');
}
