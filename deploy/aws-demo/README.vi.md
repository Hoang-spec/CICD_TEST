# Chạy thử backend trên EC2 bằng Docker

Thư mục triển khai trên máy chủ: `/opt/atelier-demo`. Copy backend source vào thư mục `backend/` cạnh `compose.yml`; không copy node_modules, data hoặc secrets local. Tạo `.env` quyền 600 gồm RELEASE_TAG, POSTGRES_PASSWORD ngẫu nhiên URL-safe và CLIENT_ORIGIN. Tạo `.env.seed` quyền 600 gồm ADMIN_EMAIL và ADMIN_PASSWORD mạnh, chỉ dùng cho seed. Không ghi đè password khi đã có volume PostgreSQL.

```bash
sudo docker compose build backend
sudo docker compose up -d --wait db
sudo docker compose run --rm migrate
sudo docker compose run --rm seed
sudo docker compose up -d --wait backend proxy
curl --fail http://127.0.0.1/api/ready
```

API được proxy qua port 80; port 4000 chỉ bind loopback, PostgreSQL không publish port. Mở inbound TCP 80 trong EC2 security group để kiểm tra public. Không mở 5432 hoặc 4000. Giữ SSH giới hạn IP quản trị.

Compose chính là bản kiểm tra HTTP bằng IP, dùng dữ liệu seed mới, chưa chuyển dữ liệu local. Để dùng HTTPS trực tiếp trên Elastic IP, áp dụng `compose.https.yml` và `Caddyfile.https` theo [hướng dẫn Render](GITHUB_RENDER.vi.md). Session cookie production giữ Secure; không tắt Secure cookie để dùng HTTP. Đặt CLIENT_ORIGIN đúng origin frontend khi tích hợp thật.

Xem trạng thái: `sudo docker compose ps`; xem log: `sudo docker compose logs --tail=100 backend proxy`. Không dùng `down -v` vì sẽ xóa dữ liệu. Volume local không thay thế backup; bản này chưa có RDS, CloudWatch hoặc dự phòng.
