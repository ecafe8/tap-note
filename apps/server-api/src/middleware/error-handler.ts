import type { ErrorHandler } from 'hono'
import { ZodError } from 'zod'
import { logger } from '../utils/logger'
import { ERROR_CODES } from '../errors/error-codes'
import { AppError, ValidationError } from '../errors/app-error'
import type { AppEnv } from '../types'

/**
 * 全局错误处理中间件。
 *
 * 捕获三类异常:
 * - `AppError` 子类:用其 `code`/`message`/`statusCode` 构建响应
 * - `ZodError`:格式化 `.issues` 为 `[{ path, message }]`,返回 422
 * - 未知错误:记录完整日志(带 `requestId`),对外返回 500 + `INTERNAL_ERROR`
 *
 * 对外响应 SHALL NOT 泄漏内部堆栈、文件路径或上游 Provider Key。
 */
export const errorHandlerMiddleware: ErrorHandler<AppEnv> = (err, c) => {
  const requestId = c.get('requestId') ?? 'unknown'

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, requestId, code: err.code }, 'app error')
    } else {
      logger.info({ requestId, code: err.code, message: err.message }, 'app error')
    }
    let data: unknown = null
    if (err instanceof ValidationError) {
      data = err.issues
    }
    return c.json(
      {
        code: err.code,
        message: err.message,
        data,
      },
      err.statusCode,
    )
  }

  if (err instanceof ZodError) {
    const issues = err.issues.map((i) => ({
      path: i.path,
      message: i.message,
    }))
    logger.info({ requestId, issues }, 'validation error')
    return c.json(
      {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'validation failed',
        data: issues,
      },
      422,
    )
  }

  // 未知错误:记录完整日志,对外只返回稳定通用错误响应
  logger.error({ err, requestId }, 'internal error')
  return c.json(
    {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: 'internal server error',
      data: null,
    },
    500,
  )
}
