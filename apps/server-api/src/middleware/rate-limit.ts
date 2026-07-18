import type { MiddlewareHandler } from 'hono'
import { env } from '../config/env'
import { RateLimitedError } from '../errors'
import type { AppEnv } from '../types'

interface RateLimitState {
  /** 滑动窗口内的请求时间戳列表(用于 RPM)。 */
  rpmWindow: number[]
  /** 当前并发请求数。 */
  concurrency: number
  /** 最近一次重置时间(用于消息数等累计维度)。 */
  lastResetAt: number
  /** 累计消息数(随时间衰减或手动重置)。 */
  messageCount: number
}

const store = new Map<string, RateLimitState>()

function getState(key: string): RateLimitState {
  let s = store.get(key)
  if (!s) {
    s = {
      rpmWindow: [],
      concurrency: 0,
      lastResetAt: Date.now(),
      messageCount: 0,
    }
    store.set(key, s)
  }
  return s
}

/**
 * 限流中间件。按认证主体(sub)限制速率、并发。
 *
 * 维度(均有默认值,可通过 env 覆盖):
 * - 速率(每分钟请求数,`RATE_LIMIT_RPM` 默认 10)
 * - 并发(`RATE_LIMIT_CONCURRENCY` 默认 3)
 *
 * 超限抛 `RateLimitedError`(429)。
 * 注:消息数、token、工具调用轮数、流持续时间等维度由 service 层在调用 streamText 前校验,
 * 中间件只覆盖请求级别的速率与并发。
 */
export const rateLimitMiddleware = (): MiddlewareHandler<AppEnv> => {
  return async (c, next) => {
    const userId = c.get('userId')
    if (!userId) {
      // 未认证(健康检查等)跳过限流
      await next()
      return
    }
    const now = Date.now()
    const state = getState(userId)

    // RPM 检查:滑动窗口 1 分钟
    const windowMs = 60_000
    state.rpmWindow = state.rpmWindow.filter((t) => now - t < windowMs)
    if (state.rpmWindow.length >= env.RATE_LIMIT_RPM) {
      throw new RateLimitedError('rpm', `rate limit exceeded: ${env.RATE_LIMIT_RPM} req/min`)
    }

    // 并发检查
    if (state.concurrency >= env.RATE_LIMIT_CONCURRENCY) {
      throw new RateLimitedError('concurrency', `too many concurrent requests: ${env.RATE_LIMIT_CONCURRENCY}`)
    }

    state.rpmWindow.push(now)
    state.concurrency += 1
    try {
      await next()
    } finally {
      state.concurrency = Math.max(0, state.concurrency - 1)
    }
  }
}

/**
 * 清空限流存储(测试用)。
 */
export function resetRateLimitStore(): void {
  store.clear()
}
