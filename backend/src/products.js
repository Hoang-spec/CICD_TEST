import { randomUUID } from "node:crypto";

import { Router } from "express";
import { z } from "zod";

import { requireAdmin, requireAuth } from "./auth.js";
import { pool, transaction } from "./db.js";
import { fail, pagination, productDTO, text } from "./http.js";

export const products = Router();
const money = z
	.number()
	.finite()
	.min(0)
	.max(999999999999.99)
	.refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.001, "Giá có tối đa 2 chữ số thập phân");
const schema = z
	.object({
		name: text,
		category: text,
		description: z.string().max(10000).default(""),
		price: money,
		oldPrice: money.nullable().default(null),
		image: z.string().max(2000).default(""),
		accent: z
			.string()
			.regex(/^#[0-9a-fA-F]{6}$/)
			.default("#e4f0e8"),
		badge: z.string().max(100).nullable().default(null),
		stock: z.number().int().min(0).max(1000000000),
		active: z.boolean().default(true),
	})
	.strict();
async function listing(req, res, admin = false) {
	const p = pagination(req.query);
	const search = z
		.string()
		.max(250)
		.parse(req.query.search ?? "");
	const category = z
		.string()
		.max(250)
		.parse(req.query.category ?? "");
	const where = `($1::boolean OR active) AND ($2='' OR name ILIKE '%'||$2||'%' OR description ILIKE '%'||$2||'%') AND ($3='' OR category=$3)`;
	const values = [admin, search, category];
	const result = await pool.query(
		`SELECT * FROM products WHERE ${where} ORDER BY created_at DESC,id LIMIT $4 OFFSET $5`,
		[...values, p.pageSize, p.offset]
	);
	const count = await pool.query(`SELECT count(*) FROM products WHERE ${where}`, values);
	res.json({
		data: result.rows.map(productDTO),
		pagination: { page: p.page, pageSize: p.pageSize, total: Number(count.rows[0].count) },
	});
}
products.get("/categories", async (_req, res) =>
	res.json({
		data: (await pool.query("SELECT DISTINCT category AS name FROM products WHERE active ORDER BY category")).rows,
	})
);
products.get("/products", (req, res) => listing(req, res));
products.get("/admin/products", requireAuth, requireAdmin, (req, res) => listing(req, res, true));
products.get("/products/:id", async (req, res) => {
	const { rows } = await pool.query("SELECT * FROM products WHERE id=$1 AND active", [req.params.id]);
	if (!rows[0]) fail(404, "Không tìm thấy sản phẩm");
	res.json({ data: productDTO(rows[0]) });
});
async function movement(db, p, delta, user, kind = "adjustment", reason = "Admin stock update") {
	if (delta)
		await db.query(
			`INSERT INTO inventory_movements(product_id,actor_user_id,kind,quantity_delta,stock_after,reason) VALUES($1,$2,$3,$4,$5,$6)`,
			[p.id, user, kind, delta, p.stock, reason]
		);
}
products.post("/products", requireAuth, requireAdmin, async (req, res) => {
	const p = schema.parse(req.body);
	const result = await transaction(async (db) => {
		await db.query("INSERT INTO categories(name) VALUES($1) ON CONFLICT DO NOTHING", [p.category]);
		const { rows } = await db.query(
			`INSERT INTO products(id,name,category,description,price,old_price,image,accent,badge,stock,active) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
			[
				`PRD-${randomUUID()}`,
				p.name,
				p.category,
				p.description,
				p.price,
				p.oldPrice,
				p.image,
				p.accent,
				p.badge,
				p.stock,
				p.active,
			]
		);
		await movement(db, rows[0], p.stock, req.user.id, "opening", "Product created");
		return productDTO(rows[0]);
	});
	res.status(201).json({ data: result });
});
products.patch("/products/:id", requireAuth, requireAdmin, async (req, res) => {
	// Stock changes have a separate endpoint to avoid stale edit forms overwriting sales.
	const parsed = schema.omit({ stock: true }).partial().strict().parse(req.body);
	// Zod 4 applies field defaults inside partial objects; PATCH must update only supplied keys.
	const input = Object.fromEntries(Object.entries(parsed).filter(([key]) => Object.hasOwn(req.body, key)));
	const mapping = {
		name: "name",
		category: "category",
		description: "description",
		price: "price",
		oldPrice: "old_price",
		image: "image",
		accent: "accent",
		badge: "badge",
		active: "active",
	};
	const entries = Object.entries(input);
	if (!entries.length) fail(400, "Chưa có thông tin cập nhật");
	const result = await transaction(async (db) => {
		if (input.category)
			await db.query("INSERT INTO categories(name) VALUES($1) ON CONFLICT DO NOTHING", [input.category]);
		const { rows } = await db.query(
			`UPDATE products SET ${entries.map(([k], i) => `${mapping[k]}=$${i + 1}`).join(",")},updated_at=now() WHERE id=$${entries.length + 1} RETURNING *`,
			[...entries.map(([, v]) => v), req.params.id]
		);
		if (!rows[0]) fail(404, "Không tìm thấy sản phẩm");
		return productDTO(rows[0]);
	});
	res.json({ data: result });
});
products.post("/admin/products/:id/stock-adjustments", requireAuth, requireAdmin, async (req, res) => {
	const input = z
		.object({
			delta: z
				.number()
				.int()
				.min(-1000000000)
				.max(1000000000)
				.refine((v) => v !== 0),
			reason: text,
		})
		.strict()
		.parse(req.body);
	const result = await transaction(async (db) => {
		const { rows } = await db.query("SELECT * FROM products WHERE id=$1 FOR UPDATE", [req.params.id]);
		if (!rows[0]) fail(404, "Không tìm thấy sản phẩm");
		const stock = rows[0].stock + input.delta;
		if (stock < 0 || stock > 1000000000) fail(409, "Tồn kho không hợp lệ");
		const updated = (
			await db.query("UPDATE products SET stock=$1,updated_at=now() WHERE id=$2 RETURNING *", [stock, req.params.id])
		).rows[0];
		await movement(db, updated, input.delta, req.user.id, "adjustment", input.reason);
		return productDTO(updated);
	});
	res.json({ data: result });
});
products.delete("/products/:id", requireAuth, requireAdmin, async (req, res) => {
	const { rowCount } = await pool.query("UPDATE products SET active=false,updated_at=now() WHERE id=$1", [
		req.params.id,
	]);
	if (!rowCount) fail(404, "Không tìm thấy sản phẩm");
	res.status(204).end();
});
