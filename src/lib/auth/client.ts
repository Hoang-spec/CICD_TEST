'use client';

import type { User } from '@/types/user';

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface AuthResponse {
  data?: User;
  token?: string;
  error?: string;
}

async function requestAuth(path: string, options?: RequestInit): Promise<AuthResponse> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  return (await response.json()) as AuthResponse;
}

export interface SignUpParams {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface SignInWithOAuthParams {
  provider: 'google' | 'discord';
}

export interface SignInWithPasswordParams {
  email: string;
  password: string;
}

export interface ResetPasswordParams {
  email: string;
}

class AuthClient {
  async signUp(params: SignUpParams): Promise<{ error?: string }> {
    const result = await requestAuth('/api/auth/register', { method: 'POST', body: JSON.stringify(params) });
    if (result.error || !result.token) return { error: result.error ?? 'Registration failed' };
    localStorage.setItem('custom-auth-token', result.token);
    return {};
  }

  async signInWithOAuth(_: SignInWithOAuthParams): Promise<{ error?: string }> {
    return { error: 'Social authentication not implemented' };
  }

  async signInWithPassword(params: SignInWithPasswordParams): Promise<{ error?: string }> {
    const result = await requestAuth('/api/auth/login', { method: 'POST', body: JSON.stringify(params) });
    if (result.error || !result.token) return { error: result.error ?? 'Invalid credentials' };
    localStorage.setItem('custom-auth-token', result.token);
    return {};
  }

  async resetPassword(_: ResetPasswordParams): Promise<{ error?: string }> {
    return { error: 'Password reset not implemented' };
  }

  async updatePassword(_: ResetPasswordParams): Promise<{ error?: string }> {
    return { error: 'Update reset not implemented' };
  }

  async getUser(): Promise<{ data?: User | null; error?: string }> {
    const token = localStorage.getItem('custom-auth-token');
    if (!token) {
      return { data: null };
    }
    const result = await requestAuth('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
    if (result.error) {
      await this.signOut();
      return { data: null, error: result.error };
    }
    return { data: result.data };
  }

  async signOut(): Promise<{ error?: string }> {
    localStorage.removeItem('custom-auth-token');
    localStorage.removeItem('custom-auth-user-id');

    return {};
  }
}

export const authClient = new AuthClient();
