# Trạng thái triển khai backend/database

Đã triển khai PostgreSQL qua SQL migration có version; Express tách module auth/products/orders/admin; session cookie HttpOnly; xác thực quyền từ DB; catalog và điều chỉnh kho có nhật ký; checkout/hủy đơn có transaction, khóa dòng và idempotency; snapshot đơn; dashboard và danh sách khách hàng; hồ sơ, đổi mật khẩu và tùy chọn thông báo.

Frontend đã chuyển các luồng chính sang API, thêm `/orders` cho khách hàng, bỏ lưu tài khoản/đơn/kho ở localStorage và bỏ API đơn lưu RAM. Giỏ hàng vẫn lưu local theo thiết kế. Compose local/production, Jenkins và CI đã cập nhật cho PostgreSQL. Có importer JSON validate mặc định, chỉ ghi khi `--apply` và DB trống; không tự chuyển dữ liệu cũ.

Khác tài liệu thiết kế ban đầu: category dùng tên làm khóa để giữ contract hiện có, customer snapshot dùng JSONB trong orders, preferences dùng JSONB trong users. ID sản phẩm/người dùng/đơn giữ dạng text. API lỗi hiện dùng `{error: string, requestId, fields?}` cho phù hợp client. Currency USD và chỉ hỗ trợ COD. Dashboard hiện tổng hợp toàn bộ thời gian; chưa có filter khoảng ngày.

Chưa triển khai cổng thanh toán card, OAuth, email khôi phục mật khẩu, upload avatar và gửi email/SMS. Trang integrations còn nội dung mẫu. API hồ sơ hỗ trợ cả client nhưng giao diện account/settings hiện nằm trong dashboard admin.

Kiểm tra: 10 integration tests trên PostgreSQL thật đã qua, gồm cạnh tranh tồn cuối, retry idempotency, hủy đồng thời, rollback với lỗi DB được chủ động chèn, phân quyền, giá snapshot, session revocation, importer dry-run/refuse overwrite và PATCH giữ các trường không truyền. TypeScript và Docker production build đã chạy thành công. Kiểm tra cấu hình Compose local/production hợp lệ. Smoke test trình duyệt Chrome headless trên Docker đã qua: đăng ký thực từ form, cookie session, catalog/giỏ hàng, COD checkout, lịch sử đơn sau reload, logout, đăng nhập admin và hiển thị đơn vừa tạo/sản phẩm. Bản review local chạy ở http://localhost:3300 (API nội bộ xuất loopback cổng 4400).

Phạm vi bảo mật phụ thuộc: dependency backend trong lockfile hiện không có cảnh báo từ npm audit. Frontend còn dependency từ dự án cũ, gồm Next 15.3.3 và Zod 3.25.57; npm audit phát hiện mức critical/high. Cần một đợt nâng cấp framework/dependency và kiểm thử tương thích trước khi public production. Không có production deployment hoặc import dữ liệu người dùng được thực hiện trong đợt này.
