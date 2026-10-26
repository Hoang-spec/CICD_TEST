"use client";

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
	const response = await fetch(`/api${path}`, {
		...options,
		credentials: "same-origin",
		headers: { "Content-Type": "application/json", "X-Atelier-Request": "1", ...options.headers },
		cache: "no-store",
	});
	if (response.status === 204) return undefined as T;
	const body = (await response.json()) as { error?: string };
	if (!response.ok) throw new ApiError(body.error ?? "Không thể kết nối máy chủ", response.status);
	return body as T;
}
export class ApiError extends Error {
	constructor(
		message: string,
		public status: number
	) {
		super(message);
	}
}
export interface PageResult<T> {
	data: T[];
	pagination: { page: number; pageSize: number; total: number };
}
// Current screens filter locally. Fetch every bounded API page rather than silently showing only the first page.
export async function allPages<T>(path: string): Promise<T[]> {
	const entries: T[] = [];
	let page = 1;
	while (true) {
		const result = await api<PageResult<T>>(`${path}${path.includes("?") ? "&" : "?"}page=${page}&pageSize=100`);
		entries.push(...result.data);
		if (entries.length >= result.pagination.total || result.data.length === 0) return entries;
		page++;
	}
}
