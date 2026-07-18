import { Hono } from 'hono'
import { SignJWT, importPKCS8 } from 'jose'
import { beforeEach, describe, expect, test } from 'bun:test'
import { authMiddleware } from '../auth'
import { resetRateLimitStore, rateLimitMiddleware } from '../rate-limit'
import { requestIdMiddleware } from '../request-id'
import { corsMiddleware } from '../cors'
import { errorHandlerMiddleware } from '../error-handler'
import type { AppEnv } from '../../types'

const ISSUER = 'https://idp.test.com'
const AUDIENCE = 'tap-note-test'

const PUBLIC_KEY = await Bun.file('/tmp/test-jwt-pub.pem').text()
const PRIVATE_KEY_PEM = await Bun.file('/tmp/test-jwt.pem').text()

async function signJwt(
  payload: Record<string, unknown>,
  alg: string = 'RS256',
): Promise<string> {
  const key = await importPKCS8(PRIVATE_KEY_PEM, alg)
  return await new SignJWT(payload)
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime('1h')
    .sign(key)
}

// 覆盖 env 中的 JWT_VERIFY_KEY/JWT_ISSUER/JWT_AUDIENCE/JWT_ALGORITHMS
const envModule = await import('../../config/env')
;(envModule.env as unknown as { JWT_VERIFY_KEY: string }).JWT_VERIFY_KEY = PUBLIC_KEY
;(envModule.env as unknown as { JWT_ISSUER: string }).JWT_ISSUER = ISSUER
;(envModule.env as unknown as { JWT_AUDIENCE: string }).JWT_AUDIENCE = AUDIENCE
;(envModule.env as unknown as { JWT_ALGORITHMS: string }).JWT_ALGORITHMS = 'RS256'

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

describe('authMiddleware', () => {
  test('合法 JWT 通过,注入 userId', async () => {
    const app = createApp()
    const token = await signJwt({ sub: 'user-1', scope: 'ai:editor' })
    const res = await app.request('/api/ai/test', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.userId).toBe('user-1')
  })

  test('缺失 Authorization 返回 401', async () => {
    const app = createApp()
    const res = await app.request('/api/ai/test')
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.code).toBe('AUTH_INVALID')
  })

  test('过期 JWT 返回 401', async () => {
    const app = createApp()
    const key = await importPKCS8(PRIVATE_KEY_PEM, 'RS256')
    const token = await new SignJWT({ sub: 'expired' })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setExpirationTime('0s')
      .sign(key)
    const res = await app.request('/api/ai/test', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(401)
  })

  test('issuer 不匹配返回 401', async () => {
    const app = createApp()
    const token = await signJwt({ sub: 'user' }, 'RS256')
    // 用错误 issuer 重新签
    const key = await importPKCS8(PRIVATE_KEY_PEM, 'RS256')
    const badToken = await new SignJWT({ sub: 'user' })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer('https://wrong.com')
      .setAudience(AUDIENCE)
      .setExpirationTime('1h')
      .sign(key)
    const res = await app.request('/api/ai/test', {
      headers: { Authorization: `Bearer ${badToken}` },
    })
    expect(res.status).toBe(401)
    void token
  })

  test('客户端伪造 X-User-Sub 头被清理,以 JWT sub 为准', async () => {
    const app = createApp()
    const token = await signJwt({ sub: 'real-user' })
    const res = await app.request('/api/ai/test', {
      headers: {
        Authorization: `Bearer ${token}`,
        'X-User-Sub': 'fake-user',
      },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.userId).toBe('real-user')
    expect(res.headers.get('X-User-Sub')).toBe('real-user')
  })

  test('缺 sub claim 返回 401', async () => {
    const app = createApp()
    const key = await importPKCS8(PRIVATE_KEY_PEM, 'RS256')
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setExpirationTime('1h')
      .sign(key)
    const res = await app.request('/api/ai/test', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status).toBe(401)
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
    const token = await signJwt({ sub: 'rpm-user' })
    // env.RATE_LIMIT_RPM 默认 10
    let rateLimited = false
    for (let i = 0; i < 15; i++) {
      const res = await app.request('/api/ai/test', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (i < 10) {
        expect(res.status).toBe(200)
      } else if (res.status === 429) {
        rateLimited = true
      }
    }
    expect(rateLimited).toBe(true)
  })

  test('不同 userId 互不影响', async () => {
    const app = createApp()
    const tokenA = await signJwt({ sub: 'user-a' })
    const tokenB = await signJwt({ sub: 'user-b' })
    // user-a 用满 10 次
    for (let i = 0; i < 10; i++) {
      await app.request('/api/ai/test', {
        headers: { Authorization: `Bearer ${tokenA}` },
      })
    }
    // user-b 仍可用
    const res = await app.request('/api/ai/test', {
      headers: { Authorization: `Bearer ${tokenB}` },
    })
    expect(res.status).toBe(200)
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
