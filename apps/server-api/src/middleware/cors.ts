import { cors } from 'hono/cors'
import { corsOrigins } from '../config/env'

/**
 * CORS 中间件:`Access-Control-Allow-Origin` 受 `CORS_ORIGIN` 环境变量控制。
 *
 * 允许的 Origin 列表严格匹配,不使用 `*`(不推荐生产)。
 * 允许的 Headers:Content-Type、Authorization、x-request-id。
 * 允许的 Methods:GET、POST、OPTIONS。
 */
export const corsMiddleware = cors({
  origin: corsOrigins,
  allowHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  exposeHeaders: ['x-request-id'],
  maxAge: 600,
  credentials: true,
})
