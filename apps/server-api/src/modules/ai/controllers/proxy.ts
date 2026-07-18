import type { Context } from 'hono'
import { ERROR_CODES } from '../../../errors'
import { fail } from '../../../utils/response'
import type { AppEnv } from '../../../types'

/**
 * `POST /api/ai/proxy` 控制器(P1 占位)。
 *
 * MVP 阶段不实现,返回 501。
 */
export async function proxyController(c: Context<AppEnv>): Promise<Response> {
  return fail(
    c,
    'NOT_IMPLEMENTED',
    'proxy endpoint not implemented in MVP',
    501,
  )
}

void ERROR_CODES
