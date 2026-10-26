"use client";

import { allPages, api } from "@/lib/api";
import type { Product } from "@/lib/shop-products";

export interface StoreProduct extends Product {
	stock: number;
	active: boolean;
}
export interface StoreOrder {
	id: string;
	userId: string;
	customer: { name: string; email: string; phone: string; address: string; city: string; postalCode: string };
	paymentMethod: string;
	items: { productId: string; name: string; price: number; quantity: number }[];
	subtotal: number;
	shipping: number;
	total: number;
	status: "pending" | "processing" | "shipped" | "delivered" | "cancelled";
	createdAt: string;
	updatedAt: string;
}
// Database/API money is decimal text; the UI uses numbers only for display and estimates.
function product(value: StoreProduct): StoreProduct {
	return { ...value, price: Number(value.price), oldPrice: value.oldPrice == null ? null : Number(value.oldPrice) };
}
function order(value: StoreOrder): StoreOrder {
	return {
		...value,
		subtotal: Number(value.subtotal),
		shipping: Number(value.shipping),
		total: Number(value.total),
		items: value.items.map((i) => ({ ...i, price: Number(i.price) })),
	};
}
export async function getProducts(admin = false): Promise<StoreProduct[]> {
	return (await allPages<StoreProduct>(admin ? "/admin/products" : "/products")).map(product);
}
export async function getOrders(): Promise<StoreOrder[]> {
	return (await allPages<StoreOrder>("/orders")).map(order);
}
export async function updateOrderStatus(id: string, status: StoreOrder["status"]): Promise<StoreOrder> {
	return order(
		(await api<{ data: StoreOrder }>(`/orders/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }))
			.data
	);
}
export async function createOrder(
	input: { customer: StoreOrder["customer"]; paymentMethod: string; items: { productId: string; quantity: number }[] },
	key: string
): Promise<StoreOrder> {
	return order(
		(
			await api<{ data: StoreOrder }>("/orders", {
				method: "POST",
				headers: { "Idempotency-Key": key },
				body: JSON.stringify(input),
			})
		).data
	);
}
