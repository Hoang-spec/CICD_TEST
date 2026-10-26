import { readdir, readFile } from "node:fs/promises";

import { pool, transaction } from "./db.js";

export async function migrate() {
	await transaction(async (db) => {
		await db.query("SELECT pg_advisory_xact_lock(738195001)");
		await db.query(
			"CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())"
		);
		const directory = new URL("../migrations/", import.meta.url);
		for (const name of (await readdir(directory)).filter((n) => n.endsWith(".sql")).sort()) {
			if ((await db.query("SELECT 1 FROM schema_migrations WHERE name=$1", [name])).rowCount) continue;
			await db.query(await readFile(new URL(name, directory), "utf8"));
			await db.query("INSERT INTO schema_migrations(name) VALUES($1)", [name]);
		}
	});
}
if (process.argv[1]?.endsWith("/migrate.js")) {
	try {
		await migrate();
		console.log("Migrations applied");
	} finally {
		await pool.end();
	}
}
