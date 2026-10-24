const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

let inMemoryToken: string | null = null;
let isRefreshing = false;
let refreshSubscribers: Array<(token: string | null) => void> = [];

export function getAccessToken(): string | null {
  return inMemoryToken;
}

export function setAccessToken(token: string | null): void {
  inMemoryToken = token;
}

function onRefreshed(token: string | null) {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(callback: (token: string | null) => void) {
  refreshSubscribers.push(callback);
}

export interface ApiRequestOptions extends RequestInit {
  skipAuth?: boolean;
  retryOn401?: boolean;
}

export class ApiError extends Error {
  statusCode: number;
  data: unknown;

  constructor(statusCode: number, message: string, data: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.data = data;
  }
}

export async function apiFetch<T = unknown>(
  endpoint: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { skipAuth = false, retryOn401 = true, ...customOptions } = options;
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;

  const headers = new Headers(customOptions.headers || {});
  if (!headers.has('Content-Type') && !(customOptions.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (!skipAuth && inMemoryToken) {
    headers.set('Authorization', `Bearer ${inMemoryToken}`);
  }

  const fetchConfig: RequestInit = {
    ...customOptions,
    headers,
    credentials: 'include', // Include HttpOnly cookies (refresh_token)
  };

  try {
    const response = await fetch(url, fetchConfig);

    if (response.status === 401 && retryOn401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          });

          if (refreshRes.ok) {
            const data = (await refreshRes.json()) as { accessToken: string };
            setAccessToken(data.accessToken);
            onRefreshed(data.accessToken);
            isRefreshing = false;

            // Retry original request
            headers.set('Authorization', `Bearer ${data.accessToken}`);
            const retryRes = await fetch(url, { ...fetchConfig, headers });
            return await parseResponse<T>(retryRes);
          } else {
            setAccessToken(null);
            onRefreshed(null);
            isRefreshing = false;
            throw new ApiError(401, 'Session expired. Please log in again.');
          }
        } catch (err) {
          isRefreshing = false;
          onRefreshed(null);
          setAccessToken(null);
          throw err;
        }
      }

      // If already refreshing, wait for subscriber
      return new Promise<T>((resolve, reject) => {
        addRefreshSubscriber(async (newToken) => {
          if (!newToken) {
            reject(new ApiError(401, 'Session expired. Please log in again.'));
            return;
          }
          headers.set('Authorization', `Bearer ${newToken}`);
          try {
            const retryRes = await fetch(url, { ...fetchConfig, headers });
            resolve(await parseResponse<T>(retryRes));
          } catch (e) {
            reject(e);
          }
        });
      });
    }

    return await parseResponse<T>(response);
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw err;
    }
    const msg = err instanceof Error ? err.message : 'Network error occurred';
    throw new ApiError(500, msg);
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') || '';
  let payload: unknown = null;

  if (contentType.includes('application/json')) {
    payload = await response.json();
  } else {
    payload = await response.text();
  }

  if (!response.ok) {
    let message = 'An error occurred';
    if (typeof payload === 'object' && payload !== null) {
      const p = payload as Record<string, unknown>;
      if (typeof p.message === 'string') {
        message = p.message;
      } else if (Array.isArray(p.message)) {
        message = p.message.join(', ');
      }
    }
    throw new ApiError(response.status, message, payload);
  }

  return payload as T;
}

export const api = {
  get: <T = unknown>(url: string, options?: ApiRequestOptions) =>
    apiFetch<T>(url, { ...options, method: 'GET' }),
  post: <T = unknown>(url: string, body?: unknown, options?: ApiRequestOptions) =>
    apiFetch<T>(url, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
  patch: <T = unknown>(url: string, body?: unknown, options?: ApiRequestOptions) =>
    apiFetch<T>(url, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: <T = unknown>(url: string, options?: ApiRequestOptions) =>
    apiFetch<T>(url, { ...options, method: 'DELETE' }),
};
