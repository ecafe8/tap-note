## Why

FEAT-002 ai-core 已交付共享契约、FEAT-005 ai-backend 已交付 `/api/ai/editor/streamText` 端点，但编辑器内还没有内联 AI 助手。创作者无法在编辑器中通过 `/ai` 唤起、输入指令、逐块流式写入、接受/拒绝。`@blocknote/xl-ai` 基于 v6 AI SDK 且 GPL 授权，不能直接使用；需要参考其思路自行重写。

## What Changes

- 新增 `@tap-note/ai-inline` workspace 包，位于 `packages/tap-note-ai-inline`，提供 BlockNote `createExtension` 状态机、StreamToolExecutor、UI 组件与 i18n。
- `TapNoteAIInlineExtension`：状态机 `user-input → thinking → ai-writing → user-reviewing → error`，复用 ai-core 的 `createAIBusyState`、`createDocumentStateBuilder`、`applyOperationsToEditor`、`layerContext`。
- `StreamToolExecutor`：增量解析 AI SDK v7 partial tool call streaming，Zod 校验，去重（`filterNewOrUpdatedOperations`），完整操作提交到 `applyOperationsToEditor(mode: "suggest")`；ConflictResult 触发 `error` 态可重试。
- `applyDocumentOperations` 流式工具：输入 `{ operations: BlockOperation[] }`，复用 ai-core applier 经 suggest-changes 可回退应用。
- `AIMenuController` / `AIToolbarButton` / `getAISlashMenuItems`：`/ai` 唤起 slash 菜单、选区 AI 按钮、AIMenu 输入框；`AbortController` 支持中止流式并回退。
- 默认 zh-CN 字典，扩展 ai-core `AICoreDictionary`（不重复定义已有字段），可被集成方替换。
- 集成方通过 `createTapNoteInlineAssistant({ transport, aiBusyState, model?, dictionary? })` 一行接入，返回的 `TapNoteInlineAssistant` 实现 `packages/tap-note-editor` 已定义的 `{ mount(editor), unmount(editor) }` 接口。
- 消费 FEAT-005 `POST /api/ai/editor/streamText` 端点；用 `@ai-sdk/react` 的 `Chat` 类 + ai-core `createServerTransport` 管理 HTTP 请求,per-request `documentState` 通过 `sendMessage` 的 `body` 参数动态注入。

## Capabilities

### New Capabilities

- `ai-inline`: 编辑器内联 Notion 式 AI 助手，`/ai` 唤起 AIMenu 输入指令，流式 BlockOperation 逐块写入，接受/拒绝/中止/重试。

### Modified Capabilities

无。

## Impact

- **新增代码**: `packages/tap-note-ai-inline/{package.json,tsconfig.json,eslint.config.js,bunfig.toml,src/{index.ts,extension/tap-note-ai-inline-extension.ts,state-machine.ts,stream-tool-executor.ts,tools/apply-document-operations.ts,ui/{ai-menu-controller.tsx,ai-toolbar-button.tsx,ai-slash-menu-items.ts},i18n/zh-cn.ts,types/*}}`。
- **新增依赖**: `@blocknote/core@0.51.4`、`@blocknote/react@0.51.4`、`@ai-sdk/react`(peerDep,用于 `Chat` 类管理 HTTP 请求与流式消费)、`ai`(peerDep)、`@tap-note/ai-core`(workspace:*);devDeps: `react@^19`、`@happy-dom/global-registrator`、`@testing-library/*`。
- **不修改**: `packages/tap-note-editor`、`packages/tap-note-ai-core`、`apps/web`、`apps/server-api` 的运行时代码。
- **不引入**: `@blocknote/xl-ai`(GPL)、任何 GPL/AGPL 依赖。
- **不实现**: 对话面板 UI(属 FEAT-004)、服务端 streamText(属 FEAT-005)、`needsApproval` 审批开关(P2 候选)。
- **研究闸门复用**: FEAT-002 已在 `tech.md §14` 锁定 v7 API、suggest-changes 兼容性;FEAT-005 已在 `tech.md §14` 锁定 Hono + jose + v7 服务端集成。本 change 需要以 Context7 复核 BlockNote `createExtension` API、`@ai-sdk/react` `Chat` 类 API 与 AI SDK partial tool call streaming 精确 API。