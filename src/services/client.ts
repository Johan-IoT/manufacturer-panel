function resolveBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configured) return configured;
  if (import.meta.env.DEV) return "http://127.0.0.1:3000";
  throw new Error(
    "VITE_API_BASE_URL must be set for production builds. Example: VITE_API_BASE_URL=https://api.example.com",
  );
}

const BASE_URL = resolveBaseUrl();

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function toUserMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Your session has expired. Please sign in again.";
    if (error.status === 403) return "You do not have permission to perform this action.";
    return error.message;
  }
  return fallback;
}

export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const TOKEN_KEY = "gsm.manufacturer.accessToken";
const REFRESH_TOKEN_KEY = "gsm.manufacturer.refreshToken";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setAccessToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export function setRefreshToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(REFRESH_TOKEN_KEY, token);
  else window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function clearAuthTokens() {
  setAccessToken(null);
  setRefreshToken(null);
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const response = await fetch(`${BASE_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        const text = await response.text();
        let payload: Record<string, unknown> = {};
        if (text) {
          try {
            payload = JSON.parse(text) as Record<string, unknown>;
          } catch {
            return false;
          }
        }
        if (!response.ok) return false;
        const accessToken = payload.accessToken as string | undefined;
        if (!accessToken) return false;
        setAccessToken(accessToken);
        return true;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  allowRetry = true,
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers as Record<string, string> | undefined),
  };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const text = await response.text();
  let payload: unknown = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { message: text };
    }
  }

  if (response.status === 401 && allowRetry && path !== "/auth/refresh" && path !== "/auth/login") {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return apiFetch<T>(path, options, false);
    }
    clearAuthTokens();
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "message" in payload
        ? String((payload as { message: string }).message)
        : response.statusText;
    throw new ApiError(message || "Request failed.", response.status);
  }
  return payload as T;
}

export function unwrapData<T>(payload: T | { data: T }): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}
