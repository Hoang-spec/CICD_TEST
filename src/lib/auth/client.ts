"use client";

import type { User } from "@/types/user";
import { api, ApiError } from "@/lib/api";

class AuthClient {
	private async action(path: string, params?: unknown): Promise<{ error?: string }> {
		try {
			await api(path, { method: "POST", body: params ? JSON.stringify(params) : undefined });
			return {};
		} catch (error) {
			return { error: error instanceof Error ? error.message : "Không thể xử lý yêu cầu" };
		}
	}
	signUp(params: {
		firstName: string;
		lastName: string;
		email: string;
		password: string;
	}): Promise<{ error?: string }> {
		const { firstName, lastName, email, password } = params;
		return this.action("/auth/register", { firstName, lastName, email, password });
	}
	signInWithPassword(params: { email: string; password: string }): Promise<{ error?: string }> {
		return this.action("/auth/login", params);
	}
	async signInWithOAuth(_params: { provider: "google" | "discord" }): Promise<{ error?: string }> {
		return { error: "Đăng nhập mạng xã hội chưa được hỗ trợ" };
	}
	async resetPassword(_params: { email: string }): Promise<{ error?: string }> {
		return { error: "Vui lòng liên hệ quản trị viên để khôi phục mật khẩu" };
	}
	async updatePassword(_params: { email: string }): Promise<{ error?: string }> {
		return { error: "Đổi mật khẩu tại trang cài đặt tài khoản" };
	}
	async getUser(): Promise<{ data?: User | null; error?: string }> {
		try {
			return await api<{ data: User }>("/auth/me");
		} catch (error) {
			if (error instanceof ApiError && error.status === 401) return { data: null };
			return { error: error instanceof Error ? error.message : "Không thể tải tài khoản" };
		}
	}
	async signOut(): Promise<{ error?: string }> {
		const result = await this.action("/auth/logout");
		if (!result.error)
			for (const key of ["atelier-demo-users", "atelier-demo-session", "custom-auth-token", "custom-auth-user-id"])
				globalThis.localStorage.removeItem(key);
		return result;
	}
}
export const authClient = new AuthClient();
