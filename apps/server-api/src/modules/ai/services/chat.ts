import { streamText, convertToModelMessages, tool } from 'ai'
import { injectDocumentStateMessages, estimateTokens } from '@tap-note/ai-core'
import { env } from '../../../config/env'
import { logger } from '../../../utils/logger'
import { resolveModel } from './resolve-model'
import { ContextTooLargeError } from '../../../errors'
import type { ChatRequest } from '../types'
import {
  CHAT_SYSTEM_PROMPT,
  insertBlockToolInputSchema,
  updateBlockToolInputSchema,
  deleteBlockToolInputSchema,
  replaceBlocksToolInputSchema,
  moveBlockToolInputSchema,
  replaceTextToolInputSchema,
  searchDocumentToolInputSchema,
  getDocumentSnapshotToolInputSchema,
} from '../types/schema'

/**
 * 对话端点 8 个 client-side tools schema(服务端只声明 `description` + `inputSchema`,不提供 `execute`)。
 *
 * 与 ai-core `blockSchema`/`blockOperationSchema` 同源(派生而非重新定义)。
 * **服务端不执行任何编辑工具**:工具的实际执行由客户端 `onToolCall` + `addToolOutput`
 * 完成并回传真实结果。服务端若提供占位 `execute` 会抢先执行并返回假成功,导致
 * 「AI 声称已修改但文档未变」,因此这里 MUST NOT 提供 `execute`。
 *
 * 工具列表:
 * - `insertBlock` — 在指定位置插入块
 * - `updateBlock` — 更新目标块
 * - `deleteBlock` — 删除目标块
 * - `replaceBlocks` — 替换多个块
 * - `moveBlock` — 移动块
 * - `replaceText` — 替换块内文本范围(compare-and-swap)
 * - `searchDocument` — 按文本搜索文档,返回块 ID 与偏移(只读)
 * - `getDocumentSnapshot` — 按需读取更多文档内容
 */
export const allChatClientSideTools = {
  insertBlock: tool({
    description:
      'Insert a new block relative to a reference block. For continue/append/write-at-the-end requests, set appendToDocument=true so the client resolves the current last top-level block instead of using a selection anchor.',
    inputSchema: insertBlockToolInputSchema,
  }),
  updateBlock: tool({
    description: 'Update an existing block by its target block ID',
    inputSchema: updateBlockToolInputSchema,
  }),
  deleteBlock: tool({
    description: 'Delete an existing block by its target block ID',
    inputSchema: deleteBlockToolInputSchema,
  }),
  replaceBlocks: tool({
    description: 'Replace one or more existing blocks with new blocks',
    inputSchema: replaceBlocksToolInputSchema,
  }),
  moveBlock: tool({
    description: 'Move an existing block to a position relative to a reference block',
    inputSchema: moveBlockToolInputSchema,
  }),
  replaceText: tool({
    description:
      'Replace a range of text within a single block. Provide from/to as zero-based character offsets into the block plain text (including from, excluding to) and expectedText (the exact current text in that range) for verification before replacing.',
    inputSchema: replaceTextToolInputSchema,
  }),
  searchDocument: tool({
    description:
      'Search the document for text (substring, or regex when isRegex=true) and return matching blocks with blockId, from/to offsets and matchedText. Use this to locate text BEFORE calling replaceText. Read-only; available in all context modes.',
    inputSchema: searchDocumentToolInputSchema,
  }),
  getDocumentSnapshot: tool({
    description: 'Read more of the document on demand, with block and token limits',
    inputSchema: getDocumentSnapshotToolInputSchema,
  }),
}

/**
 * 对话 streamText service。
 *
 * 流程:校验 → documentState 体积检查(可选)→ injectDocumentStateMessages(可选)
 * → streamText 声明全部 client-side tools 不 execute → toUIMessageStream。
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

  // 注入 documentState(可选)
  const injectedMessages = injectDocumentStateMessages(
    req.messages as never,
    req.documentState,
  )

  // 转换 UIMessage[] 为 ModelMessage[]
  const modelMessages = await convertToModelMessages(injectedMessages as never)

  // 调用 streamText(声明全部 client-side tools 不 execute;system 约束必须调用工具才能改文档)
  // toolChoice 保持 auto:对话也支持纯问答,不强制工具调用。
  const result = streamText({
    model: resolveModel(req.model),
    system: CHAT_SYSTEM_PROMPT,
    messages: modelMessages,
    tools: allChatClientSideTools,
    onFinish: ({ usage, finishReason }) => {
      logger.info(
        {
          requestId: ctx.requestId,
          userId: ctx.userId,
          model: req.model,
          usage,
          finishReason,
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
