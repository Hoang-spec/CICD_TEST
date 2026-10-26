import { app } from "./app.js";
import { pool } from "./db.js";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required. Run migrations and seed before starting.");
if (process.env.NODE_ENV === "production" && !process.env.CLIENT_ORIGIN)
	throw new Error("CLIENT_ORIGIN is required in production");
await pool.query("SELECT 1 FROM schema_migrations LIMIT 1");
const server = app.listen(Number(process.env.PORT ?? 4000), () => console.log("Atelier API ready"));
for (const signal of ["SIGTERM", "SIGINT"])
	process.on(signal, () => {
		server.close(async () => {
			await pool.end();
			process.exit(0);
		});
		setTimeout(() => process.exit(1), 10000).unref();
	});
