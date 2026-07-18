## 1. 研究闸门:Hono + AI SDK v7 服务端集成

- [ ] 1.1 使用 Context7 查询 `hono` 与 `@hono/node-server` 文档,确认精确版本(`hono@~4.12`、`@hono/node-server@~2.0`)、`app.request()` 测试模式、`c.body(stream)` 返回流式响应的方式
- [ ] 1.2 使用 Context7 查询 `jose` 文档,确认 v5/v6 与 Bun ESM 兼容性、`jwtVerify` API、JWKS 支持(本 change 用单密钥,JWKS 留 P2)
- [ ] 1.3 使用 Context7 查询 AI SDK v7 `streamText` 服务端调用模式,确认 `result.toUIMessageStream({ onError })` 返回 `ReadableStream<UIMessageChunk>`,Hono 用 `new Response(stream, { headers })` 返回 `text/event-stream`
- [ ] 1.4 复核 v7 `convertToModelMessages(uiMessages)` 把 `UIMessage[]` 转为 `ModelMessage[]` 用于 `streamText` 入参(FEAT-002 研究闸门已确认,本 change 只需复核服务端调用)
- [ ] 1.5 复核 v7 `createAgentUIStreamResponse({ agent, uiMessages, ... })` 与 `ToolLoopAgent` + `toolApproval` 在 v7 的精确形状(FEAT-002 已确认保留,本 change 复核审批代理重写路径)
- [ ] 1.6 将 1.1-1.5 结论写入 `docs/prd/sub-ai-platform/feat-ai-backend/tech.md`(新增研究闸门结论小节),包括锁定版本、Hono 集成模式、jose API、审批代理重写路径、仍待确认风险
- [ ] 1.7 只有 1.1-1.6 全部有可复核结果后,才允许进入第 2 组;若研究结论改变目标方案,先更新本 change 的 design.md

## 2. 包基础设施

- [ ] 2.1 创建 `apps/server-api/package.json`,包名 `@workspace/server-api`,`private: true`,workspace 源码消费,scripts 含 `dev`/`lint`/`format`/`typecheck`/`test`
- [ ] 2.2 创建 `apps/server-api/tsconfig.json`,启用 ES2022/ESNext/bundler/strict/noEmit/verbatimModuleSyntax/erasableSyntaxOnly,配置路径别名 `@workspace/server-api/*`
- [ ] 2.3 创建 `apps/server-api/eslint.config.js` 与 `apps/server-api/bunfig.toml`(preload happy-dom + Testing Library,复用 FEAT-001/002 模式)
- [ ] 2.4 创建 `apps/server-api/src/index.ts` 空入口骨架,使包可被 TypeScript 解析
- [ ] 2.5 添加运行时依赖到 `package.json`:`hono`、`@hono/node-server`、`jose`、`pino`、`pino-pretty`、`@ai-sdk/alibaba@2.0.14`、`@ai-sdk/google@4.0.18`、`ai@7.0.31`、`zod`(与 monorepo 一致)、`@tap-note/ai-core`(workspace:*)
- [ ] 2.6 添加 devDependencies:`@happy-dom/global-registrator`、`@testing-library/jest-dom`、`eslint`、`typescript-eslint`、`typescript`、`@types/bun`
- [ ] 2.7 在根 `package.json` 的 workspaces 已含 `apps/*`,执行 `bun install`,检查 lockfile 变更仅含预期依赖
- [ ] 2.8 确认依赖闭包无 `@blocknote/xl-ai-server`、`@blocknote/xl-ai`、`xl-pdf-exporter`、`xl-docx-exporter`、`xl-multi-column` 或任何 GPL/AGPL 依赖
- [ ] 2.9 运行 `bun run typecheck`、`bun run lint`,修复基础配置问题后再进入核心实现

## 3. config/env.ts 与 .env.example

- [ ] 3.1 创建 `src/config/env.ts`,用 Zod schema 校验 `DASHSCOPE_API_KEY`(必填)、`GOOGLE_GENERATIVE_AI_API_KEY`(可选)、`JWT_ISSUER`、`JWT_AUDIENCE`、`JWT_VERIFY_KEY`、`PORT`(默认 3000)、`CORS_ORIGIN`、`MODELS_PUBLIC`(默认 false)、`CONTEXT_MAX_TOKENS`(默认 30000)、限流维度配置(`RATE_LIMIT_RPM` 默认 10 等)
- [ ] 3.2 用 `safeParse` 解析 `process.env`,失败时打印可读 Zod 错误并 `process.exit(1)`(fail-fast)
- [ ] 3.3 导出 `env` 单例对象与 `Env` 类型
- [ ] 3.4 删除现有 `src/config.ts`(迁移到 `src/config/env.ts`),更新所有引用
- [ ] 3.5 创建 `apps/server-api/.env.example`,文档化所有必需环境变量及默认值
- [ ] 3.6 编写 `env.ts` 单元测试:合法 env 通过、缺必需变量 fail-fast(用子进程模拟)、可选变量缺省时使用默认值

## 4. errors 与 utils 基础

- [ ] 4.1 创建 `src/errors/app-error.ts`,定义 `AppError` 抽象基类(含 `code`/`message`/`statusCode` 抽象字段)
- [ ] 4.2 创建 `src/errors/error-codes.ts`,用 `as const` 对象定义错误码:`SUCCESS`、`VALIDATION_ERROR`、`AUTH_INVALID`、`MODEL_NOT_ALLOWED`、`CONTEXT_TOO_LARGE`、`RATE_LIMITED`、`AI_PROVIDER_ERROR`、`INTERNAL_ERROR`
- [ ] 4.3 创建 `AppError` 子类:`ValidationError`(422)、`AuthError`(401)、`ModelNotAllowedError`(400)、`ContextTooLargeError`(400)、`RateLimitedError`(429)、`AIProviderError`(502),各携带必要字段
- [ ] 4.4 迁移现有 `src/utils/response.ts` 的 `success(c, data, message?, status?)`/`fail(c, code, message, status, data?)` 到新结构,保持 `{ code, message, data }` 信封
- [ ] 4.5 创建 `src/utils/logger.ts`,用 `pino` 创建 logger 实例,配置 `redact: ['req.body', 'req.body.messages', 'req.body.documentState', 'res.body']`,开发环境用 `pino-pretty`
- [ ] 4.6 迁移现有 `src/utils/{hono,logger,pagination}.ts` 与 `src/types/*` 到新结构,删除旧 `src/utils/logger.ts` 中 console.log 调用
- [ ] 4.7 编写 errors 单元测试:每个子类返回正确 code/statusCode,不泄漏内部路径

## 5. 中间件栈

- [ ] 5.1 创建 `src/middleware/request-id.ts`,注入 `c.var.requestId`(UUID v4)与 `x-request-id` 响应头
- [ ] 5.2 创建 `src/middleware/cors.ts`,从 `env.CORS_ORIGIN` 读取逗号分隔 origin 列表,用 Hono `cors()` 中间件配置 origin 白名单
- [ ] 5.3 创建 `src/middleware/auth.ts`,用 `jose` 校验 JWT(签名算法白名单、issuer、audience、exp、sub、scope),先删除所有 `X-User-*` 请求头,再注入 `c.var.userId`/`c.var.scopes`,失败抛 `AuthError`
- [ ] 5.4 创建 `src/middleware/rate-limit.ts`,内存 Map 存储,按 `sub` 限流(速率、并发、消息数、token、工具调用轮数、流持续时间),超限抛 `RateLimitedError`
- [ ] 5.5 创建 `src/middleware/error-handler.ts`,全局错误处理:捕获 `AppError` 用其 code/message/statusCode;捕获 `ZodError` 格式化 `.issues` 为 `[{ path, message }]` 返回 422;未知错误记录完整日志带 requestId,对外返回 500 + `INTERNAL_ERROR`,不泄漏堆栈/路径/Key
- [ ] 5.6 健康检查路由 `GET /health` 与 `GET /ready` 标记为匿名可访问,其余 `/api/ai/*` 默认需 JWT
- [ ] 5.7 编写中间件单元测试:JWT 合法/缺失/过期/伪造 X-User-* 头、CORS 白名单通过/拒绝、requestId 串联、限流超限返回 429

## 6. modules/ai/providers 迁移与修复

- [ ] 6.1 创建 `src/modules/ai/providers/index.ts`,迁移现有 `providers.ts` 的 `createLLMProvider` 到新位置
- [ ] 6.2 新增 `defaultAgentModel` 导出(从 allowlist 选定默认模型,如 `dashscope:qwen-plus`),修复 `create-approval-agent.ts` 的导入
- [ ] 6.3 创建 `src/modules/ai/providers/allowlist.ts`,定义模型 allowlist 元数据 `{ id, label, provider, capabilities }` 列表,根据 env 配置过滤已配置的 provider
- [ ] 6.4 创建 `src/modules/ai/services/resolve-model.ts`,实现 `resolveModel(modelId)`:从 allowlist 查找,未列出抛 `ModelNotAllowedError`,不回退默认
- [ ] 6.5 删除原 `src/modules/ai/providers/providers.ts` 与 `src/modules/ai/types.ts`,迁移到新结构
- [ ] 6.6 编写 providers 单元测试:已配置 DashScope 但未配置 Google 时只返回 dashscope 模型、未列出 modelId 抛 `ModelNotAllowedError`、`defaultAgentModel` 正确导出

## 7. modules/ai/types 与 server streamTool schema

- [ ] 7.1 创建 `src/modules/ai/types/schema.ts`,定义请求 body Zod schema:`EditorStreamTextRequestSchema`(`{ messages, documentState, model }`)、`ChatRequestSchema`(`{ messages, documentState?, documentRevision?, model }`);`documentState` 字段用 `@tap-note/ai-core` 的 `documentStateSchema`(导入,不重复定义)
- [ ] 7.2 在 schema.ts 定义服务端 streamTool schema,从 `@tap-note/ai-core` 导入 `blockOperationSchema` 作为 tool inputSchema,服务端 `execute` 返回 `{ ok: true }`(实际操作由客户端 `applyOperationsToEditor` 应用)
- [ ] 7.3 在 schema.ts 定义 client-side tools schema(chat 端点用),声明工具描述与 inputSchema 但不带 `execute`(由客户端执行)
- [ ] 7.4 创建 `src/modules/ai/types/type.ts`,从 schema 派生 TypeScript 类型(`EditorStreamTextRequest`、`ChatRequest`、`ModelInfo`、`ModelsResponse`)
- [ ] 7.5 创建 `src/modules/ai/types/index.ts` 集中导出 schema 与类型
- [ ] 7.6 创建 `src/modules/ai/constants/` 存放模型 ID 常量、错误消息等
- [ ] 7.7 编写 schema 单元测试:合法 body 通过、缺字段抛 ZodError、documentState 非法抛 ZodError、客户端提交 tools 字段抛错

## 8. modules/ai/services streamText 装配

- [ ] 8.1 创建 `src/modules/ai/services/editor-stream-text.ts`,实现 `streamEditorText(req)`:校验 → `injectDocumentStateMessages(messages, documentState)`(从 ai-core 导入)→ `streamText({ model: resolveModel(modelId), system, messages: await convertToModelMessages(injected), tools: serverStreamToolSchema, toolChoice: "required" })` → `result.toUIMessageStream({ onError })`
- [ ] 8.2 创建 `src/modules/ai/services/chat.ts`,实现 `streamChat(req)`:校验 → `injectDocumentStateMessages(messages, documentState?)`(可选注入)→ `streamText({ model, system, messages: await convertToModelMessages(injected), tools: clientSideToolsSchema })` → `result.toUIMessageStream({ onError })`(服务端不 execute,客户端用 `onToolCall`/`addToolOutput` 回传)
- [ ] 8.3 实现 documentState 体积检查:用 `@tap-note/ai-core` 的 `estimateTokens` 估算,超过 `env.CONTEXT_MAX_TOKENS` 抛 `ContextTooLargeError`
- [ ] 8.4 实现隐私日志钩子:`onFinish` 回调记录 `requestId`/`userId`/`model`/`usage`/`durationMs`/`status`,不记录 prompt/messages/documentState
- [ ] 8.5 创建 `src/modules/ai/services/list-models.ts`,从 allowlist 返回 `{ models: [{ id, label, provider, capabilities }] }`
- [ ] 8.6 编写 services 单元测试(用 Provider mock):合法请求返回 ReadableStream、documentState 超限抛 `ContextTooLargeError`、未知 modelId 抛 `ModelNotAllowedError`、`onFinish` 记录正确元数据

## 9. modules/ai/controllers

- [ ] 9.1 创建 `src/modules/ai/controllers/editor-stream-text.ts`,提取 body → `EditorStreamTextRequestSchema.parse()` → 拒绝客户端 `tools`/`toolDefinitions` 字段 → 调用 service → 返回 `new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'x-request-id': requestId } })`
- [ ] 9.2 创建 `src/modules/ai/controllers/chat.ts`,类似 editor 但允许 `documentState` 缺省,返回 UIMessageStream
- [ ] 9.3 创建 `src/modules/ai/controllers/models.ts`,调用 `listModels()` service,返回 `success(c, { models: [...] })` 信封
- [ ] 9.4 创建 `src/modules/ai/controllers/proxy.ts`(P1 占位),抛 `501 Not Implemented`
- [ ] 9.5 创建 `src/modules/ai/controllers/approval.ts`,调用 `createApprovalAgent` + `createAgentUIStreamResponse`,返回 UIMessageStream
- [ ] 9.6 控制器均为薄层,业务规则放 service,提取请求参数 + Zod 校验 + 调用 service + 构建响应
- [ ] 9.7 编写 controllers 单元测试:合法 body 调用 service、非法 body 抛 ZodError 由全局 handler 处理、客户端提交 tools 字段返回 400

## 10. modules/ai/routes

- [ ] 10.1 创建 `src/modules/ai/routes/editor-stream-text.ts`,定义 `POST /api/ai/editor/streamText` Hono 路由,挂载 controller
- [ ] 10.2 创建 `src/modules/ai/routes/chat.ts`,定义 `POST /api/ai/chat`
- [ ] 10.3 创建 `src/modules/ai/routes/models.ts`,定义 `GET /api/ai/models`
- [ ] 10.4 创建 `src/modules/ai/routes/proxy.ts`,定义 `POST /api/ai/proxy`(501 占位)
- [ ] 10.5 创建 `src/modules/ai/routes/approval.ts`,定义 `POST /api/ai/agents/approval`
- [ ] 10.6 创建 `src/modules/ai/routes/index.ts`,聚合所有路由到 `aiRoutes` Hono 实例
- [ ] 10.7 替换原 `src/modules/ai/routes/index.ts` 内容,删除 v6 脚手架的 `createAgentUIStreamResponse` 直接调用

## 11. modules/ai/agents 审批代理 v7 重写

- [ ] 11.1 创建 `src/modules/ai/agents/agent-approval/create-approval-agent.ts`,用 v7 `ToolLoopAgent` 重写,`model: defaultAgentModel`,`stopWhen: [stepCountIs(15)]`,`toolApproval: { approvalTool: "user-approval" }`(替代 v6 `needsApproval: true`)
- [ ] 11.2 迁移 `tools/create-approval-tool.ts` 到 v7 tool API,用 `tool({ inputSchema, execute })` 形状
- [ ] 11.3 确保审批代理不被内联/对话主流程引用(独立路由 `/api/ai/agents/approval`)
- [ ] 11.4 编写审批代理集成测试:用 `app.request()` 调用端点,验证返回 `text/event-stream`,toolApproval 流程正确

## 12. app 入口 index.ts 装配

- [ ] 12.1 创建 `src/index.ts`,导出 `createApp()` 函数装配中间件栈与路由
- [ ] 12.2 中间件顺序:`errorHandler`(全局包装)→ `requestId` → `cors` → `auth`(生产 `/api/ai/*` 强制,健康检查跳过)→ `rateLimit` → 路由
- [ ] 12.3 挂载 `aiRoutes` 到 `/api/ai`,挂载 `healthRoutes` 到根路径(`/health`、`/ready`)
- [ ] 12.4 启动 `@hono/node-server` 监听 `env.PORT`,导出 `default` 入口供 `bun run dev` 使用
- [ ] 12.5 在根 `package.json` 验证 `turbo.json` 的 `dev` task 能发现并启动 server-api(与 web 一致)

## 13. 集成测试

- [ ] 13.1 编写中间件集成测试:合法 JWT 通过、缺 JWT 返回 401、伪造 `X-User-*` 头被清理、CORS 白名单通过/拒绝、requestId 串联、限流超限 429
- [ ] 13.2 编写 `POST /api/ai/editor/streamText` 集成测试:合法请求返回 200 + `text/event-stream` + `x-request-id` 头、非法 body 422、客户端提交 tools 400、未知 modelId 400、documentState 超限 400
- [ ] 13.3 编写 `POST /api/ai/chat` 集成测试:合法请求返回流、documentState 缺省时不注入、服务端不 execute 客户端工具
- [ ] 13.4 编写 `GET /api/ai/models` 集成测试:已配置 DashScope 时返回 dashscope 模型、未配置 Google 时不返回 google 模型、未列出 modelId 被拒绝、默认 JWT 保护、`MODELS_PUBLIC=true` 时匿名可访问
- [ ] 13.5 编写 `POST /api/ai/agents/approval` 集成测试:返回流、`toolApproval` 流程正确
- [ ] 13.6 编写错误处理集成测试:`AppError` 子类返回正确 code/statusCode、`ZodError` 返回 422 + issues 数组、未知错误返回 500 + `INTERNAL_ERROR` 不泄漏堆栈
- [ ] 13.7 Provider 全部用 mock 隔离,不调用真实 LLM API

## 14. 质量门禁

- [ ] 14.1 运行 `apps/server-api` 包 `bun test`,修复测试环境问题,保留稳定的行为断言
- [ ] 14.2 运行 `apps/server-api` 包 `bun run typecheck`,确认无 `any` 泄漏、`import type` 正确、与 `@tap-note/ai-core` schema 对齐
- [ ] 14.3 运行 `apps/server-api` 包 `bun run lint`,确认通过 ESLint
- [ ] 14.4 运行根 `bun run typecheck`,确认 workspace 依赖和所有受影响包通过
- [ ] 14.5 运行根 `bun run lint`,确认新增包通过(预存在的 ui/button.tsx 错误与本 change 无关)
- [ ] 14.6 运行根 `bun run test`,确认 Turbo 能发现并执行 server-api 测试
- [ ] 14.7 启动 `bun run dev`,验证 `/health` 返回 200、`/api/ai/models` 返回 401(无 JWT)、`/api/ai/editor/streamText` 返回 422(空 body)
- [ ] 14.8 确认测试不依赖真实 LLM API、网络或持久化服务

## 15. 授权、文档与收尾

- [ ] 15.1 生成 `@workspace/server-api` 的生产依赖闭包清单,确认无 `@blocknote/xl-ai-server`、`@blocknote/xl-ai`、`xl-pdf-exporter`、`xl-docx-exporter`、`xl-multi-column` 或其他 GPL/AGPL 依赖
- [ ] 15.2 确认 `jose`、`pino`、`hono`、`@hono/node-server` 授权为 ISC/MIT,记录到 feat tech.md
- [ ] 15.3 将依赖闭包和许可证检查结果写入 feat tech.md,发现禁止依赖时阻塞 change 完成
- [ ] 15.4 编写 `apps/server-api/README.md`,包含最小启动指南(配置 env、`bun install`、`bun run dev`)、API 表、与 FEAT-002 ai-core 契约对齐说明
- [ ] 15.5 在 README 写明 AI SDK v7 依赖、`streamText` + UIMessageStream 协议、不外泄 LLM Key 的安全边界
- [ ] 15.6 在 README 写明 JWT 校验、`X-User-*` 头清理、CORS、限流的安全策略
- [ ] 15.7 在 README 写明 allowlist 机制、未列出 modelId 拒绝、不回退默认
- [ ] 15.8 为 `src/index.ts` 与公开 controller 补充简洁 JSDoc,确保 API 意图清晰
- [ ] 15.9 检查所有新增目录和文件遵循 kebab-case、index 入口和项目 TypeScript 命名约定
- [ ] 15.10 最终复核 ai-backend spec 的每条 requirement 都有代码、测试对应物
- [ ] 15.11 只有 typecheck、lint、test 和许可证检查全部通过后,才将 change 标记为可归档
