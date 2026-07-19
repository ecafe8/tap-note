import type { MiddlewareHandler } from 'hono'
import { importSPKI, jwtVerify } from 'jose'
import { env, getJwtAlgorithms } from '../config/env'
import { AuthError } from '../errors'
import type { AppEnv } from '../types'

/**
 * 缓存已导入的 CryptoKey(避免每次请求重新解析 PEM)。
 */
let cachedKey: { alg: string; key: CryptoKey } | undefined

async function getKey(): Promise<{ alg: string; key: CryptoKey } | undefined> {
  // JWT 未配置时跳过鉴权(开发/演示模式)
  if (!env.JWT_VERIFY_KEY) {
    return undefined
  }
  const alg = getJwtAlgorithms()[0] ?? 'RS256'
  if (cachedKey && cachedKey.alg === alg) {
    return cachedKey
  }
  // RS256/ES256 用 importSPKI 导入 PEM 公钥;HS256 用文本字节
  if (alg.startsWith('RS') || alg.startsWith('ES')) {
    const key = await importSPKI(env.JWT_VERIFY_KEY, alg)
    cachedKey = { alg, key }
    return cachedKey
  }
  // HS256: 直接用 utf-8 字节作为密钥
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.JWT_VERIFY_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  )
  cachedKey = { alg, key }
  return cachedKey
}

/**
 * JWT 校验中间件。
 *
 * 生产 `/api/ai/*` 路由(除健康检查)强制校验短期 JWT:
 * - 验证签名算法、issuer、audience、exp、sub
 * - **先删除所有客户端 `X-User-*` 请求头**,再注入 `c.var.userId`/`c.var.scopes`
 * - 后端不无条件信任客户端 `X-User-*` 头
 *
 * **JWT 未配置时跳过校验**(开发/演示模式)。生产环境集成方自行配置 JWT 鉴权。
 * 失败抛 `AuthError`,由 errorHandlerMiddleware 统一返回 401。
 */
export const authMiddleware = (): MiddlewareHandler<AppEnv> => {
  return async (c, next) => {
    // 1. JWT 未配置时跳过鉴权(开发/演示模式)
    const keyInfo = await getKey()
    if (!keyInfo) {
      // 开发模式:注入默认 userId
      c.set('userId', 'dev-user')
      c.set('scopes', ['ai:editor', 'ai:chat', 'ai:models'])
      await next()
      return
    }

    // 2. 清理客户端伪造的 X-User-* 头
    const headersToRemove: string[] = []
    c.req.raw.headers.forEach((_, name) => {
      if (name.toLowerCase().startsWith('x-user-')) {
        headersToRemove.push(name)
      }
    })
    for (const name of headersToRemove) {
      c.req.raw.headers.delete(name)
    }

    // 3. 提取 Authorization: Bearer <jwt>
    const auth = c.req.header('Authorization')
    if (!auth || !auth.startsWith('Bearer ')) {
      throw new AuthError('missing Bearer token')
    }
    const token = auth.slice(7)

    // 4. 校验 JWT
    const { key } = keyInfo
    let payload: { sub?: string; scope?: string }
    try {
      const result = await jwtVerify(token, key, {
        algorithms: getJwtAlgorithms(),
        issuer: env.JWT_ISSUER,
        audience: env.JWT_AUDIENCE,
      })
      payload = result.payload as { sub?: string; scope?: string }
    } catch {
      throw new AuthError('invalid or expired JWT')
    }

    if (!payload.sub) {
      throw new AuthError('JWT missing sub claim')
    }

    // 5. 注入已验证的身份上下文
    c.set('userId', payload.sub)
    c.set('scopes', payload.scope ? payload.scope.split(' ') : [])

    // 6. 注入回 X-User-Sub 头(已验证的,非客户端伪造)
    c.header('X-User-Sub', payload.sub)

    await next()
  }
}
