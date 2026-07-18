/**
 * @packageDocumentation @workspace/server-api
 *
 * TapNote 自托管 AI 网关。Hono + AI SDK v7,提供:
 * - `POST /api/ai/editor/streamText`:内联流式写作
 * - `POST /api/ai/chat`:对话流式(client-side tools)
 * - `GET /api/ai/models`:allowlist 元数据
 * - `POST /api/ai/agents/approval`:审批代理独立示例
 * - `POST /api/ai/proxy`:P1 透明代理占位
 *
 * 中间件:requestId → CORS → auth(JWT + 清理 X-User-* 头)→ rateLimit → errorHandler。
 * Provider Key 不外泄,浏览器 DevTools 永不见 LLM Key。
 */

import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { env } from './config/env'
import type { AppEnv } from './types'
import { requestIdMiddleware } from './middleware/request-id'
import { corsMiddleware } from './middleware/cors'
import { authMiddleware } from './middleware/auth'
import { rateLimitMiddleware } from './middleware/rate-limit'
import { errorHandlerMiddleware } from './middleware/error-handler'
import { aiRoutes } from './modules/ai/routes'
import { logger } from './utils/logger'

export type { AppEnv, AppVariables } from './types'
export { env } from './config/env'
export type { Env } from './config/env'
export {
  AppError,
  ValidationError,
  AuthError,
  ModelNotAllowedError,
  ContextTooLargeError,
  RateLimitedError,
  AIProviderError,
} from './errors'
export { ERROR_CODES, type ErrorCode } from './errors'
export { success, fail, type ApiResponse } from './utils/response'
export { logger } from './utils/logger'

/**
 * 创建 Hono 应用,装配全局中间件与路由。
 *
 * 中间件顺序:
 * 1. errorHandler(全局包装,捕获所有未处理错误)
 * 2. requestId(注入 x-request-id)
 * 3. cors(允许白名单 Origin)
 * 4. auth(生产 `/api/ai/*` 强制 JWT 校验 + 清理 X-User-* 头)
 * 5. rateLimit(按 sub 限流)
 */
export function createApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>()

  // 全局错误处理(最后包装)
  app.onError(errorHandlerMiddleware)

  // 中间件栈
  app.use('*', requestIdMiddleware())
  app.use('*', corsMiddleware)

  // 健康检查(匿名可访问,不经过 auth 中间件)
  app.get('/health', (c) => c.text('ok'))
  app.get('/ready', (c) => c.text('ready'))

  // /api/ai/* 强制 JWT 校验(除非 MODELS_PUBLIC 且请求 /api/ai/models)
  app.use('/api/ai/*', async (c, next) => {
    // MODELS_PUBLIC=true 且 GET /api/ai/models 跳过 JWT
    if (env.MODELS_PUBLIC && c.req.method === 'GET' && c.req.path === '/api/ai/models') {
      await next()
      return
    }
    await authMiddleware()(c, next)
  })
  app.use('/api/ai/*', rateLimitMiddleware())

  // 业务路由
  app.route('/', aiRoutes)

  return app
}

/**
 * 启动 HTTP 服务(生产/开发入口)。
 */
if (env.NODE_ENV !== 'test') {
  const app = createApp()
  serve(
    { fetch: app.fetch, port: env.PORT },
    (info) => {
      logger.info({ port: info.port, env: env.NODE_ENV }, 'server-api listening')
    },
  )
}
