import {env} from 'cloudflare:workers';
import {authCookie,checkPassword,decodeJwtPart,MAX_SESSION_AGE,normalizeEmail,OAUTH_COOKIE,passwordHash,randomToken,readCookie,safeEqual,SESSION_COOKIE,sha256,validateGoogleClaims,verifyPassword,type AppUser} from './auth-core';
const db=()=>env.DB!;
const cfg=()=>env as unknown as Record<string,string>;
async function one(sql:string,...args:unknown[]):Promise<any>{return (await db().prepare(sql).bind(...args).all()).results[0];}
export const appOrigin=()=>cfg().AUTH_APP_ORIGIN||'https://hoanly-shopee.congyeuthuong21.chatgpt.site';
export const googleReady=()=>!!(cfg().GOOGLE_CLIENT_ID&&cfg().GOOGLE_CLIENT_SECRET);
export function requireSameOrigin(request:Request){if(request.headers.get('origin')!==appOrigin())throw new Error('Yêu cầu không hợp lệ. Vui lòng tải lại trang đăng nhập.');}
export async function authRateLimit(request:Request,email:string){
 const bucket=Math.floor(Date.now()/900000),ip=request.headers.get('cf-connecting-ip')??request.headers.get('oai-authenticated-user-id')??'unknown';
 for(const [label,value,limit] of [['ip',ip,30],['account',email,10]] as const){const key=`${label}:${bucket}:${await sha256(value)}`;
  const row=await one('INSERT INTO auth_rate(id,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET attempts=auth_rate.attempts+1 RETURNING attempts',key,Date.now()+900000);
  if(row.attempts>limit)throw new Error('Bạn đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút.');
 }
 // Prune short-lived auth data; no personal financial records are removed.
 await db().batch([db().prepare('DELETE FROM auth_rate WHERE expires_at<?').bind(Date.now()),db().prepare('DELETE FROM auth_sessions WHERE expires_at<?').bind(Date.now()),db().prepare('DELETE FROM auth_oauth WHERE expires_at<?').bind(Date.now())]);
}
async function newUserId(email:string,legacy?:AppUser|null){
 if(legacy&&normalizeEmail(legacy.email)===email&&!await one('SELECT id FROM auth_users WHERE id=?',legacy.userId))return legacy.userId;
 return 'app:'+crypto.randomUUID();
}
export function isAdmin(user:AppUser|null|undefined):boolean{
 if(!user||user.status==='locked')return false;
 if(user.role==='admin')return true;
 const adminIds=(cfg().ADMIN_USER_IDS??'').split(',').map(s=>s.trim()).filter(Boolean);
 return adminIds.includes(user.userId);
}
export async function checkAdmin(user:AppUser|null|undefined):Promise<boolean>{
 if(!user||user.status==='locked')return false;
 if(user.role==='admin')return true;
 if(isAdmin(user))return true;
 try{
  const row=await one('SELECT admin_user_ids FROM settings WHERE id=?','live');
  const dbIds=String(row?.admin_user_ids??'').split(',').map((s:string)=>s.trim()).filter(Boolean);
  return dbIds.includes(user.userId);
 }catch{
  return false;
 }
}
export async function registerAccount(emailValue:unknown,passwordValue:unknown,nameValue:unknown,legacy?:AppUser|null){
 const email=normalizeEmail(emailValue),password=checkPassword(passwordValue),name=String(nameValue??'').trim();if(name.length<2||name.length>100)throw new Error('Họ tên cần từ 2 đến 100 ký tự.');
 const hash=await passwordHash(password),id=await newUserId(email,legacy);
 const result=await db().prepare("INSERT INTO auth_users(id,email,name,password_hash,verified,role,status,created_at) VALUES(?,?,?,?,0,'customer','active',?) ON CONFLICT(email) DO NOTHING").bind(id,email,name,hash,new Date().toISOString()).run();
 if(!result.meta.changes)throw new Error('Không thể tạo tài khoản với email này. Bạn có thể thử đăng nhập hoặc sử dụng email khác.');
 return {userId:id,email,displayName:name,fullName:name,emailVerified:false,role:'customer',status:'active'} as AppUser;
}
export async function loginAccount(emailValue:unknown,passwordValue:unknown){
 const email=normalizeEmail(emailValue),password=typeof passwordValue==='string'?passwordValue:'';if(password.length>128)throw new Error('Email hoặc mật khẩu chưa đúng.');
 const row=await one('SELECT * FROM auth_users WHERE email=?',email);
 const fallback='pbkdf2-sha256$100000$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000';
 const valid=await verifyPassword(password,row?.password_hash??fallback);if(!row?.password_hash||!valid)throw new Error('Email hoặc mật khẩu chưa đúng.');
 if(row.status==='locked')throw new Error(row.locked_reason?`Tài khoản đã bị khóa: ${row.locked_reason}`:'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.');
 return asUser(row);
}
function asUser(row:any):AppUser{return {userId:row.id,email:row.email,displayName:row.name,fullName:row.name,emailVerified:row.verified===1,role:row.role==='admin'?'admin':'customer',status:row.status==='locked'?'locked':'active',lockedAt:row.locked_at||null,lockedReason:row.locked_reason||null};}
export async function issueSession(userId:string){const token=randomToken(),hash=await sha256(token);await db().prepare('INSERT INTO auth_sessions(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)').bind(hash,userId,Date.now()+MAX_SESSION_AGE*1000,new Date().toISOString()).run();return authCookie(SESSION_COOKIE,token,MAX_SESSION_AGE);}
export async function sessionUser(token:string):Promise<AppUser|null>{if(!/^[a-f0-9]{64}$/.test(token))return null;const row=await one('SELECT u.* FROM auth_users u JOIN auth_sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?',await sha256(token),Date.now());if(!row||row.status==='locked')return null;return asUser(row);}
export async function destroySession(token:string){if(token)await db().prepare('DELETE FROM auth_sessions WHERE token_hash=?').bind(await sha256(token)).run();return authCookie(SESSION_COOKIE,'',0);}
export async function beginGoogle(){
 if(!googleReady())throw new Error('Đăng nhập Google chưa được cấu hình. Bạn có thể tạo tài khoản bằng email.');
 const state=randomToken(),nonce=randomToken(),verifier=randomToken(),challengeBytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))),challenge=btoa(String.fromCharCode(...challengeBytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 await db().prepare('INSERT INTO auth_oauth(state_hash,verifier,nonce,expires_at) VALUES(?,?,?,?)').bind(await sha256(state),verifier,nonce,Date.now()+600000).run();
 const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');url.search=new URLSearchParams({client_id:cfg().GOOGLE_CLIENT_ID,redirect_uri:appOrigin()+'/api/auth/google/callback',response_type:'code',scope:'openid email profile',state,nonce,code_challenge:challenge,code_challenge_method:'S256',prompt:'select_account'}).toString();
 return {url:url.href,cookie:authCookie(OAUTH_COOKIE,state,600)};
}
export async function finishGoogle(request:Request,legacy?:AppUser|null){
 if(!googleReady())throw new Error('Google chưa được cấu hình.');const params=new URL(request.url).searchParams,state=params.get('state')??'',cookie=readCookie(request.headers.get('cookie'),OAUTH_COOKIE);
 if(!/^[a-f0-9]{64}$/.test(state)||!safeEqual(state,cookie))throw new Error('Phiên Google không hợp lệ hoặc đã hết hạn.');
 const row=await one('DELETE FROM auth_oauth WHERE state_hash=? AND expires_at>? RETURNING *',await sha256(state),Date.now());if(!row)throw new Error('Phiên Google đã hết hạn. Vui lòng thử lại.');
 if(params.get('error'))throw new Error('Bạn chưa hoàn tất đăng nhập Google.');const code=params.get('code');if(!code||code.length>4096)throw new Error('Google chưa cấp mã đăng nhập.');
 const response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:cfg().GOOGLE_CLIENT_ID,client_secret:cfg().GOOGLE_CLIENT_SECRET,redirect_uri:appOrigin()+'/api/auth/google/callback',grant_type:'authorization_code',code_verifier:row.verifier}),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error('Không thể xác minh với Google. Vui lòng thử lại.');const tokens=await response.json() as {id_token?:string};if(!tokens.id_token)throw new Error('Google chưa trả token đăng nhập.');
 const parts=tokens.id_token.split('.');if(parts.length!==3)throw new Error('Token Google không hợp lệ.');const header=decodeJwtPart(parts[0]);if(header.alg!=='RS256'||typeof header.kid!=='string')throw new Error('Chữ ký Google không hợp lệ.');
 const keysResponse=await fetch('https://www.googleapis.com/oauth2/v3/certs',{signal:AbortSignal.timeout(15000)});if(!keysResponse.ok)throw new Error('Chưa kiểm tra được chữ ký Google.');const keys=await keysResponse.json() as {keys:(JsonWebKey&{kid:string})[]};const jwk=keys.keys.find(k=>k.kid===header.kid);if(!jwk)throw new Error('Chưa xác minh được khóa Google. Vui lòng thử lại.');
 const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);const sig=Uint8Array.from(atob(parts[2].replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
 if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,sig,new TextEncoder().encode(parts[0]+'.'+parts[1])))throw new Error('Chữ ký Google không hợp lệ.');
 const profile=validateGoogleClaims(decodeJwtPart(parts[1]),cfg().GOOGLE_CLIENT_ID,row.nonce);
 let user=await one('SELECT * FROM auth_users WHERE google_sub=?',profile.sub);
 if(user){
  if(user.status==='locked')throw new Error(user.locked_reason?`Tài khoản đã bị khóa: ${user.locked_reason}`:'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.');
 }else{
  // Never merge an unverified email/password identity into a Google identity automatically.
  const collision=await one('SELECT id FROM auth_users WHERE email=?',profile.email);if(collision)throw new Error('Email này đã có tài khoản. Hãy đăng nhập bằng mật khẩu; chưa hỗ trợ gộp hai cách đăng nhập.');
  const id=await newUserId(profile.email,legacy);await db().prepare("INSERT INTO auth_users(id,email,name,google_sub,verified,role,status,created_at) VALUES(?,?,?,?,1,'customer','active',?)").bind(id,profile.email,profile.name,profile.sub,new Date().toISOString()).run();user=await one('SELECT * FROM auth_users WHERE id=?',id);
 }
 return asUser(user);
}

export async function changePassword(userId:string,currentPasswordValue:unknown,newPasswordValue:unknown){
 const currentPassword=typeof currentPasswordValue==='string'?currentPasswordValue:'';
 const newPassword=checkPassword(newPasswordValue);
 const row=await one('SELECT * FROM auth_users WHERE id=?',userId);
 if(!row)throw new Error('Không tìm thấy tài khoản người dùng.');
 if(row.status==='locked')throw new Error('Tài khoản của bạn đã bị khóa.');

 if(row.password_hash){
  const valid=await verifyPassword(currentPassword,row.password_hash);
  if(!valid)throw new Error('Mật khẩu hiện tại chưa chính xác.');
  if(await verifyPassword(newPassword,row.password_hash)){
   throw new Error('Mật khẩu mới không được trùng với mật khẩu hiện tại.');
  }
 }

 const hash=await passwordHash(newPassword);
 await db().prepare('UPDATE auth_users SET password_hash=? WHERE id=?').bind(hash,userId).run();

 try{
  await db().prepare('INSERT INTO audit(id, actor, scope, action, detail, created_at) VALUES(?,?,?,?,?,?)').bind(
   'aud:'+crypto.randomUUID(),
   row.email,
   'auth',
   'Đổi mật khẩu',
   `Tài khoản ${row.email} (${row.role}) đổi mật khẩu thành công`,
   new Date().toISOString()
  ).run();
 }catch{}

 return {ok:true,message:'Đổi mật khẩu thành công!'};
}
