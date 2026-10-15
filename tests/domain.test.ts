import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bankDetails,cashback,csvRows,integerMoney,nextOrderStatus,shopeeUrl} from '../lib/domain.ts';
test('Chấp nhận link Shopee và trích link chia sẻ; chặn hostname giả, credentials, port và HTTP',()=>{
 assert.equal(shopeeUrl('Mua ngay https://shopee.vn/product/1/2 nhé'),'https://shopee.vn/product/1/2');
 for(const u of ['http://shopee.vn','https://shopee.vn.evil.org','https://evil.org','https://user:password@shopee.vn','https://shopee.vn:8443','https://shopee.vn/a https://shopee.vn/b'])assert.throws(()=>shopeeUrl(u));
 assert.equal(shopeeUrl('https://s.shopee.vn/test'),'https://s.shopee.vn/test');
});
test('Tiền nguyên VND, không âm, không NaN/Infinity; chia hoa hồng làm tròn xuống',()=>{
 for(const n of [-1,1.5,'',null,NaN,Infinity,1000000001])assert.throws(()=>integerMoney(n));
 assert.equal(integerMoney('50000'),50000);assert.equal(cashback(12345,8000),9876);
});
test('CSV đọc BOM, quoted commas/newlines và CRLF; không nhận cột thiếu hoặc file lỗi',()=>{
 const rows=csvRows('\uFEFForder_id,sub_id,product,amount,commission,status,date\r\nO1,abc,"Sản phẩm, màu trắng",100000,12000,approved,2026-10-15\r\n');
 assert.equal(rows[0].product,'Sản phẩm, màu trắng');assert.equal(rows.length,1);
 assert.throws(()=>csvRows('order_id,sub_id\n1,2'));assert.throws(()=>csvRows('order_id,sub_id,product,amount,commission,status,date\n1,a,"broken'));
});
test('Không được giảm trạng thái đơn đã khả dụng hoặc quay lại chờ sau khi duyệt',()=>{
 assert.throws(()=>nextOrderStatus('available','rejected'));assert.throws(()=>nextOrderStatus('approved','pending'));assert.equal(nextOrderStatus('pending','approved'),'approved');
});
test('Thông tin ngân hàng đủ định dạng, giữ số 0 đầu',()=>{
 assert.equal(bankDetails({bank:'MB Bank',bankNumber:'0000 123456',bankName:'tài khoản demo'}).bankNumber,'0000123456');
 assert.throws(()=>bankDetails({bank:'MB',bankNumber:'abc',bankName:'A'}));
});
