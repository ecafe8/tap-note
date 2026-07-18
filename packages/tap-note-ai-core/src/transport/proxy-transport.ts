import type { DefaultChatTransport, UIMessage } from 'ai'

/**
 * Proxy transport 选项(MVP 占位,FEAT-004 实现具体能力)。
 */
export interface CreateProxyTransportOptions {
  /**
   * Proxy 代理 URL。MVP 仅占位,不实际使用。
   */
  proxyUrl?: string
  /**
   * 鉴权头注入器(可选)。
   */
  getAuthHeaders?: () => Record<string, string>
}

/**
 * 创建 proxy transport(P1 候选 ClientSideTransport 等价能力)。
 *
 * MVP 阶段仅占位接口,实际能力由 FEAT-004 实现。
 * 当前实现抛出错误,提醒调用方此能力未实现。
 */
export function createProxyTransport(
  _options: CreateProxyTransportOptions,
): DefaultChatTransport<UIMessage> {
  // MVP 占位:FEAT-004 提供具体实现,这里仅声明接口契约。
  void _options
  throw new Error(
    'createProxyTransport: not implemented in MVP (FEAT-004 will provide ClientSideTransport equivalent)',
  )
}
