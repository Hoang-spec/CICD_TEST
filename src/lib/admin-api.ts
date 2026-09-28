const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export async function adminRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = globalThis.localStorage.getItem('custom-auth-token');
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const result = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(result?.error ?? 'Không thể tải dữ liệu từ máy chủ');
  return result as T;
}
