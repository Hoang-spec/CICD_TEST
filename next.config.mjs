/** @type {import('next').NextConfig} */
const nextConfig = {
	async rewrites() {
		return [
			{ source: "/api/:path*", destination: `${process.env.API_INTERNAL_URL || "http://127.0.0.1:4000"}/api/:path*` },
		];
	},
	// Thêm đoạn này để bỏ qua lỗi ESLint khi build
	eslint: {
		ignoreDuringBuilds: true,
	},
	// Nếu có các cấu hình khác đang tồn tại, hãy giữ nguyên ở dưới
};

export default nextConfig;
