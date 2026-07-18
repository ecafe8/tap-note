export {
  /**
   * 创建服务端 transport,封装 AI SDK v7 `DefaultChatTransport`,不持有 LLM Key。
   */
  createServerTransport,
} from './server-transport'
export type {
  /** `createServerTransport` 选项。 */
  CreateServerTransportOptions,
} from './server-transport'
export {
  /**
   * 创建 proxy transport(MVP 占位,FEAT-004 实现)。
   */
  createProxyTransport,
} from './proxy-transport'
export type {
  /** `createProxyTransport` 选项。 */
  CreateProxyTransportOptions,
} from './proxy-transport'

import type { DefaultChatTransport, UIMessage } from 'ai'

/**
 * Transport 类型别名,对齐 AI SDK v7 `DefaultChatTransport<UIMessage>`。
 */
export type Transport = DefaultChatTransport<UIMessage>
