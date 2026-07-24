import { streamText, convertToModelMessages, tool } from 'ai'
import { injectDocumentStateMessages, estimateTokens } from '@tap-note/ai-core'
import { env } from '../../../config/env'
import { logger } from '../../../utils/logger'
import { resolveModel } from './resolve-model'
import { ContextTooLargeError, AIProviderError } from '../../../errors'
import {
  EDITOR_SYSTEM_PROMPT,
  serverStreamToolInputSchema,
} from '../types'
import type { EditorStreamTextRequest } from '../types'

/**
 * 服务端 streamTool schema(editor/streamText 端点)。
 *
 * 与 `@tap-note/ai-core` 的 `blockOperationSchema` 同源(从 ai-core 导入)。
 * 服务端 execute 返回 `{ ok: true }`,实际编辑器操作由客户端 `applyOperationsToEditor` 应用。
 */
export const serverStreamTools = {
  applyDocumentOperations: tool({
    description: 'Apply document operations to the editor',
    inputSchema: serverStreamToolInputSchema,
    execute: async () => ({ ok: true as const }),
  }),
}

/**
 * 内联写作 streamText service。
 *
 * 流程:校验 → documentState 体积检查 → injectDocumentStateMessages → streamText
 * → toUIMessageStream → 返回 ReadableStream。
 *
 * 服务端持有 streamTool schema(与 ai-core BlockOperation 同源);
 * 客户端不得提交或覆盖工具定义。
 */
export async function streamEditorText(
  req: EditorStreamTextRequest,
  ctx: { requestId: string; userId?: string },
): Promise<ReadableStream<unknown>> {
  // documentState 体积检查
  const documentStateText = JSON.stringify(req.documentState.blocks)
  const estimated = estimateTokens(documentStateText)
  if (estimated > env.CONTEXT_MAX_TOKENS) {
    throw new ContextTooLargeError(estimated, env.CONTEXT_MAX_TOKENS)
  }

  // 注入 documentState 到 messages(复用 ai-core 的注入逻辑,单 source of truth)
  const injectedMessages = injectDocumentStateMessages(
    req.messages as never,
    req.documentState,
  )

  // 转换 UIMessage[] 为 ModelMessage[]
  const modelMessages = await convertToModelMessages(injectedMessages as never)

  // 调用 streamText
  const result = streamText({
    model: resolveModel(req.model),
    system: EDITOR_SYSTEM_PROMPT,
    messages: modelMessages,
    tools: serverStreamTools,
    toolChoice: 'auto',
    onFinish: ({ usage, finishReason }) => {
      // 隐私日志:记录 requestId/userId/model/usage/duration/status,不记录正文
      logger.info(
        {
          requestId: ctx.requestId,
          userId: ctx.userId,
          model: req.model,
          usage,
          finishReason,
        },
        'editor streamText finished',
      )
    },
  })

  // 转为 UIMessageStream,错误掩码(不泄漏 Provider Key)
  // 注意: result.toUIMessageStream() 已经返回 ReadableStream<UIMessageChunk>,
  // 不要再包一层 toUIMessageStream()(会导致双重转换报错)
  const stream = result.toUIMessageStream({
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      logger.error({ requestId: ctx.requestId, error: message }, 'streamText error')
      if (/apiKey|api_key|secret|sk-/i.test(message)) {
        return 'AI provider call failed'
      }
      return message
    },
  })

  return stream as unknown as ReadableStream<unknown>
}

/**
 * Provider 调用失败时抛 AIProviderError(不泄漏 Key)。
 */
export function handleProviderError(error: unknown, requestId: string): never {
  const message = error instanceof Error ? error.message : String(error)
  logger.error({ requestId, error: message }, 'AI provider error')
  throw new AIProviderError()
}
