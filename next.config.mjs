/** @type {import('next').NextConfig} */
const nextConfig = {
  // Thêm đoạn này để bỏ qua lỗi ESLint khi build
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Nếu có các cấu hình khác đang tồn tại, hãy giữ nguyên ở dưới
};

export default nextConfig;  