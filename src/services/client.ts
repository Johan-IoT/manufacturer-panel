// Transport-level concerns for the service layer. Swapping the mock backend for
// the real REST API only requires changing this file and the service bodies.

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Public, user-safe message. Raw errors/stack traces are never surfaced. */
export function toUserMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "Your session has expired. Please sign in again.";
    if (error.status === 403) return "You do not have permission to perform this action.";
    return error.message;
  }
  return fallback;
}

export const latency = (ms = 260) => new Promise<void>((r) => setTimeout(r, ms));

export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
