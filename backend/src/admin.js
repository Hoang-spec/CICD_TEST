import { Router } from "express";
import { z } from "zod";

import { requireAdmin, requireAuth } from "./auth.js";
import { pool, transaction } from "./db.js";
import { listOrders, pagination, productDTO, userDTO } from "./http.js";

export const admin = Router();
admin.use("/admin", requireAuth, requireAdmin);
admin.get("/admin/customers", async (req, res) => {
	const p = pagination(req.query);
	const search = z
		.string()
		.max(250)
		.parse(req.query.search ?? "");
	const where = `u.role='client' AND ($1='' OR concat(u.first_name,' ',u.last_name,' ',u.email) ILIKE '%'||$1||'%')`;
	const { rows } = await pool.query(
		`SELECT u.*, (SELECT count(*)::int FROM orders o WHERE o.user_id=u.id) order_count,(SELECT coalesce(sum(o.total),0)::text FROM orders o WHERE o.user_id=u.id AND o.status='delivered') total_spent FROM users u WHERE ${where} ORDER BY u.created_at DESC,u.id LIMIT $2 OFFSET $3`,
		[search, p.pageSize, p.offset]
	);
	const total = Number((await pool.query(`SELECT count(*) FROM users u WHERE ${where}`, [search])).rows[0].count);
	res.json({
		data: rows.map((u) => ({ ...userDTO(u), orderCount: u.order_count, totalSpent: u.total_spent })),
		pagination: { page: p.page, pageSize: p.pageSize, total },
	});
});
admin.get("/admin/dashboard", async (_req, res) => {
	const data = await transaction(async (db) => {
		await db.query("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
		const stats = (
			await db.query(
				`SELECT (SELECT count(*)::int FROM users WHERE role='client') "totalCustomers",(SELECT count(*)::int FROM products WHERE active) "totalProducts",count(*)::int "totalOrders",count(*) FILTER(WHERE status='pending')::int "pendingOrders",coalesce(sum(total) FILTER(WHERE status='delivered'),0)::text revenue,coalesce(sum(total) FILTER(WHERE status<>'cancelled'),0)::text "placedOrderValue" FROM orders`
			)
		).rows[0];
		const low = (await db.query("SELECT * FROM products WHERE active AND stock<=5 ORDER BY stock,id LIMIT 20")).rows;
		const best = (
			await db.query(
				`SELECT p.*,s.quantity FROM products p JOIN (SELECT i.product_id,sum(i.quantity)::int quantity FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.status='delivered' GROUP BY i.product_id ORDER BY quantity DESC,i.product_id LIMIT 5) s ON s.product_id=p.id ORDER BY s.quantity DESC,p.id`
			)
		).rows;
		return {
			...stats,
			lowStockProducts: low.map(productDTO),
			bestSellingProducts: best.map((p) => ({ product: productDTO(p), quantity: p.quantity })),
			latestOrders: await listOrders(db, "true", [], 5),
		};
	});
	res.json({ data });
});
