import { z } from "zod";

export const text = z.string().trim().min(1).max(250);
export function fail(status, message) {
	const error = new Error(message);
	error.status = status;
	throw error;
}
export const userDTO = (u) => ({
	id: u.id,
	firstName: u.first_name,
	lastName: u.last_name,
	name: `${u.first_name} ${u.last_name}`.trim(),
	email: u.email,
	role: u.role,
	phone: u.phone,
	city: u.city,
	state: u.state,
	country: u.country,
	avatar: u.avatar,
	createdAt: u.created_at,
});
export const productDTO = (p) => ({
	id: p.id,
	name: p.name,
	category: p.category,
	description: p.description,
	price: p.price,
	oldPrice: p.old_price,
	image: p.image,
	accent: p.accent,
	badge: p.badge,
	stock: p.stock,
	active: p.active,
});
export const orderDTO = (o) => ({
	id: o.id,
	userId: o.user_id,
	customer: o.customer,
	paymentMethod: o.payment_method,
	currency: o.currency,
	status: o.status,
	subtotal: o.subtotal,
	shipping: o.shipping,
	total: o.total,
	items: o.items ?? [],
	createdAt: o.created_at,
	updatedAt: o.updated_at,
});
// A bounded page is returned even when callers omit pagination.
export function pagination(query) {
	const schema = z.coerce.number().int().min(1);
	const page = schema.max(100000).parse(query.page ?? 1);
	const pageSize = schema.max(100).parse(query.pageSize ?? 20);
	return { page, pageSize, offset: (page - 1) * pageSize };
}
export async function listOrders(db, where, values = [], limit = 100, offset = 0) {
	const result = await db.query(
		`SELECT o.*, COALESCE((SELECT jsonb_agg(jsonb_build_object('productId',i.product_id,'name',i.name,'price',i.price::text,'quantity',i.quantity) ORDER BY i.product_id) FROM order_items i WHERE i.order_id=o.id),'[]'::jsonb) items FROM orders o WHERE ${where} ORDER BY o.created_at DESC,o.id LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
		[...values, limit, offset]
	);
	return result.rows.map(orderDTO);
}
