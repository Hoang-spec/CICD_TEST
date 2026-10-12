'use client';

import type { User } from '@/types/user';

interface StoredUser extends User {
  password: string;
  createdAt: string;
}

const USERS_KEY = 'atelier-demo-users';
const SESSION_KEY = 'atelier-demo-session';

const demoAccounts: StoredUser[] = [
  { id: 'USR-ADMIN', name: 'Admin User', email: 'admin@gmail.com', password: 'admin123', role: 'admin', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'USR-CLIENT', name: 'Client User', email: 'client@example.com', password: 'Client123', role: 'client', createdAt: '2026-01-02T00:00:00.000Z' },
];

function getStoredUsers(): StoredUser[] {
  try {
    return JSON.parse(globalThis.localStorage.getItem(USERS_KEY) ?? '[]') as StoredUser[];
  } catch {
    return [];
  }
}

function saveStoredUsers(users: StoredUser[]): void {
  globalThis.localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function publicUser(user: StoredUser): User {
  const { password: _password, ...safeUser } = user;
  return safeUser;
}

export function getDemoUsers(): User[] {
  return [...demoAccounts, ...getStoredUsers()].map(publicUser);
}

class AuthClient {
  async signUp(params: { firstName: string; lastName: string; email: string; password: string }): Promise<{ error?: string }> {
    const users = getStoredUsers();
    const email = params.email.trim().toLowerCase();
    if ([...demoAccounts, ...users].some((user) => user.email?.toLowerCase() === email)) return { error: 'Email đã được sử dụng' };
    const user: StoredUser = {
      id: `USR-${globalThis.crypto.randomUUID()}`,
      name: `${params.firstName.trim()} ${params.lastName.trim()}`,
      email,
      password: params.password,
      role: 'client',
      createdAt: new Date().toISOString(),
    };
    saveStoredUsers([...users, user]);
    globalThis.localStorage.setItem(SESSION_KEY, user.id);
    return {};
  }

  async signInWithOAuth(_params: { provider: 'google' | 'discord' }): Promise<{ error?: string }> {
    return { error: 'Đăng nhập mạng xã hội chưa được hỗ trợ trong chế độ demo' };
  }

  async signInWithPassword(params: { email: string; password: string }): Promise<{ error?: string }> {
    const email = params.email.trim().toLowerCase();
    const user = [...demoAccounts, ...getStoredUsers()].find((candidate) => candidate.email?.toLowerCase() === email && candidate.password === params.password);
    if (!user) return { error: 'Email hoặc mật khẩu không đúng' };
    globalThis.localStorage.setItem(SESSION_KEY, user.id);
    return {};
  }

  async resetPassword(_params: { email: string }): Promise<{ error?: string }> {
    return { error: 'Đặt lại mật khẩu chưa được hỗ trợ trong chế độ demo' };
  }

  async updatePassword(_params: { email: string }): Promise<{ error?: string }> {
    return { error: 'Đổi mật khẩu chưa được hỗ trợ trong chế độ demo' };
  }

  async getUser(): Promise<{ data?: User | null; error?: string }> {
    const id = globalThis.localStorage.getItem(SESSION_KEY);
    if (!id) return { data: null };
    const user = [...demoAccounts, ...getStoredUsers()].find((candidate) => candidate.id === id);
    if (!user) {
      await this.signOut();
      return { data: null };
    }
    return { data: publicUser(user) };
  }

  async signOut(): Promise<{ error?: string }> {
    globalThis.localStorage.removeItem(SESSION_KEY);
    globalThis.localStorage.removeItem('custom-auth-token');
    globalThis.localStorage.removeItem('custom-auth-user-id');
    return {};
  }
}

export const authClient = new AuthClient();
