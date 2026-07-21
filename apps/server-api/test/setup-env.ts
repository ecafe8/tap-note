// 测试预加载:设置默认环境变量(模拟 .env 加载)
// 不配置 JWT_VERIFY_KEY:JWT 鉴权由集成方负责,测试走 authMiddleware 开发模式(自动注入 dev-user)。
const testEnv: Record<string, string> = {
  DASHSCOPE_API_KEY: 'sk-test-key',
  CORS_ORIGIN: 'https://app.example.com',
  MODELS_PUBLIC: 'false',
  CONTEXT_MAX_TOKENS: '30000',
  RATE_LIMIT_RPM: '10',
  RATE_LIMIT_CONCURRENCY: '3',
  NODE_ENV: 'test',
}

for (const [k, v] of Object.entries(testEnv)) {
  if (!process.env[k]) {
    process.env[k] = v
  }
}

