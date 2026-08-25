import type { PaginatedResponse } from '@peditrack/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details?: string | string[],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// SEC-001 fix: The JWT is now stored in an HttpOnly cookie set by the API.
// JavaScript never touches the token — no localStorage, no Authorization header.
// `credentials: 'include'` instructs the browser to send the cookie
// automatically on every same-site (and CORS-credentialed) request.

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: 'include', // send the HttpOnly auth cookie
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    // An expired or revoked cookie causes the API to return 401. Redirect to
    // login so the user can obtain a fresh session.
    if (response.status === 401 && typeof window !== 'undefined') {
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }

    const message = Array.isArray(body?.message) ? body.message[0] : body?.message;
    throw new ApiError(
      message ?? 'Something went wrong. Please try again.',
      response.status,
      body?.message,
    );
  }

  return body?.data ?? body;
}

/** Paginated endpoints return { data, meta } at the top level. */
async function requestPaginated<T>(path: string): Promise<PaginatedResponse<T>> {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    const message = Array.isArray(body?.message) ? body.message[0] : body?.message;
    throw new ApiError(message ?? 'Something went wrong.', response.status);
  }

  return { data: body.data ?? [], meta: body.meta };
}

function toQueryString(params: Record<string, unknown> = {}): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export const api = {
  get:  <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  paginated: requestPaginated,
  qs: toQueryString,
};
