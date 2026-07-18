import type { Context } from 'hono'
import type { AppEnv } from '../../../types'
import { createAgentUIStreamResponse } from 'ai'
import { createApprovalAgent } from '../agents/agent-approval/create-approval-agent'

/**
 * `POST /api/ai/agents/approval` 控制器。
 *
 * 保留审批代理为独立示例,用 v7 `createAgentUIStreamResponse` 返回流。
 */
export async function approvalController(c: Context<AppEnv>): Promise<Response> {
  const body = await c.req.json()
  const { messages } = body as { messages: unknown[] }

  if (!Array.isArray(messages)) {
    return c.json(
      { code: 'VALIDATION_ERROR', message: 'messages must be an array', data: null },
      422,
    )
  }

  const userId = c.get('userId') ?? 'anonymous'
  const requestId = c.get('requestId') ?? 'unknown'

  const agent = createApprovalAgent(userId)

  return createAgentUIStreamResponse({
    agent,
    uiMessages: messages as never,
    headers: {
      'x-request-id': requestId,
    },
  })
}
