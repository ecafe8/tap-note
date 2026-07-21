import { beforeEach, describe, expect, test } from 'bun:test'
import { createApp } from '../index'
import { resetRateLimitStore } from '../middleware/rate-limit'

// JWT 鉴权由集成方负责,本套件不测试 JWT。测试环境未配置 JWT_VERIFY_KEY,
// authMiddleware 走开发模式(自动注入 dev-user),据此覆盖路由/校验/错误处理等行为。
beforeEach(() => {
  resetRateLimitStore()
})

describe('health 端点', () => {
  test('GET /health 返回 200 ok', async () => {
    const app = createApp()
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('ok')
  })

  test('GET /ready 返回 200 ready', async () => {
    const app = createApp()
    const res = await app.request('/ready')
    expect(res.status).toBe(200)
  })

  test('健康检查匿名可访问', async () => {
    const app = createApp()
    const res = await app.request('/health')
    expect(res.status).toBe(200)
  })
})

describe('GET /api/ai/models', () => {
  test('返回 allowlist 模型', async () => {
    const app = createApp()
    const res = await app.request('/api/ai/models')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.code).toBe('SUCCESS')
    expect(body.data.models.length).toBeGreaterThanOrEqual(3)
    // 未配置 Google 时不返回 google:* 模型
    expect(body.data.models.filter((m: { provider: string }) => m.provider === 'google').length).toBe(0)
  })
})

describe('POST /api/ai/editor/streamText', () => {
  test('缺 body 字段返回 422', async () => {
    const app = createApp()
    const res = await app.request('/api/ai/editor/streamText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'dashscope:qwen-plus' }),
    })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.code).toBe('VALIDATION_ERROR')
  })

  test('客户端提交 tools 字段被忽略(不再 strict)', async () => {
    const app = createApp()
    const res = await app.request('/api/ai/editor/streamText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ id: 'u-1', role: 'user', parts: [{ type: 'text', text: 'hi' }] }],
        documentState: { format: 'blocks-json', schemaVersion: '0.51.4', documentRevision: 0, blocks: [] },
        model: 'dashscope:qwen-plus',
        tools: { customTool: {} },
      }),
    })
    // schema 不再严格,tools 字段不触发 422
    // 可能进入 streamText 调用(200/500/502 都合理,取决于 provider 是否可用)
    expect(res.status).not.toBe(422)
  })

  test('未知 modelId 返回 400 MODEL_NOT_ALLOWED', async () => {
    const app = createApp()
    const res = await app.request('/api/ai/editor/streamText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ id: 'u-1', role: 'user', parts: [{ type: 'text', text: 'hi' }] }],
        documentState: { format: 'blocks-json', schemaVersion: '0.51.4', documentRevision: 0, blocks: [] },
        model: 'unknown:model',
      }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.code).toBe('MODEL_NOT_ALLOWED')
  })
})

describe('POST /api/ai/proxy', () => {
  test('返回 501 Not Implemented', async () => {
    const app = createApp()
    const res = await app.request('/api/ai/proxy', {
      method: 'POST',
    })
    expect(res.status).toBe(501)
  })
})

describe('错误处理集成', () => {
  test('未知路由返回 404', async () => {
    const app = createApp()
    const res = await app.request('/api/ai/unknown')
    expect(res.status).toBe(404)
  })
})
