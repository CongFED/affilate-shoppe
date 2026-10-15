export function shopeeUrl(value: unknown): string {
 if(typeof value!=='string'||value.length>2500) throw new Error('Vui lòng nhập một link Shopee hợp lệ.');
 const matches=value.match(/https:\/\/[^\s<>]+/g); if(!matches||matches.length!==1) throw new Error('Hãy dán một link Shopee, bắt đầu bằng https://.');
 let u:URL; try {u=new URL(matches[0]);} catch {throw new Error('Link không hợp lệ.');}
 if(u.protocol!=='https:'||u.username||u.password||u.port||!['shopee.vn','www.shopee.vn','s.shopee.vn','shope.ee','vn.shp.ee'].includes(u.hostname)) throw new Error('Chỉ hỗ trợ link Shopee Việt Nam và link chia sẻ chính thức.');
 u.hash='';return u.href;
}
export function integerMoney(value:unknown, label='Số tiền', max=1000000000):number { const n=Number(value);if(value===''||value===null||!Number.isSafeInteger(n)||n<0||n>max) throw new Error(`${label} phải là số nguyên VND từ 0 đến ${max.toLocaleString('vi-VN')}.`);return n; }
export function cashback(commission:number, bps:number){return Math.floor(commission*bps/10000);}
export function bankDetails(v:Record<string,unknown>){
 const bank=String(v.bank??'').trim(),bankNumber=String(v.bankNumber??'').replace(/\s/g,''),bankName=String(v.bankName??'').trim().toUpperCase();
 if(bank.length<2||bank.length>80||!/^\d{6,24}$/.test(bankNumber)||bankName.length<3||bankName.length>100)throw new Error('Điền ngân hàng, số tài khoản 6–24 chữ số và họ tên chủ tài khoản.');return {bank,bankNumber,bankName};
}
export function csvRows(input:string):Record<string,string>[] {
 if(input.length>300000)throw new Error('File CSV tối đa 300 KB.');
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
 for(let i=0;i<input.length;i++){const c=input[i];if(c==='"'){if(quoted&&input[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&input[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';}else cell+=c;}
 if(quoted)throw new Error('CSV có dấu ngoặc kép chưa đóng.');row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
 const headers=rows.shift()?.map(x=>x.replace(/^\uFEFF/,'').trim())??[];
 const required=['order_id','sub_id','product','amount','commission','status','date'];if(!required.every(x=>headers.includes(x)))throw new Error('CSV cần các cột: '+required.join(', '));if(rows.length>200)throw new Error('Mỗi lần nhập tối đa 200 dòng.');
 return rows.map((r,i)=>{if(r.length!==headers.length)throw new Error(`Dòng ${i+2} không đủ cột.`);return Object.fromEntries(headers.map((h,k)=>[h,r[k].trim()]));});
}
export function nextOrderStatus(from:string,to:string){if(['available'].includes(from)&&to!==from)throw new Error('Đơn đã mở rút tiền không thể sửa qua nhập báo cáo.');if(from==='approved'&&to==='pending')throw new Error('Không thể đưa đơn đã duyệt về chờ xác nhận.');if(!['pending','approved','rejected'].includes(to)&&to!==from)throw new Error('Trạng thái báo cáo không hợp lệ.');return to;}
