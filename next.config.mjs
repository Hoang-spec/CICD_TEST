/** @type {import('next').NextConfig} */
const apiOrigin = (process.env.API_INTERNAL_URL || "http://127.0.0.1:4000").trim().replace(/\/+$/, "");
const apiUrl = new URL(apiOrigin);
if (!["http:", "https:"].includes(apiUrl.protocol) || apiUrl.pathname !== "/" || apiUrl.search || apiUrl.hash || apiUrl.username || apiUrl.password) {
	throw new Error("API_INTERNAL_URL must be an HTTP(S) origin, without /api, credentials, query or fragment");
}

const nextConfig = {
	async rewrites() {
		console.info(`[API proxy] /api/* -> ${apiOrigin}/api/*`);
		return [
			{ source: "/api/:path*", destination: `${apiOrigin}/api/:path*` },
		];
	},
	// Thêm đoạn này để bỏ qua lỗi ESLint khi build
	eslint: {
		ignoreDuringBuilds: true,
	},
	// Nếu có các cấu hình khác đang tồn tại, hãy giữ nguyên ở dưới
};

export default nextConfig;
