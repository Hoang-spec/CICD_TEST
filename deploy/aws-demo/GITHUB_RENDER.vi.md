# GitHub SSH CI/CD và Render → Elastic IP → backend → DB

Frontend chạy Render Node Web Service; Next.js proxy `/api` sang EC2 qua Elastic IP. Caddy chuyển tiếp tới Express trong Docker; Express gọi PostgreSQL qua mạng Docker riêng. Dữ liệu giữ trong volume `atelier-demo_postgres-data` trên EC2. Elastic IP chỉ là địa chỉ tĩnh; không cung cấp TLS hoặc load balancing.

## 1. Gắn Elastic IP

Trong đúng region đang chứa EC2, chọn EC2 → Elastic IPs → Allocate Elastic IP address → Associate Elastic IP address → chọn instance đang chạy. IP public cũ sẽ được thay thế; cập nhật SSH host, DNS và Render sau khi gắn. IPv4 public có phí theo AWS; không giả định thuộc free tier.

## 2. Thiết lập GitHub Actions

Repo: `Hoang-spec/CICD_TEST`. Workflow `.github/workflows/ci.yml` test frontend/backend trước; chỉ push vào `main` đã pass mới chạy job `deploy-backend`. PR không được deploy. Các file mới phải được commit/push để GitHub thấy workflow/script.

Trong Settings → Environments tạo `production` và giới hạn deployment branch `main`. Nếu gói GitHub không hỗ trợ environment secrets cho private repo, dùng repository Actions secrets.

Tạo ba secrets (không phải Variables):

| Secret | Giá trị |
|---|---|
| `EC2_HOST` | Elastic IP mới hoặc DNS trỏ tới nó |
| `EC2_SSH_PRIVATE_KEY` | Toàn bộ nội dung file `ssh-devops.pem`, bao gồm BEGIN/END; không commit file |
| `EC2_SSH_KNOWN_HOSTS` | Dòng known_hosts của EC2, host phải trùng EC2_HOST |

Có thể lấy dòng known_hosts đã tin cậy trên máy local bằng `ssh-keygen -F ELASTIC_IP`; chỉ copy dòng khóa, bỏ dòng comment. Nếu IP mới chưa có trong known_hosts, xác minh fingerprint với khóa máy EC2 qua phiên đã tin cậy, rồi ghi nhận host mới. Không dùng `StrictHostKeyChecking=no`; không tin `ssh-keyscan` mà chưa đối chiếu fingerprint.

User `ubuntu` phải có sudo không cần password cho Docker như máy hiện tại. Workflow dùng SSH/SCP, không cần quyền push GitHub trên EC2. SSH port 22 phải cho phép runner truy cập: runner GitHub hosted không có một IP cố định. Nếu muốn giới hạn nguồn hẹp, dùng runner có egress IP cố định hoặc private runner; rule chỉ cho IP laptop sẽ làm CI timeout. Không sửa security group tự động từ workflow này.

Script chạy trên `/opt/atelier-demo`, build image theo SHA, giữ `.env`, Compose và dữ liệu hiện có, dừng backend, migrate một lần, khởi động và smoke-test. Không seed hoặc prune volume. Healthcheck thất bại sau migration sẽ báo lỗi để review schema trước rollback; `.env.previous` giữ image trước release. Caddy/Compose không tự cập nhật từ CI, tránh ghi đè HTTPS đang cấu hình trên máy chủ.

Nếu migration lỗi, script khởi động lại image cũ do runner migration hiện có transaction. Build lỗi thì backend đang chạy không bị dừng. Cập nhật lớn cần kiểm tra dung lượng trước; giữ image rollback, dọn image/release cũ có chọn lọc khi đĩa gần đầy. Không prune volume DB.

## 3. Frontend trên Render

Tạo **Web Service** từ repository, runtime Node, root directory để trống:

- Build command: `npm ci && npm run build`
- Start command: `npm run start -- --hostname 0.0.0.0 --port $PORT`
- Environment: `API_INTERNAL_URL=https://54.253.83.155`

Backend hiện dùng HTTPS trực tiếp qua Elastic IP, không cần domain: thêm `API_IP=54.253.83.155` và `COMPOSE_FILE=compose.yml:compose.https.yml` vào `.env` trên EC2, đặt `compose.https.yml` và `Caddyfile.https` cạnh Compose chính. Override bổ sung port 443 và volume lưu chứng chỉ; Caddy xin chứng chỉ IP từ Let's Encrypt với profile `shortlived` và tự gia hạn. Giữ port 80 mở cho HTTP-01 challenge; mở TCP 443 cho Render/client. `default_sni` xử lý kết nối IP không gửi SNI khi EC2 nằm sau NAT. Không dùng `tls internal` hoặc tắt xác minh certificate ở frontend.

Chỉ đặt Render dùng URL trên sau khi `curl --fail https://54.253.83.155/api/ready` thành công từ Internet. Chứng chỉ IP có thời hạn khoảng 6 ngày nên Caddy phải hoạt động, có outbound HTTPS và giữ volume chứng chỉ để tự gia hạn. Nếu đổi Elastic IP, cập nhật API_IP, EC2_HOST, known_hosts và API_INTERNAL_URL rồi xin certificate cho IP mới. Tham khảo [Let's Encrypt IP certificates](https://letsencrypt.org/2026/01/15/6day-and-ip-general-availability).

`API_INTERNAL_URL` được Next.js đọc khi build nên phải redeploy frontend sau khi đổi. Browser tiếp tục gọi `/api` trên domain Render, không gọi thẳng Elastic IP. Backend `.env` đặt `CLIENT_ORIGIN=https://TEN_APP.onrender.com` chính xác, sau đó recreate backend. Cookie production giữ `Secure`.

Render có thể tự deploy frontend theo branch; backend có pipeline riêng. Với thay đổi API phá tương thích, phát hành backend tương thích cả frontend cũ/mới trước, rồi deploy frontend. Chưa có bước gọi Render deploy hook trong workflow này.

## 4. Kiểm tra

Push thay đổi lên `main`, theo dõi Actions → CI → validate → deploy-backend. Kiểm tra HTTPS readiness qua domain API; trên frontend Render kiểm tra login, `/api/auth/me`, sản phẩm và logout. Nếu Render báo 502, kiểm tra API_INTERNAL_URL, DNS, port 443 và certificate EC2. Nếu mutation báo 403, kiểm tra CLIENT_ORIGIN và header `X-Atelier-Request`.

Tham chiếu: [GitHub Actions secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets), [Elastic IP association](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/working-with-eips.html), [Render Next.js](https://render.com/docs/deploy-nextjs-app).
