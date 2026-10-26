import bcrypt from "bcryptjs";

import { catalog } from "./catalog.js";
import { pool, transaction } from "./db.js";

export async function seed() {
	const production = process.env.NODE_ENV === "production";
	const email = (process.env.ADMIN_EMAIL || (!production ? "admin@gmail.com" : "")).trim().toLowerCase();
	const password = process.env.ADMIN_PASSWORD_B64
		? Buffer.from(process.env.ADMIN_PASSWORD_B64, "base64").toString("utf8")
		: process.env.ADMIN_PASSWORD || (!production ? "admin123" : "");
	if (!email || password.length < 8) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD (minimum 8 characters)");
	const hash = await bcrypt.hash(password, 12);
	await transaction(async (db) => {
		await db.query("SELECT pg_advisory_xact_lock(738195002)");
		await db.query(
			`INSERT INTO users(id,first_name,last_name,email,password_hash,role) VALUES('USR-ADMIN','Admin','User',$1,$2,'admin') ON CONFLICT DO NOTHING`,
			[email, hash]
		);
		for (const p of catalog) {
			await db.query("INSERT INTO categories(name) VALUES($1) ON CONFLICT DO NOTHING", [p.category]);
			const inserted = await db.query(
				`INSERT INTO products(id,name,category,description,price,old_price,image,accent,badge,stock,active)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true) ON CONFLICT DO NOTHING RETURNING id`,
				[p.id, p.name, p.category, p.description, p.price, p.oldPrice, p.image, p.accent, p.badge, p.stock]
			);
			if (inserted.rowCount && p.stock)
				await db.query(
					`INSERT INTO inventory_movements(product_id,kind,quantity_delta,stock_after,reason) VALUES($1,'opening',$2,$2,'Initial catalog')`,
					[p.id, p.stock]
				);
		}
	});
}
if (process.argv[1]?.endsWith("/seed.js")) {
	try {
		await seed();
		console.log("Seed applied (existing accounts unchanged)");
	} finally {
		await pool.end();
	}
}
