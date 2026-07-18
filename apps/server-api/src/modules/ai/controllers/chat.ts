import type { Context } from 'hono'
import type { AppEnv } from '../../../types'
import { chatRequestSchema } from '../types'
import { streamChat } from '../services/chat'
import { createUIMessageStreamResponse } from 'ai'

/**
 * `POST /api/ai/chat` 控制器。
 *
 * 提取 body → Zod `.parse()` → 调用 service → 返回 UIMessageStream Response。
 * documentState 缺省时为不引用模式,不注入文档。
 */
export async function chatController(c: Context<AppEnv>): Promise<Response> {
  const body = await c.req.json()
  const req = chatRequestSchema.parse(body)

  const requestId = c.get('requestId') ?? 'unknown'
  const userId = c.get('userId')

  const stream = await streamChat(req, { requestId, userId })

  return createUIMessageStreamResponse({
    stream: stream as never,
    headers: {
      'x-request-id': requestId,
    },
  })
}
