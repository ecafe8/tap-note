## Context

FEAT-002 `@tap-note/ai-core` 已归档,提供 `BlockOperation`/`DocumentState`/`ConflictResult` Zod schema、`createServerTransport`、`injectDocumentStateMessages`、`applyOperationsToEditor`、`createAIBusyState`、`layerContext` 等共享契约。客户端 transport 指向 `/api/ai/editor/streamText` 与 `/api/ai/chat`,但 `apps/server-api` 当前只是半成品:

- 无 `package.json`、`tsconfig.json`、`index.ts`、`bunfig.toml`,包未被 workspace 识别。
- `src/config.ts` 直接读 `process.env` + `z.parse`(非 `safeParse` + `process.exit(1)`),不符合 Hono coding 规范的 fail-fast。
- `src/modules/ai/providers/providers.ts` 创建 DashScope(qwen-plus/max/qwen3-vl-flash)与 Google(gemini-2.0-flash、gemini-3-flash-preview)provider,但未导出 `defaultAgentModel`,导致 `create-approval-agent.ts` 的 `import { defaultAgentModel }` 失败。
- `routes/index.ts` 已用 v7 `createAgentUIStreamResponse`,但未导出 `defaultAgentModel`,脚手架实际无法运行。
- 无 `config/env.ts`、`middleware/{error-handler,request-id,auth,rate-limit,cors}.ts`、无 `errors/{app-error,error-codes}.ts`、无 `utils/logger.ts` 的 pino 结构化日志。
- v7 研究闸门结论已在 FEAT-002 `tech.md §14` 锁定:`ai@7.0.31` + `@ai-sdk/alibaba@2.0.14` + `@ai-sdk/google@4.0.18` peerDep 兼容;`streamText({ model, messages, tools, toolChoice })` 返回带 `.toUIMessageStream()` 的对象;v7 `UIMessage.parts` 数组结构;`createAgentUIStreamResponse` 在 v7 保留;`needsApproval` → `toolApproval`。本 change 复用这些结论,无需重新研究,但需以 Context7 复核服务端 `streamText` + UIMessageStream 协议与 Hono 集成。

约束:遵循 Hono coding 规范(模块化、Zod、AppError、pino、统一响应信封、`/api/` 前缀);不引入 `@blocknote/xl-ai-server`(GPL);浏览器永不持 LLM Key;不记录正文日志。

## Goals / Non-Goals

**Goals:**

- 把 `apps/server-api` 补齐为可独立启动的 Hono workspace app,通过 `bun run dev` 在 `:3000` 监听。
- 实现 3 个 P0 流式/元数据端点 + 1 个独立审批示例端点 + 1 个 P1 透明代理占位:
  - `POST /api/ai/editor/streamText`(内联,服务端 streamTool schema + 客户端不得提交工具定义)
  - `POST /api/ai/chat`(对话,服务端声明版本化 client-side tools 不 execute)
  - `GET /api/ai/models`(allowlist 元数据,默认 JWT 保护)
  - `POST /api/ai/agents/approval`(保留示例,v7 重写)
  - `POST /api/ai/proxy`(P1 占位接口)
- 中间件栈:`requestId` → `cors` → `auth`(JWT 校验 + 清理 `X-User-*` 头)→ `rateLimit` → `errorHandler`(统一 `AppError`/`ZodError`/未知错误处理)。
- `config/env.ts` 用 Zod schema `safeParse`,失败 `process.exit(1)` fail-fast;业务代码统一通过 `env` 访问,不读 `process.env`。
- `modules/ai/providers/` 迁移现有 `createLLMProvider` 并新增 `defaultAgentModel` 导出,修复审批代理脚手架。
- 服务端 streamTool schema 与 `@tap-note/ai-core` 的 `blockOperationSchema` **同源**(从 ai-core 导入,不在服务端重复定义)。
- 隐私日志:记录 requestId、用户 sub、模型、用量、耗时、状态;**不记录** prompt/文档正文/工具结果。
- `app.request()` 集成测试覆盖中间件、Zod 校验、allowlist 拒绝、错误响应、流 headers,Provider 用 mock 隔离。
- `.env.example` 文档化所有必需环境变量。

**Non-Goals:**

- 不实现编辑器 UI、客户端 operation 执行、documentState 构造(属 FEAT-002/003/004)。
- 不签发终端用户账号或长期 Token(总 PRD §5.2 排除);JWT 校验只验签,签发由集成方 BFF/外部 IdP 完成。
- 不实现持久化、导出、字体(属其他 Sub)。
- 不实现 npm 发布(私有 app,FEAT-007 处理 SDK 发布)。
- 不引入 `@blocknote/xl-ai-server` 或任何 GPL/AGPL 依赖。
- 不实现 OpenAPI 自动生成文档(P2 候选,FEAT-007 处理);现有 `hono-openapi` 的 `describeRoute` 调用保留为简单标注,不作为契约源。
- 不实现多租户租户隔离(MVP 单租户自托管)。
- 不实现 Redis 限流存储(MVP 用内存 Map,P2 可替换)。

## Decisions

### 1. JWT 校验用 `jose`,不用 `hono/jwt` 或 `jsonwebtoken`

`jose` 是现代 ESM 库,支持 JWKS、签名算法白名单、issuer/audience/exp 校验,与 Hono + Bun 兼容性好。`hono/jwt` 内置 JWT 中间件功能较弱(无 JWKS、claims 校验需手写)。`jsonwebtoken` 是 CJS,与 Bun ESM 不友好,且历史 CVE 较多。

备选:`hono/jwt` 简单但功能不足;`jsonwebtoken` 旧。排除。

### 2. 限流用内存 Map,不引入 Redis

MVP 单实例自托管,内存 Map 够用。限流维度:每认证主体(sub)的速率(默认 10 req/min)、并发(默认 3)、消息数(默认 20/会话)、输入/输出 token(默认 30K/30K)、工具调用轮数(默认 5)、流持续时间(默认 60s)。维度可配,所有超限返回 `429 RATE_LIMITED`。

备选:Redis store。放弃原因是 MVP 不假设 Redis 部署;P2 通过抽象 `RateLimitStore` 接口替换。

### 3. 服务端 streamTool schema 从 `@tap-note/ai-core` 导入,不在服务端重复定义

`editor/streamText` 端点的服务端工具 schema 与 `@tap-note/ai-core` 的 `blockOperationSchema` **同源**,直接 `import { blockOperationSchema } from '@tap-note/ai-core'`。工具的 `inputSchema` 用 `blockOperationSchema`(或其子 schema),`execute` 由服务端实现为返回 `{ ok: true }`(实际编辑器操作由客户端 `applyOperationsToEditor` 应用,服务端只校验+回传)。

备选:服务端独立定义等价 schema。放弃原因是 schema 漂移会导致 revision/前置条件校验不一致(对齐 FEAT-002 spec "服务端与客户端共享同一 schema 模块,不允许各自定义等价 schema")。

### 4. documentState 注入用 ai-core 的 `injectDocumentStateMessages`,不在服务端重写

服务端 `editor/streamText` 与 `chat` 两个端点收到 `documentState` 后,直接调用 `injectDocumentStateMessages(messages, documentState)`(从 `@tap-note/ai-core` 导入)注入。单 source of truth,确保客户端与服务端消息形状一致。

备选:服务端独立实现注入逻辑。放弃原因是 v7 `UIMessage.parts` 形状复杂,两端实现可能漂移。

### 5. streamText 服务端调用 + UIMessageStream 协议

`streamText({ model: resolveModel(modelId), system: systemPrompt, messages: await convertToModelMessages(injectedMessages), tools, toolChoice: "required" })` → `result.toUIMessageStream({ onError: (e) => e instanceof Error ? e.message : String(e) })` → `new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'x-request-id': requestId } })`。Hono 的 `c.body(stream)` 也可用,但显式 `new Response` 控制更直接。

备选:`createUIMessageStream` + `createUIMessageStreamResponse`。放弃原因:这两个用于自定义流,`streamText().toUIMessageStream()` 更直接,无需 writer 介入。

### 6. 审批代理用 v7 `createAgentUIStreamResponse` 重写,保留为独立示例

`createAgentUIStreamResponse({ agent, uiMessages, sendReasoning: true })` 在 v7 保留(研究闸门已确认)。审批代理用 v7 `ToolLoopAgent` + `toolApproval` 重写:`toolApproval: { approvalTool: 'user-approval' }` 替代 v6 的 `needsApproval: true`。

备选:废弃审批代理。放弃原因是总 PRD v2 决策保留为独立示例,且可作为 `toolApproval` 的参考实现。

### 7. 错误码统一为 `as const` 对象,不用 enum

按 Hono coding 规范,错误码常量定义在 `errors/error-codes.ts`,用 `as const` 对象而非 enum。错误码:`SUCCESS`、`VALIDATION_ERROR`、`AUTH_INVALID`、`MODEL_NOT_ALLOWED`、`CONTEXT_TOO_LARGE`、`RATE_LIMITED`、`AI_PROVIDER_ERROR`、`INTERNAL_ERROR`。`AppError` 子类:`ValidationError`(422)、`AuthError`(401)、`ModelNotAllowedError`(400)、`ContextTooLargeError`(400)、`RateLimitedError`(429)、`AIProviderError`(502)。

备选:enum。放弃原因是 `as const` 对象 tree-shaking 友好,与 Hono 规范一致。

### 8. pino 日志 + redact 配置,不记录正文

`pino` 实例配置 `redact: { paths: ['req.body', 'req.body.messages', 'req.body.documentState', 'res.body'] }`,记录 `requestId`、`userId`(脱敏后)、`model`、`usage`(inputTokens/outputTokens)、`durationMs`、`status`。开发环境用 `pino-pretty`。

备选:`console.log`。放弃原因是无结构化、无 requestId 串联、不脱敏。

### 9. 路由前缀统一为 `/api/ai/*`,健康检查独立路径

业务路由全部以 `/api/ai/` 前缀;健康检查 `/health` 与 `/ready` 独立,可匿名访问;`/api/ai/models` 默认 JWT 保护,可通过 `MODELS_PUBLIC=true` 配置开启匿名访问。

备选:把 models 放在根路径。放弃原因是与 Hono 规范的 `/api/` 前缀一致。

### 10. CORS 由 `CORS_ORIGIN` 控制,不暴露 LLM Key 头

`cors()` 中间件从 `env.CORS_ORIGIN` 读取逗号分隔的 origin 列表;LLM 调用由服务端注入 Key,响应头不携带任何 `Authorization`/`X-API-Key` 字段。

### 11. 中间件顺序与 `X-User-*` 头清理

顺序:`requestId` → `cors` → `auth`(JWT 校验后**先删除所有 `X-User-*` 请求头**,再注入已验证的 `X-User-Sub`/`X-User-Scopes`)→ `rateLimit` → `errorHandler`(全局,最后包装)。后端服务不无条件信任客户端 `X-User-*` 头。

## Risks / Trade-offs

- [JWT 密钥轮换流程未定义] → MVP 用 `JWT_VERIFY_KEY` 单一密钥,部署文档建议定期轮换;P2 支持 JWKS endpoint 多密钥。本 change 不实现轮换流程。
- [内存限流不跨实例] → MVP 单实例自托管;多实例部署需替换为 Redis store。本 change 提供抽象 `RateLimitStore` 接口便于替换。
- [streamText 上游 Provider 失败] → `onError` 把错误转为 `error` part 返回给客户端,不泄漏 Key;同时 `AIProviderError`(502)记录完整日志带 requestId,对外只返回稳定错误码。
- [documentState 体积超限] → 收到请求时先估算 token(`estimateTokens` from ai-core),超过 `CONTEXT_MAX_TOKENS`(默认 30K,可配)返回 `CONTEXT_TOO_LARGE`(400),不调用 Provider。
- [v7 API 再次 breaking change] → 研究闸门已锁定 `ai@7.0.31` 的 `streamText`/`UIMessage`/`DefaultChatTransport` 形状;若安装后发现 API 与文档不符,先更新本 design 与 tech.md,不带着错误 API 实现。
- [审批代理 `defaultAgentModel` 修复后仍可能因 v7 `ToolLoopAgent` API 变化失效] → MVP 实现后用 `app.request()` 集成测试覆盖;若 `ToolLoopAgent` 在 v7 不再可用,降级为 `streamText` + `stopWhen: isStepCount(15)` + `toolApproval` 手动实现。
- [Hono `app.request()` 测试与流式响应断言] → 流式端点用 `Content-Type: text/event-stream` 头校验 + 读取 `response.body` 流的第一个 chunk 验证非空;不解析完整流。
- [`@ai-sdk/google` `createGoogleGenerativeAI` 类型 `as any` 规避] → 沿用现有 `as any` 规避(Google provider 的类型与 v7 有出入),记录在 tech.md 待 v7 适配后修复。
- [中间件顺序错误导致身份头泄漏] → 集成测试覆盖:`X-User-Fake` 头注入请求,断言控制器收到的是 JWT 校验后的 `X-User-Sub`,不是伪造值。

## Migration Plan

无运行时数据或公开 API 需要迁移(全新 app)。回滚方式是删除 `apps/server-api` 或恢复到原脚手架状态(git revert)。

1. 先补包基础与 `config/env.ts` + 中间件骨架,`bun run dev` 能启动并响应 `/health`。
2. 实现 `modules/ai/providers/` 迁移 + `defaultAgentModel` 导出,修复审批代理脚手架。
3. 实现 3 个 P0 端点 + 1 个审批示例,通过 `app.request()` 集成测试。
4. `.env.example` 文档化,根 `bun run typecheck/lint/test` 通过。

## Open Questions

- JWT claims 精确集合:`sub`(必)、`iss`、`aud`、`exp`、`scope`(最小权限声明,如 `ai:editor`/`ai:chat`/`ai:models`);`scope` 字段名与值需对齐集成方 BFF,本 change 假设用标准 `scope` claim 空格分隔。
- `hono` 与 `@hono/node-server` 精确版本需以 lockfile 锁定(目标 `hono@~4.12`、`@hono/node-server@~2.0`,以 Context7 复核)。
- `jose` 精确版本(目标 `^5` 或 `^6`,以 Context7 复核 v7 兼容)。
- 限流维度的精确默认值(速率/并发/消息数/token/轮数/持续时间)需部署方校准;本 change 提供默认值与可配 override。
- 是否需要 `POST /api/ai/proxy` 透明代理的 P1 实现;MVP 占位抛 501,FEAT-007 阶段评估。

## 环境变量清单(.env.example 内容)

实现时 `apps/server-api/.env.example` SHALL 包含以下变量,文档化所有必需与可选环境变量及默认值。`config/env.ts` 的 Zod schema 与此清单对齐。

```bash
# ============== LLM Provider 配置 ==============
# DashScope(阿里云百炼)API Key,必填
DASHSCOPE_API_KEY=sk-your-dashscope-key-here
# DashScope 自定义 base URL(可选,用于自建代理或私有部署)
# DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/api/v1

# Google Generative AI API Key(可选,未设置则不返回 google:* 模型)
# GOOGLE_GENERATIVE_AI_API_KEY=your-google-key-here
# GOOGLE_GENERATIVE_BASE_URL=https://generativelanguage.googleapis.com/v1beta

# ============== JWT 鉴权配置(必填)==============
# JWT 签发者(issuer),校验时必须匹配
JWT_ISSUER=https://idp.example.com
# JWT 受众(audience),校验时必须匹配
JWT_AUDIENCE=tap-note-ai-backend
# JWT 验证密钥(用于 HS256)或 PEM 格式公钥(用于 RS256/ES256)
# 生产环境 SHALL 使用 RS256/ES256,不使用 HS256 共享密钥
JWT_VERIFY_KEY=-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
-----END PUBLIC KEY-----
# JWT 允许的签名算法(逗号分隔,默认 RS256,ES256)
JWT_ALGORITHMS=RS256,ES256

# ============== 服务配置 ==============
# 监听端口(默认 3000)
PORT=3000
# 日志级别:trace/debug/info/warn/error/fatal(默认 info)
LOG_LEVEL=info

# ============== CORS 配置 ==============
# 允许的 Origin 列表(逗号分隔,严格匹配;* 不推荐用于生产)
CORS_ORIGIN=https://app.example.com,https://staging.app.example.com

# ============== 模型列表端点访问控制 ==============
# 是否允许匿名访问 GET /api/ai/models(默认 false,需 JWT)
MODELS_PUBLIC=false

# ============== documentState 体积限制 ==============
# 单次请求 documentState 估算 token 上限(默认 30000)
CONTEXT_MAX_TOKENS=30000

# ============== 限流配置(按认证主体 sub)==============
# 每分钟请求数(默认 10)
RATE_LIMIT_RPM=10
# 最大并发请求数(默认 3)
RATE_LIMIT_CONCURRENCY=3
# 单会话最大消息数(默认 20)
RATE_LIMIT_MAX_MESSAGES=20
# 单次请求最大输入 token(默认 30000)
RATE_LIMIT_MAX_INPUT_TOKENS=30000
# 单次请求最大输出 token(默认 30000)
RATE_LIMIT_MAX_OUTPUT_TOKENS=30000
# 工具调用最大轮数(默认 5)
RATE_LIMIT_MAX_TOOL_ROUNDS=5
# 流式请求最大持续时间(秒,默认 60)
RATE_LIMIT_MAX_STREAM_DURATION_SEC=60
```

### 变量分类

| 变量名 | 必填 | 类型 | 默认值 | 说明 |
|---|---|---|---|---|
| `DASHSCOPE_API_KEY` | 是 | string | — | DashScope API Key |
| `DASHSCOPE_BASE_URL` | 否 | url | — | DashScope 自定义 base URL |
| `GOOGLE_GENERATIVE_AI_API_KEY` | 否 | string | — | Google AI API Key,未设置时不返回 google:* 模型 |
| `GOOGLE_GENERATIVE_BASE_URL` | 否 | url | — | Google 自定义 base URL |
| `JWT_ISSUER` | 是 | string | — | JWT issuer |
| `JWT_AUDIENCE` | yes | string | — | JWT audience |
| `JWT_VERIFY_KEY` | yes | string(PEM) | — | JWT 验证密钥(HS256)或公钥(RS256/ES256) |
| `JWT_ALGORITHMS` | 否 | string | `RS256,ES256` | 允许的签名算法 |
| `PORT` | 否 | number | `3000` | 监听端口 |
| `LOG_LEVEL` | 否 | enum | `info` | pino 日志级别 |
| `CORS_ORIGIN` | yes | string(逗号分隔) | — | 允许的 Origin 白名单 |
| `MODELS_PUBLIC` | 否 | boolean | `false` | 是否允许匿名访问 `/api/ai/models` |
| `CONTEXT_MAX_TOKENS` | 否 | number | `30000` | documentState 体积上限 |
| `RATE_LIMIT_RPM` | 否 | number | `10` | 每分钟请求上限 |
| `RATE_LIMIT_CONCURRENCY` | 否 | number | `3` | 并发请求上限 |
| `RATE_LIMIT_MAX_MESSAGES` | 否 | number | `20` | 单会话消息数上限 |
| `RATE_LIMIT_MAX_INPUT_TOKENS` | 否 | number | `30000` | 单请求输入 token 上限 |
| `RATE_LIMIT_MAX_OUTPUT_TOKENS` | 否 | number | `30000` | 单请求输出 token 上限 |
| `RATE_LIMIT_MAX_TOOL_ROUNDS` | 否 | number | `5` | 工具调用轮数上限 |
| `RATE_LIMIT_MAX_STREAM_DURATION_SEC` | 否 | number | `60` | 流持续时间上限(秒) |

### 安全要求

- `.env.example` 中的占位值 SHALL NOT 是真实 Key(用 `your-xxx-here` 占位)。
- `.env` 文件 SHALL NOT 提交到 git(已在 `.gitignore` 中)。
- `JWT_VERIFY_KEY` 在生产 SHALL 使用 RS256/ES256 公钥,不使用 HS256 共享密钥。
- 所有 LLM API Key 只通过环境变量注入,业务代码不读 `process.env`,统一通过 `env` 访问。
