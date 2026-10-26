# Chuẩn bị backend trên AWS: EC2 + RDS + ECR

Xem [thiết kế kiến trúc](ARCHITECTURE.vi.md) để nắm sơ đồ mạng, luồng phát hành, bảo mật và giới hạn vận hành.

Cấu hình này dành cho `material-kit-react/backend` (Express + PostgreSQL).
Một EC2 chạy Docker Compose và Caddy cấp HTTPS, RDS lưu dữ liệu,
ECR lưu image. Đây là cấu hình một máy, chưa có high availability hoặc autoscaling.
Các lệnh bên dưới tạo tài nguyên tính phí khi bạn thực hiện; chưa được chạy trên AWS.

## 1. Tài nguyên cần chuẩn bị

- Chọn region, ví dụ `ap-southeast-1`. Tạo ECR private repository `atelier-backend`, bật tag immutability và image scanning.
- EC2 Linux x86_64, Docker Engine, Compose v2, AWS CLI v2; gắn IAM instance role chỉ có quyền pull ECR (`AmazonEC2ContainerRegistryReadOnly`). Dùng SSM để quản trị hoặc chỉ mở SSH từ IP quản trị.
- Gắn Elastic IP và trỏ DNS `api.example.com` về EC2. Security group EC2 chỉ mở TCP 80/443 công khai; không mở 4000/5432.
- RDS PostgreSQL trong cùng VPC, private subnets ở ít nhất hai AZ, `Publicly accessible = No`. Security group RDS chỉ nhận TCP 5432 từ security group EC2. Bật encryption, automated backups và deletion protection. EC2 phải có đường mạng tới RDS.
- Tạo database `atelier` và user riêng. User chạy migration cần quyền tạo bảng; không dùng RDS master user cho runtime lâu dài. Có thể chạy migration với credential riêng qua file env tạm quyền 600.
- Máy build đăng nhập AWS bằng SSO/profile có quyền push ECR. Không đặt AWS access key trong container hoặc Git.

## 2. Build và push từ repository root

Thay account, region và tag release. Image này dành cho EC2 x86_64; nếu chọn Graviton thì build `linux/arm64`.

```bash
export AWS_REGION=ap-southeast-1
export AWS_ACCOUNT_ID=123456789012
export RELEASE_TAG=release-001
export ECR_REGISTRY="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
aws sts get-caller-identity
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$ECR_REGISTRY"
docker build --platform linux/amd64 -t "$ECR_REGISTRY/atelier-backend:$RELEASE_TAG" backend
docker push "$ECR_REGISTRY/atelier-backend:$RELEASE_TAG"
```

Chạy CI integration tests với PostgreSQL trước khi phát hành (`backend/README.md`). Không dùng `latest` để rollback có thể xác định đúng image.

## 3. Chuẩn bị trên EC2

Copy thư mục `deploy/aws` lên `/opt/atelier` rồi thực hiện trong thư mục đó:

```bash
cp .env.example .env
chmod 600 .env
mkdir -p certs
curl --fail --show-error --location https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem -o certs/global-bundle.pem
```

Sửa `.env` bằng editor trên máy chủ: image URI, domain, email, frontend HTTPS origin và RDS connection URI. Percent-encode ký tự đặc biệt trong user/password URI; giữ `sslmode=verify-full`. CA được mount read-only và nạp qua `NODE_EXTRA_CA_CERTS`, áp dụng cho API, migration và seed. Không tắt xác minh TLS. `.env` không được commit; base64 cũng không phải mã hóa bí mật. Trong môi trường yêu cầu quản lý tập trung, lấy giá trị từ Secrets Manager bằng instance role và ghi file quyền 600 ngoài Git.

Đăng nhập ECR bằng instance role (đặt region/registry như bước 2), rồi:

```bash
docker compose config --quiet
docker compose pull
docker compose run --rm migrate
# Chỉ chạy lần đầu trên DB mới, sau khi đặt admin password mạnh:
docker compose run --rm seed
docker compose up -d --wait
docker compose ps
curl --fail https://api.example.com/api/health
curl --fail https://api.example.com/api/ready
```

Migration/seed là bước riêng; lỗi phải được xử lý trước `up`. Nếu chuyển dữ liệu JSON cũ, migrate rồi import vào database rỗng theo `backend/README.md`, không seed trước import. Xóa admin password khỏi `.env` sau seed và recreate backend để loại credential đó khỏi môi trường runtime.

Caddy cần DNS đúng, port 80/443 tới được EC2 và outbound HTTPS để cấp certificate. API chỉ có mạng nội bộ Compose. `TRUST_PROXY_HOPS=1` tương ứng duy nhất Caddy; nếu thêm CDN/ALB phải xem lại đường proxy trước khi đổi số hop. Rate limit hiện lưu trong memory từng process và reset khi restart.

## 4. Kết nối frontend

Frontend hiện gọi `/api` cùng origin và Next.js proxy sang backend. Build lại frontend với `API_INTERNAL_URL=https://api.example.com` (cấu hình rewrite hiện được chốt khi build). Đặt `CLIENT_ORIGIN` đúng origin frontend, ví dụ `https://shop.example.com`; không có dấu `/` cuối. Không cần đổi code trình duyệt sang gọi API khác domain.

Giữ frontend trên HTTPS để session cookie `Secure` hoạt động. Kiểm tra đăng nhập, `/api/auth/me`, tạo đơn hàng, logout qua frontend; readiness đơn thuần chưa xác nhận luồng cookie/proxy hoạt động.

## 5. Release tiếp theo và rollback

Backup RDS và xác nhận restore trước migration quan trọng. Với migration ảnh hưởng writes, dùng maintenance window: dừng backend trước migration, chấp nhận downtime cho cấu hình một máy này. Đổi `BACKEND_IMAGE` sang tag mới, pull, chạy migration một lần, rồi `up -d --wait`. Không chạy nhiều migration đồng thời.

Nếu readiness hoặc smoke test thất bại, xem `docker compose logs --tail=100 backend proxy`. Rollback bằng cách đổi image về tag cũ và `up -d --wait` chỉ khi schema còn tương thích. Không tự động rollback schema hoặc restore snapshot lên dữ liệu vừa phát sinh. Theo dõi log, dung lượng đĩa, CPU, bộ nhớ và RDS; file Compose giới hạn dung lượng log container nhưng chưa cấu hình CloudWatch alarms.

## Tài liệu tham chiếu

- [Push image lên ECR](https://docs.aws.amazon.com/AmazonECR/latest/userguide/docker-push-ecr-image.html)
- [RDS PostgreSQL TLS và xác minh certificate](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/PostgreSQL.Concepts.General.SSL.html)
- [CA bundle chính thức của RDS](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/UsingWithRDS.SSL.html)
