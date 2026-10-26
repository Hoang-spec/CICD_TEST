import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { after, before, test } from "node:test";

import pg from "pg";

if (!process.env.TEST_DATABASE_URL || process.env.TEST_DATABASE_URL === process.env.DATABASE_URL)
	throw new Error("TEST_DATABASE_URL must point to a dedicated test database");
const schema = `test_${randomUUID().replaceAll("-", "")}`;
const cleanup = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
await cleanup.query(`CREATE SCHEMA "${schema}"`);
const url = new URL(process.env.TEST_DATABASE_URL);
url.searchParams.set("options", `-c search_path=${schema}`);
process.env.DATABASE_URL = url.toString();
process.env.NODE_ENV = "test";
const { pool } = await import("../src/db.js");
const { migrate } = await import("../src/migrate.js");
const { seed } = await import("../src/seed.js");
const { app } = await import("../src/app.js");
let server, base, admin, client, other, product, order;
const customer = {
	name: "Test Customer",
	email: "client@example.com",
	phone: "0901234567",
	address: "1 Test Street",
	city: "HCM",
	postalCode: "700000",
};
async function request(path, { method = "GET", body, cookie, key, headers = {} } = {}) {
	const response = await fetch(base + path, {
		method,
		headers: {
			"Content-Type": "application/json",
			"X-Atelier-Request": "1",
			...(cookie ? { Cookie: cookie } : {}),
			...(key ? { "Idempotency-Key": key } : {}),
			...headers,
		},
		body: body === undefined ? undefined : JSON.stringify(body),
	});
	const text = await response.text();
	return {
		status: response.status,
		body: text ? JSON.parse(text) : null,
		cookie: response.headers.get("set-cookie")?.split(";")[0],
	};
}
async function register(email) {
	const r = await request("/auth/register", {
		method: "POST",
		body: { firstName: "Test", lastName: "User", email, password: "Client123" },
	});
	assert.equal(r.status, 201, JSON.stringify(r.body));
	return r.cookie;
}
before(async () => {
	await migrate();
	await migrate();
	await seed();
	await seed();
	server = app.listen(0, "127.0.0.1");
	await once(server, "listening");
	base = `http://127.0.0.1:${server.address().port}/api`;
	admin = (await request("/auth/login", { method: "POST", body: { email: "admin@gmail.com", password: "admin123" } }))
		.cookie;
	client = await register("client@example.com");
	other = await register("other@example.com");
});
after(async () => {
	if (server) await new Promise((resolve) => server.close(resolve));
	await pool.end();
	await cleanup.query(`DROP SCHEMA "${schema}" CASCADE`);
	await cleanup.end();
});
test("auth, unique normalized email, authorization and CSRF", async () => {
	assert.equal(
		(
			await request("/auth/register", {
				method: "POST",
				body: { firstName: "Other", lastName: "User", email: "CLIENT@example.com", password: "Client123" },
			})
		).status,
		409
	);
	assert.equal((await request("/admin/products", { cookie: client })).status, 403);
	assert.equal((await request("/orders")).status, 401);
	assert.equal(
		(
			await request("/auth/login", {
				method: "POST",
				body: { email: "admin@gmail.com", password: "admin123" },
				headers: { Origin: "https://foreign.example" },
			})
		).status,
		403
	);
	assert.equal(
		(await request("/auth/logout", { method: "POST", cookie: client, headers: { "X-Atelier-Request": "" } })).status,
		403
	);
});
test("catalog creation, strict validation, exact money and pagination", async () => {
	const r = await request("/products", {
		method: "POST",
		cookie: admin,
		body: { name: "Last item", category: "Testing", price: 0.1, stock: 1 },
	});
	assert.equal(r.status, 201, JSON.stringify(r.body));
	product = r.body.data;
	assert.equal(product.price, "0.10");
	assert.equal(
		(
			await request("/products", {
				method: "POST",
				cookie: admin,
				body: { name: "Invalid", category: "Testing", price: null, stock: 1 },
			})
		).status,
		400
	);
	const list = await request("/admin/products?pageSize=1", { cookie: admin });
	assert.equal(list.body.data.length, 1);
	assert.ok(list.body.pagination.total > 1);
	assert.equal((await request("/products?pageSize=1000")).status, 400);
});
test("concurrent final-item checkout and idempotent retries", async () => {
	const input = { customer, paymentMethod: "cod", items: [{ productId: product.id, quantity: 1 }] };
	const results = await Promise.all([
		request("/orders", { method: "POST", cookie: client, key: "checkout-attempt-1", body: input }),
		request("/orders", { method: "POST", cookie: other, key: "checkout-attempt-2", body: input }),
	]);
	assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
	const winner = results.findIndex((r) => r.status === 201);
	order = results[winner].body.data;
	const cookie = winner === 0 ? client : other;
	const key = `checkout-attempt-${winner + 1}`;
	assert.equal(order.subtotal, "0.10");
	assert.equal(order.total, "5.10");
	const repeated = await Promise.all([
		request("/orders", { method: "POST", cookie, key, body: input }),
		request("/orders", { method: "POST", cookie, key, body: input }),
	]);
	assert.ok(repeated.every((r) => r.status === 200 && r.body.data.id === order.id));
	assert.equal(
		(
			await request("/orders", {
				method: "POST",
				cookie,
				key,
				body: { ...input, customer: { ...customer, name: "Different" } },
			})
		).status,
		409
	);
	assert.equal((await request(`/orders/${order.id}`, { cookie: winner === 0 ? other : client })).status, 404);
	assert.equal((await request(`/products/${product.id}`)).body.data.stock, 0);
	assert.equal(Number((await pool.query("SELECT count(*) FROM orders")).rows[0].count), 1);
});
test("concurrent cancellation restores inventory exactly once", async () => {
	const results = await Promise.all([
		request(`/orders/${order.id}/status`, { method: "PATCH", cookie: admin, body: { status: "cancelled" } }),
		request(`/orders/${order.id}/status`, { method: "PATCH", cookie: admin, body: { status: "cancelled" } }),
	]);
	assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
	assert.equal((await request(`/products/${product.id}`)).body.data.stock, 1);
	assert.equal(
		Number(
			(await pool.query("SELECT count(*) FROM inventory_movements WHERE order_id=$1 AND kind='cancel'", [order.id]))
				.rows[0].count
		),
		1
	);
});
test("failed checkout keeps stock; fake totals/card are rejected", async () => {
	const input = {
		customer,
		paymentMethod: "cod",
		items: [
			{ productId: product.id, quantity: 1 },
			{ productId: "missing", quantity: 1 },
		],
	};
	assert.equal(
		(await request("/orders", { method: "POST", cookie: client, key: "failed-checkout", body: input })).status,
		409
	);
	assert.equal((await request(`/products/${product.id}`)).body.data.stock, 1);
	assert.equal(
		(
			await request("/orders", {
				method: "POST",
				cookie: client,
				key: "fake-price-attempt",
				body: { ...input, total: 0 },
			})
		).status,
		400
	);
	assert.equal(
		(
			await request("/orders", {
				method: "POST",
				cookie: client,
				key: "card-attempt",
				body: { ...input, paymentMethod: "card" },
			})
		).status,
		400
	);
});
test("delivered sales, immutable snapshots and product archive", async () => {
	const r = await request("/orders", {
		method: "POST",
		cookie: client,
		key: "second-order-attempt",
		body: { customer, paymentMethod: "cod", items: [{ productId: product.id, quantity: 1 }] },
	});
	assert.equal(r.status, 201);
	const id = r.body.data.id;
	await request(`/products/${product.id}`, { method: "PATCH", cookie: admin, body: { price: 99, name: "Renamed" } });
	for (const status of ["processing", "shipped", "delivered"])
		assert.equal(
			(await request(`/orders/${id}/status`, { method: "PATCH", cookie: admin, body: { status } })).status,
			200
		);
	assert.equal((await request("/admin/dashboard", { cookie: admin })).body.data.revenue, "5.10");
	await request(`/products/${product.id}`, { method: "DELETE", cookie: admin });
	assert.equal((await request(`/products/${product.id}`)).status, 404);
	const saved = (await request(`/orders/${id}`, { cookie: client })).body.data;
	assert.equal(saved.items[0].price, "0.10");
	assert.equal(saved.items[0].name, "Last item");
});
test("profile/preferences persist; password changes revoke all sessions", async () => {
	const login = (
		await request("/auth/login", { method: "POST", body: { email: "client@example.com", password: "Client123" } })
	).cookie;
	assert.equal(
		(await request("/users/me", { method: "PATCH", cookie: client, body: { firstName: "Updated" } })).body.data
			.firstName,
		"Updated"
	);
	const prefs = { productUpdates: true, securityUpdates: false, phoneEmail: false, phoneSecurity: true };
	assert.equal(
		(await request("/users/me/notification-preferences", { method: "PATCH", cookie: client, body: prefs })).status,
		200
	);
	assert.deepEqual((await request("/users/me/notification-preferences", { cookie: client })).body.data, prefs);
	assert.equal(
		(
			await request("/users/me/change-password", {
				method: "POST",
				cookie: client,
				body: { currentPassword: "Client123", password: "Replacement123" },
			})
		).status,
		204
	);
	assert.equal((await request("/auth/me", { cookie: client })).status, 401);
	assert.equal((await request("/auth/me", { cookie: login })).status, 401);
	const newLogin = await request("/auth/login", {
		method: "POST",
		body: { email: "client@example.com", password: "Replacement123" },
	});
	assert.equal(newLogin.status, 200);
	assert.equal((await request("/auth/logout", { method: "POST", cookie: newLogin.cookie })).status, 204);
	assert.equal((await request("/auth/me", { cookie: newLogin.cookie })).status, 401);
});

test("database failure after stock update rolls back the entire checkout", async () => {
	const created = await request("/products", {
		method: "POST",
		cookie: admin,
		body: { name: "Rollback test", category: "Testing", price: 12.34, stock: 2 },
	});
	const id = created.body.data.id;
	const before = Number((await pool.query("SELECT count(*) FROM orders")).rows[0].count);
	await pool.query(
		`CREATE FUNCTION reject_test_sale() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind='sale' THEN RAISE EXCEPTION 'Injected storage failure'; END IF; RETURN NEW; END $$`
	);
	await pool.query(
		"CREATE TRIGGER reject_test_sale BEFORE INSERT ON inventory_movements FOR EACH ROW EXECUTE FUNCTION reject_test_sale()"
	);
	try {
		const failed = await request("/orders", {
			method: "POST",
			cookie: other,
			key: "transaction-rollback",
			body: { customer, paymentMethod: "cod", items: [{ productId: id, quantity: 1 }] },
		});
		assert.equal(failed.status, 500);
		assert.equal((await request(`/products/${id}`)).body.data.stock, 2);
		assert.equal(Number((await pool.query("SELECT count(*) FROM orders")).rows[0].count), before);
	} finally {
		await pool.query("DROP TRIGGER reject_test_sale ON inventory_movements");
		await pool.query("DROP FUNCTION reject_test_sale()");
	}
	const retry = await request("/orders", {
		method: "POST",
		cookie: other,
		key: "transaction-rollback",
		body: { customer, paymentMethod: "cod", items: [{ productId: id, quantity: 1 }] },
	});
	assert.equal(retry.status, 201);
});

test("JSON importer validates data and refuses to overwrite a populated database", async () => {
	const { importJson } = await import("../src/import-json.js");
	const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
	const { tmpdir } = await import("node:os");
	const { join } = await import("node:path");
	const directory = await mkdtemp(join(tmpdir(), "atelier-import-"));
	const file = join(directory, "db.json");
	try {
		const hash = (await pool.query("SELECT password_hash FROM users WHERE role='admin' LIMIT 1")).rows[0].password_hash;
		const data = {
			users: [
				{
					id: "IMPORT-USER",
					firstName: "Import",
					lastName: "User",
					email: "import@example.com",
					passwordHash: hash,
					role: "client",
					createdAt: new Date().toISOString(),
				},
			],
			products: [],
			orders: [],
		};
		await writeFile(file, JSON.stringify(data));
		assert.deepEqual(await importJson(file), { users: 1, products: 0, orders: 0, applied: false });
		await assert.rejects(importJson(file, true), /empty migrated database/);
		await writeFile(file, JSON.stringify({ ...data, users: [...data.users, ...data.users] }));
		await assert.rejects(importJson(file), /Duplicate/);
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test("partial product updates preserve omitted fields and archived state", async () => {
	const created = await request("/products", {
		method: "POST",
		cookie: admin,
		body: {
			name: "Partial",
			category: "Testing",
			price: 10,
			stock: 3,
			image: "/custom.png",
			badge: "New",
			active: false,
		},
	});
	assert.equal(created.status, 201);
	const id = created.body.data.id;
	const updated = await request(`/products/${id}`, { method: "PATCH", cookie: admin, body: { price: 11 } });
	assert.equal(updated.body.data.active, false);
	assert.equal(updated.body.data.image, "/custom.png");
	assert.equal(updated.body.data.badge, "New");
	assert.equal(updated.body.data.stock, 3);
	const adjustment = await request(`/admin/products/${id}/stock-adjustments`, {
		method: "POST",
		cookie: admin,
		body: { delta: -4, reason: "Invalid reduction" },
	});
	assert.equal(adjustment.status, 409);
	assert.equal(
		(await request(`/products/${id}`, { method: "PATCH", cookie: admin, body: { stock: 100 } })).status,
		400
	);
});
