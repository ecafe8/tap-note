# @workspace/server-api

TapNote 自托管 AI 网关。Hono + AI SDK v7,提供内联写作 streamText、对话 chat、模型列表、审批代理示例。

## 快速启动

```bash
# 1. 复制 .env.example 并填入真实值
cp .env.example .env
# 编辑 .env 填入 DASHSCOPE_API_KEY、JWT 配置、CORS_ORIGIN

# 2. 安装依赖(workspace 级)
bun install

# 3. 启动开发服务器(热重载)
bun run dev
# 服务监听 http://localhost:3000
```

## API

| 端点 | 方法 | 认证 | 说明 |
|---|---|---|---|
| `/health` | GET | 匿名 | 健康检查 |
| `/ready` | GET | 匿名 | 就绪检查 |
| `/api/ai/editor/streamText` | POST | JWT | 内联流式写作,服务端持有 streamTool schema |
| `/api/ai/chat` | POST | JWT | 对话流式,client-side tools 不 execute |
| `/api/ai/models` | GET | JWT(可配) | 返回 allowlist 模型元数据 |
| `/api/ai/agents/approval` | POST | JWT | 审批代理独立示例 |
| `/api/ai/proxy` | POST | JWT | P1 透明代理占位(501) |

## 安全策略

- **JWT 校验**:生产 `/api/ai/*` 强制校验短期 JWT(签名算法、issuer、audience、exp、sub、scope)。`jose` v6 实现,RS256/ES256 公钥校验。
- **清理 X-User-* 头**:中间件先删除客户端发送的所有 `X-User-*` 请求头,再注入 JWT 验证后的身份上下文。后端不无条件信任客户端身份头。
- **CORS**:`Access-Control-Allow-Origin` 受 `CORS_ORIGIN` 环境变量控制(逗号分隔白名单)。
- **限流**:按认证主体(sub)限制速率(默认 10 RPM)与并发(默认 3)。
- **隐私日志**:pino 记录 requestId/userId/model/usage/duration/status,**不记录** prompt/文档正文/工具结果。

## Provider Key 安全边界

- LLM API Key(`DASHSCOPE_API_KEY`/`GOOGLE_GENERATIVE_AI_API_KEY`)只存在于服务端环境
- 客户端只通过 `@tap-note/ai-core` 的 `createServerTransport` 携带短期 JWT
- 浏览器 DevTools Network 面板永不见 LLM API Key
- Provider 调用由服务端 `streamText` 内部注入 Key

## Allowlist 机制

- 服务端仅返回 `allowlist.ts` 中列出的模型
- 未配置 `GOOGLE_GENERATIVE_AI_API_KEY` 时只返回 dashscope 模型
- 提交未在 allowlist 的 modelId 被拒绝(`MODEL_NOT_ALLOWED`,400),**不回退默认模型**

## 与 FEAT-002 ai-core 契约对齐

- 服务端 streamTool schema **从 `@tap-note/ai-core` 导入** `blockOperationSchema`(单 source of truth)
- documentState 注入**复用 ai-core 的 `injectDocumentStateMessages`**
- transport 指向 `/api/ai/editor/streamText` 与 `/api/ai/chat`

## AI SDK v7 依赖

- `ai@7.0.31`: `streamText` → `result.toUIMessageStream()` → `createUIMessageStreamResponse`
- `@ai-sdk/alibaba@2.0.14`: DashScope/Qwen 主路径
- `@ai-sdk/google@4.0.18`: Gemini 可选
- v7 `DefaultChatTransport` 封装对象(不直接暴露 Provider)
- v7 `createAgentUIStreamResponse` + `ToolLoopAgent` + `toolApproval`(审批代理)

## 测试

```bash
cd apps/server-api
bun test          # 67 个测试
bun run typecheck
bun run lint
```

测试用 `app.request()` 覆盖中间件、Zod 校验、allowlist 拒绝、错误处理、流 headers。Provider 全部用 mock 隔离,不调用真实 LLM API。

## 依赖闭包授权

| 包 | 授权 |
|---|---|
| `hono@4.12.30` | ISC |
| `@hono/node-server@2.0.10` | ISC |
| `jose@6.2.3` | MIT |
| `pino@10.3.1` + `pino-pretty@13.1.3` | MIT |
| `ai@7.0.31` | Apache-2.0 |
| `@ai-sdk/alibaba@2.0.14` / `@ai-sdk/google@4.0.18` | Apache-2.0 |
| `zod@4.4.3` | MIT |

无 `@blocknote/xl-ai-server`、`@blocknote/xl-ai` 或任何 GPL/AGPL 依赖。
