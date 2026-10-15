import { shopeeUrl } from './domain';
export async function createAffiliateLink(url:string,subId:string,appId:string,secret:string){
 const origin=shopeeUrl(url);
 const payload=JSON.stringify({query:`mutation { generateShortLink(input: { originUrl: ${JSON.stringify(origin)}, subIds: [${JSON.stringify(subId)}] }) { shortLink } }`});
 const timestamp=String(Math.floor(Date.now()/1000));
 const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(appId+timestamp+payload+secret));
 const signature=Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
 const res=await fetch('https://open-api.affiliate.shopee.vn/graphql',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`SHA256 Credential=${appId}, Signature=${signature}, Timestamp=${timestamp}`},body:payload,signal:AbortSignal.timeout(15000)});
 if(!res.ok)throw new Error('Shopee chưa trả kết quả. Vui lòng thử lại sau.');
 const data=await res.json() as {data?:{generateShortLink?:{shortLink?:string}},errors?:unknown[]};
 if(data.errors?.length||!data.data?.generateShortLink?.shortLink)throw new Error('Shopee chưa cấp link. Hãy kiểm tra quyền Open API và cấu hình tài khoản affiliate.');
 return shopeeUrl(data.data.generateShortLink.shortLink);
}
