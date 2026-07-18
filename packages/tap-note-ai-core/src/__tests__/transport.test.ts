import { describe, expect, test } from 'bun:test'
import { createProxyTransport, createServerTransport } from '../transport'

describe('createServerTransport', () => {
  test('返回 DefaultChatTransport 实例', () => {
    const transport = createServerTransport({
      baseUrl: '/api/ai/editor/streamText',
      model: 'dashscope:qwen-plus',
    })
    expect(transport).toBeDefined()
    expect(typeof transport).toBe('object')
  })

  test('不持有 LLM Key 字段', () => {
    const transport = createServerTransport({
      baseUrl: '/api/ai/editor/streamText',
      model: 'dashscope:qwen-plus',
      getAuthHeaders: () => ({ Authorization: 'Bearer short-lived-jwt' }),
    })
    // 检查实例字段不包含 LLM 凭据
    const transportObj = transport as unknown as Record<string, unknown>
    expect(transportObj.apiKey).toBeUndefined()
    expect(transportObj.apiSecret).toBeUndefined()
    expect(transportObj.apiKey).toBeUndefined()
  })

  test('携带 model 字段在 body 中', () => {
    const transport = createServerTransport({
      baseUrl: '/api/ai/chat',
      model: 'google:gemini-2.0-flash',
    })
    // DefaultChatTransport 把 body 存储在实例上
    const transportObj = transport as unknown as {
      body?: Record<string, unknown> | (() => Record<string, unknown>)
    }
    const body = typeof transportObj.body === 'function' ? transportObj.body() : transportObj.body
    expect(body?.model).toBe('google:gemini-2.0-flash')
  })

  test('getAuthHeaders 注入到 headers', () => {
    const transport = createServerTransport({
      baseUrl: '/api/ai/editor/streamText',
      model: 'dashscope:qwen-plus',
      getAuthHeaders: () => ({
        Authorization: 'Bearer my-jwt',
        'X-User-ID': 'user-123',
      }),
    })
    const transportObj = transport as unknown as {
      headers?: Record<string, string> | (() => Record<string, string>)
    }
    const headers = typeof transportObj.headers === 'function' ? transportObj.headers() : transportObj.headers
    expect(headers?.Authorization).toBe('Bearer my-jwt')
    expect(headers?.['X-User-ID']).toBe('user-123')
    expect(headers?.['Content-Type']).toBe('application/json')
  })

  test('baseUrl 为空字符串抛错', () => {
    expect(() =>
      createServerTransport({
        baseUrl: '',
        model: 'dashscope:qwen-plus',
      }),
    ).toThrow(/baseUrl/)
  })

  test('baseUrl 非字符串抛错', () => {
    expect(() =>
      createServerTransport({
        baseUrl: 123 as unknown as string,
        model: 'dashscope:qwen-plus',
      }),
    ).toThrow(/baseUrl/)
  })

  test('model 为空字符串抛错', () => {
    expect(() =>
      createServerTransport({
        baseUrl: '/api/ai/editor/streamText',
        model: '',
      }),
    ).toThrow(/model/)
  })

  test('extraBody 合并到 body', () => {
    const transport = createServerTransport({
      baseUrl: '/api/ai/editor/streamText',
      model: 'dashscope:qwen-plus',
      extraBody: { stream: true, sessionId: 's-1' },
    })
    const transportObj = transport as unknown as {
      body?: Record<string, unknown> | (() => Record<string, unknown>)
    }
    const body = typeof transportObj.body === 'function' ? transportObj.body() : transportObj.body
    expect(body?.stream).toBe(true)
    expect(body?.sessionId).toBe('s-1')
    expect(body?.model).toBe('dashscope:qwen-plus')
  })

  test('无 getAuthHeaders 时只有 Content-Type', () => {
    const transport = createServerTransport({
      baseUrl: '/api/ai/editor/streamText',
      model: 'dashscope:qwen-plus',
    })
    const transportObj = transport as unknown as {
      headers?: Record<string, string> | (() => Record<string, string>)
    }
    const headers = typeof transportObj.headers === 'function' ? transportObj.headers() : transportObj.headers
    expect(headers?.['Content-Type']).toBe('application/json')
    expect(headers?.Authorization).toBeUndefined()
  })
})

describe('createProxyTransport', () => {
  test('MVP 阶段抛错(未实现)', () => {
    expect(() =>
      createProxyTransport({
        proxyUrl: 'https://proxy.example.com',
      }),
    ).toThrow(/not implemented/)
  })

  test('无参数也抛错', () => {
    expect(() => createProxyTransport({})).toThrow(/not implemented/)
  })
})
