# Phân tích backend và database cho Atelier

Ngày rà soát: 26/10/2026. Đây là thiết kế triển khai từ code hiện có; chưa phải backend/database đã được chuyển đổi hay kiểm thử vận hành.

## 1. Phạm vi và kết luận

Workspace có hai ứng dụng độc lập:

- `material-kit-react`: Next.js 15, React 19, TypeScript, MUI; đã tùy biến thành cửa hàng Atelier với shop, checkout và dashboard quản trị. Có Express 5 trong `backend/` nhưng lưu JSON.
- `material-dashboard-react-nodejs`: React dashboard template và Express 4/Mongoose. Chủ yếu có auth/profile, không có nghiệp vụ sản phẩm, tồn kho, đơn hàng của Atelier. Dù package khai báo thêm driver SQL, code khởi động kết nối MongoDB. Không có bằng chứng hai ứng dụng đang dùng chung backend.

Chọn Atelier làm ứng dụng chính để thiết kế vì đây là nơi có nghiệp vụ bán hàng. Giữ Express hiện có, tổ chức lại thành module, thay JSON bằng PostgreSQL và chuyển frontend sang gọi API. Không cần ghép hai backend hay xây lại giao diện.

## 2. Hiện trạng từ mã nguồn

| Phần | File chính | Hiện trạng |
| --- | --- | --- |
| Đăng ký/đăng nhập | `src/lib/auth/client.ts` | Tài khoản demo hardcode, tài khoản đăng ký lưu cả mật khẩu rõ trong localStorage; session là ID user |
| Phân quyền giao diện | `src/components/auth/admin-guard.tsx` | Đọc role phía client; chỉ phục vụ điều hướng, không bảo vệ dữ liệu server |
| Catalog và giỏ hàng | `src/app/shop/page.tsx`, `src/lib/shop-products.ts` | Catalog demo, giỏ `atelier-cart` lưu tại trình duyệt |
| Đặt hàng | `src/app/checkout/page.tsx`, `src/lib/demo-store.ts` | Tạo đơn và trừ kho trong localStorage, không gọi Express |
| Quản trị | `src/app/dashboard/{page,products/page,orders/page,customers/page}.tsx` | Tổng hợp và chỉnh sửa dữ liệu demo tại trình duyệt |
| Express | `backend/src/server.js` | Đã có auth, CRUD sản phẩm, đơn, khách hàng, dashboard; đọc/ghi toàn bộ `data/db.json` |
| Next API đơn hàng | `src/app/api/orders/route.ts` | Lưu mảng trong RAM; GET không xác thực, POST không kiểm tra giá/tồn kho bằng catalog server |
| Hồ sơ/cài đặt | `src/components/dashboard/account/*`, `settings/*` | Thông tin mẫu; lưu hồ sơ, upload avatar, đổi mật khẩu và lưu thông báo chưa nối API |
| Tích hợp | `src/app/dashboard/integrations/page.tsx` | Giao diện danh sách mẫu, chưa có luồng tích hợp thực |
| Triển khai | `docker-compose*.yml`, `Jenkinsfile`, `DEPLOYMENT.md` | Compose local chỉ khởi động web dù tài liệu mô tả cả API; production dùng volume JSON |

Ba nguồn dữ liệu localStorage, RAM và JSON không đồng bộ. Đăng ký ở UI hiện tại không tạo tài khoản trong Express. Chỉnh sản phẩm ở UI không thay catalog Express. Khách đặt hàng trên một máy không làm dashboard máy khác cập nhật.

## 3. Những điểm cần sửa trước khi vận hành

1. Thay auth demo bằng xác thực server; không nhận role/userId từ client làm căn cứ phân quyền. Server kiểm tra tài khoản còn hoạt động và quyền hiện tại.
2. Loại bỏ cơ chế ghi đơn trong Next API; có thể xóa route hoặc chuyển thành proxy tới Express có chuyển tiếp session. Không giữ GET công khai trả thông tin khách hàng.
3. JSON đọc–sửa–ghi có thể ghi đè dữ liệu giữa hai request, mất đơn, trùng email, bán vượt kho hoặc hoàn kho sai. Cần transaction và constraint database.
4. Backend trả firstName/lastName trong khi UI dùng name: cần DTO thống nhất.
5. Catalog public ẩn sản phẩm inactive; cần endpoint admin riêng để xem và khôi phục sản phẩm ẩn.
6. Validation hiện có cho phép một số giá trị ép kiểu như null/chuỗi rỗng thành 0; customer chỉ kiểm tra truthy trước khi trim. Cần schema nghiêm ngặt, giới hạn độ dài và reject field sai kiểu.
7. Dashboard hiện coi mọi đơn chưa hủy là doanh thu. Cần tách giá trị đơn đặt, doanh số hoàn tất và tiền thực thu; frontend/backend đang tính orderCount khác nhau đối với đơn hủy.
8. UI có lựa chọn card nhưng chưa có cổng thanh toán. MVP dùng COD; chỉ bật card khi có payment session và webhook xác minh. Không gửi/lưu số thẻ hoặc CVV vào backend này.
9. Backend template cũ có JWT secret hardcode `token`; resetPassword tham chiếu biến `foundToken` chưa khai báo. Không sao chép nguyên auth từ template.

## 4. Kiến trúc dự kiến

Luồng: Next.js → `/api` qua reverse proxy → Express → PostgreSQL.

Một backend dạng modular monolith là đủ cho phạm vi hiện tại. Giữ bcrypt để tương thích hash đã có. Dùng driver `pg`, SQL migration có version, query tham số hóa; chưa cần Redis hay microservice.

```text
backend/src/
  app.js                 # cấu hình Express, export app để test
  server.js              # khởi động, shutdown
  config/                # validate biến môi trường
  db/                    # pool, transaction helper
  middleware/            # auth, admin, validation, error, request ID
  modules/
    auth/ users/ categories/ products/ orders/ inventory/ dashboard/
  services/              # email và thanh toán khi triển khai
backend/migrations/
backend/scripts/         # seed admin, import JSON
backend/tests/           # integration test trên DB riêng
```

Đề xuất session opaque ngẫu nhiên trong cookie HttpOnly, Secure ở production, SameSite phù hợp; lưu hash token trong DB để logout/đổi mật khẩu có thể thu hồi. Deploy cùng origin qua reverse proxy để đơn giản cookie. Request ghi dữ liệu kiểm tra Origin và CSRF token; nếu dùng khác origin phải cấu hình CORS allowlist và credentials cụ thể. Đây là thay đổi có chủ đích so với Bearer JWT hiện tại, cần chuyển frontend và backend cùng đợt.

## 5. Thiết kế dữ liệu

Giữ ID dạng text hiện tại (`USR-*`, `PRD-*`, `ORD-*`) để nhập dữ liệu cũ và tránh đổi mọi liên kết. ID mới dùng UUID có prefix. Thời gian dùng `timestamptz`, lưu theo UTC; giao diện hiển thị múi giờ người dùng.

UI đang dùng ký hiệu USD và quy tắc phí ship 5 USD khi subtotal dưới 50 USD. MVP tạm giữ USD, không tự đổi sang VND. Lưu tiền bằng `numeric(14,2)`, không dùng float; ứng dụng tính bằng decimal hoặc integer cents và trả chuỗi decimal trong API. Frontend chuyển sang hàm format tiền thống nhất.

### Các bảng lõi

| Bảng | Cột chính | Ràng buộc/quy tắc |
| --- | --- | --- |
| users | id, first_name, last_name, email, password_hash, role, active, phone, avatar_url, city, state, country, created_at, updated_at | email normalize và unique index `lower(email)`; role admin/client; không trả password_hash |
| sessions | id, user_id, token_hash, expires_at, revoked_at, created_at | FK users; token_hash unique; index user_id và expires_at |
| categories | id, name, slug, active, created_at, updated_at | slug unique; không xóa category đang được tham chiếu |
| products | id, category_id, name, description, price, old_price, currency, image_url, accent, badge, stock, active, deleted_at, created_at, updated_at | FK categories; stock integer >= 0; tiền >= 0; currency USD cho MVP; archive thay xóa |
| orders | id, user_id, status, payment_method, currency, recipient_name, recipient_email, recipient_phone, address, city, postal_code, subtotal, shipping, total, idempotency_key, request_hash, created_at, updated_at | FK users; unique(user_id, idempotency_key); status theo tập giá trị; total = subtotal + shipping |
| order_items | id, order_id, product_id, product_name, unit_price, quantity | FK orders/products; quantity > 0; unit_price >= 0; unique(order_id, product_id) |
| order_status_history | id, order_id, from_status, to_status, actor_user_id, reason, created_at | Ghi cùng transaction cập nhật trạng thái; actor có thể null cho tác vụ hệ thống |
| inventory_movements | id, product_id, order_id, actor_user_id, kind, quantity_delta, stock_after, reason, created_at | kind opening/sale/cancel/adjustment; delta != 0; stock_after >= 0; unique partial(order_id, product_id, kind) cho sale/cancel |

Tên sản phẩm, giá và địa chỉ trên đơn là bản chụp tại lúc đặt. Sửa catalog/hồ sơ không làm thay đổi lịch sử đơn. Khách hàng là user có role client, không cần bảng customers trùng dữ liệu. Tồn kho nằm trên products; movement là lịch sử để đối soát, không có bảng tồn kho thứ hai trong MVP.

### Các bảng bổ sung theo tính năng

- `password_reset_tokens`: user_id, token_hash unique, expires_at, used_at, created_at; token dùng một lần, hết hạn, thu hồi session sau reset.
- `notification_preferences`: user_id PK/FK và các cờ thông báo theo UI; chỉ biểu diễn lựa chọn, chưa đồng nghĩa có dịch vụ gửi SMS/email.
- `payments` khi bật thanh toán trực tuyến: order_id, provider, provider_payment_id unique, amount, currency, status, paid_at; nhiều lần thử thanh toán cho một đơn.
- `payment_events`: provider, external_event_id, received_at, processed_at; unique(provider, external_event_id) chống xử lý webhook lặp.
- Chưa cần bảng cart: có thể giữ ID/số lượng trong localStorage; backend luôn kiểm tra lại khi checkout. Wishlist hiện chỉ có nút giao diện, chưa cần bảng trong MVP.

### Quan hệ và index

users 1–N sessions/orders; categories 1–N products; orders 1–N order_items/history; products 1–N order_items/movements.

Index ban đầu: orders(user_id, created_at DESC, id), orders(status, created_at DESC), products(category_id, active), order_items(product_id), history(order_id, created_at), movements(product_id, created_at). Sort và pagination luôn có ID làm khóa phụ. Search nhỏ có thể dùng ILIKE; chỉ thêm index tìm kiếm chuyên biệt sau khi đo truy vấn.

Không cascade xóa users/products sang orders. Không cho sửa/xóa đơn đã tạo; thay đổi bằng trạng thái và nhật ký. Tổng dòng đơn phải được tính và kiểm tra trong transaction; CHECK của một bảng không thay thế kiểm tra tổng nhiều order_items.

## 6. API cần triển khai

Giữ prefix `/api` để gần backend hiện có. DTO camelCase, thành công `{ data }`, danh sách `{ data, pagination: { page, pageSize, total } }`. Page bắt đầu từ 1, pageSize mặc định 20, tối đa 100. Lỗi `{ error: { code, message, fields? }, requestId }`; 400 sai input, 401 chưa đăng nhập, 403 thiếu quyền, 404 không thấy, 409 xung đột/tồn kho/trạng thái, 429 quá nhiều request.

| Method/path | Quyền | Mục đích |
| --- | --- | --- |
| POST /auth/register, /auth/login | Public | Tạo tài khoản client; tạo session cookie |
| POST /auth/logout | Signed in | Thu hồi session, xóa cookie |
| GET /auth/me | Signed in | DTO user gồm id, name, firstName, lastName, email, role, avatar |
| POST /auth/forgot-password, /auth/reset-password | Public | Giai đoạn bổ sung email; forgot trả thông điệp chung |
| PATCH /users/me | Signed in | Sửa hồ sơ; email cần luồng xác minh riêng |
| POST /users/me/change-password | Signed in | Kiểm tra mật khẩu hiện tại, đổi hash, thu hồi session |
| GET/PATCH /users/me/notification-preferences | Signed in | Đọc/lưu tùy chọn |
| GET /categories | Public | Danh mục đang hoạt động |
| GET /products, /products/:id | Public | Chỉ sản phẩm active; search/category/page/pageSize |
| GET /admin/products | Admin | Toàn bộ sản phẩm; lọc active/ẩn/tồn thấp |
| POST /products | Admin | Tạo sản phẩm |
| PATCH /products/:id | Admin | Sửa nội dung/giá/trạng thái; thay tồn bằng nghiệp vụ adjustment |
| DELETE /products/:id | Admin | Archive, không xóa lịch sử |
| POST /admin/products/:id/stock-adjustments | Admin | Điều chỉnh delta, lý do bắt buộc, ghi movement |
| POST /orders | Signed in | Tạo đơn của session hiện tại, Idempotency-Key bắt buộc |
| GET /orders, /orders/:id | Owner hoặc admin | Client chỉ thấy đơn của mình; admin có filter status/date/search |
| PATCH /orders/:id/status | Admin | Chuyển trạng thái hợp lệ, ghi history |
| GET /admin/customers | Admin | Tìm tên/email, phân trang, số đơn và chi tiêu |
| GET /admin/dashboard | Admin | Thống kê theo khoảng thời gian đã validate |
| GET /health | Public | Liveness; readiness riêng kiểm tra DB trước khi nhận traffic |

Request đặt hàng chỉ gồm customer, paymentMethod và items[{productId,quantity}]. Không tin price, stock, total, role, userId hay status từ client. MVP từ chối paymentMethod card cho tới khi tích hợp provider.

## 7. Transaction và quy tắc nghiệp vụ

### Đặt hàng

1. Xác thực, validate và gộp dòng trùng productId; giới hạn số dòng/số lượng.
2. BEGIN; tạo order với unique(user_id, idempotency_key) để phân xử retry. Lưu hash payload chuẩn hóa; cùng key khác payload trả 409. Request lặp cùng payload trả đơn trước đó; lỗi giữa chừng rollback toàn bộ.
3. Khóa các dòng products theo thứ tự ID cố định bằng SELECT FOR UPDATE để giảm deadlock; kiểm tra active và tồn kho.
4. Lấy giá từ DB, tính subtotal và shipping bằng số chính xác. Giữ phí hiện tại: subtotal > 0 và < 50 thì 5, còn lại 0.
5. Trừ stock, thêm order_items, inventory_movements và history khởi tạo, hoàn tất order. COMMIT rồi trả 201. Khi DB lỗi, không được có đơn thiếu dòng hoặc trừ kho dở dang.
6. Retry giới hạn cho deadlock/lỗi serialization; gửi lại cùng idempotency key. Không gọi email/payment network trong lúc giữ khóa DB.

### Chuyển trạng thái

pending → processing → shipped → delivered. pending/processing → cancelled. delivered/cancelled kết thúc.

Khóa order trước, kiểm tra trạng thái hiện tại trong DB. Hủy đơn khóa các products theo cùng thứ tự và hoàn kho một lần trong cùng transaction; movement unique là lớp bảo vệ bổ sung. Hai request chuyển trạng thái cạnh tranh phải nhận kết quả nhất quán; trạng thái đã hoàn tất không được lặp hoàn kho. Mọi nghiệp vụ sửa stock cũng phải dùng khóa/UPDATE nguyên tử tương thích.

### Thống kê

MVP báo riêng: totalOrders gồm tất cả, pendingOrders chỉ pending, completedSales là tổng total của delivered, placedOrderValue là tổng total chưa hủy. `totalSpent` khách hàng dùng completedSales; `orderCount` gồm tất cả và có completedOrderCount riêng. Best sellers dùng số lượng của đơn delivered. Chỉ có chỉ số thực thu khi có dữ liệu thanh toán đáng tin cậy; delivered không tự động đồng nghĩa paid.

## 8. Thứ tự chuyển đổi

1. Tách app/server và module; bổ sung PostgreSQL, migration, transaction helper, validation, error handler và integration test.
2. Tạo schema lõi, seed category/catalog và admin bằng biến môi trường; không seed tài khoản demo ở production.
3. Chuyển auth/session trước; cập nhật UserContext/AuthClient và DTO name. Xóa mật khẩu demo khỏi frontend, đăng xuất session localStorage cũ.
4. Chuyển shop và admin products sang API; giữ cart local nhưng validate lại; không fallback âm thầm sang catalog demo khi API lỗi.
5. Chuyển checkout/orders sang API transaction; thay hoặc xóa Next route RAM. Cập nhật trạng thái từ response server.
6. Chuyển customers/dashboard, rồi profile/settings. Bổ sung trang lịch sử đơn cho client vì hiện chưa có màn tương ứng dù API hỗ trợ.
7. Cập nhật Compose local thành web/api/db, production thành frontend/backend/db hoặc DB được quản lý; bổ sung DATABASE_URL, secrets và healthcheck. Jenkins chạy migrations một lần cho bản phát hành, kiểm tra readiness rồi mới chuyển traffic.
8. Import dữ liệu JSON có backup và dry-run; sau khi xác minh mới chuyển nguồn ghi sang DB.

## 9. Nhập dữ liệu và triển khai

- Backup db.json; kiểm tra duplicate email/ID, tham chiếu đơn, stock âm, số tiền và category trước import.
- Giữ ID và passwordHash bcrypt từ Express; tách category theo tên chuẩn hóa; giữ snapshot order và mốc thời gian. Hash không hợp lệ buộc reset mật khẩu.
- Import trong transaction, xuất báo cáo đếm/tổng tiền/đơn lỗi, có chế độ dry-run. Không cộng/trừ lại stock từ orders vì JSON đã phản ánh việc đặt/hủy; ghi opening movement bằng stock đang nhập.
- LocalStorage không phải dữ liệu server đáng tin. Không tự nhập tài khoản/mật khẩu hay đơn từ trình duyệt vào production. Nếu cần giữ dữ liệu demo thì xuất riêng và kiểm duyệt.
- Không tiếp tục cho JSON và PostgreSQL cùng nhận ghi. Trong cửa sổ chuyển đổi, tạm ngừng ghi, import, đối soát rồi bật ứng dụng mới.
- Bổ sung backup PostgreSQL và thử restore; rollback code phải tương thích schema đang dùng. Sau khi DB có ghi mới, rollback không được quay lại JSON cũ vì sẽ mất dữ liệu.
- Rate limit login/register/reset; không log token, mật khẩu hay toàn bộ địa chỉ; readiness không lộ connection string. Các biện pháp này phục vụ trực tiếp auth và dữ liệu khách hàng hiện có.

## 10. Tiêu chí nghiệm thu

- Đăng ký/đăng nhập rồi reload vẫn có session server; logout/đổi mật khẩu thu hồi đúng session; client gọi endpoint admin nhận 403.
- Hai đăng ký email chỉ khác hoa/thường không tạo hai tài khoản.
- Hai checkout tranh sản phẩm stock=1: chỉ một đơn thành công; stock cuối = 0; không mất đơn.
- Gửi lại cùng key/payload tạo một đơn; key cũ payload khác nhận 409; kiểm tra cả request retry đồng thời.
- Hủy một đơn hai lần/đồng thời chỉ hoàn kho một lần; transaction lỗi rollback cả đơn và kho.
- Không thể mua sản phẩm inactive, số lượng âm/thập phân, giá giả; sửa catalog không đổi giá đơn cũ.
- Client không đọc được đơn người khác; API Next không còn công khai danh sách khách hàng.
- Các thay đổi sản phẩm/đơn trên máy A xuất hiện trên máy B sau tải lại; restart backend không mất dữ liệu.
- Kiểm tra phân trang/lọc, DTO và số tiền USD; đối chiếu dashboard với đơn pending/delivered/cancelled đã biết.
- Compose local khởi động đủ ba service; CI chạy typecheck, build và integration test trên database riêng; kiểm tra migrate/restore trước release.

## 11. Những giả định cần giữ rõ khi viết code

Thiết kế này chọn Atelier là ứng dụng chính, PostgreSQL là DB, USD theo UI hiện tại, COD cho MVP, hai role admin/client và một kho. Thanh toán thật, nhiều kho, voucher, thuế, OAuth, wishlist và gửi SMS là phần mở rộng, chưa có nghiệp vụ đủ rõ trong mã hiện tại. Đây là các lựa chọn thiết kế đề xuất, không phải yêu cầu đã được người dùng xác nhận.

Tài liệu kỹ thuật tham chiếu: [PostgreSQL row locking](https://www.postgresql.org/docs/current/explicit-locking.html) cho khóa dòng trong transaction; [PostgreSQL numeric](https://www.postgresql.org/docs/current/datatype-numeric.html) cho kiểu tiền chính xác.
