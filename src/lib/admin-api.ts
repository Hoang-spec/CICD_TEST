import { apiConnectionError, apiEndpoint } from '@/lib/api-url';

export async function adminRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = globalThis.localStorage.getItem('custom-auth-token');
  const endpoint = apiEndpoint(path);
  let response: Response;
  try {
    response = await fetch(endpoint, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw apiConnectionError();
  }
  const result = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(result?.error ?? 'Không thể tải dữ liệu từ máy chủ');
  return result as T;
}
