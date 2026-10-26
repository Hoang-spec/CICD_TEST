import "dotenv/config";

import { randomUUID } from "node:crypto";

import cors from "cors";
import express from "express";
import { ZodError } from "zod";

import { admin } from "./admin.js";
import { auth } from "./auth.js";
import { pool } from "./db.js";
import { orders } from "./orders.js";
import { products } from "./products.js";

export const app = express();
app.disable("x-powered-by");
// Enable only behind a controlled reverse proxy; the API port must stay private.
if (process.env.TRUST_PROXY_HOPS) {
	const hops = Number(process.env.TRUST_PROXY_HOPS);
	if (!Number.isInteger(hops) || hops < 1 || hops > 10) throw new Error("TRUST_PROXY_HOPS must be an integer from 1 to 10");
	app.set("trust proxy", hops);
}
const origin = process.env.CLIENT_ORIGIN ?? "http://localhost:3000";
app.use(cors({ origin, credentials: true, allowedHeaders: ["Content-Type", "X-Atelier-Request", "Idempotency-Key"] }));
app.use((req, res, next) => {
	req.requestId = randomUUID();
	res.set("X-Request-Id", req.requestId);
	res.set("Cache-Control", "no-store");
	res.set("X-Content-Type-Options", "nosniff");
	// Cross-site forms cannot provide this custom header. Cross-site JS requires an approved CORS preflight.
	if (
		!["GET", "HEAD", "OPTIONS"].includes(req.method) &&
		(req.get("X-Atelier-Request") !== "1" || (req.get("Origin") && req.get("Origin") !== origin))
	)
		return res.status(403).json({ error: "Yêu cầu không hợp lệ", requestId: req.requestId });
	next();
});
app.use(express.json({ limit: "100kb" }));
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.get("/api/ready", async (_req, res) => {
	await pool.query("SELECT 1");
	res.json({ status: "ok" });
});
app.use("/api", auth, products, orders, admin);
app.use((_req, res) => res.status(404).json({ error: "Không tìm thấy API" }));
app.use((error, req, res, _next) => {
	const status = error instanceof ZodError ? 400 : error.code === "23505" ? 409 : (error.status ?? 500);
	if (status >= 500) console.error({ requestId: req.requestId, message: error.message });
	const message =
		error instanceof ZodError
			? "Dữ liệu không hợp lệ"
			: error.code === "23505"
				? "Dữ liệu đã tồn tại"
				: status >= 500
					? "Không thể xử lý yêu cầu"
					: error.message;
	res
		.status(status)
		.json({
			error: message,
			requestId: req.requestId,
			...(error instanceof ZodError
				? { fields: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }
				: {}),
		});
});
