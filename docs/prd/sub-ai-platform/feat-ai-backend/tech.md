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
