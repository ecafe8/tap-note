## ADDED Requirements

### Requirement: 提供 `POST /api/ai/editor/streamText` 内联流式写作端点

系统 SHALL 提供 `POST /api/ai/editor/streamText` 端点,接收 `{ messages: UIMessage[], documentState: DocumentState, model: string }` 请求体。Controller SHALL 用 Zod `.parse()` 校验 body,Service SHALL 通过 `injectDocumentStateMessages(messages, documentState)`(从 `@tap-note/ai-core` 导入)注入 documentState,再调用 AI SDK v7 `streamText({ model: resolveModel(modelId), messages: await convertToModelMessages(injectedMessages), tools: serverStreamToolSchema, toolChoice: "required" })`,返回 `result.toUIMessageStream()` 作为 `text/event-stream` 响应。服务端 streamTool schema SHALL 与 `@tap-note/ai-core` 的 `blockOperationSchema` 同源(从 ai-core 导入,不在服务端重复定义)。客户端 SHALL NOT 提交或覆盖工具定义。

#### Scenario: 合法请求返回 UIMessageStream

- **WHEN** 调用方携带合法 JWT 与符合 schema 的 `{ messages, documentState, model }` 请求体
- **THEN** 端点 SHALL 返回 `200` + `Content-Type: text/event-stream`,响应体为 UIMessageStream,包含 `tool-call` chunks(由客户端 `applyOperationsToEditor` 应用)

#### Scenario: 非法 body 被拒绝

- **WHEN** 调用方提交缺字段或类型错误的 body
- **THEN** Controller SHALL 抛 `ZodError`,全局错误处理中间件 SHALL 返回 `422` + `{ code: "VALIDATION_ERROR", message, data: [{ path, message }] }`,不调用 Provider

#### Scenario: 客户端提交工具定义被拒绝

- **WHEN** 调用方在 body 中携带 `tools` 或 `toolDefinitions` 字段
- **THEN** Controller SHALL 返回 `400` + `{ code: "VALIDATION_ERROR", message: "client must not submit tool definitions" }`,不调用 Provider

#### Scenario: modelId 不在 allowlist 被拒绝

- **WHEN** 调用方提交 `model: "unknown:model"`
- **THEN** Service SHALL 返回 `400` + `{ code: "MODEL_NOT_ALLOWED", message }`,不回退默认模型

#### Scenario: documentState 体积超限被拒绝

- **WHEN** documentState 估算 token 超过 `CONTEXT_MAX_TOKENS`(默认 30K)
- **THEN** Service SHALL 返回 `400` + `{ code: "CONTEXT_TOO_LARGE", message }`,不调用 Provider

### Requirement: 提供 `POST /api/ai/chat` 对话流式端点

系统 SHALL 提供 `POST /api/ai/chat` 端点,接收 `{ messages: UIMessage[], documentState?: DocumentState, documentRevision?: number, model: string }`。Controller SHALL 用 Zod 校验 body,Service SHALL 通过 `injectDocumentStateMessages` 注入 documentState(可选),声明版本化 client-side tools schema(只描述形状,不 execute),调用 `streamText` 返回 UIMessageStream。服务端 SHALL NOT execute 编辑器操作;工具结果由客户端执行后以 `toolCallId` 回传进入后续消息。

#### Scenario: 合法请求返回 UIMessageStream

- **WHEN** 调用方携带合法 JWT 与符合 schema 的请求体
- **THEN** 端点 SHALL 返回 `200` + `text/event-stream`,响应体包含 `tool-call` chunks(state: `input-available`),客户端用 `onToolCall` + `addToolOutput` 回传结果

#### Scenario: 服务端不 execute 编辑器操作

- **WHEN** 模型返回 `tool-call` 给 client-side tools
- **THEN** 服务端 SHALL 只把 `tool-call` part 转发给客户端,不调用任何 `execute` 函数;客户端执行后通过下一次 `POST /api/ai/chat` 把 `tool-result` part 带回

#### Scenario: documentState 缺省时不注入

- **WHEN** 调用方未提交 `documentState`(不引用模式)
- **THEN** Service SHALL 原样使用 `messages` 调用 `streamText`,不附加文档相关 part

### Requirement: 提供 `GET /api/ai/models` allowlist 元数据端点

系统 SHALL 提供 `GET /api/ai/models` 端点,返回 `{ code: "SUCCESS", message: "", data: { models: [{ id, label, provider, capabilities }] } }`。仅返回已配置(`DASHSCOPE_API_KEY` 必填,`GOOGLE_GENERATIVE_AI_API_KEY` 可选)且 allowlist 中的模型。默认 SHALL 受 JWT 保护;通过 `MODELS_PUBLIC=true` 可开启匿名访问。未配置 provider 时不返回该 provider 的模型。

#### Scenario: 已配置 DashScope 但未配置 Google

- **WHEN** 环境只有 `DASHSCOPE_API_KEY` 而无 `GOOGLE_GENERATIVE_AI_API_KEY`
- **THEN** 端点 SHALL 只返回 dashscope 命名的模型(`dashscope:qwen-plus` 等),不返回 `google:*` 模型

#### Scenario: 默认受 JWT 保护

- **WHEN** 调用方未携带 JWT 请求 `GET /api/ai/models`
- **THEN** 端点 SHALL 返回 `401` + `{ code: "AUTH_INVALID" }`,不返回模型列表

#### Scenario: 显式开启匿名访问

- **WHEN** `MODELS_PUBLIC=true` 且调用方未携带 JWT
- **THEN** 端点 SHALL 返回 allowlist 元数据

### Requirement: 生产 `/api/ai/*` 校验短期 JWT 并清理 `X-User-*` 头

系统 SHALL 对生产 `/api/ai/*` 路由(除健康检查)强制校验短期 JWT。JWT 校验 SHALL 验证签名算法、issuer(`JWT_ISSUER`)、audience(`JWT_AUDIENCE`)、exp、sub、最小权限 scope 声明。`auth` 中间件 SHALL 先删除所有客户端发送的 `X-User-*` 请求头,再注入已验证的身份上下文(`X-User-Sub`、`X-User-Scopes`)。后端服务 SHALL NOT 无条件信任客户端 `X-User-*` 头。

#### Scenario: 合法 JWT 通过

- **WHEN** 调用方携带合法签名、未过期、issuer/audience 匹配、含所需 scope 的 JWT
- **THEN** 中间件 SHALL 注入 `c.var.userId = sub`、`c.var.scopes = [...]`,请求转发到 controller

#### Scenario: 缺失/过期/签名错误 JWT

- **WHEN** 调用方未携带 JWT、或 JWT 过期、或签名错误、或 issuer/audience 不匹配
- **THEN** 中间件 SHALL 返回 `401` + `{ code: "AUTH_INVALID", message: "invalid or missing JWT" }`,不转发到 controller

#### Scenario: 客户端伪造 `X-User-*` 头被清理

- **WHEN** 调用方携带 `X-User-Sub: fake-user` 头
- **THEN** 中间件 SHALL 先删除该头,再从 JWT 注入验证后的 `X-User-Sub`,控制器读到的 `c.var.userId` SHALL 是 JWT 中的 sub 而非 `fake-user`

#### Scenario: 健康检查可匿名访问

- **WHEN** 调用方未携带 JWT 请求 `GET /health` 或 `GET /ready`
- **THEN** 端点 SHALL 返回 `200`,不触发 JWT 校验

### Requirement: 提供 CORS、requestId、pino 结构化日志、限流中间件

系统 SHALL 提供 CORS 中间件,`Access-Control-Allow-Origin` 受 `CORS_ORIGIN` 环境变量控制(逗号分隔 origin 列表)。系统 SHALL 提供 `requestId` 中间件,为每个请求注入唯一 `x-request-id` 响应头与 `c.var.requestId`。系统 SHALL 用 pino 进行结构化日志,记录 `requestId`、脱敏后的 `userId`、`model`、`usage`、`durationMs`、`status`,**不记录** prompt/文档正文/工具结果/messages/documentState。系统 SHALL 提供限流中间件,按认证主体(sub)限制速率、并发、消息数、输入/输出 token、工具调用轮数、流持续时间,超限返回 `429` + `{ code: "RATE_LIMITED" }`。

#### Scenario: CORS 由环境变量控制

- **WHEN** `CORS_ORIGIN=https://app.example.com` 且请求 Origin 为 `https://app.example.com`
- **THEN** 响应 SHALL 携带 `Access-Control-Allow-Origin: https://app.example.com`

#### Scenario: 不在白名单的 Origin 被拒

- **WHEN** `CORS_ORIGIN=https://app.example.com` 且请求 Origin 为 `https://evil.com`
- **THEN** 响应 SHALL NOT 携带 `Access-Control-Allow-Origin: https://evil.com`

#### Scenario: requestId 串联全链路

- **WHEN** 同一请求经多个中间件、controller、service
- **THEN** 所有日志 SHALL 携带相同的 `requestId` 字段,响应头 SHALL 携带 `x-request-id`

#### Scenario: 隐私日志不记录正文

- **WHEN** 请求体包含 `documentState` 与 `messages`
- **THEN** pino 日志输出 SHALL NOT 包含 `documentState` 或 `messages` 字段(通过 `redact` 配置)

#### Scenario: 限流超限返回 429

- **WHEN** 同一 `sub` 在 1 分钟内发送超过 `RATE_LIMIT_RPM`(默认 10)个请求
- **THEN** 中间件 SHALL 返回 `429` + `{ code: "RATE_LIMITED", message: "rate limit exceeded" }`,不调用 Provider

### Requirement: `config/env.ts` Zod 校验与 fail-fast

系统 SHALL 在 `config/env.ts` 用 Zod schema 校验所有必需环境变量(`DASHSCOPE_API_KEY`、`GOOGLE_GENERATIVE_AI_API_KEY` 可选、`JWT_ISSUER`、`JWT_AUDIENCE`、`JWT_VERIFY_KEY`、`PORT`、`CORS_ORIGIN`、`MODELS_PUBLIC`、`CONTEXT_MAX_TOKENS`、限流维度配置)。校验 SHALL 用 `safeParse`,失败时打印可读错误并 `process.exit(1)`(fail-fast)。业务代码 SHALL NOT 直接读 `process.env`,统一通过 `env` 对象访问。`.env.example` SHALL 文档化所有必需变量及默认值。

#### Scenario: 缺失必需环境变量 fail-fast

- **WHEN** 启动时 `DASHSCOPE_API_KEY` 未设置
- **THEN** 应用 SHALL 打印 Zod 错误并 `process.exit(1)`,不启动 HTTP 服务

#### Scenario: 可选环境变量缺省时使用默认值

- **WHEN** `GOOGLE_GENERATIVE_AI_API_KEY` 未设置
- **THEN** `env.google` SHALL 为 `undefined`,应用正常启动,`/api/ai/models` 不返回 `google:*` 模型

#### Scenario: 业务代码不读 process.env

- **WHEN** 检查 `src/modules/ai/` 下所有 controller/service 代码
- **THEN** 源码 SHALL NOT 出现 `process.env` 直接读取,统一通过 `import { env } from '../../config/env'` 访问

### Requirement: 统一错误处理中间件

系统 SHALL 提供全局 `errorHandlerMiddleware`,捕获三类异常:`AppError` 子类(用其 `code`/`message`/`statusCode` 构建响应)、`ZodError`(格式化 `.issues` 为 `[{ path, message }]`,返回 `422`)、未知错误(记录完整日志带 `requestId`,对外只返回 `500` + `{ code: "INTERNAL_ERROR", message: "internal server error" }`)。Controller SHALL 用 Zod `.parse()`(非 `safeParse`),验证失败自动抛 `ZodError` 由全局 handler 处理。对外响应 SHALL NOT 泄漏内部堆栈、文件路径或上游 Provider Key。

#### Scenario: AppError 子类返回其 statusCode 与 code

- **WHEN** Service 抛出 `ModelNotAllowedError`(code `MODEL_NOT_ALLOWED`,statusCode `400`)
- **THEN** 中间件 SHALL 返回 `400` + `{ code: "MODEL_NOT_ALLOWED", message, data: null }`

#### Scenario: ZodError 格式化为 422

- **WHEN** Controller 的 `z.parse(body)` 失败
- **THEN** 中间件 SHALL 返回 `422` + `{ code: "VALIDATION_ERROR", message: "validation failed", data: [{ path: ["messages"], message: "expected array" }] }`

#### Scenario: 未知错误脱敏

- **WHEN** Service 抛出普通 `Error("some internal detail: /path/to/file.ts")`
- **THEN** 中间件 SHALL 记录完整错误日志(带 `requestId`),对外只返回 `500` + `{ code: "INTERNAL_ERROR", message: "internal server error" }`,响应体 SHALL NOT 包含 `/path/to/file.ts` 或堆栈

### Requirement: 保留 `POST /api/ai/agents/approval` 为独立示例

系统 SHALL 保留 `POST /api/ai/agents/approval` 端点作为审批代理独立示例,用 AI SDK v7 `createAgentUIStreamResponse` + `ToolLoopAgent` + `toolApproval` 实现(替代 v6 的 `needsApproval`)。该端点 SHALL NOT 被内联或对话主流程引用。`defaultAgentModel` SHALL 从 `modules/ai/providers/` 正确导出,审批代理脚手架可独立运行。

#### Scenario: 审批代理可独立调用

- **WHEN** 调用方携带合法 JWT 请求 `POST /api/ai/agents/approval` 与 `{ messages }`
- **THEN** 端点 SHALL 返回 `200` + `text/event-stream`,代理使用 `toolApproval: { approvalTool: "user-approval" }` 控制审批流程

#### Scenario: defaultAgentModel 正确导出

- **WHEN** 检查 `modules/ai/providers/index.ts` 的导出
- **THEN** `defaultAgentModel` SHALL 被导出,审批代理 `import { defaultAgentModel }` SHALL 不抛错

### Requirement: 非流式响应统一信封,流式端点不套信封

系统 SHALL 对所有非流式业务响应使用 `{ code: string, message: string, data: unknown }` 信封。成功响应 `code` SHALL 为 `"SUCCESS"`,`message` 可为空字符串或业务消息,`data` 包含实际数据。失败响应 `code` SHALL 为具体错误码字符串,`message` 包含脱敏描述,`data` 可为 `null`。流式端点(`editor/streamText`、`chat`、`agents/approval`)SHALL 直接返回 UIMessageStream,不套业务信封。

#### Scenario: 非流式成功响应信封

- **WHEN** 调用 `GET /api/ai/models` 成功
- **THEN** 响应 SHALL 为 `{ code: "SUCCESS", message: "", data: { models: [...] } }`

#### Scenario: 流式端点不套信封

- **WHEN** 调用 `POST /api/ai/editor/streamText` 成功
- **THEN** 响应 SHALL 为 `text/event-stream`,响应体为 UIMessageStream,SHALL NOT 是 `{ code, message, data }` 信封

### Requirement: Provider Key 不外泄

系统 SHALL 确保 LLM Provider API Key(`DASHSCOPE_API_KEY`、`GOOGLE_GENERATIVE_AI_API_KEY`)只存在于服务端已校验环境,SHALL NOT 出现在响应头、响应体、客户端可访问的任何位置。Provider 调用由服务端 `streamText` 内部注入 Key,客户端只通过 transport 携带短期 JWT。浏览器 DevTools Network 面板 SHALL NOT 可见 LLM API Key 或长期共享 Token。

#### Scenario: 响应不携带 LLM Key

- **WHEN** 调用 `/api/ai/editor/streamText` 并检查响应 headers
- **THEN** 响应 SHALL NOT 包含 `Authorization: Bearer dashscope-key` 或任何 LLM provider 凭据字段

#### Scenario: 客户端 transport 不持 Key

- **WHEN** 检查 `@tap-note/ai-core` 的 `createServerTransport` 实例字段
- **THEN** 实例 SHALL NOT 包含 `apiKey`/`apiSecret`,只通过 `getAuthHeaders` 注入短期 JWT

### Requirement: 保留纯库与授权边界

`apps/server-api` 的生产依赖闭包 SHALL NOT 包含 `@blocknote/xl-ai-server`、`xl-ai-server`、`@blocknote/xl-ai`、`xl-pdf-exporter`、`xl-docx-exporter`、`xl-multi-column` 或任何 GPL/AGPL 依赖。系统 SHALL 只阅读 `resource/BlockNote` submodule 作思路参考,SHALL NOT 引入其 GPL 源码作为依赖。

#### Scenario: 依赖闭包检查

- **WHEN** 执行 `bun pm ls --all` 检查 `apps/server-api` 的依赖闭包
- **THEN** 结果 SHALL NOT 包含 `@blocknote/xl-ai-server`、`@blocknote/xl-ai` 或任何 GPL/AGPL 授权的包

### Requirement: 提供自动化测试覆盖

系统 SHALL 用 Bun 内置 `bun:test` 与 Hono `app.request()` 覆盖中间件(JWT/CORS/requestId/限流)、Zod 校验、allowlist 拒绝、统一错误处理、流 headers、审批代理、Provider mock。测试 MUST NOT 依赖真实 LLM API、网络或持久化服务。

#### Scenario: 中间件测试

- **WHEN** 运行 `bun test`
- **THEN** JWT/CORS/requestId/限流中间件的认证、清理 `X-User-*`、Origin 白名单、requestId 注入、超限返回 429 用例 SHALL 全部通过

#### Scenario: Zod 校验测试

- **WHEN** 运行 `bun test`
- **THEN** 缺字段、错类型、客户端提交工具定义、非法 modelId、documentState 超限 用例 SHALL 全部返回对应错误码与状态码

#### Scenario: 流 headers 测试

- **WHEN** 运行 `bun test`
- **THEN** `POST /api/ai/editor/streamText` 合法请求 SHALL 返回 `200` + `Content-Type: text/event-stream` + `x-request-id` 头,响应体首 chunk SHALL 非空(用 Provider mock)

#### Scenario: Provider mock 隔离

- **WHEN** 运行 `bun test`
- **THEN** 测试 SHALL NOT 调用真实 DashScope/Google API,所有 Provider 调用 SHALL 通过 mock 返回 fixture 响应
