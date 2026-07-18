import type { Context } from 'hono'
import type { AppEnv } from '../../../types'
import { success } from '../../../utils/response'
import { editorStreamTextRequestSchema } from '../types'
import { streamEditorText } from '../services/editor-stream-text'
import { createUIMessageStreamResponse } from 'ai'

/**
 * `POST /api/ai/editor/streamText` 控制器。
 *
 * 提取 body → Zod `.parse()` → 调用 service → 返回 UIMessageStream Response。
 * 客户端提交 `tools`/`toolDefinitions` 字段由 schema `.strict()` 拒绝。
 */
export async function editorStreamTextController(c: Context<AppEnv>): Promise<Response> {
  const body = await c.req.json()
  const req = editorStreamTextRequestSchema.parse(body)

  const requestId = c.get('requestId') ?? 'unknown'
  const userId = c.get('userId')

  const stream = await streamEditorText(req, { requestId, userId })

  return createUIMessageStreamResponse({
    stream: stream as never,
    headers: {
      'x-request-id': requestId,
    },
  })
}

/**
 * `POST /api/ai/chat` 控制器。
 */
export { chatController } from './chat'

/**
 * `GET /api/ai/models` 控制器。
 */
export { modelsController } from './models'

/**
 * `POST /api/ai/proxy` 控制器(P1 占位)。
 */
export { proxyController } from './proxy'

/**
 * `POST /api/ai/agents/approval` 控制器。
 */
export { approvalController } from './approval'

/**
 * 成功响应 helper(controller 间共享)。
 */
export function successResponse<T>(c: Context<AppEnv>, data: T): Response {
  return success(c, data)
}

// 显式导出 success(用于 approval controller 等非流式响应)
export { success }
