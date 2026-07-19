## Why

FEAT-002 ai-core 已交付共享契约(schema/DocumentStateBuilder/busy/transport/layerContext)、FEAT-005 ai-backend 已交付 `/api/ai/chat` 与 `/api/ai/models` 端点、FEAT-003 ai-inline 已交付内联助手并验证了 busy 互斥与 suggest-changes 链路,但编辑器还没有侧边对话助手。创作者无法在侧边面板引用选区/全文、与 AI 多轮对话、通过离散工具调用作用于编辑器文档(每次 tool call 单 BlockOperation)。本 change 实现总 PRD §4.3 对话流程与 §15 MVP 项 FEAT-004,补齐 MVP「侧边对话改文档」的最后一块。

## What Changes

- 新增 `@tap-note/ai-chat` workspace 包,位于 `packages/tap-note-ai-chat`,**位置无关**:只导出 `TapNoteChatPanel` 组件本体与 `createTapNoteChatAssistant` 入口,不导出抽屉开关/布局容器组件;ChatPanel 最小宽度 320px,集成方可放置在任意区域(右侧/左侧/浮动/独立路由)。
- `TapNoteChatPanel`:由 header、上下文三态 segmented(选区/全文/无,默认 `无`)、消息列表、输入区构成;支持焦点陷阱、`Escape` 关闭、发送后焦点恢复、`aria-live` 流状态播报。
- `useTapNoteChat`:封装 AI SDK v7 `useChat` + ai-core `createServerTransport`,per-request 注入 `documentState` 与 `documentRevision`;触发前 `busy.acquire("chat")`,完成/中止/失败/卸载时 `busy.release`。
- 客户端 tools `execute` 实现:`insertBlock`/`updateBlock`/`deleteBlock`/`replaceBlocks`/`moveBlock`/`getDocumentSnapshot`;每个 `execute` 先校验 `baseDocumentRevision` 与块前置条件,冲突返回 ai-core `ConflictResult`(可重试);`getDocumentSnapshot` 仅「引用全文」+ 允许按需读取时暴露,受块数/token 预算约束。
- 工具调用 UI:tool-call 输入状态(`◔/◑/◐`)嵌入 AI 消息 UIMessage.parts;tool 结果(成功 `✓` + 跳转、冲突 `⚠` + 仅重试该 `toolCallId`、前置失败 `⚠` + 重试、错误 `✗`)用独立气泡作回执。冲突重试用最新 revision 重新 execute 当前 `toolCallId`,不重发整轮、不破坏已成功操作。
- 上下文三态引用:经 ai-core `DocumentStateBuilder` 序列化为 documentState 随消息发送;选区超 4K 前端拦截;全文预算 8K 截断带 `[文档已截断]` 标记、>2× 改发结构化大纲;`none` 不发 documentState,不暴露 `getDocumentSnapshot`。
- 选区引用:发送前编辑器侧保留选区高亮 + 消息气泡 chip,发送后清除编辑器侧高亮保留 chip 作为审计回执。
- 默认 zh-CN 字典,**扩展** ai-core `AICoreDictionary`(不重复定义已有字段),可被集成方替换。
- 集成方通过 `createTapNoteChatAssistant({ transport, documentStateBuilder, editor, model?, getAuthHeaders?, dictionary? })` 一行接入,返回的 `TapNoteChatAssistant` 实现 `packages/tap-note-editor` 已定义的 `{ mount(editor), unmount(editor), panel }` 接口。
- **不修改** `packages/tap-note-editor`、`packages/tap-note-ai-core`、`packages/tap-note-ai-inline`、`apps/server-api` 的运行时代码。
- **不引入** `@blocknote/xl-ai`(GPL)、任何 GPL/AGPL 依赖。
- **不实现**:对话工具执行审批开关(`needsApproval` P2 候选)、批量操作(严格单次单操作)、移动端窄屏 sheet(由集成方实现)、npm 发布构建(MVP 阶段 workspace 直接消费)。
- `apps/web` demo 改造:新增 sidemenu + `/inline`、`/chat`、`/both` 三路由作为 example;A4 纸面样式(灰色工作区 + 居中白纸 + 阴影)与右侧可开合抽屉布局均属 demo 自有样式与逻辑,不在 `@tap-note/ai-chat` 或 `@tap-note/editor` 包范围内,集成方可参考或自行修改;模型下拉调 `/api/ai/models`;Vite proxy `/api` → server-api。

## Capabilities

### New Capabilities

- `ai-chat`: 侧边 Cursor/Copilot Chat 式对话面板,位置无关(最小宽 320px),支持引用选区/全文/不引用三态上下文,通过 AI SDK v7 client-side tools 以离散工具调用(单次单操作)修改编辑器文档,每次 tool-call 携带 `baseDocumentRevision` 与块前置条件,冲突可重试;与 inline 共享同一 `aiBusyState`,任一进行中时另一助手入口禁用。

### Modified Capabilities

无。本 change 不修改 `editor`、`ai-core`、`ai-inline`、`ai-backend` 任何 capability 的 spec-level 行为。`packages/tap-note-editor` 已暴露的 `TapNoteChatAssistant` 接口(`{ mount, unmount }`)在 ai-inline change 已定义,本 change 只新增 `panel` 字段返回组件引用,不破坏既有契约(原接口未约束额外字段)。

## Impact

- **新增代码**: `packages/tap-note-ai-chat/{package.json,tsconfig.json,eslint.config.js,bunfig.toml,src/{index.ts,tap-note-chat-panel.tsx,use-tap-note-chat.ts,tools/{client-tools.ts,tool-result-bubble.tsx},context/{context-mode.ts,context-layer.ts},i18n/zh-cn.ts,types/*,ui/{context-selector.tsx,message-list.tsx,message-bubble.tsx,input-area.tsx}}}`、`apps/web/src/{routes/{inline,chat,both},components/{sidemenu,chat-drawer,editor-paper-layout}}`、`apps/web/src/app.css`(A4 纸面样式)。
- **新增依赖**: `@tap-note/ai-core@workspace:*`、`@blocknote/core@0.51.4`(MPL)、`@blocknote/react@0.51.4`(MPL);peerDeps: `ai@7.0.x`、`react@^19`、`react-dom@^19`;devDeps: `@happy-dom/global-registrator`、`@testing-library/{jest-dom,react}`、`eslint`、`typescript-eslint`、`react`、`react-dom`、`@types/react`、`@types/react-dom`、`typescript`。`apps/web` 新增 `react-router-dom` 用于多路由。
- **不修改**: `packages/tap-note-editor`、`packages/tap-note-ai-core`、`packages/tap-note-ai-inline`、`apps/server-api` 的运行时代码。
- **不引入**: `@blocknote/xl-ai`(GPL)、任何 GPL/AGPL 依赖。
- **研究闸门复用**: FEAT-002 已在 `tech.md §14` 锁定 v7 API、suggest-changes 兼容性;FEAT-005 已在 `tech.md §14` 锁定 Hono + jose + v7 服务端集成与 `/api/ai/chat` 端点契约(client-side tools 服务端声明不 execute)。本 change 需要以 Context7 复核 AI SDK v7 `useChat`、`DefaultChatTransport`、client-side tools `execute`/`toolCallId` 回传精确 API、UIMessage.parts 中 tool-call 状态渲染、`@ai-sdk/alibaba@2`/`@ai-sdk/google@4` 与 `ai@7` peerDep 兼容性。
