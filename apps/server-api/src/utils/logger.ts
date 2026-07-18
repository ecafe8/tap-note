import pino from 'pino'
import { env } from '../config/env'

/**
 * pino logger 实例。
 *
 * 配置 `redact` 防止 prompt/文档正文/工具结果进入日志(隐私)。
 * 开发环境用 pino-pretty 格式化。
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  ...(env.NODE_ENV !== 'production'
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true },
        },
      }
    : {}),
  redact: {
    paths: [
      'req.body',
      'req.body.messages',
      'req.body.documentState',
      'req.body.documentState.blocks',
      'res.body',
      'headers.authorization',
      'headers.Authorization',
      'apiKey',
      'api_key',
    ],
    censor: '[REDACTED]',
  },
})
