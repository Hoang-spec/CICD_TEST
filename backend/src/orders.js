import { createHash, randomUUID } from "node:crypto";

import { Router } from "express";
import { z } from "zod";

import { requireAdmin, requireAuth } from "./auth.js";
import { pool, transaction } from "./db.js";
import { fail, listOrders, pagination, text } from "./http.js";

export const orders = Router();
orders.use("/orders", requireAuth);
const inputSchema = z
	.object({
		customer: z
			.object({
				name: text,
				email: z.string().trim().email().max(250),
				phone: text,
				address: text,
				city: text,
				postalCode: text,
			})
			.strict(),
		paymentMethod: z.literal("cod"),
		items: z
			.array(z.object({ productId: text, quantity: z.number().int().min(1).max(1000000) }).strict())
			.min(1)
			.max(100),
	})
	.strict();
orders.post("/orders", async (req, res) => {
	const input = inputSchema.parse(req.body);
	const key = z.string().min(8).max(128).parse(req.get("Idempotency-Key"));
	const quantities = new Map();
	for (const item of input.items) quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
	const items = [...quantities].sort(([a], [b]) => a.localeCompare(b));
	const hash = createHash("sha256")
		.update(JSON.stringify({ ...input, items }))
		.digest("hex");
	const result = await transaction(async (db) => {
		// Serialize only retries for this user/key; unrelated checkouts use row locks.
		await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [JSON.stringify([req.user.id, key])]);
		const existing = (
			await db.query("SELECT id,request_hash FROM orders WHERE user_id=$1 AND idempotency_key=$2", [req.user.id, key])
		).rows[0];
		if (existing) {
			if (existing.request_hash !== hash) fail(409, "Mã đặt hàng đã được dùng với nội dung khác");
			return { order: (await listOrders(db, "o.id=$1", [existing.id]))[0], replay: true };
		}
		const locked = (
			await db.query("SELECT * FROM products WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE", [
				items.map(([id]) => id),
			])
		).rows;
		for (const [id, quantity] of items) {
			const p = locked.find((p) => p.id === id);
			if (!p || !p.active) fail(409, "Một sản phẩm không còn bán");
			if (p.stock < quantity) fail(409, `Sản phẩm ${p.name} chỉ còn ${p.stock} trong kho`);
		}
		const id = `ORD-${randomUUID()}`;
		// SQL numeric arithmetic keeps prices exact throughout checkout.
		await db.query(
			`INSERT INTO orders(id,user_id,customer,payment_method,status,subtotal,shipping,total,idempotency_key,request_hash) VALUES($1,$2,$3,'cod','pending',0,0,0,$4,$5)`,
			[id, req.user.id, input.customer, key, hash]
		);
		for (const [productId, quantity] of items) {
			await db.query(
				`INSERT INTO order_items(order_id,product_id,name,price,quantity) SELECT $1,id,name,price,$3 FROM products WHERE id=$2`,
				[id, productId, quantity]
			);
			const p = (
				await db.query("UPDATE products SET stock=stock-$1,updated_at=now() WHERE id=$2 RETURNING stock", [
					quantity,
					productId,
				])
			).rows[0];
			await db.query(
				`INSERT INTO inventory_movements(product_id,order_id,actor_user_id,kind,quantity_delta,stock_after,reason) VALUES($1,$2,$3,'sale',$4,$5,'Order placed')`,
				[productId, id, req.user.id, -quantity, p.stock]
			);
		}
		await db.query(
			`WITH amounts AS (SELECT sum(price*quantity) subtotal FROM order_items WHERE order_id=$1), totals AS (SELECT subtotal,CASE WHEN subtotal>0 AND subtotal<50 THEN 5 ELSE 0 END shipping FROM amounts) UPDATE orders SET subtotal=t.subtotal,shipping=t.shipping,total=t.subtotal+t.shipping FROM totals t WHERE orders.id=$1`,
			[id]
		);
		await db.query(`INSERT INTO order_status_history(order_id,to_status,actor_user_id) VALUES($1,'pending',$2)`, [
			id,
			req.user.id,
		]);
		return { order: (await listOrders(db, "o.id=$1", [id]))[0], replay: false };
	});
	res.status(result.replay ? 200 : 201).json({ data: result.order });
});
orders.get("/orders", async (req, res) => {
	const p = pagination(req.query);
	const values = [req.user.role === "admin", req.user.id];
	let where = "($1::boolean OR o.user_id=$2)";
	if (req.query.status) {
		const status = z.enum(["pending", "processing", "shipped", "delivered", "cancelled"]).parse(req.query.status);
		values.push(status);
		where += " AND o.status=$3";
	}
	const data = await listOrders(pool, where, values, p.pageSize, p.offset);
	const total = Number((await pool.query(`SELECT count(*) FROM orders o WHERE ${where}`, values)).rows[0].count);
	res.json({ data, pagination: { page: p.page, pageSize: p.pageSize, total } });
});
orders.get("/orders/:id", async (req, res) => {
	const result = await listOrders(pool, "o.id=$1 AND ($2::boolean OR o.user_id=$3)", [
		req.params.id,
		req.user.role === "admin",
		req.user.id,
	]);
	if (!result[0]) fail(404, "Không tìm thấy đơn hàng");
	res.json({ data: result[0] });
});
orders.patch("/orders/:id/status", requireAdmin, async (req, res) => {
	const { status } = z
		.object({ status: z.enum(["pending", "processing", "shipped", "delivered", "cancelled"]) })
		.strict()
		.parse(req.body);
	const result = await transaction(async (db) => {
		const order = (await db.query("SELECT * FROM orders WHERE id=$1 FOR UPDATE", [req.params.id])).rows[0];
		if (!order) fail(404, "Không tìm thấy đơn hàng");
		const transitions = {
			pending: ["processing", "cancelled"],
			processing: ["shipped", "cancelled"],
			shipped: ["delivered"],
			delivered: [],
			cancelled: [],
		};
		if (!transitions[order.status].includes(status)) fail(409, `Không thể chuyển từ ${order.status} sang ${status}`);
		if (status === "cancelled") {
			const items = (await db.query("SELECT * FROM order_items WHERE order_id=$1 ORDER BY product_id", [order.id]))
				.rows;
			await db.query("SELECT id FROM products WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE", [
				items.map((i) => i.product_id),
			]);
			for (const item of items) {
				const p = (
					await db.query("UPDATE products SET stock=stock+$1,updated_at=now() WHERE id=$2 RETURNING stock", [
						item.quantity,
						item.product_id,
					])
				).rows[0];
				await db.query(
					`INSERT INTO inventory_movements(product_id,order_id,actor_user_id,kind,quantity_delta,stock_after,reason) VALUES($1,$2,$3,'cancel',$4,$5,'Order cancelled')`,
					[item.product_id, order.id, req.user.id, item.quantity, p.stock]
				);
			}
		}
		await db.query("UPDATE orders SET status=$1,updated_at=now() WHERE id=$2", [status, order.id]);
		await db.query(
			"INSERT INTO order_status_history(order_id,from_status,to_status,actor_user_id) VALUES($1,$2,$3,$4)",
			[order.id, order.status, status, req.user.id]
		);
		return (await listOrders(db, "o.id=$1", [order.id]))[0];
	});
	res.json({ data: result });
});
