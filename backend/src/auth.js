import { createHash, randomBytes, randomUUID } from "node:crypto";

import bcrypt from "bcryptjs";
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";

import { pool, transaction } from "./db.js";
import { fail, text, userDTO } from "./http.js";

export const auth = Router();
export const tokenHash = (value) => createHash("sha256").update(value).digest("hex");
const cookieName = "atelier_session";
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" };
function token(req) {
	const value = (req.headers.cookie ?? "")
		.split(";")
		.map((v) => v.trim())
		.find((v) => v.startsWith(`${cookieName}=`));
	return value?.slice(cookieName.length + 1);
}
export async function requireAuth(req, _res, next) {
	const raw = token(req);
	if (!raw) fail(401, "Vui lòng đăng nhập");
	const { rows } = await pool.query(
		`SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active`,
		[tokenHash(raw)]
	);
	if (!rows[0]) fail(401, "Phiên đăng nhập đã hết hạn");
	req.user = rows[0];
	next();
}
export function requireAdmin(req, _res, next) {
	if (req.user.role !== "admin") fail(403, "Bạn không có quyền quản trị");
	next();
}
async function session(db, res, userId) {
	const raw = randomBytes(32).toString("hex");
	await db.query(`INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')`, [
		tokenHash(raw),
		userId,
	]);
	res.cookie(cookieName, raw, { ...cookieOptions, maxAge: 7 * 86400000 });
}
auth.use(
	["/auth/login", "/auth/register"],
	rateLimit({ windowMs: 15 * 60000, limit: 30, standardHeaders: "draft-8", legacyHeaders: false })
);
const credentials = z.object({
	email: z
		.string()
		.trim()
		.email()
		.max(250)
		.transform((s) => s.toLowerCase()),
	password: z.string().min(8).max(72),
});
auth.post("/auth/register", async (req, res) => {
	const input = credentials.extend({ firstName: text, lastName: text }).strict().parse(req.body);
	const password = await bcrypt.hash(input.password, 12);
	const user = await transaction(async (db) => {
		const { rows } = await db.query(
			`INSERT INTO users(id,first_name,last_name,email,password_hash) VALUES($1,$2,$3,$4,$5) RETURNING *`,
			[`USR-${randomUUID()}`, input.firstName, input.lastName, input.email, password]
		);
		// Cookie is set after successful commit below.
		return rows[0];
	});
	await session(pool, res, user.id);
	res.status(201).json({ data: userDTO(user) });
});
auth.post("/auth/login", async (req, res) => {
	const input = credentials.parse(req.body);
	const { rows } = await pool.query("SELECT * FROM users WHERE lower(email)=$1 AND active", [input.email]);
	if (!rows[0] || !(await bcrypt.compare(input.password, rows[0].password_hash)))
		fail(401, "Email hoặc mật khẩu không đúng");
	await session(pool, res, rows[0].id);
	res.json({ data: userDTO(rows[0]) });
});
auth.post("/auth/logout", async (req, res) => {
	if (token(req)) await pool.query("DELETE FROM sessions WHERE token_hash=$1", [tokenHash(token(req))]);
	res.clearCookie(cookieName, cookieOptions);
	res.status(204).end();
});
auth.get("/auth/me", requireAuth, (req, res) => res.json({ data: userDTO(req.user) }));
auth.patch("/users/me", requireAuth, async (req, res) => {
	const input = z
		.object({
			firstName: text.optional(),
			lastName: text.optional(),
			phone: z.string().trim().max(50).optional(),
			city: z.string().trim().max(250).optional(),
			state: z.string().trim().max(250).optional(),
			country: z.string().trim().max(250).optional(),
		})
		.strict()
		.parse(req.body);
	const mapping = {
		firstName: "first_name",
		lastName: "last_name",
		phone: "phone",
		city: "city",
		state: "state",
		country: "country",
	};
	const entries = Object.entries(input);
	if (!entries.length) fail(400, "Chưa có thông tin cập nhật");
	const { rows } = await pool.query(
		`UPDATE users SET ${entries.map(([key], i) => `${mapping[key]}=$${i + 1}`).join(",")},updated_at=now() WHERE id=$${entries.length + 1} RETURNING *`,
		[...entries.map(([, value]) => value), req.user.id]
	);
	res.json({ data: userDTO(rows[0]) });
});
auth.post("/users/me/change-password", requireAuth, async (req, res) => {
	const input = z
		.object({ currentPassword: z.string().min(1).max(72), password: z.string().min(8).max(72) })
		.strict()
		.parse(req.body);
	const hash = await bcrypt.hash(input.password, 12);
	await transaction(async (db) => {
		const { rows } = await db.query("SELECT * FROM users WHERE id=$1 FOR UPDATE", [req.user.id]);
		if (!(await bcrypt.compare(input.currentPassword, rows[0].password_hash)))
			fail(400, "Mật khẩu hiện tại không đúng");
		await db.query("UPDATE users SET password_hash=$1,updated_at=now() WHERE id=$2", [hash, req.user.id]);
		await db.query("DELETE FROM sessions WHERE user_id=$1", [req.user.id]);
	});
	res.clearCookie(cookieName, cookieOptions);
	res.status(204).end();
});
const preferences = z
	.object({
		productUpdates: z.boolean(),
		securityUpdates: z.boolean(),
		phoneEmail: z.boolean(),
		phoneSecurity: z.boolean(),
	})
	.strict();
auth.get("/users/me/notification-preferences", requireAuth, (req, res) => res.json({ data: req.user.preferences }));
auth.patch("/users/me/notification-preferences", requireAuth, async (req, res) => {
	const input = preferences.parse(req.body);
	await pool.query("UPDATE users SET preferences=$1,updated_at=now() WHERE id=$2", [input, req.user.id]);
	res.json({ data: input });
});
