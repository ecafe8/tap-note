import { streamText, toUIMessageStream, convertToModelMessages, tool } from 'ai'
import { z } from 'zod'
import { injectDocumentStateMessages, estimateTokens } from '@tap-note/ai-core'
import { env } from '../../../config/env'
import { logger } from '../../../utils/logger'
import { resolveModel } from './resolve-model'
import { ContextTooLargeError } from '../../../errors'
import type { ChatRequest } from '../types'

/**
 * 对话端点的 client-side tools schema。
 *
 * 服务端声明工具描述与 inputSchema 但不带 `execute`(由客户端执行)。
 * 客户端用 `onToolCall` + `addToolOutput` 回传结果。
 */
export const chatClientSideTools = {
  applyDocumentOperations: tool({
    description: 'Apply document operations to the editor (executed client-side)',
    inputSchema: z.object({
      operation: z.string(),
    }),
    // 无 execute:由客户端执行
  }),
}

/**
 * 对话 streamText service。
 *
 * 流程:校验 → documentState 体积检查(可选)→ injectDocumentStateMessages(可选)
 * → streamText 声明 client-side tools 不 execute → toUIMessageStream。
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

  // 调用 streamText(声明 client-side tools 不 execute)
  const result = streamText({
    model: resolveModel(req.model),
    messages: modelMessages,
    tools: chatClientSideTools,
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

  const stream = toUIMessageStream({
    stream: result.toUIMessageStream() as never,
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
