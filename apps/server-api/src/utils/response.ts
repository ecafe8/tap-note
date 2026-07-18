import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

/**
 * 统一业务响应信封。
 */
export interface ApiResponse<T = unknown> {
  code: string
  message: string
  data: T
}

/**
 * Build a success response.
 * Usage: `return success(c, data)` or `success(c, data, "Created", 201)`
 */
export function success<T, S extends ContentfulStatusCode = 200>(
  c: Context,
  data: T,
  message = '',
  status: S = 200 as S,
): Response {
  return c.json<ApiResponse<T>, S>(
    {
      code: 'SUCCESS',
      message,
      data,
    },
    status,
  )
}

/**
 * Build a fail response. Typically called from the global error handler.
 */
export function fail(
  c: Context,
  code: string,
  message: string,
  status: ContentfulStatusCode = 400,
  data: unknown = null,
): Response {
  return c.json<ApiResponse<unknown>>(
    {
      code,
      message,
      data,
    },
    status,
  )
}
