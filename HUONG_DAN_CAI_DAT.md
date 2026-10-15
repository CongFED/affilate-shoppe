# SANDEAL — Hướng dẫn sử dụng mã nguồn

Gói này chứa toàn bộ mã nguồn của bản SANDEAL đã triển khai, gồm giao diện, API phía máy chủ, xác thực email/Google, logic tiền hoàn, schema và migration database, các bộ kiểm thử cùng mã framework hỗ trợ.

## 1. Cấu trúc chính

- `app/auth-screen.tsx`: giao diện đăng nhập và đăng ký.
- `app/cashback-app.tsx`: tổng quan, tạo link, đơn hàng, ví và quản trị.
- `app/api/auth/`: API đăng ký, đăng nhập, đăng xuất và Google OAuth.
- `app/api/action/route.ts`: API thao tác dữ liệu hoàn tiền.
- `lib/auth-core.ts`, `lib/auth-service.ts`: mật khẩu, phiên đăng nhập, OAuth.
- `lib/service.ts`: số dư, rút tiền, nhập báo cáo, đối soát.
- `lib/shopee.ts`: bộ chuyển đổi link qua Shopee Open API.
- `db/`, `drizzle/`: schema D1 và các migration SQL.
- `tests/`: kiểm thử nghiệp vụ và xác thực.
- `.env.example`: danh sách biến môi trường.
- `README.md`: mô tả đầy đủ tính năng, giới hạn và cấu hình.

Công nghệ: React + TypeScript, Vinext, Cloudflare Workers, Cloudflare D1/SQLite, Drizzle. Mã hiện tại dùng Cloudflare D1 thông qua binding `DB`; triển khai sang VPS/Node hoặc database khác cần điều chỉnh lớp runtime/database. Đây không phải dự án Next.js thuần để đưa nguyên trạng lên Vercel.

## 2. Chuẩn bị và cài đặt

Cài Node.js từ 22.13 trở lên; dùng phiên bản Node 24 khi chạy các kiểm thử có `node:sqlite`.

Mở Terminal/PowerShell trong thư mục `Hoanly_Source_Code`:

```sh
npm install -g pnpm@11.25.0
pnpm install --frozen-lockfile
```

Dùng lệnh cài pnpm trực tiếp ở trên; script `install:ci` trong mã nguồn là tiện ích cho môi trường xây dựng Linux ban đầu.

## 3. Cấu hình môi trường local

Tạo file `.dev.vars` từ `.dev.vars.example`. Các giá trị cần điền theo tài khoản của bạn:

```dotenv
AUTH_APP_ORIGIN=http://localhost:5173
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
SHOPEE_APP_ID=
SHOPEE_APP_SECRET=
SHOPEE_ENABLED=false
ADMIN_USER_IDS=
```

File `.dev.vars` được Cloudflare Vite/Wrangler dùng cho Worker local. `.env.example` chỉ là tài liệu tên biến; khi deploy, thiết lập các biến này trong runtime secrets của môi trường hosting. Không commit giá trị thật.

Giữ `SHOPEE_ENABLED=false` khi chưa kiểm tra quyền và kết nối Shopee. Đăng ký/đăng nhập email và chế độ dữ liệu mẫu không cần khóa Google hoặc Shopee.

Bản local sạch mặc định dùng execution profile `portable`; không cần thư mục công cụ nội bộ `.sites-runtime` của môi trường trước.

## 4. Tạo database local

Build một lần để sinh cấu hình Worker:

```sh
pnpm build
```

Áp dụng lần lượt hai migration, mỗi migration chỉ áp dụng một lần cho database local mới:

```sh
pnpm exec wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_worried_blacklash.sql
pnpm exec wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_wooden_betty_ross.sql
```

Sau đó chạy:

```sh
pnpm dev
```

Mở địa chỉ được Terminal in ra, mặc định là `http://localhost:5173`. `AUTH_APP_ORIGIN` phải khớp chính xác origin được mở, kể cả hostname và port. Dùng `localhost` như cấu hình trên, không tự đổi thành IP khác khi chưa cập nhật biến.

Cookie xác thực có Secure/HttpOnly và tên `__Host-`; môi trường production cần HTTPS. Nếu môi trường local/trình duyệt không chấp nhận cookie trên localhost, dùng HTTPS local và cập nhật origin tương ứng; không tắt cơ chế bảo vệ cookie khi đưa lên mạng.

Quy trình local trên được viết theo cấu trúc starter hiện có; gói xuất chưa được cài lại và kiểm thử bằng trình duyệt trên máy Windows riêng của bạn. Bản production trước khi đóng gói đã build thành công và qua kiểm thử nghiệp vụ/xác thực.

## 5. Bật đăng nhập Google

Trong Google Cloud, tạo OAuth Client loại Web application và cấu hình màn hình consent. Điền Client ID, Client Secret vào biến môi trường phía máy chủ.

Redirect URI của website hiện tại:

```text
https://hoanly-shopee.congyeuthuong21.chatgpt.site/api/auth/google/callback
```

Nếu chuyển sang domain khác, cập nhật `AUTH_APP_ORIGIN` và redirect URI trong Google Cloud theo đúng domain mới. Với môi trường local, đăng ký redirect URI local tương ứng, ví dụ:

```text
http://localhost:5173/api/auth/google/callback
```

Google OAuth hiện có luồng máy chủ và kiểm thử bằng phản hồi giả lập có chữ ký RSA; chưa kết nối Google thật vì chưa được cấu hình credentials. Tài khoản email/mật khẩu hoạt động độc lập. Chưa có gửi email xác minh hoặc khôi phục mật khẩu tự động.

## 6. Shopee và quản trị

Để tạo link affiliate thật, cần `SHOPEE_APP_ID`, `SHOPEE_APP_SECRET`, quyền Open API hợp lệ và kiểm tra schema hiện hành với tài khoản của bạn. Sau khi kiểm tra mới bật `SHOPEE_ENABLED=true`.

Trong giao diện Cài đặt, sao chép mã người dùng và thêm vào `ADMIN_USER_IDS` để cấp quyền quản trị dữ liệu thật. Không cấp quyền dựa trên email do client tự gửi.

Đơn hàng hiện được ghép bằng Sub ID từ báo cáo CSV chuẩn hóa. Chưa có đồng bộ tự động báo cáo đơn hàng từ Shopee. Chuyển tiền cho khách là thao tác ngân hàng thủ công; công cụ chỉ theo dõi yêu cầu và ghi nhận mã giao dịch.

## 7. Kiểm tra mã nguồn

```sh
pnpm exec tsc --noEmit
node --experimental-strip-types --test tests/domain.test.ts
node --experimental-vm-modules --test tests/service.test.mjs tests/auth.test.mjs
pnpm build
```

## 8. Phạm vi gói mã nguồn

Đây là snapshot mã nguồn của commit ghi trong `SOURCE_INFO.json`. Các thư mục `node_modules`, kết quả build `dist`, cache, lịch sử `.git`, database runtime và khóa bí mật không thuộc gói mã nguồn. Có lockfile để cài lại dependency đúng phiên bản. Bản dữ liệu mẫu nằm trong mã nghiệp vụ để bạn có thể thử luồng sau khi tạo tài khoản.

Cấu hình `.openai/hosting.json` giữ nguyên định danh website hiện có để đối chiếu nguồn. Nếu tạo một website mới trên tài khoản/hạ tầng khác, cấu hình lại định danh, binding D1 và domain bằng quy trình của môi trường đó; không tái sử dụng tài nguyên production cũ ngoài ý muốn.
