import type { ApiResponse } from "@workspace/server-api/types/response";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

/**
 * Build a success response.
 * Usage: return success(c, data) or success(c, data, "Created", 201)
 *
 * S is inferred as the literal status code (e.g. 200, 201) so that
 * Hono's InferResponseType can match on the exact status.
 */
export function success<T, S extends ContentfulStatusCode = 200>(
  c: Context,
  data: T,
  message = "",
  status: S = 200 as S,
) {
  return c.json<ApiResponse<T>, S>(
    {
      code: "SUCCESS",
      message,
      data,
    },
    status,
  );
}

/**
 * Build a fail response.
 * Typically called from the global error handler, not directly in controllers.
 */
export function fail(
  c: Context,
  code: string,
  message: string,
  status: ContentfulStatusCode = 400,
  data: unknown = null,
) {
  return c.json<ApiResponse<unknown>>(
    {
      code,
      message,
      data,
    },
    status,
  );
}
