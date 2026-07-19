import type { UIMessage, UIMessageChunk } from 'ai'
import type { Transport, DocumentState } from '@tap-note/ai-core'

/**
 * 流式会话选项。
 */
export interface StreamSessionOptions {
  /** AI-core `createServerTransport` 创建的 transport 实例。 */
  transport: Transport
  /** 用户消息列表。 */
  messages: UIMessage[]
  /** 文档状态快照。 */
  documentState: DocumentState
  /** AbortSignal,用于中止流。 */
  abortSignal?: AbortSignal
}

/**
 * 用 `DefaultChatTransport.sendMessages` 发起流式请求。
 *
 * 不依赖 `@ai-sdk/react`;直接调用 transport 的 `sendMessages` 方法,
 * 返回 `ReadableStream<UIMessageChunk>` 供 StreamToolExecutor 消费。
 *
 * per-request `documentState` 通过 `body` 参数动态注入。
 *
 * @returns `ReadableStream<UIMessageChunk>` 供 StreamToolExecutor 消费
 */
export async function startStreamSession(
  options: StreamSessionOptions,
): Promise<ReadableStream<UIMessageChunk>> {
  const stream = await options.transport.sendMessages({
    trigger: 'submit-message',
    chatId: crypto.randomUUID(),
    messageId: undefined,
    messages: options.messages,
    abortSignal: options.abortSignal,
    body: { documentState: options.documentState },
  } as Parameters<Transport['sendMessages']>[0])

  return stream
}
