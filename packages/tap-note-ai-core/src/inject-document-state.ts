import type { UIMessage } from 'ai'
import { documentStateSchema } from './types/schema'
import type { DocumentState } from './types/type'

/**
 * 把 `documentState` 注入到 `messages` 列表中,返回新的 `UIMessage[]`。
 *
 * 适配 AI SDK v7 的 `UIMessage.parts` 数组结构(参见研究闸门结论 §14.2 / §14.3):
 * 把 documentState 作为一条 `assistant` 消息(多个 `text` parts)紧贴在原 user
 * 消息之前,提示模型只针对此最新状态发操作。
 *
 * - `documentState` 为 `undefined`/`null` 时原样返回 `messages`,不附加 part。
 * - `documentState` 形状用 `documentStateSchema.parse()` 校验,非法抛 `ZodError`。
 * - 不修改原 `messages` 数组(浅拷贝展开)。
 *
 * 注入后的消息形状可被 FEAT-005 `streamText` 端点解析(契约对齐,实际联调在 FEAT-005)。
 */
export function injectDocumentStateMessages(
  messages: UIMessage[],
  documentState?: DocumentState | null,
): UIMessage[] {
  if (documentState === null || documentState === undefined) {
    return messages
  }
  // 用 Zod 校验 documentState 形状后再注入,非法 documentState 抛 ZodError
  const validated = documentStateSchema.parse(documentState)

  return messages.flatMap((message) => {
    if (message.role !== 'user') {
      return [message]
    }
    const stateMessage: UIMessage = {
      id: `assistant-document-state-${message.id}`,
      role: 'assistant',
      parts: buildDocumentStateParts(validated),
    }
    return [stateMessage, message]
  })
}

function buildDocumentStateParts(state: {
  blocks: unknown
  selection?: { start: string; end: string }
}): UIMessage['parts'] {
  if (state.selection) {
    return [
      {
        type: 'text',
        text: 'This is the latest state of the selection (ignore previous selections, you MUST issue operations against this latest version of the selection):',
      } as const,
      {
        type: 'text',
        text: JSON.stringify(state.selection),
      } as const,
      {
        type: 'text',
        text: 'This is the latest state of the entire document (INCLUDING the selected text), you can use this to find the selected text to understand the context (but you MUST NOT issue operations against this document, you MUST issue operations against the selection):',
      } as const,
      {
        type: 'text',
        text: JSON.stringify(state.blocks),
      } as const,
    ]
  }
  return [
    {
      type: 'text',
      text: 'There is no active selection. This is the latest state of the document (ignore previous documents, you MUST issue operations against this latest version of the document).',
    } as const,
    {
      type: 'text',
      text: JSON.stringify(state.blocks),
    } as const,
  ]
}
