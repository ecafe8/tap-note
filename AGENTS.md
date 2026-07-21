# AGENTS.md

## 项目概述

tap-note：基于 BlockNote 的富文本编辑器，支持两种 AI 助手模式（内联写作 + 侧边对话），类似 Notion AI / Cursor Chat 体验。Bun + Turbo monorepo，React 19 + Tailwind 4 + AI SDK v7 + Hono。


## 命令

```bash
bun install              # 安装依赖（bun@1.3.14，不用 pnpm/npm）
bun run dev              # turbo dev（web :5173 + server-api :4100）
bun run build            # turbo build（依赖 ^build）
bun run lint             # turbo lint（各包 eslint）
bun run typecheck        # turbo typecheck（各包 tsc --noEmit）
bun run test             # turbo test（依赖 ^build）
bun run format           # prettier write
```

单包操作：`bun run typecheck --filter=@tap-note/ai-core`
单测试文件：`bun test path/to/file.test.ts`（在包目录下运行）

验证顺序：`lint -> typecheck -> test`

## Monorepo 结构

| 路径 | 包名 | 职责 |
|---|---|---|
| `apps/web` | `web` | Vite + React 19 参考 demo（多路由：/inline, /chat, /both） |
| `apps/server-api` | `@workspace/server-api` | Hono AI 网关（streamText, chat, models） |
| `packages/tap-note-editor` | `@tap-note/editor` | BlockNote shadcn 封装（`TapNoteEditor`） |
| `packages/tap-note-ai-core` | `@tap-note/ai-core` | 共享层：BlockOperation schema、DocumentStateBuilder、suggest-changes 应用器、transport、busy 状态 |
| `packages/tap-note-ai-inline` | `@tap-note/ai-inline` | 内联 AI：流式写入 + 接受/拒绝 |
| `packages/tap-note-ai-chat` | `@tap-note/ai-chat` | 对话 AI：侧边面板、离散工具调用、上下文引用 |
| `packages/ui` | `@workspace/ui` | shadcn 组件（base-ui + tailwind-merge@3） |
| `resource/BlockNote` | git submodule | 仅作参考，不参与构建。阅读其源码获取 API/算法灵感 |

## 关键约束

- **GPL 规避**：任何 `dependencies` 中禁止添加 `@blocknote/xl-ai`、`xl-ai-server`、`xl-pdf-exporter`、`xl-docx-exporter`、`xl-multi-column`。生产依赖仅允许 `@blocknote/core`、`react`、`shadcn`（MPL-2.0）。
- **AI SDK v7 锁定**：`ai@7.0.31`、`@ai-sdk/react@4.0.34`、`@ai-sdk/alibaba@2.0.14`、`@ai-sdk/google@4.0.18`。v6→v7 breaking：`needsApproval`→`toolApproval`、`UIMessage.content`→`parts`、`DefaultChatTransport` 为包装对象。
- **BlockNote 锁定**：所有包统一 `0.51.4`。
- **TypeScript ~6**（暂不用 7.x）。
- **server-api 端口 4100**；web vite proxy `/api` → `http://localhost:4100`。
- **纯组件产品**：编辑器/组件包中不含持久化。Demo 刷新丢内容是预期行为。
- **AI 互斥**：同一编辑器会话同一时刻只能有一个 AI 任务（内联或对话），由 ai-core 的 `createAIBusyState()` 管理。
- **模型 ID 格式**：`<provider>:<model>`（如 `dashscope:qwen-plus`）。服务端拒绝未列出的模型，不回退默认。
- **API 信封**：非流式端点返回 `{ code, message, data }`；流式 AI 端点直接返回 UIMessageStream（无信封）。

## 代码风格

- Prettier：无分号、双引号、2 空格缩进、trailing comma es5、tailwind 插件。
- kebab-case 目录 + `index.ts`/`index.tsx` 入口。
- 工作区别名：`@workspace/ui/*`、`@tap-note/*`（workspace:* 协议）。
- `apps/web` 使用 `@/` 别名指向 `./src`。
- server-api 遵循 Hono 模块模式：`config/`、`middleware/`、`modules/`、`errors/`、`utils/`、`types/`。

## 测试

- 测试运行器：`bun test`（不用 vitest/jest）。
- 含 DOM 测试的包通过 `bunfig.toml` 预加载 happy-dom + testing-library。
- server-api 测试：`apps/server-api/test/` 下有 `setup-env.ts`、`happydom.ts`、`testing-library.ts` 预加载。
- Hono 路由测试：使用 `app.request()` 模式，不启动真实服务器。

## 环境配置（server-api）

复制 `apps/server-api/.env.example` → `.env`。必填：`DASHSCOPE_API_KEY`。JWT 配置可选（开发模式跳过）。限流和上下文预算变量见 `.env.example`。

## 参考代码规则

`resource/BlockNote` submodule 是 BlockNote 集成模式的首要参考来源。阅读其源码理解 API，然后独立编写代码。

使用三方组件/包时，先用 Context7 查询当前版本文档。

## OpenSpec 工作流

变更提案位于 `openspec/changes/`。使用 openspec skills（propose → apply → verify → archive）进行结构化功能开发。
