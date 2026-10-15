# SANDEAL — Công cụ hoàn tiền Shopee

Ứng dụng tiếng Việt chạy với Vinext/React và Cloudflare D1. Đây là MVP có dữ liệu bền vững, tách dữ liệu mẫu và dữ liệu thật theo người dùng.

## Có sẵn

- Đăng ký và đăng nhập bằng email/mật khẩu; phiên đăng nhập cookie HttpOnly/Secure, lưu token băm trong D1. Đăng nhập Google OAuth có sẵn luồng máy chủ, cần cấu hình Client ID/Secret. Dữ liệu khách được phân quyền phía máy chủ.
- Tạo link mẫu hoặc gọi bộ chuyển đổi Shopee Affiliate Open API (khi được cấu hình).
- Mỗi link có Sub ID riêng để ghép báo cáo với đúng tài khoản.
- Theo dõi đơn, lọc/tìm, chi tiết tiền hoàn và xuất CSV.
- Ví: phân biệt chờ xác nhận, đã duyệt, có thể rút, đang giữ cho yêu cầu và đã thanh toán.
- Tạo yêu cầu rút nguyên tử có khóa chống gửi trùng, kiểm tra số dư ở database.
- Khách chỉ hủy được yêu cầu còn chờ; quản trị nhận xử lý rồi nhập mã giao dịch sau khi chuyển khoản thủ công.
- Nhập báo cáo chuẩn hóa CSV, giữ tỷ lệ chia đã chốt trên mỗi đơn, không cộng trùng mã dòng.
- Xác nhận hoa hồng đã về trước khi mở số dư có thể rút.
- Cài đặt tỷ lệ chia và mức rút tối thiểu; nhật ký thao tác quản trị.

## Giới hạn cần hoàn tất trước khi chạy cho khách thật

1. Website mẫu tienve.io.vn chỉ trả vỏ ứng dụng JavaScript qua trình đọc; việc mở giao diện tham chiếu bằng trình duyệt bị timeout. Giao diện SANDEAL được thiết kế mới theo luồng mô tả, không sao chép mã của website mẫu.
2. Chưa có App ID/Secret Shopee của chủ website; chưa thử được tạo link, thuộc tính Sub ID và ghi nhận chuyển đổi với tài khoản thật. Bộ chuyển đổi API để tắt mặc định. Phải đối chiếu hợp đồng API hiện hành trong tài khoản trước khi bật.
3. Đơn hàng hiện nhập bằng CSV chuẩn hóa từ báo cáo affiliate, chưa có đồng bộ tự động. Không giả lập đơn chỉ vì khách bấm link hoặc nhập mã đơn.
4. Không có tích hợp ngân hàng. Chủ website tự kiểm tra tiền hoa hồng đã về và chuyển khoản cho khách, sau đó ghi mã giao dịch.
5. Website hiện riêng tư cho chủ sở hữu ở lớp hosting. Bên trong đã có đăng ký/đăng nhập email và Google (Google chưa được cấu hình). Muốn khách vào trực tiếp mà không qua lớp truy cập nền tảng cần chủ sở hữu yêu cầu mở quyền truy cập công khai. Không tự mở công khai trong lần sửa đăng nhập này.
6. Đơn đã mở quyền rút bị khóa chỉnh qua import. Nếu có thu hồi hoa hồng sau thanh toán, cần quy trình điều chỉnh sổ và đối soát riêng; chưa hỗ trợ tự động đảo bút toán.
7. Lịch sử người dùng trong màn hình quản trị hiện hiển thị tối đa 500 đơn / 500 yêu cầu gần nhất; cần bổ sung phân trang cho quy mô lớn. Danh sách link gần nhất giới hạn 100.
8. Cần hoàn thiện điều khoản vận hành, liên hệ hỗ trợ và cơ chế xử lý khiếu nại của chủ website trước khi mở công khai.

## Kích hoạt dữ liệu thật

Cấu hình biến môi trường bảo mật (không nhập khóa vào mã nguồn):

- `ADMIN_USER_IDS`: mã người dùng trong Cài đặt (có thể phân cách nhiều mã bằng dấu phẩy).
- `SHOPEE_APP_ID`: App ID Open API do Shopee cấp.
- `SHOPEE_APP_SECRET`: khóa bí mật tương ứng.
- `SHOPEE_ENABLED`: chỉ đặt `true` sau khi kiểm tra kết nối và quyền tài khoản.

Sau khi cấu hình, làm mới, chọn Dữ liệu thật. Chủ tài khoản phải có quyền API và được phép triển khai mô hình vận hành dự định theo điều kiện tài khoản của họ.

Không chỉ thêm `affiliate_id` tùy ý vào URL. Bộ chuyển đổi gọi `generateShortLink` phía máy chủ, ký payload SHA-256 và truyền mã theo dõi theo từng link. Cần xác nhận schema hiện hành qua https://affiliate.shopee.vn/open_api/list bằng tài khoản của chủ website. Hợp đồng API chưa được xác minh trong phiên này do tài liệu chính thức yêu cầu JavaScript/đăng nhập.

## CSV đối soát

Các cột bắt buộc:

```csv
order_id,sub_id,product,amount,commission,status,date
SP001:ITEM001,hSUB_ID_TU_LINK,San pham,300000,30000,approved,2026-10-15
```

- Dùng mã dòng duy nhất nếu đơn có nhiều sản phẩm. Không nhập cùng mã đơn cho nhiều dòng hàng.
- `sub_id` phải trùng mã do hệ thống tạo. Hệ thống từ chối toàn bộ lần nhập nếu có dòng không ghép được.
- `amount`, `commission` là số nguyên VND, không dấu phân cách. `commission` cần là khoản hoa hồng được đối soát dùng làm cơ sở chia; chủ website phải xử lý phân bổ khấu trừ/thuế thực tế trước khi mở rút.
- `status`: pending, approved hoặc rejected. Không nhập available qua CSV.
- `date`: ISO date (YYYY-MM-DD) hoặc ISO datetime có timezone.
- Tỷ lệ chia mặc định 80% chỉ là cấu hình khởi tạo có thể đổi, không phải chính sách Shopee. Mức rút mặc định 50.000đ cũng có thể đổi.
- Tối đa 200 dòng / 300KB, UTF-8. Nhập lại cùng mã dòng sẽ cập nhật, không cộng trùng. Đơn đã mở rút không thể điều chỉnh qua import.
- Sau khi chủ website nhận hoa hồng thực tế: trang Quản trị → Đối soát đơn hàng → Xác nhận tiền về → nhập mã đối soát. Mỗi lần xác nhận phải khớp đúng khoản nhận thực tế.

## Kiểm thử

```sh
node node_modules/typescript/bin/tsc --noEmit
node --experimental-strip-types --test tests/domain.test.ts
node --experimental-vm-modules --test tests/service.test.mjs tests/auth.test.mjs
node /root/.codex/plugins/cache/openai-curated-remote/sites/1.0.0/scripts/build-site.mjs
```

Kiểm thử dịch vụ thực thi mã dịch vụ với database SQLite thật tương thích D1: chống rút vượt số dư, yêu cầu lặp, yêu cầu đồng thời, chuyển trạng thái chi trả, tách dữ liệu/người dùng, phân quyền, nhập lại báo cáo, giữ tỷ lệ chia và xác nhận tiền về. Chưa kiểm thử UI bằng trình duyệt vì môi trường không có kỹ năng control-browser; không khởi chạy server preview thay thế.


## Đăng nhập và tạo tài khoản

Đăng ký email tạo tài khoản thật trong D1 và đăng nhập ngay. Mật khẩu yêu cầu 12–128 ký tự gồm chữ và số, được băm PBKDF2-SHA256 100.000 vòng bằng Web Crypto (mức phù hợp giới hạn Workers), salt ngẫu nhiên riêng. Mật khẩu và token gốc không được ghi log hay trả về. Cookie phiên `__Host-hoanly_session`: Secure, HttpOnly, SameSite=Lax, Path=/, hạn 7 ngày; đăng xuất thu hồi bản ghi phiên. Giới hạn thử đăng nhập/đăng ký theo email và IP trong cửa sổ 15 phút. Các POST kiểm tra Origin phía máy chủ.

Chưa có gửi email xác minh hay khôi phục mật khẩu tự động. Không đánh dấu email đăng ký bằng mật khẩu là đã xác minh. Không dùng email như khóa sở hữu ví. Không tự động gộp tài khoản email và Google có cùng địa chỉ; nếu trùng, người dùng phải đăng nhập theo phương thức cũ. Khi người dùng đăng ký bằng đúng email của phiên nền tảng cũ đang được máy chủ xác thực, giữ mã người dùng cũ nếu chưa được gắn để bảo toàn link/đơn/ví và quyền quản trị cũ; không nhận mã người dùng này từ client.

### Bật Google

1. Tạo OAuth Client loại Web application trong Google Cloud, cấu hình consent screen và người thử nghiệm nếu app ở chế độ testing.
2. Authorized redirect URI chính xác:
   `https://hoanly-shopee.congyeuthuong21.chatgpt.site/api/auth/google/callback`
3. Thiết lập runtime secrets `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`. Không đưa Client Secret vào giao diện hay mã nguồn.
4. `AUTH_APP_ORIGIN` mặc định là URL hiện tại; cập nhật nếu đổi domain và cập nhật callback trong Google tương ứng.
5. Nút Google tự bật khi có đủ cấu hình. Chưa có credentials trong phiên triển khai nên chưa thử đăng nhập Google thật.

Luồng OAuth sử dụng state gắn với cookie, PKCE S256, nonce, code exchange phía máy chủ; kiểm tra chữ ký RS256 bằng JWKS Google cùng issuer, audience, expiry, nonce, email_verified. Chỉ giữ `sub` và thông tin hồ sơ cần thiết; không lưu access token hoặc refresh token. OAuth state có hạn 10 phút, dùng một lần. Đường callback này là `/api/auth/google/callback`, không ghi đè `/callback` do Sites quản lý.

Kiểm thử auth có đăng ký/đăng nhập, băm mật khẩu, thu hồi/hết hạn phiên, CSRF, rate limiting, giữ ownership cũ, state replay, chữ ký RSA, sai audience/nonce và ngăn chiếm tài khoản do email trùng. Google OAuth được kiểm thử với phản hồi ký bằng khóa RSA tạo trong bộ test, chưa phải xác nhận kết nối Google thật.
