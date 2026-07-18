import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { ERROR_CODES, type ErrorCode } from './error-codes'

/**
 * App 错误基类。所有子类不泄漏内部堆栈或路径,对外脱敏。
 */
export abstract class AppError extends Error {
  abstract readonly code: ErrorCode
  abstract readonly statusCode: ContentfulStatusCode
}

/**
 * Zod 校验失败错误。
 */
export class ValidationError extends AppError {
  readonly code = ERROR_CODES.VALIDATION_ERROR
  readonly statusCode = 422 as const
  readonly issues: Array<{ path: (string | number)[]; message: string }>
  constructor(issues: Array<{ path: (string | number)[]; message: string }>) {
    super('validation failed')
    this.issues = issues
  }
}

/**
 * 鉴权错误(JWT 缺失/过期/签名错误/issuer/audience 不匹配)。
 */
export class AuthError extends AppError {
  readonly code = ERROR_CODES.AUTH_INVALID
  readonly statusCode = 401 as const
  constructor(message = 'invalid or missing JWT') {
    super(message)
  }
}

/**
 * modelId 不在 allowlist。
 */
export class ModelNotAllowedError extends AppError {
  readonly code = ERROR_CODES.MODEL_NOT_ALLOWED
  readonly statusCode = 400 as const
  readonly modelId: string
  constructor(modelId: string) {
    super(`model not allowed: ${modelId}`)
    this.modelId = modelId
  }
}

/**
 * documentState 体积超限。
 */
export class ContextTooLargeError extends AppError {
  readonly code = ERROR_CODES.CONTEXT_TOO_LARGE
  readonly statusCode = 400 as const
  readonly estimatedTokens: number
  readonly maxTokens: number
  constructor(estimatedTokens: number, maxTokens: number) {
    super(
      `document state estimated ${estimatedTokens} tokens exceeds max ${maxTokens}`,
    )
    this.estimatedTokens = estimatedTokens
    this.maxTokens = maxTokens
  }
}

/**
 * 限流触发。
 */
export class RateLimitedError extends AppError {
  readonly code = ERROR_CODES.RATE_LIMITED
  readonly statusCode = 429 as const
  readonly limit: string
  constructor(limit: string, message = `rate limit exceeded: ${limit}`) {
    super(message)
    this.limit = limit
  }
}

/**
 * Provider 调用失败(上游 LLM API 错误)。不泄漏上游 Key。
 */
export class AIProviderError extends AppError {
  readonly code = ERROR_CODES.AI_PROVIDER_ERROR
  readonly statusCode = 502 as const
  constructor(message = 'AI provider call failed') {
    super(message)
  }
}
