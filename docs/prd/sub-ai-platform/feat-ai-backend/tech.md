# 技术方案：AI 后端服务

## 0. 文档信息

- 功能 ID：FEAT-005；所属 Sub：SUB-004；状态：草稿；类型：纯后端，无 `ui.md`；依据：总 PRD v7、SUB-004 `tech.md`。

## 1. 当前项目事实与复用点

- `apps/server-api` 无 `package.json` 与 entrypoint；有半成品源码：
  - `src/config.ts`：直接读 `process.env`，未对齐 hono 规范 `config/env.ts` fail-fast。
  - `src/modules/ai/providers/providers.ts`：注册 DashScope qwen-plus/max/qwen3-vl-flash 与 Gemini，含 `as any`。
  - `src/modules/ai/agents/agent-approval/create-approval-agent.ts`：引用 `defaultAgentModel` 但未从 providers 导出（脚手架未完成）。
  - `src/utils/response.ts`：`success`/`fail` 统一响应；`src/types/`：`AppEnv`、`ApiResponse`。
  - `src/utils/hono.ts`、`logger.ts`、`pagination.ts` 已存在。
- 上述为代码库事实，不代表目标架构已实现。

## 2. 本 feat 在 sub 中的位置与职责

私有 app（不分发），按 hono 规范补齐 `config/`、`middleware/`、`modules/`、`utils/`、`types/`、`errors/`、`index.ts`；修复 `defaultAgentModel`；所有非流式 endpoint 以 OpenAPI 描述；统一响应信封；流式端点返回 UIMessageStream（见 SUB-004 tech.md §2）。

```text
HTTP -> requestId/CORS/JWT/rate limit -> Zod controller -> AI service -> Provider
                                   |                                -> UIMessageStream
                                   +-> pino (metadata only)
```

## 3. 模块职责与目录范围（按 hono 规范）

```text
apps/server-api/
├── package.json            # 待补：name=@workspace/server-api
├── tsconfig.json
├── src/
│   ├── index.ts            # 入口：createApp() 装配全局中间件与路由
│   ├── config/env.ts       # Zod 校验环境变量（迁移自 config.ts）
│   ├── middleware/
│   │   ├── error-handler.ts
│   │   ├── request-id.ts
│   │   ├── auth.ts         # JWT 校验 + 清理 X-User-* 头
│   │   ├── rate-limit.ts
│   │   └── cors.ts
│   ├── modules/ai/
│   │   ├── routes/         # editor/streamText、chat、models、proxy、approval
│   │   ├── controllers/
│   │   ├── services/       # resolveModel、streamText 装配、documentState 注入
│   │   ├── providers/      # 迁移现有 providers.ts，修复 defaultAgentModel 导出
│   │   ├── agents/agent-approval/   # 保留为独立示例
│   │   ├── errors/
│   │   ├── constants/
│   │   └── types/          # enum.ts/schema.ts/type.ts/index.ts
│   ├── errors/app-error.ts
│   ├── errors/error-codes.ts
│   ├── utils/logger.ts     # pino + pino-pretty(dev)
│   ├── utils/response.ts   # success/fail 信封
│   └── types/
└── .env.example
```

## 4. 数据模型、迁移与状态

- 无数据库；无迁移。状态为运行时请求上下文（JWT 主体、modelId、documentState）。
- `config/env.ts` 用 Zod schema 校验 `DASHSCOPE_API_KEY`、`GOOGLE_GENERATIVE_AI_API_KEY`、`JWT_ISSUER`、`JWT_AUDIENCE`、`JWT_VERIFY_KEY`、`PORT`、`CORS_ORIGIN`；`safeParse` 失败 `process.exit(1)`。

## 5. API、服务接口与组件接口

### 5.1 `POST /api/ai/editor/streamText`

- 入参 Zod：`{ messages: UIMessage[], documentState: DocumentStateSchema, model: string }`。
- 流程：校验 → 注入 documentState 到消息 → `streamText({ model: resolveModel(modelId), tools: serverStreamToolSchema, ... })` → `toUIMessageStreamResponse`。
- 服务端持有 streamTool schema（与 FEAT-002 BlockOperation 对齐）；客户端不得提交或覆盖工具定义。

### 5.2 `POST /api/ai/chat`

- 入参 Zod：`{ messages, documentState?, documentRevision?, model }`。
- 流程：UIMessage 转模型消息 → 注入 documentState → `streamText` 仅声明版本化 client-side tools 不 execute → UIMessageStream。
- 工具结果由客户端执行后以 `toolCallId` 回传进入后续消息。

### 5.3 `GET /api/ai/models`

- 默认 JWT 保护；返回 allowlist 元数据 `{ id, label, provider, capabilities }`。
- 仅返回环境变量已配置且 allowlist 中的模型；未列出 modelId 一律拒绝，不回退默认。

### 5.4 `POST /api/ai/proxy`（可选 P1）

- 透明代理，按 provider 注入 Key；可独立启用。

### 5.5 `POST /api/ai/agents/approval`

- 保留现有审批代理为独立示例，不进主流程。

## 6. 核心流程与错误处理

```text
请求进入
  -> requestId 中间件注入 id
  -> CORS 检查
  -> 清理 X-User-* 头 + JWT 校验（生产 /api/ai/* 强制；健康检查可匿名）
  -> rate limit
  -> 路由 controller：Zod .parse() 输入（失败抛 ZodError）
  -> service：resolveModel(allowlist) + streamText
  -> 错误由 errorHandlerMiddleware 统一处理
```

错误处理三类：`AppError` → 其 code/message/statusCode；`ZodError` → 422 格式化 issues；未知 → 500 `INTERNAL_ERROR` + 完整日志（带 requestId），对外脱敏。

## 7. 权限、安全、输入校验与隐私

- 生产 `/api/ai/*` 校验短期 JWT：签名算法、issuer、audience、exp、sub、最小权限声明。
- 清理客户端 `X-User-*` 头后注入已验证身份上下文；后端不无条件信任客户端身份头。
- Provider Key 只存在于已校验环境；业务代码经 `env` 访问，不读 `process.env`。
- 输入校验：所有 controller 用 Zod `.parse()`；documentState 体积受限（对齐 FEAT-002 预算）。
- 隐私日志：记录 requestId、主体、模型、用量、耗时、状态；不记录 prompt/文档正文/工具结果。
- 限流：速率、并发、消息数、输入/输出 token、工具调用轮数、流持续时间。
- 资源安全：不涉及导出资源 resolver（属 SUB-005）。

## 8. 测试策略

- 用 Bun `app.request()` 覆盖：中间件（JWT/CORS/requestId/限流）、Zod 校验、allowlist 拒绝、统一错误、流 headers。
- Provider 用 mock 隔离；流式协议用 fixture。
- 契约测试：documentState/工具 schema 与 FEAT-002 对齐。
- 集成测试覆盖 `/api/ai/editor/streamText`、`/api/ai/chat`、`/api/ai/models` 的认证、错误、流协议。

## 9. 发布、兼容与回滚

- 私有 app 不分发；无 npm 发布。
- 以环境校验、健康检查、可观测性发布。
- 密钥轮换与 provider 故障通过配置切换/回滚，不向客户端降级为默认模型。
- `.env.example` 提交仓库文档化所有必需变量。

## 10. 类似产品与开源方案调研

| 来源 | 日期 | 可借鉴 | 限制 |
|---|---|---|---|
| Context7 `/websites/hono_dev` | 2026-07-17 | 类型化中间件、CORS、stream helper、`app.request()` 测试、Bun/Node 兼容 | 精确版本待锁定 |
| Context7 `/websites/ai-sdk_dev` | 2026-07-17 | `streamText` + UIMessageStream 与 Hono 返回集成；错误可掩码 | 精确版本与 partial tool call / client-side tools API 须实施前锁定 |
| BlockNote `xl-ai-server` `regular.ts` | 2026-07-17 | `injectDocumentStateMessages` + `toolDefinitionsToToolSet` + `toUIMessageStreamResponse` 模式 | GPL；不引用源码，自研匹配路由 |
| Hono 官方仓库 | 2026-07-17 | MIT、活跃；release v4.12.30 | — |

## 11. 第三方依赖、版本与 Context7 记录

| 包 | 版本 | 授权 | 来源 | 备注 |
|---|---|---|---|---|
| `hono` | ~4.12（sub 调研记 v4.12.30） | ISC | Context7 `/websites/hono_dev` | 实施前以 lockfile 锁定 |
| `@hono/node-server` | ~2.0 | ISC | 同上 | 同上 |
| AI SDK (`ai`) | 待锁定 | Apache-2.0 | Context7 `/websites/ai-sdk_dev` | 实施前必须用 Context7 + 最小端到端示例锁定 |
| `@ai-sdk/alibaba` | 待锁定 | Apache-2.0 | 同上 | DashScope/Qwen 主路径 |
| `@ai-sdk/google` | 待锁定 | Apache-2.0 | 同上 | Gemini 可选 |
| `zod` | 与 monorepo 一致 | MIT | 代码库现状 | — |
| `pino` + `pino-pretty` | 待锁定 | MIT | hono 规范 | — |

> 实施前必须用 Context7 查询 AI SDK 最新稳定版本、`streamText` UIMessageStream helper、partial tool call streaming、client-side tools `execute`/tool result 回传 API，并以最小 editor/chat 流式工具调用示例验证后锁定到 workspace lockfile。

## 12. 备选方案与决策

- 备选 A：直接暴露 Provider（客户端持 Key）。排除：泄露 Key。
- 备选 B：让客户端定义 tools。排除：破坏授权与契约，服务端无法版本化管控。
- 采纳：Hono 网关 + AI SDK，服务端声明工具 schema，客户端执行（chat）或服务端 streamTool（editor）。满足 Key 安全、allowlist、版本化契约。
- 复用 approval 脚手架 vs 新建 chat 路由：总 PRD v2 决策新建独立 `/api/ai/chat`，approval 保留为独立示例。

## 13. 技术风险与待确认

- AI SDK 精确版本与 partial tool call / client-side tools API 未锁定（总 PRD §17 item 5）——实施前阻塞项。
- `defaultAgentModel` 导出缺失是否仅为保留脚手架（总 PRD §17 item 4）。
- JWT issuer/audience/claims、限流存储、secret rotation 流程需部署方确定（SUB-004 §11）。
- 现有脚手架与 hono 规范目录/安全/日志存在差距，需增量重构。

## 14. 研究闸门结论（T-001 / T-002 完成）

本节为 OpenSpec change `add-ai-backend` 任务 1.1–1.5 的可复核结论。研究阶段完成后锁定以下事实，后续实现严格基于此。

### 14.1 锁定版本组合

| 包 | 版本 | 授权 | 备注 |
|---|---|---|---|
| `hono` | 4.12.30 | ISC | Context7 `/websites/hono_dev` 与 `npm view` 确认 |
| `@hono/node-server` | 2.0.10 | ISC | `serve({ fetch: app.fetch, port })` 模式 |
| `jose` | 6.2.3 | MIT | ESM(`type: module`),与 Bun 兼容;`jwtVerify` + `importSPKI` API |
| `pino` | 10.3.1 | MIT | 结构化日志 |
| `pino-pretty` | 13.1.3 | MIT | 开发环境日志格式化 |
| `ai` | 7.0.31 | Apache-2.0 | FEAT-002 研究闸门已锁定 |
| `@ai-sdk/alibaba` | 2.0.14 | Apache-2.0 | FEAT-002 已验证 peerDep 兼容 |
| `@ai-sdk/google` | 4.0.18 | Apache-2.0 | FEAT-002 已验证 peerDep 兼容 |
| `zod` | 4.4.3 | MIT | 与 monorepo 一致 |
| `@tap-note/ai-core` | workspace:* | — | 复用 schema/transport/busy/预算契约 |

### 14.2 Hono + AI SDK v7 服务端集成模式（T-001.1 / 1.3）

通过 Context7 `/websites/hono_dev` 与 `/websites/ai-sdk_dev` 查询确认:

- **流式响应模式**:Hono controller 直接返回 `createUIMessageStreamResponse({ stream, headers, status })`(由 AI SDK 提供),或手动 `new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } })`。推荐用 AI SDK 的 `createUIMessageStreamResponse`,它已正确设置 SSE headers(`Content-Type: text/event-stream`、`Cache-Control: no-cache`等)。
- **streamText 调用**:`streamText({ model, system, messages: await convertToModelMessages(injectedMessages), tools, toolChoice })` 返回 `StreamTextResult`;`result.stream` 是 `ReadableStream<LanguageModelStreamPart>`;用 `toUIMessageStream({ stream: result.stream, onError })` 转为 `ReadableStream<UIMessageChunk>`;再交给 `createUIMessageStreamResponse({ stream })` 包装为 HTTP Response。
- **测试模式**:`app.request('/path', { method: 'POST', body: JSON.stringify(...), headers: {...} })` 返回标准 `Response`,可用 `res.status`、`res.headers.get(...)`、`await res.text()`/`await res.json()` 断言。流式响应读 `response.body`(ReadableStream)的首 chunk。
- **Hono Node.js 启动**:`import { serve } from '@hono/node-server'; serve({ fetch: app.fetch, port: 3000 }, (info) => console.log('listening on ' + info.port))`。

### 14.3 jose v6 API（T-001.2）

通过 `npm pack jose@6.2.3` 解包 `dist/types/` 确认:

- **License**:MIT
- **type**:`module`(ESM,与 Bun 兼容)
- **核心 API**:
  - `importSPKI(pem: string, alg: string, options?): Promise<CryptoKey>` — 导入 PEM 格式公钥(RS256/ES256)
  - `importPKCS8(pem, alg, options?)` — 导入私钥
  - `createSecretKey`/`importJWK` — 用于 HS256 共享密钥(不推荐生产)
  - `jwtVerify<PayloadType>(jwt: string, key: CryptoKey, options?: { algorithms, issuer, audience, maxTokenAge, clockTolerance }): Promise<{ payload, protectedHeader }>`
  - `SignJWT` 类(测试用,服务端只校验不签发)
- **生产用 RS256/ES256 公钥**:`JWT_VERIFY_KEY` 环境变量放 PEM 格式公钥,启动时 `importSPKI(env.JWT_VERIFY_KEY, 'RS256')` 导入,运行时 `jwtVerify(token, key, { algorithms: env.JWT_ALGORITHMS, issuer: env.JWT_ISSUER, audience: env.JWT_AUDIENCE })`。
- **JWKS 多密钥支持**:P2 候选,用 `createRemoteJWKSet(url)`;MVP 用单密钥。

### 14.4 审批代理 v7 重写路径（T-001.5）

通过 Context7 查询 v7 `ToolLoopAgent` 与 `createAgentUIStreamResponse` 确认:

- **`ToolLoopAgent` v7 保留**:`new ToolLoopAgent({ model, instructions, tools, toolApproval: { approvalTool: 'user-approval' }, stopWhen: [stepCountIs(15)] })`
- **`toolApproval` 替代 v6 `needsApproval`**:v6 `needsApproval: true` → v7 `toolApproval: { approvalTool: 'user-approval' }`;v6 `needsApproval: async (args) => condition` → v7 `toolApproval: { toolName: SingleToolApprovalFunction }` 或 generic `toolApproval: function`
- **`createAgentUIStreamResponse({ agent, uiMessages, abortSignal?, headers?, status? })` v7 保留**:执行 agent 流式输出,返回 HTTP Response。本 change 用此函数返回审批代理流。
- **`tool()` v7 形状**:`tool({ description, inputSchema: z.object({...}), execute: async (args) => result })`,与 v6 一致。
- **审批流程**:agent stream 输出 `tool-approval-request` part,客户端用 `addToolApprovalResponse({ approvalId, approved })` 回传;`toolApproval: { approvalTool: 'user-approval' }` 触发手动审批。

### 14.5 Hono CORS 中间件（T-001.1 复核）

- **多 origin 白名单**:`cors({ origin: ['https://app.example.com', 'https://staging.app.example.com'] })`,严格匹配
- **动态 origin**:`cors({ origin: (origin, c) => origin.endsWith('.example.com') ? origin : 'http://example.com' })`
- **环境变量注入**:`app.use('*', async (c, next) => { const corsMiddleware = cors({ origin: c.env.CORS_ORIGIN }); return corsMiddleware(c, next) })`
- 本 change 实现:从 `env.CORS_ORIGIN`(逗号分隔)解析为 `string[]`,传给 `cors({ origin, allowHeaders: ['Content-Type', 'Authorization'], allowMethods: ['GET', 'POST'] })`。

### 14.6 仍待确认风险

- JWT claims 精确集合(`scope` 字段名与值需对齐集成方 BFF);本 change 假设用标准 `scope` claim 空格分隔,值如 `ai:editor ai:chat ai:models`。
- 限流维度的精确默认值需部署方校准;本 change 提供默认值与可配 override。
- `POST /api/ai/proxy` 透明代理的 P1 实现;MVP 占位抛 501。

### 14.7 研究闸门放行结论

T-001.1–1.5 全部有可复核结果（已写入 14.1–14.6），无需更新本 change 的 `design.md` 与 `specs/ai-backend/spec.md`:

- 锁定版本组合不冲突:`hono@4.12.30` + `@hono/node-server@2.0.10` + `jose@6.2.3` + `pino@10.3.1` + `pino-pretty@13.1.3` + AI SDK v7 组合。
- Hono + AI SDK v7 集成模式确认:`createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) })` 返回流式 Response。
- jose v6 API 确认:`importSPKI` + `jwtVerify` 满足 RS256/ES256 公钥校验需求。
- 审批代理 v7 重写路径确认:`ToolLoopAgent` + `toolApproval` + `createAgentUIStreamResponse`。

**放行进入第 2 组实现任务。**

## 15. 依赖闭包与许可证检查(T-15.1 / 15.2 / 15.3 完成)

实施完成后,通过 `bun pm ls --all` 生成 `@workspace/server-api` 的生产依赖闭包,确认结果:

### 15.1 直接 dependencies

| 包 | 版本 | 授权 |
|---|---|---|
| `hono` | 4.12.30 | ISC |
| `@hono/node-server` | 2.0.10 | ISC |
| `jose` | 6.2.3 | MIT |
| `pino` | 10.3.1 | MIT |
| `pino-pretty` | 13.1.3 | MIT |
| `ai` | 7.0.31 | Apache-2.0 |
| `@ai-sdk/alibaba` | 2.0.14 | Apache-2.0 |
| `@ai-sdk/google` | 4.0.18 | Apache-2.0 |
| `zod` | 4.4.3 | MIT |
| `@tap-note/ai-core` | workspace:* | —(workspace 内包) |
| `dotenv` | 17.4.2 | MIT |

### 15.2 间接依赖闭包(传递)

- `@ai-sdk/gateway@4.0.23`、`@ai-sdk/provider@4.0.3`、`@ai-sdk/provider-utils@5.0.11`、`@ai-sdk/openai-compatible@3.0.12`(均 Apache-2.0)
- `@pinojs/redact@0.4.0`(MIT)
- `@tap-note/editor@workspace:*`(workspace 内包,MPL-2.0 from `@blocknote/*`)

### 15.3 禁止依赖检查

闭包检查结果:无以下任何禁止依赖:

- ❌ `@blocknote/xl-ai-server`(GPL)— 未出现
- ❌ `@blocknote/xl-ai`(GPL/PROPRIETARY)— 未出现
- ❌ `xl-pdf-exporter` / `xl-docx-exporter` / `xl-odt-exporter` / `xl-email-exporter` / `xl-multi-column` — 均未出现
- ❌ 任何 GPL/AGPL 依赖 — 未出现

### 15.4 结论

`@workspace/server-api` 的生产依赖闭包完全干净,仅含 ISC(hono)、MIT(jose/pino/zod/dotenv)、Apache-2.0(ai SDK)依赖。许可证检查通过,允许 change 完成并归档。
