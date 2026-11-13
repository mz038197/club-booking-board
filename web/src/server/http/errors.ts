/** Every error response body is `{ code, message }`. */

export type ErrorCode =
  | "UNAUTHORIZED"
  | "NOT_A_STUDENT"
  | "FORBIDDEN"
  | "BOOKING_CLOSED"
  | "ROUTER_UNAVAILABLE"
  | "SLOT_TAKEN"
  | "INVALID_SLOT"
  | "NOT_OWNER"
  | "NOT_FOUND"
  | "LIMIT_REACHED"
  | "INVALID_POSTER"
  | "INVALID_REQUEST"
  | "CONFLICT"
  | "INTERNAL_ERROR";

/** Throw from anywhere inside a `handle()`d route to answer with this error. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export function errorResponse(status: number, code: ErrorCode, message: string): Response {
  return Response.json({ code, message }, { status });
}

/**
 * Wraps a route handler: `ApiError` → its `{ code, message }` response;
 * anything else → 500 INTERNAL_ERROR (details only in the server log).
 */
export function handle<A extends unknown[]>(
  fn: (req: Request, ...rest: A) => Promise<Response>,
): (req: Request, ...rest: A) => Promise<Response> {
  return async (req, ...rest) => {
    try {
      return await fn(req, ...rest);
    } catch (error) {
      if (error instanceof ApiError) return errorResponse(error.status, error.code, error.message);
      console.error("[api] unhandled error", error);
      return errorResponse(500, "INTERNAL_ERROR", "伺服器發生錯誤，請稍後再試");
    }
  };
}
