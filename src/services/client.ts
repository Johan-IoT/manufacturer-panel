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
  /** Machine-readable reason from the backend error body (e.g. ACCOUNT_SUSPENDED). */
  code: string | undefined;
  constructor(message: string, status = 500, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

/** Why the backend refused a login or a request (`code` with `message` as fallback). */
export type AuthFailure = { code?: string | null | undefined; message?: string | null | undefined };

type AuthReason = "suspended" | "disabled" | "verification" | "credentials" | "other";

/**
 * Reads the backend error `code` (see AuthErrorCode in the backend). The
 * message text is only a fallback for a backend that does not send codes yet.
 */
function authReason(failure: AuthFailure | null | undefined): AuthReason {
  switch (failure?.code) {
    case "ACCOUNT_SUSPENDED":
      return "suspended";
    case "ACCOUNT_DISABLED":
      return "disabled";
    case "VERIFICATION_INCOMPLETE":
      return "verification";
    case "INVALID_CREDENTIALS":
      return "credentials";
    case "SESSION_EXPIRED":
    case "ACCOUNT_INACTIVE":
      return "other";
    default:
      break;
  }
  const text = (failure?.message ?? "").toLowerCase();
  if (text.includes("suspended")) return "suspended";
  if (text.includes("disabled")) return "disabled";
  if (text.includes("verification")) return "verification";
  return "other";
}

/** True when the account itself is blocked (not just an old session). */
export function isBlockedAccount(failure: AuthFailure | null | undefined): boolean {
  const reason = authReason(failure);
  return reason === "suspended" || reason === "disabled" || reason === "verification";
}

export function toUserMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Your session has expired. Please sign in again.";
    if (error.status === 403) return "You do not have permission to perform this action.";
    return error.message;
  }
  return fallback;
}

/**
 * Login screen messages. A 401 here means wrong credentials (or a blocked
 * account), never an expired session, so it must not use toUserMessage.
 */
export function toLoginMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return "Login failed. Please try again.";
  switch (error.status) {
    case 0:
      return "Cannot reach the server. Check your internet connection and try again.";
    case 401: {
      const reason = authReason(error);
      if (reason === "suspended") {
        return "Login failed. This account is suspended. Contact ConfigGate support.";
      }
      if (reason === "disabled") {
        return "Login failed. This account is disabled. Contact ConfigGate support.";
      }
      return "Login failed. Incorrect email or password. Please try again.";
    }
    case 403:
      // Set by the panel itself: not a Manufacturer, not active, not verified.
      return error.message;
    case 422:
      return "Login failed. Enter a valid email address and password.";
    case 429:
      return "Too many login attempts. Please wait a few minutes and try again.";
    default:
      return "Login failed. Please try again.";
  }
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
/** Why the last session renewal failed (null when it did not fail). */
let lastRefreshFailure: AuthFailure | null = null;

/**
 * Message shown when the panel signs the user out. The backend rejects every
 * request (and the session renewal) as soon as an account is suspended or
 * disabled, so the reason is in the server message.
 */
export function sessionEndedMessage(failure?: AuthFailure | null): string {
  switch (authReason(failure)) {
    case "suspended":
      return "Your account has been suspended. Contact ConfigGate support.";
    case "disabled":
      return "Your account has been disabled. Contact ConfigGate support.";
    case "verification":
      return "Your account verification is incomplete. Complete the verification in the app, then sign in again.";
    default:
      return "Your session has expired. Please sign in again.";
  }
}

/** Why the last session renewal failed, for the sign-out message (null when it did not fail). */
export function getLastRefreshFailure(): AuthFailure | null {
  return lastRefreshFailure;
}

type UnauthorizedListener = (message: string) => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

/** Subscribe when refresh fails and the user must sign in again. */
export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

function emitUnauthorized(failure?: AuthFailure | null) {
  clearAuthTokens();
  const message = sessionEndedMessage(failure);
  unauthorizedListeners.forEach((listener) => listener(message));
}

/** Attempts to obtain a new access token from the stored refresh token. */
export async function tryRefreshAccessToken(): Promise<boolean> {
  return refreshAccessToken();
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    lastRefreshFailure = null;
    return false;
  }

  if (!refreshPromise) {
    lastRefreshFailure = null;
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
        if (!response.ok) {
          lastRefreshFailure = errorBodyFailure(payload);
          return false;
        }
        const accessToken = payload["accessToken"] as string | undefined;
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

/** `code` and `message` of a backend error body. */
function errorBodyFailure(payload: unknown): AuthFailure {
  if (typeof payload !== "object" || payload === null) return {};
  const body = payload as Record<string, unknown>;
  return {
    code: typeof body["code"] === "string" ? body["code"] : undefined,
    message: typeof body["message"] === "string" ? body["message"] : undefined,
  };
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
  // Never send an old session token with a new login.
  if (token && path !== "/auth/login") headers["Authorization"] = `Bearer ${token}`;

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
    emitUnauthorized(lastRefreshFailure ?? errorBodyFailure(payload));
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "message" in payload
        ? String((payload as { message: string }).message)
        : response.statusText;
    throw new ApiError(
      message || "Request failed.",
      response.status,
      errorBodyFailure(payload).code ?? undefined,
    );
  }
  return payload as T;
}

export function unwrapData<T>(payload: T | { data: T }): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}
