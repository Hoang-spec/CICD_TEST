'use client';

import type { User } from '@/types/user';

function generateToken(): string {
  const arr = new Uint8Array(12);
  globalThis.crypto.getRandomValues(arr);
  return Array.from(arr, (v) => v.toString(16).padStart(2, '0')).join('');
}

const users = [
  {
    id: 'USR-ADMIN',
    avatar: '/assets/avatar.png',
    firstName: 'Admin',
    lastName: 'User',
    email: 'admin@example.com',
    password: 'Admin123',
    role: 'admin',
  },
  {
    id: 'USR-CLIENT',
    avatar: '/assets/avatar.png',
    firstName: 'Client',
    lastName: 'User',
    email: 'client@example.com',
    password: 'Client123',
    role: 'client',
  },
] satisfies Array<User & { password: string }>;

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
  async signUp(_: SignUpParams): Promise<{ error?: string }> {
    // Make API request

    // We do not handle the API, so we'll just generate a token and store it in localStorage.
    const token = generateToken();
    localStorage.setItem('custom-auth-token', token);
    localStorage.setItem('custom-auth-user-id', 'USR-CLIENT');

    return {};
  }

  async signInWithOAuth(_: SignInWithOAuthParams): Promise<{ error?: string }> {
    return { error: 'Social authentication not implemented' };
  }

  async signInWithPassword(params: SignInWithPasswordParams): Promise<{ error?: string }> {
    const { email, password } = params;

    // Make API request

    // We do not handle the API, so we'll check the credentials against the demo users.
    const user = users.find((candidate) => candidate.email === email && candidate.password === password);

    if (!user) {
      return { error: 'Invalid credentials' };
    }

    const token = generateToken();
    localStorage.setItem('custom-auth-token', token);
    localStorage.setItem('custom-auth-user-id', user.id);

    return {};
  }

  async resetPassword(_: ResetPasswordParams): Promise<{ error?: string }> {
    return { error: 'Password reset not implemented' };
  }

  async updatePassword(_: ResetPasswordParams): Promise<{ error?: string }> {
    return { error: 'Update reset not implemented' };
  }

  async getUser(): Promise<{ data?: User | null; error?: string }> {
    // Make API request

    // We do not handle the API, so just check if we have a token in localStorage.
    const token = localStorage.getItem('custom-auth-token');

    if (!token) {
      return { data: null };
    }

    const userId = localStorage.getItem('custom-auth-user-id');
    const authenticatedUser = users.find((candidate) => candidate.id === userId);

    if (!authenticatedUser) {
      return { data: null };
    }

    const { password: _, ...safeUser } = authenticatedUser;
    return { data: safeUser };
  }

  async signOut(): Promise<{ error?: string }> {
    localStorage.removeItem('custom-auth-token');
    localStorage.removeItem('custom-auth-user-id');

    return {};
  }
}

export const authClient = new AuthClient();
