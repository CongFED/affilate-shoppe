export const SESSION_COOKIE='__Host-hoanly_session';
export const OAUTH_COOKIE='__Host-hoanly_oauth';
export const MAX_SESSION_AGE=7*24*60*60;
export type AppUser={userId:string;displayName:string;email:string;fullName:string|null;emailVerified?:boolean;role?:'admin'|'customer';status?:'active'|'locked';lockedAt?:string|null;lockedReason?:string|null};
export function randomToken(){return Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');}
export async function sha256(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');}
export function safeEqual(a:string,b:string){if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
export function normalizeEmail(value:unknown){const email=String(value??'').trim().toLowerCase();if(email==='admin')return 'admin@hoanly.vn';if(email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Vui lòng nhập địa chỉ email hợp lệ.');return email;}
export function checkPassword(value:unknown){if(typeof value!=='string'||value.length<8||value.length>128||!/[A-Za-z]/.test(value)||!/[0-9]/.test(value))throw new Error('Mật khẩu cần từ 8 đến 128 ký tự (khuyến nghị từ 12 ký tự), gồm cả chữ và số.');return value;}
export async function passwordHash(password:string,salt=randomToken().slice(0,32)){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode(salt),iterations:100000},key,256);
 return `pbkdf2-sha256$100000$${salt}$${Array.from(new Uint8Array(bits),b=>b.toString(16).padStart(2,'0')).join('')}`;
}
export async function verifyPassword(password:string,hash:string){const parts=hash.split('$');if(parts.length!==4||parts[0]!=='pbkdf2-sha256'||parts[1]!=='100000'||!/^[a-f0-9]{32}$/.test(parts[2])||!/^[a-f0-9]{64}$/.test(parts[3]))return false;return safeEqual(await passwordHash(password,parts[2]),hash);}
export function authCookie(name:string,value:string,maxAge:number){return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;}
export function readCookie(header:string|null,name:string){return header?.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)??'';}
export function decodeJwtPart(part:string){if(part.length>20000)throw new Error('Token Google không hợp lệ.');const b=atob(part.replace(/-/g,'+').replace(/_/g,'/'));return JSON.parse(new TextDecoder().decode(Uint8Array.from(b,c=>c.charCodeAt(0))));}
export function validateGoogleClaims(claims:Record<string,unknown>,clientId:string,nonce:string){
 const time=Math.floor(Date.now()/1000);
 if(!['https://accounts.google.com','accounts.google.com'].includes(String(claims.iss))||claims.aud!==clientId||(claims.azp&&claims.azp!==clientId)||typeof claims.exp!=='number'||claims.exp<=time||typeof claims.iat!=='number'||claims.iat>time+60||claims.nonce!==nonce||typeof claims.sub!=='string'||!claims.sub||claims.sub.length>255||claims.email_verified!==true)throw new Error('Không xác minh được phiên đăng nhập Google. Vui lòng thử lại.');
 return {sub:claims.sub,email:normalizeEmail(claims.email),name:String(claims.name??claims.email).slice(0,100)};
}
