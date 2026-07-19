import { streamText, convertToModelMessages, tool } from 'ai'
import { injectDocumentStateMessages, estimateTokens } from '@tap-note/ai-core'
import { env } from '../../../config/env'
import { logger } from '../../../utils/logger'
import { resolveModel } from './resolve-model'
import { ContextTooLargeError } from '../../../errors'
import type { ChatRequest } from '../types'
import type { ChatContextMode } from '../types/schema'
import {
  insertBlockToolInputSchema,
  updateBlockToolInputSchema,
  deleteBlockToolInputSchema,
  replaceBlocksToolInputSchema,
  moveBlockToolInputSchema,
  getDocumentSnapshotToolInputSchema,
} from '../types/schema'

/**
 * 对话端点 6 个 client-side tools schema(服务端只声明,不 execute)。
 *
 * 与 ai-core `blockSchema`/`blockOperationSchema` 同源(派生而非重新定义)。
 * 服务端 `execute` 始终返回 `{ ok: true }` 占位;实际编辑器操作由客户端
 * `onToolCall` + `addToolOutput` 执行并回传结果。
 *
 * 工具列表:
 * - `insertBlock` — 在指定位置插入块
 * - `updateBlock` — 更新目标块
 * - `deleteBlock` — 删除目标块
 * - `replaceBlocks` — 替换多个块
 * - `moveBlock` — 移动块
 * - `getDocumentSnapshot` — 按需读取更多文档内容(仅 `full` 模式声明)
 */
export const allChatClientSideTools = {
  insertBlock: tool({
    description: 'Insert a new block at the specified position relative to a reference block',
    inputSchema: insertBlockToolInputSchema,
    execute: async () => ({ ok: true as const }),
  }),
  updateBlock: tool({
    description: 'Update an existing block by its target block ID',
    inputSchema: updateBlockToolInputSchema,
    execute: async () => ({ ok: true as const }),
  }),
  deleteBlock: tool({
    description: 'Delete an existing block by its target block ID',
    inputSchema: deleteBlockToolInputSchema,
    execute: async () => ({ ok: true as const }),
  }),
  replaceBlocks: tool({
    description: 'Replace one or more existing blocks with new blocks',
    inputSchema: replaceBlocksToolInputSchema,
    execute: async () => ({ ok: true as const }),
  }),
  moveBlock: tool({
    description: 'Move an existing block to a position relative to a reference block',
    inputSchema: moveBlockToolInputSchema,
    execute: async () => ({ ok: true as const }),
  }),
  getDocumentSnapshot: tool({
    description: 'Read more of the document on demand, with block and token limits',
    inputSchema: getDocumentSnapshotToolInputSchema,
    execute: async () => ({ ok: true as const }),
  }),
}

/**
 * 根据上下文模式过滤 client-side tools 声明。
 *
 * - `none` / `selection`:不声明 `getDocumentSnapshot`(LLM 不可见)
 * - `full`:声明全部 6 个 tools
 *
 * 防止 LLM 在不引用或选区模式下尝试读取全文,造成无意义重试。
 */
export function getChatClientSideTools(contextMode: ChatContextMode): Record<string, typeof allChatClientSideTools[keyof typeof allChatClientSideTools]> {
  if (contextMode === 'full') {
    return allChatClientSideTools
  }
  // 排除 getDocumentSnapshot,只保留 5 个核心 tools
  const { getDocumentSnapshot: _, ...rest } = allChatClientSideTools
  void _
  return rest
}

/**
 * 对话 streamText service。
 *
 * 流程:校验 → documentState 体积检查(可选)→ injectDocumentStateMessages(可选)
 * → streamText 声明 client-side tools 不 execute(按 contextMode 过滤)→ toUIMessageStream。
 */
export async function streamChat(
  req: ChatRequest,
  ctx: { requestId: string; userId?: string },
): Promise<ReadableStream<unknown>> {
  // documentState 体积检查(仅在 documentState 存在时)
  if (req.documentState) {
    const documentStateText = JSON.stringify(req.documentState.blocks)
    const estimated = estimateTokens(documentStateText)
    if (estimated > env.CONTEXT_MAX_TOKENS) {
      throw new ContextTooLargeError(estimated, env.CONTEXT_MAX_TOKENS)
    }
  }

  // 注入 documentState(可选,不引用模式不注入)
  const injectedMessages = injectDocumentStateMessages(
    req.messages as never,
    req.documentState,
  )

  // 转换 UIMessage[] 为 ModelMessage[]
  const modelMessages = await convertToModelMessages(injectedMessages as never)

  // 根据 contextMode 过滤 tools(只在 full 模式声明 getDocumentSnapshot)
  const tools = getChatClientSideTools(req.contextMode)

  // 调用 streamText(声明 client-side tools 不 execute)
  const result = streamText({
    model: resolveModel(req.model),
    messages: modelMessages,
    tools,
    onFinish: ({ usage, finishReason }) => {
      logger.info(
        {
          requestId: ctx.requestId,
          userId: ctx.userId,
          model: req.model,
          usage,
          finishReason,
          contextMode: req.contextMode,
        },
        'chat streamText finished',
      )
    },
  })

  // 转为 UIMessageStream,错误掩码
  const stream = result.toUIMessageStream({
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      logger.error({ requestId: ctx.requestId, error: message }, 'chat streamText error')
      if (/apiKey|api_key|secret|sk-/i.test(message)) {
        return 'AI provider call failed'
      }
      return message
    },
  })

  return stream as unknown as ReadableStream<unknown>
}
