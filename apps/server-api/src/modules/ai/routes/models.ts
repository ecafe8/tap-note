import { Hono } from 'hono'
import type { AppEnv } from '../../../types'
import { modelsController } from '../controllers/models'
import { env } from '../../../config/env'

/**
 * `GET /api/ai/models` 路由。
 *
 * 默认受 JWT 保护;`MODELS_PUBLIC=true` 时允许匿名访问。
 */
export const modelsRoute = new Hono<AppEnv>().get('/api/ai/models', async (c, next) => {
  // MODELS_PUBLIC=true 时跳过 JWT 校验(中间件层会检查)
  if (env.MODELS_PUBLIC) {
    // 标记为可匿名
    c.header('X-Models-Public', 'true')
  }
  await next()
}, modelsController)
