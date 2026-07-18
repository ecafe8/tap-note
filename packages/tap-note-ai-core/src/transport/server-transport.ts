import { DefaultChatTransport, type UIMessage } from 'ai'

/**
 * 服务端 transport 选项。
 */
export interface CreateServerTransportOptions {
  /**
   * API 端点 URL,例如 `/api/ai/editor/streamText`(内联)或 `/api/ai/chat`(对话)。
   * 调用方根据场景选择。
   */
  baseUrl: string
  /**
   * 模型 ID,例如 `dashscope:qwen-plus` 或 `google:gemini-2.0-flash`。
   * 由服务端路由解析,不在客户端解析为 provider。
   */
  model: string
  /**
   * 鉴权头注入器。由集成方提供,返回短期 JWT 等鉴权头。
   * transport 不持有 LLM Key,只通过此回调注入用户级 JWT。
   */
  getAuthHeaders?: () => Record<string, string>
  /**
   * 额外静态 body 字段(可选)。
   */
  extraBody?: Record<string, unknown>
}

/**
 * Transport 类型别名,对齐 AI SDK v7 `DefaultChatTransport<UIMessage>`。
 */
export type Transport = DefaultChatTransport<UIMessage>

/**
 * 创建服务端 transport,封装 AI SDK v7 的 `DefaultChatTransport`。
 *
 * - `body` 携带 `model` 字段(供服务端路由)
 * - `headers` 通过 `getAuthHeaders` 注入短期 JWT(不持有 LLM Key)
 * - 不发起 HTTP(由 `useChat`/`Chat` 调用时实际发起)
 *
 * 安全边界:transport 实例不存储 `apiKey`、`apiSecret` 或任何 LLM provider
 * 凭据字段,凭据仅在服务端由 FEAT-005 处理。
 *
 * 用法:
 * ```ts
 * const transport = createServerTransport({
 *   baseUrl: '/api/ai/editor/streamText',
 *   model: 'dashscope:qwen-plus',
 *   getAuthHeaders: () => ({ Authorization: `Bearer ${getJwt()}` }),
 * })
 * ```
 */
export function createServerTransport(
  options: CreateServerTransportOptions,
): Transport {
  if (!options.baseUrl || typeof options.baseUrl !== 'string') {
    throw new Error('createServerTransport: baseUrl must be a non-empty string')
  }
  if (!options.model || typeof options.model !== 'string') {
    throw new Error('createServerTransport: model must be a non-empty string')
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.getAuthHeaders?.(),
  }
  const body: Record<string, unknown> = {
    model: options.model,
    ...options.extraBody,
  }
  return new DefaultChatTransport<UIMessage>({
    api: options.baseUrl,
    headers,
    body,
  })
}
