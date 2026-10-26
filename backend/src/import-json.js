import { readFile } from "node:fs/promises";

import { z } from "zod";

import { pool, transaction } from "./db.js";

const text = z.string().trim().min(1);
const money = z
	.number()
	.finite()
	.nonnegative()
	.refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.001);
const timestamp = z.string().datetime({ offset: true });
const customer = z.object({
	name: text,
	email: z.string().email(),
	phone: text,
	address: text,
	city: text,
	postalCode: text,
});
const schema = z.object({
	users: z.array(
		z.object({
			id: text,
			firstName: text,
			lastName: text,
			email: z
				.string()
				.trim()
				.email()
				.transform((v) => v.toLowerCase()),
			passwordHash: z.string().regex(/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/),
			role: z.enum(["admin", "client"]),
			createdAt: timestamp,
		})
	),
	products: z.array(
		z.object({
			id: text,
			name: text,
			category: text,
			description: z.string().default(""),
			price: money,
			oldPrice: money.nullable().optional(),
			image: z.string().default(""),
			accent: z.string().default("#e4f0e8"),
			badge: z.string().nullable().optional(),
			stock: z.number().int().nonnegative(),
			active: z.boolean().default(true),
		})
	),
	orders: z.array(
		z.object({
			id: text,
			userId: text,
			customer,
			paymentMethod: z.literal("cod"),
			status: z.enum(["pending", "processing", "shipped", "delivered", "cancelled"]),
			items: z
				.array(z.object({ productId: text, name: text, price: money, quantity: z.number().int().positive() }))
				.min(1),
			subtotal: money,
			shipping: money,
			total: money,
			createdAt: timestamp,
			updatedAt: timestamp,
		})
	),
});
export async function importJson(file, apply = false) {
	const data = schema.parse(JSON.parse(await readFile(file, "utf8")));
	const unique = (entries, label) => {
		if (new Set(entries).size !== entries.length) throw new Error(`Duplicate ${label}`);
	};
	unique(
		data.users.map((u) => u.id),
		"user IDs"
	);
	unique(
		data.users.map((u) => u.email),
		"emails"
	);
	unique(
		data.products.map((p) => p.id),
		"product IDs"
	);
	unique(
		data.orders.map((o) => o.id),
		"order IDs"
	);
	const users = new Set(data.users.map((u) => u.id)),
		products = new Set(data.products.map((p) => p.id));
	const cents = (v) => Math.round(v * 100);
	for (const order of data.orders) {
		if (!users.has(order.userId) || order.items.some((i) => !products.has(i.productId)))
			throw new Error(`Broken reference in ${order.id}`);
		unique(
			order.items.map((i) => i.productId),
			`items of ${order.id}`
		);
		if (
			order.items.reduce((s, i) => s + cents(i.price) * i.quantity, 0) !== cents(order.subtotal) ||
			cents(order.total) !== cents(order.subtotal) + cents(order.shipping)
		)
			throw new Error(`Invalid amounts in ${order.id}`);
	}
	const report = {
		users: data.users.length,
		products: data.products.length,
		orders: data.orders.length,
		applied: apply,
	};
	if (!apply) return report;
	await transaction(async (db) => {
		// Migration requires an empty target and an offline application. Never overwrite existing records.
		await db.query("LOCK TABLE users,products,orders IN ACCESS EXCLUSIVE MODE");
		const count = (
			await db.query(
				"SELECT (SELECT count(*) FROM users)+(SELECT count(*) FROM products)+(SELECT count(*) FROM orders) AS n"
			)
		).rows[0].n;
		if (Number(count) !== 0)
			throw new Error("Import requires an empty migrated database. Do not seed before importing.");
		for (const u of data.users)
			await db.query(
				"INSERT INTO users(id,first_name,last_name,email,password_hash,role,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)",
				[u.id, u.firstName, u.lastName, u.email, u.passwordHash, u.role, u.createdAt]
			);
		for (const p of data.products) {
			await db.query("INSERT INTO categories(name) VALUES($1) ON CONFLICT DO NOTHING", [p.category]);
			await db.query(
				"INSERT INTO products(id,name,category,description,price,old_price,image,accent,badge,stock,active) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)",
				[
					p.id,
					p.name,
					p.category,
					p.description,
					p.price,
					p.oldPrice ?? null,
					p.image,
					p.accent,
					p.badge ?? null,
					p.stock,
					p.active,
				]
			);
			if (p.stock)
				await db.query(
					"INSERT INTO inventory_movements(product_id,kind,quantity_delta,stock_after,reason) VALUES($1,'opening',$2,$2,'Imported current stock; historical sales already reflected')",
					[p.id, p.stock]
				);
		}
		for (const o of data.orders) {
			await db.query(
				"INSERT INTO orders(id,user_id,customer,payment_method,status,subtotal,shipping,total,idempotency_key,request_hash,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)",
				[
					o.id,
					o.userId,
					o.customer,
					o.paymentMethod,
					o.status,
					o.subtotal,
					o.shipping,
					o.total,
					`import:${o.id}`,
					"legacy-import",
					o.createdAt,
					o.updatedAt,
				]
			);
			for (const i of o.items)
				await db.query("INSERT INTO order_items(order_id,product_id,name,price,quantity) VALUES($1,$2,$3,$4,$5)", [
					o.id,
					i.productId,
					i.name,
					i.price,
					i.quantity,
				]);
			await db.query("INSERT INTO order_status_history(order_id,to_status,created_at) VALUES($1,$2,$3)", [
				o.id,
				o.status,
				o.updatedAt,
			]);
		}
	});
	return report;
}
if (process.argv[1]?.endsWith("/import-json.js")) {
	try {
		const file = process.argv[2];
		if (!file || file.startsWith("--"))
			throw new Error("Usage: npm run import:json -- /path/to/db.json [--apply] (default: validation only)");
		console.log(await importJson(file, process.argv.includes("--apply")));
	} finally {
		await pool.end();
	}
}
