## Why

FEAT-002 `@tap-note/ai-core` 已交付 schema/transport/busy/预算契约,但没有服务端实现就无法联调 FEAT-003 内联助手与 FEAT-004 对话助手——客户端 transport 指向的 `/api/ai/editor/streamText` 与 `/api/ai/chat` 端点都不存在。`apps/server-api` 目前只是半成品脚手架:无 `package.json`/`index.ts`、`config.ts` 直接读 `process.env` 不符合 Hono fail-fast 规范、`defaultAgentModel` 导出缺失、v6 脚手架与 v7 不兼容。现在补齐服务端,可以让 FEAT-003/004 有真实联调目标,并满足总 PRD §9 安全规则(浏览器永不持 LLM Key)。

## What Changes

- 补齐 `apps/server-api` 包基础:`package.json`、`tsconfig.json`、`bunfig.toml`、`src/index.ts` 入口装配全局中间件与路由。
- 按 Hono 规范新增 `config/env.ts`(Zod 校验 `DASHSCOPE_API_KEY`/`GOOGLE_GENERATIVE_AI_API_KEY`/`JWT_ISSUER`/`JWT_AUDIENCE`/`JWT_VERIFY_KEY`/`PORT`/`CORS_ORIGIN`,`safeParse` 失败 `process.exit(1)`)。
- 新增中间件:`error-handler.ts`、`request-id.ts`、`auth.ts`(JWT 校验 + 清理 `X-User-*` 头)、`rate-limit.ts`、`cors.ts`。
- 新增 `modules/ai/routes/`:`editor-stream-text.ts`、`chat.ts`、`models.ts`、`proxy.ts`(P1 占位)、`agents/approval.ts`。
- 新增 `modules/ai/controllers/`、`services/`、`providers/`(迁移现有 `providers.ts` 并修复 `defaultAgentModel` 导出)、`agents/agent-approval/`(v7 重写审批代理)、`errors/`、`constants/`、`types/{schema.ts,type.ts,index.ts}`。
- 新增 `errors/app-error.ts`、`errors/error-codes.ts`(as const 对象)、`utils/logger.ts`(pino + pino-pretty)、`utils/response.ts`(success/fail 信封,迁移现有)。
- 锁定 AI SDK v7 组合(`ai@7.0.31` + `@ai-sdk/alibaba@2.0.14` + `@ai-sdk/google@4.0.18`,FEAT-002 研究闸门已验证兼容)。
- 服务端 streamTool schema 与 `@tap-note/ai-core` 的 `BlockOperation` schema 对齐(单 source of truth,不允许各自定义等价 schema)。
- 现有审批代理(`POST /api/ai/agents/approval`)用 v7 `createAgentUIStreamResponse` 重写,保留为独立示例,不进内联/对话主流程。
- `.env.example` 文档化所有必需环境变量。
- 测试用 Bun `app.request()` 覆盖中间件、Zod 校验、allowlist 拒绝、统一错误、流 headers,Provider 用 mock 隔离。

## Capabilities

### New Capabilities

- `ai-backend`: 自托管 Hono AI 网关,提供 `/api/ai/editor/streamText`、`/api/ai/chat`、`/api/ai/models`、`POST /api/ai/agents/approval` 端点,JWT/CORS/限流/requestId/pino 日志/统一错误处理,服务端 Key 不外泄。

### Modified Capabilities

无。`openspec/specs/` 当前只有 `editor` 与 `ai-core`,ai-backend 是全新能力。

## Impact

- **新增代码**:`apps/server-api/src/{index.ts,config/env.ts,middleware/*,modules/ai/{routes,controllers,services,providers,agents,errors,constants,types}/*,errors/*,utils/*,types/*}`、`.env.example`、`package.json`、`tsconfig.json`、`bunfig.toml`。
- **迁移代码**:现有 `src/config.ts` 内容迁移到 `src/config/env.ts`(Zod 校验);现有 `src/modules/ai/providers/providers.ts` 迁移到 `modules/ai/providers/` 并修复 `defaultAgentModel` 导出;现有 `src/utils/{response,hono,logger,pagination}.ts`、`src/types/*` 迁移到新结构;现有 `agents/agent-approval/*` 用 v7 重写。
- **新增依赖**:`hono@~4.12`、`@hono/node-server@~2.0`、`hono/typicode-jwt` 或 `jose`(JWT 校验)、`pino`、`pino-pretty`、`@ai-sdk/alibaba@2.0.14`、`@ai-sdk/google@4.0.18`;workspace 内复用 `ai@7.0.31`、`zod`、`@tap-note/ai-core`(schema 对齐)。
- **不修改**:`packages/tap-note-editor`、`packages/tap-note-ai-core`、`apps/web` 的运行时代码。
- **不引入**:`@blocknote/xl-ai-server`(GPL)、任何 GPL/AGPL 依赖。
- **不实现**:编辑器 UI、客户端 operation 执行、documentState 构造(属 FEAT-002/003/004)、终端用户账号签发与长期 Token 分发(总 PRD §5.2 排除)、持久化/导出/字体(属其他 Sub)。
- **研究闸门复用**:FEAT-002 已在 `tech.md §14` 锁定 v7 API、provider peerDep 兼容性、suggest-changes 兼容性;本 change 复用这些结论,无需重新研究,但需以 Context7 复核 `streamText` 服务端 UIMessageStream 协议与 Hono 集成。
