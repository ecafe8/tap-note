import { describe, expect, test } from 'bun:test'
import {
  AIProviderError,
  AuthError,
  ContextTooLargeError,
  ERROR_CODES,
  ModelNotAllowedError,
  RateLimitedError,
  ValidationError,
} from '../index'

describe('AppError 子类', () => {
  test('ValidationError 返回 422 + VALIDATION_ERROR', () => {
    const err = new ValidationError([{ path: ['messages'], message: 'expected array' }])
    expect(err.code).toBe(ERROR_CODES.VALIDATION_ERROR)
    expect(err.statusCode).toBe(422)
    expect(err.issues).toHaveLength(1)
    expect(err.issues[0]?.path).toEqual(['messages'])
  })

  test('AuthError 默认 401 + AUTH_INVALID', () => {
    const err = new AuthError()
    expect(err.code).toBe(ERROR_CODES.AUTH_INVALID)
    expect(err.statusCode).toBe(401)
    expect(err.message).toBe('invalid or missing JWT')
  })

  test('AuthError 自定义消息', () => {
    const err = new AuthError('JWT expired')
    expect(err.statusCode).toBe(401)
    expect(err.message).toBe('JWT expired')
  })

  test('ModelNotAllowedError 携带 modelId', () => {
    const err = new ModelNotAllowedError('unknown:model')
    expect(err.code).toBe(ERROR_CODES.MODEL_NOT_ALLOWED)
    expect(err.statusCode).toBe(400)
    expect(err.modelId).toBe('unknown:model')
    expect(err.message).toContain('unknown:model')
  })

  test('ContextTooLargeError 携带估算 token 与上限', () => {
    const err = new ContextTooLargeError(50000, 30000)
    expect(err.code).toBe(ERROR_CODES.CONTEXT_TOO_LARGE)
    expect(err.statusCode).toBe(400)
    expect(err.estimatedTokens).toBe(50000)
    expect(err.maxTokens).toBe(30000)
    expect(err.message).toContain('50000')
    expect(err.message).toContain('30000')
  })

  test('RateLimitedError 携带 limit 字段', () => {
    const err = new RateLimitedError('rpm')
    expect(err.code).toBe(ERROR_CODES.RATE_LIMITED)
    expect(err.statusCode).toBe(429)
    expect(err.limit).toBe('rpm')
  })

  test('AIProviderError 默认消息不泄漏 Key', () => {
    const err = new AIProviderError()
    expect(err.code).toBe(ERROR_CODES.AI_PROVIDER_ERROR)
    expect(err.statusCode).toBe(502)
    expect(err.message).toBe('AI provider call failed')
    expect(err.message).not.toMatch(/sk-[a-zA-Z0-9]+/)
  })
})

describe('ERROR_CODES 常量', () => {
  test('所有错误码存在', () => {
    expect(ERROR_CODES.SUCCESS).toBe('SUCCESS')
    expect(ERROR_CODES.VALIDATION_ERROR).toBe('VALIDATION_ERROR')
    expect(ERROR_CODES.AUTH_INVALID).toBe('AUTH_INVALID')
    expect(ERROR_CODES.MODEL_NOT_ALLOWED).toBe('MODEL_NOT_ALLOWED')
    expect(ERROR_CODES.CONTEXT_TOO_LARGE).toBe('CONTEXT_TOO_LARGE')
    expect(ERROR_CODES.RATE_LIMITED).toBe('RATE_LIMITED')
    expect(ERROR_CODES.AI_PROVIDER_ERROR).toBe('AI_PROVIDER_ERROR')
    expect(ERROR_CODES.INTERNAL_ERROR).toBe('INTERNAL_ERROR')
  })
})

describe('错误不泄漏内部路径', () => {
  test('所有子类消息不含内部路径', () => {
    const errors = [
      new ValidationError([{ path: ['x'], message: 'err' }]),
      new AuthError(),
      new ModelNotAllowedError('m'),
      new ContextTooLargeError(0, 0),
      new RateLimitedError('x'),
      new AIProviderError(),
    ]
    for (const err of errors) {
      expect(err.message).not.toMatch(/\/Volumes|\/Users|node_modules/)
    }
  })
})
