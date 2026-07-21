import { Hono } from 'hono'
import { beforeEach, describe, expect, test } from 'bun:test'
import { authMiddleware } from '../auth'
import { resetRateLimitStore, rateLimitMiddleware } from '../rate-limit'
import { requestIdMiddleware } from '../request-id'
import { corsMiddleware } from '../cors'
import { errorHandlerMiddleware } from '../error-handler'
import type { AppEnv } from '../../types'

// JWT 鉴权由集成方负责,本套件不测试 JWT。测试环境未配置 JWT_VERIFY_KEY,
// authMiddleware 走开发模式:自动注入 userId='dev-user',据此覆盖限流等下游行为。
function createApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>()
  app.onError(errorHandlerMiddleware)
  app.use('*', requestIdMiddleware())
  app.use('*', corsMiddleware)
  app.use('/api/*', authMiddleware())
  app.use('/api/*', rateLimitMiddleware())
  app.get('/api/ai/test', (c) => c.json({ ok: true, userId: c.get('userId') }))
  app.get('/health', (c) => c.text('ok'))
  return app
}

describe('requestIdMiddleware', () => {
  test('注入 x-request-id 响应头', async () => {
    const app = createApp()
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    expect(res.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/)
  })

  test('客户端 x-request-id 头透传', async () => {
    const app = createApp()
    const res = await app.request('/health', {
      headers: { 'x-request-id': 'my-trace-id' },
    })
    expect(res.headers.get('x-request-id')).toBe('my-trace-id')
  })
})

describe('corsMiddleware', () => {
  test('中间件运行并设置 credentials 头(Bun 无法在 fetch 中设置 Origin 头,此处只验证中间件正常运行)', async () => {
    const app = createApp()
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    // cors 中间件应设置 Access-Control-Allow-Credentials
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true')
    // Vary: Origin 由 cors 中间件添加
    expect(res.headers.get('Vary')).toContain('Origin')
  })
})

describe('rateLimitMiddleware', () => {
  beforeEach(() => {
    resetRateLimitStore()
  })

  test('未认证(健康检查)跳过限流', async () => {
    const app = createApp()
    for (let i = 0; i < 50; i++) {
      const res = await app.request('/health')
      expect(res.status).toBe(200)
    }
  })

  test('RPM 超限返回 429', async () => {
    const app = createApp()
    // 开发模式注入同一 userId='dev-user';env.RATE_LIMIT_RPM 默认 10
    let rateLimited = false
    for (let i = 0; i < 15; i++) {
      const res = await app.request('/api/ai/test')
      if (i < 10) {
        expect(res.status).toBe(200)
      } else if (res.status === 429) {
        rateLimited = true
      }
    }
    expect(rateLimited).toBe(true)
  })
})

describe('errorHandlerMiddleware', () => {
  test('AppError 子类返回其 code 与 statusCode', async () => {
    const app = new Hono<AppEnv>()
    app.onError(errorHandlerMiddleware)
    app.use('*', requestIdMiddleware())
    app.get('/test', () => {
      throw new (class extends Error {
        code = 'MODEL_NOT_ALLOWED'
        statusCode = 400
      })()
    })
    // 上面是临时实例,用实际 AppError 子类
    const { ModelNotAllowedError } = await import('../../errors/app-error')
    app.get('/test2', () => {
      throw new ModelNotAllowedError('x')
    })
    const res = await app.request('/test2')
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('MODEL_NOT_ALLOWED')
  })

  test('ZodError 返回 422 + issues 数组', async () => {
    const app = new Hono<AppEnv>()
    app.onError(errorHandlerMiddleware)
    app.use('*', requestIdMiddleware())
    const { z } = await import('zod')
    app.get('/zod', () => {
      const schema = z.object({ x: z.string() })
      schema.parse({ x: 123 })
      return new Response('ok')
    })
    const res = await app.request('/zod')
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.code).toBe('VALIDATION_ERROR')
    expect(body.data).toBeInstanceOf(Array)
  })

  test('未知错误返回 500 INTERNAL_ERROR 不泄漏堆栈', async () => {
    const app = new Hono<AppEnv>()
    app.onError(errorHandlerMiddleware)
    app.use('*', requestIdMiddleware())
    app.get('/unknown', () => {
      throw new Error('internal detail: /path/to/file.ts')
    })
    const res = await app.request('/unknown')
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.code).toBe('INTERNAL_ERROR')
    expect(body.message).toBe('internal server error')
    expect(body.message).not.toContain('/path/to/file.ts')
  })
})
