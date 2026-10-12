const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/+$/, '');

export function getApiUrl(): string {
  if (configuredApiUrl) {
    if (process.env.NODE_ENV === 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(?:\/|$)/i.test(configuredApiUrl)) {
      throw new Error('NEXT_PUBLIC_API_URL trên Render đang trỏ về localhost; hãy dùng URL backend công khai.');
    }
    return configuredApiUrl;
  }
  if (process.env.NODE_ENV !== 'production') return 'http://localhost:4000';
  throw new Error('Frontend chưa được cấu hình NEXT_PUBLIC_API_URL bằng URL backend trên Render.');
}

export function apiEndpoint(path: string): string {
  return `${getApiUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

export function apiConnectionError(): Error {
  return new Error('Không kết nối được backend. Kiểm tra NEXT_PUBLIC_API_URL trên Render và CLIENT_ORIGIN ở backend.');
}
