// 测试预加载:设置默认环境变量(模拟 .env 加载)
// JWT_VERIFY_KEY 用临时生成的 RSA 公钥(由测试套件外的脚本生成,见 test/jwt-keys)
const testEnv: Record<string, string> = {
  DASHSCOPE_API_KEY: 'sk-test-key',
  JWT_ISSUER: 'https://idp.test.com',
  JWT_AUDIENCE: 'tap-note-test',
  JWT_VERIFY_KEY: 'test-key', // 默认 HS256 测试;authMiddleware 测试会动态覆盖为 RSA 公钥
  JWT_ALGORITHMS: 'HS256',
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

