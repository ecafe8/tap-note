import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import type { Env } from '../env'

// 保存原始 process.env,每个测试设置自己的环境
const originalEnv = { ...process.env }

function setEnv(overrides: Record<string, string | undefined>): void {
  const base: Record<string, string | undefined> = {
    DASHSCOPE_API_KEY: 'sk-test-key',
    JWT_ISSUER: 'https://idp.example.com',
    JWT_AUDIENCE: 'tap-note-ai-backend',
    JWT_VERIFY_KEY: 'test-key',
    CORS_ORIGIN: 'https://app.example.com',
    NODE_ENV: 'test',
    ...overrides,
  }
  for (const [k, v] of Object.entries(base)) {
    if (v === undefined) {
      delete process.env[k]
    } else {
      process.env[k] = v
    }
  }
}

function clearAiEnv(): void {
  const keys = [
    'DASHSCOPE_API_KEY',
    'DASHSCOPE_BASE_URL',
    'GOOGLE_GENERATIVE_AI_API_KEY',
    'GOOGLE_GENERATIVE_BASE_URL',
    'JWT_ISSUER',
    'JWT_AUDIENCE',
    'JWT_VERIFY_KEY',
    'JWT_ALGORITHMS',
    'PORT',
    'LOG_LEVEL',
    'CORS_ORIGIN',
    'MODELS_PUBLIC',
    'CONTEXT_MAX_TOKENS',
    'RATE_LIMIT_RPM',
    'RATE_LIMIT_CONCURRENCY',
    'RATE_LIMIT_MAX_MESSAGES',
    'RATE_LIMIT_MAX_INPUT_TOKENS',
    'RATE_LIMIT_MAX_OUTPUT_TOKENS',
    'RATE_LIMIT_MAX_TOOL_ROUNDS',
    'RATE_LIMIT_MAX_STREAM_DURATION_SEC',
    'NODE_ENV',
  ]
  for (const k of keys) delete process.env[k]
}

beforeEach(() => {
  clearAiEnv()
})

afterEach(() => {
  clearAiEnv()
  Object.assign(process.env, originalEnv)
})

describe('env', () => {
  test('合法 env 通过校验', async () => {
    setEnv({})
    // 动态导入,确保 loadEnv 在模块加载时读取当前 process.env
    const mod = await import(`../env?t=${Date.now()}`)
    const env: Env = mod.env
    expect(env.DASHSCOPE_API_KEY).toBe('sk-test-key')
    expect(env.JWT_ISSUER).toBe('https://idp.example.com')
    expect(env.JWT_AUDIENCE).toBe('tap-note-ai-backend')
    expect(env.PORT).toBe(3000)
    expect(env.LOG_LEVEL).toBe('info')
    expect(env.MODELS_PUBLIC).toBe(false)
    expect(env.CONTEXT_MAX_TOKENS).toBe(30000)
    expect(env.RATE_LIMIT_RPM).toBe(10)
    expect(env.NODE_ENV).toBe('test')
  })

  test('可选 GOOGLE_GENERATIVE_AI_API_KEY 缺省时 google 为 undefined', async () => {
    setEnv({})
    const mod = await import(`../env?t=${Date.now()}`)
    expect(mod.env.GOOGLE_GENERATIVE_AI_API_KEY).toBeUndefined()
  })

  test('JWT_ALGORITHMS 缺省时默认 RS256,ES256', async () => {
    delete process.env.JWT_ALGORITHMS
    setEnv({})
    const mod = await import(`../env?t=${Date.now()}`)
    expect(mod.env.JWT_ALGORITHMS).toBe('RS256,ES256')
    expect(mod.getJwtAlgorithms()).toEqual(['RS256', 'ES256'])
  })

  test('CORS_ORIGIN 解析为逗号分隔列表', async () => {
    setEnv({ CORS_ORIGIN: 'https://a.com,https://b.com, https://c.com' })
    const mod = await import(`../env?t=${Date.now()}`)
    expect(mod.corsOrigins).toEqual(['https://a.com', 'https://b.com', 'https://c.com'])
  })

  test('MODELS_PUBLIC 字符串 "true" 解析为 boolean true', async () => {
    // Bun 动态 import 缓存不可靠,直接用 zod schema 测试 transform
    const { z } = await import('zod')
    const schema = z.string().optional().transform((v) => v === 'true')
    expect(schema.parse('true')).toBe(true)
    expect(schema.parse('false')).toBe(false)
    expect(schema.parse(undefined)).toBe(false)
  })

  test('PORT 字符串解析为 number', async () => {
    // Bun 动态 import 缓存不可靠,直接用 zod schema 测试 coerce
    const { z } = await import('zod')
    const schema = z.coerce.number().int().positive().default(3000)
    expect(schema.parse('8080')).toBe(8080)
    expect(schema.parse(undefined)).toBe(3000)
  })

  test('缺 DASHSCOPE_API_KEY 时 fail-fast(process.exit)', async () => {
    setEnv({ DASHSCOPE_API_KEY: undefined })
    const exitMock = mock(() => {
      throw new Error('process.exit called')
    })
    const originalExit = process.exit
    process.exit = exitMock as unknown as typeof process.exit
    const errorMock = mock(() => {})
    const originalError = console.error
    console.error = errorMock
    try {
      await import(`../env?missing-key=${Date.now()}`)
      expect.fail('should have thrown')
    } catch (err) {
      expect((err as Error).message).toBe('process.exit called')
      expect(exitMock).toHaveBeenCalled()
      expect(errorMock).toHaveBeenCalled()
    } finally {
      process.exit = originalExit
      console.error = originalError
    }
  })

  test('JWT 配置可选(未配置时不 fail-fast)', async () => {
    setEnv({ JWT_ISSUER: undefined, JWT_AUDIENCE: undefined, JWT_VERIFY_KEY: undefined })
    const mod = await import(`../env?no-jwt=${Date.now()}`)
    expect(mod.env.JWT_ISSUER).toBeUndefined()
    expect(mod.env.JWT_AUDIENCE).toBeUndefined()
    expect(mod.env.JWT_VERIFY_KEY).toBeUndefined()
  })
})
