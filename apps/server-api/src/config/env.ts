import 'dotenv/config'
import { z } from 'zod'

/**
 * 环境变量 Zod schema。
 * 启动时 `safeParse`,失败打印错误并 `process.exit(1)`(fail-fast)。
 * 业务代码统一通过 `env` 访问,不读 `process.env`。
 *
 * JWT 配置为可选:未配置时跳过 JWT 校验(开发/演示模式)。
 * 生产环境集成方自行配置 JWT 鉴权。
 */
const emptyToUndefined = (v: unknown) => (v === '' ? undefined : v)

const envSchema = z.object({
  /** DashScope(阿里云百炼)API Key,必填。 */
  DASHSCOPE_API_KEY: z.string().min(1, 'DASHSCOPE_API_KEY is required'),
  /** DashScope 自定义 base URL(可选)。 */
  DASHSCOPE_BASE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  /** Google Generative AI API Key(可选,未设置则不返回 google:* 模型)。 */
  GOOGLE_GENERATIVE_AI_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  /** Google 自定义 base URL。 */
  GOOGLE_GENERATIVE_BASE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  /** JWT 签发者(可选,未配置时跳过 JWT 校验)。 */
  JWT_ISSUER: z.preprocess(emptyToUndefined, z.string().optional()),
  /** JWT 受众(可选)。 */
  JWT_AUDIENCE: z.preprocess(emptyToUndefined, z.string().optional()),
  /** JWT 验证密钥(可选,PEM 公钥或共享密钥)。 */
  JWT_VERIFY_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  /** JWT 允许的签名算法(逗号分隔)。默认 `RS256,ES256`。 */
  JWT_ALGORITHMS: z.string().default('RS256,ES256'),
  /** 监听端口。默认 3000。 */
  PORT: z.coerce.number().int().positive().default(3000),
  /** pino 日志级别。默认 `info`。 */
  LOG_LEVEL: z
    .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])
    .default('info'),
  /** 允许的 CORS Origin(逗号分隔)。 */
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  /** 是否允许匿名访问 `/api/ai/models`(默认 false)。 */
  MODELS_PUBLIC: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  /** documentState 估算 token 上限。默认 30000。 */
  CONTEXT_MAX_TOKENS: z.coerce.number().int().positive().default(30000),
  /** 每分钟请求数上限。默认 10。 */
  RATE_LIMIT_RPM: z.coerce.number().int().positive().default(10),
  /** 最大并发请求数。默认 3。 */
  RATE_LIMIT_CONCURRENCY: z.coerce.number().int().positive().default(3),
  /** 单会话最大消息数。默认 20。 */
  RATE_LIMIT_MAX_MESSAGES: z.coerce.number().int().positive().default(20),
  /** 单次请求最大输入 token。默认 30000。 */
  RATE_LIMIT_MAX_INPUT_TOKENS: z.coerce.number().int().positive().default(30000),
  /** 单次请求最大输出 token。默认 30000。 */
  RATE_LIMIT_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(30000),
  /** 工具调用最大轮数。默认 5。 */
  RATE_LIMIT_MAX_TOOL_ROUNDS: z.coerce.number().int().positive().default(5),
  /** 流式请求最大持续时间(秒)。默认 60。 */
  RATE_LIMIT_MAX_STREAM_DURATION_SEC: z.coerce
    .number()
    .int()
    .positive()
    .default(60),
  /** 运行环境。 */
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

export type Env = z.infer<typeof envSchema>

/**
 * 解析环境变量。fail-fast:校验失败时打印 Zod 错误并 `process.exit(1)`。
 */
function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) {
    console.error('[env] Environment variable validation failed:')
    for (const issue of parsed.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`)
    }
    process.exit(1)
  }
  return parsed.data
}

export const env: Env = loadEnv()

/**
 * CORS Origin 列表(解析逗号分隔)。
 */
export const corsOrigins: string[] = env.CORS_ORIGIN.split(',')
  .map((o) => o.trim())
  .filter(Boolean)

/**
 * JWT 允许算法列表(解析逗号分隔,从 env 读取)。
 */
export function getJwtAlgorithms(): string[] {
  return env.JWT_ALGORITHMS.split(',').map((a) => a.trim()).filter(Boolean)
}
