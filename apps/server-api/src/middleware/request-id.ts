import type { MiddlewareHandler } from 'hono'
import { randomUUID } from 'crypto'
import type { AppEnv } from '../types'

/**
 * requestId 中间件:注入 `c.var.requestId` 与 `x-request-id` 响应头。
 *
 * 若客户端请求头携带 `x-request-id` 则透传(便于跨服务串联);否则生成 UUID v4。
 */
export const requestIdMiddleware = (): MiddlewareHandler<AppEnv> => {
  return async (c, next) => {
    const incoming = c.req.header('x-request-id')
    const id = incoming && incoming.length > 0 ? incoming : randomUUID()
    c.set('requestId', id)
    c.header('x-request-id', id)
    await next()
  }
}
