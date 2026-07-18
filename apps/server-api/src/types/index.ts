/**
 * Hono 应用变量(中间件注入)。
 */
export interface AppVariables {
  /** 请求唯一 ID(UUID v4)。 */
  requestId?: string
  /** JWT 校验后的 sub。 */
  userId?: string
  /** JWT 校验后的 scope 列表。 */
  scopes?: string[]
}

/**
 * Hono 环境(Bindings 来自 @hono/node-server,Variables 来自中间件)。
 */
export interface AppEnv {
  Bindings: Record<string, string | undefined>
  Variables: AppVariables
}
