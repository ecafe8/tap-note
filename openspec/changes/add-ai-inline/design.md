## Context

FEAT-002 ai-core 已归档,提供 `BlockOperation`/`DocumentState`/`ConflictResult` Zod schema、`createDocumentStateBuilder`、`injectDocumentStateMessages`、`applyOperationsToEditor`(suggest/apply/revert)、`createAIBusyState`、`createServerTransport`、`layerContext`。FEAT-005 ai-backend 已归档,提供 `POST /api/ai/editor/streamText` 端点(服务端 streamTool schema 与 ai-core 同源)。`packages/tap-note-editor` 已暴露 `TapNoteInlineAssistant` 接口(`mount`/`unmount` 函数)与 `aiBusyState` 注入点。

当前缺失:
- `packages/tap-note-ai-inline` 尚不存在。
- 编辑器内 `/ai` 唤起、输入指令、流式逐块写入、接受/拒绝/中止/重试的端到端工作流。
- BlockNote `xl-ai` 基于 v6 AI SDK 且 GPL 授权,不能直接使用;需参考其思路自行重写(AIExtension 状态机、StreamTool 增量解析/校验/去重、AIMenu/AIToolbarButton/Slash 项交互范式),不复制其源码。

## Goals / Non-Goals

**Goals:**

- 创建 `@tap-note/ai-inline` workspace 包,提供 `createTapNoteInlineAssistant` 入口函数。
- `TapNoteAIInlineExtension` 状态机:`user-input → thinking → ai-writing → user-reviewing → error`。
- `StreamToolExecutor`:增量解析 AI SDK v7 partial tool call streaming, Zod 校验,去重,完整操作提交到 `applyOperationsToEditor(mode: "suggest")`。
- `applyDocumentOperations` 流式工具:输入 `{ operations: BlockOperation[] }`,复用 ai-core applier。
- `AIMenuController` / `AIToolbarButton` / `getAISlashMenuItems`:UI 交互。
- 复用 ai-core 的 schema/DocumentStateBuilder/applier/busy/transport。
- 消费 FEAT-005 `/api/ai/editor/streamText` 端点。
- 通过 `TapNoteEditor.inlineAssistant` prop 注入编辑器。
- 默认 zh-CN 字典,可被集成方替换。

**Non-Goals:**

- 不实现对话面板 UI(属 FEAT-004)。
- 不实现服务端 streamText/模型路由/JWT(属 FEAT-005)。
- 不实现 `needsApproval` 审批开关(P2 候选,总 PRD §5.2)。
- 不引入 `@blocknote/xl-ai` 或任何 GPL/AGPL 依赖。
- 不实现 npm 发布构建(MVP 阶段 workspace 直接消费)。

## Decisions

### 1. 状态机用纯 TypeScript 实现,不依赖 XState

状态机只有 5 个状态(`user-input`/`thinking`/`ai-writing`/`user-reviewing`/`error`),转换逻辑简单。用 `useReducer` + 纯函数处理状态转换足够,不引入额外依赖。状态机定义在 `state-machine.ts`。

备选:XState。放弃原因是引入额外依赖且状态机规模小,XState 的复杂语法反而增加维护成本。

### 2. StreamToolExecutor 用 TransformStream 模式

参考 xl-ai `StreamToolExecutor` 思路:AI SDK v7 的 `streamText` 返回 `ReadableStream<UIMessageChunk>`,其中 `tool-call` chunks 包含 partial JSON input。`StreamToolExecutor` 用 `TransformStream` 模式:
- 输入: `ReadableStream<UIMessageChunk>`(来自 transport)
- 中间: `parsePartialJson` + `filterNewOrUpdatedOperations`(去重)→ `BlockOperation[]`
- 输出:完整的 `BlockOperation[]`(每次增量刷新)

备选:一次性等待所有 partial 完成后再处理。放弃原因是无法实现逐块流式写入体验。

### 3. AI SDK v7 partial tool call streaming 解析

AI SDK v7 的 `tool-call` chunk 包含 `{ type: "tool-call", toolName: "applyDocumentOperations", ...}`。input 可能在多个 chunk 中分片到达(partial)。StreamToolExecutor 用 `parsePartialJson` 累积 JSON,`isPossiblyPartial` 标记判断是否完成。已完成的操作校验后提交到 `applyOperationsToEditor`,未完成的操作继续累积。

备选:用 `tool-input-start`/`tool-input-delta`/`tool-input-end`/`tool-call` chunks 逐步解析。放弃原因是 `parsePartialJson` 足够处理 MVP 场景,且 `tool-call` chunk 的完整 input 已经包含最终 JSON。

### 4. TapNoteAIInlineExtension 通过 BlockNote `createExtension` 注入

`@tap-note/ai-core` 不负责 UI 渲染,`@tap-note/ai-inline` 通过 `createExtension` 创建 BlockNote 扩展,安装在 `prosemirrorPlugins`(suggest-changes 插件)与 `keyboardShortcuts`(`/ai` 触发)。扩展的 `store` 管理状态机状态,UI 组件通过 `useExtension` 或 `editor.getExtension` 读写状态。

备选:直接管理编辑器 DOM 事件。放弃原因是用 BlockNote 的扩展系统更规范,与 `@blocknote/xl-ai` 的 `AIExtension` 模式一致。

### 5. UI 组件用 React + BlockNote 的 `useBlockNoteEditor` 模式

`AIMenuController` 是 React 组件,通过 `useBlockNoteEditor()` hook 获取 editor 实例,通过 `editor.getExtension('ai-inline')` 获取扩展 store。`AIToolbarButton` 与 `getAISlashMenuItems` 也是 React 组件,在 `TapNoteEditor` 的 `inlineAssistant.mount` 时挂载到编辑器的 DOM 中。

备选:用原生 DOM 渲染 UI。放弃原因是包已经是 React 生态,`@blocknote/react` 的 UI 组件也是 React 实现,保持一致。

### 6. 复用 ai-core 的 `injectDocumentStateMessages` 只在服务端注入

`injectDocumentStateMessages` 在 FEAT-002 中定义,但 FEAT-005 服务端在 `editor-stream-text` service 中调用它。客户端(`@tap-note/ai-inline`)不直接调用注入,而是把 `documentState` 作为请求 body 的一部分发送,服务端在收到后注入。

备选:客户端注入后发送。放弃原因是:这与 FEAT-005 的 `/api/ai/editor/streamText` 端点契约一致(服务端收到 `documentState` 字段后注入)。

### 7. busy 状态通过 ai-core `createAIBusyState` 共享

内联助手与对话助手共享同一 `AIBusyState` 实例。`createTapNoteInlineAssistant` 接收 `aiBusyState` 参数(来自 `TapNoteEditor` 的 `aiBusyState` prop),触发时 `busy.acquire("inline")`,失败则入口禁用。完成/中止/失败/卸载时 `busy.release()`。

### 8. 锚点菜单使用 BlockNote 的 `useFloatingMenu` 模式

`AIMenuController` 用 BlockNote 的 `useFloatingMenu`(或 `useBlockNote` 的 `editor.getBlockByPos` 定位)附着在光标所在块下方。`/ai` 触发时显示 slash 菜单,选择后或在空白块直接输入时显示 AIMenu 输入框。

备选:自定义浮动定位。放弃原因是 BlockNote 已提供 `@blocknote/react` 的浮动菜单工具,复用即可。

## Risks / Trade-offs

- [BlockNote `createExtension` API 在 0.51.4 中可能不支持 `keyboardShortcuts` 等字段] → 实施前以 Context7 确认;若不支持,回退到用原生 DOM 事件监听。
- [AI SDK v7 partial tool call streaming 的 JSON 分片边界不确定] → 用 `parsePartialJson` 累积处理,丢弃非法 partial 不中断流。MVP 容忍少量延迟,不追求精确逐字流式。
- [StreamToolExecutor 去重逻辑复杂] → 参考 xl-ai `filterNewOrUpdatedOperations` 思路:用 `operation.id` + `isUpdateToPreviousOperation` 标记去重,不重复应用已处理的工具调用。
- [suggest-changes 插件安装冲突] → 内联扩展与 ai-core 的 `applyOperationsToEditor` 都依赖 suggest-changes 插件;确保插件只安装一次。
- [AIMenu 与 BlockNote 现有 UI 组件冲突] → 通过 `TapNoteEditor` 的 `inlineAssistant` prop 注入,由编辑器控制渲染时机,避免与编辑器原生 UI 冲突。

## Migration Plan

无运行时数据或公开 API 需要迁移(全新包)。回滚方式是移除 `packages/tap-note-ai-inline`。

1. 先创建包基础与 `StreamToolExecutor`(核心逻辑,不依赖 UI)。
2. 实现状态机与 `TapNoteAIInlineExtension`。
3. 实现 `applyDocumentOperations` 流式工具。
4. 实现 UI 组件(AIMenu/AIToolbarButton/Slash)。
5. 通过 `createTapNoteInlineAssistant` 入口函数组装。
6. 集成到 `TapNoteEditor` 的 `inlineAssistant` prop 测试。
7. 通过 typecheck/lint/test 与 license 检查。

## Open Questions

- BlockNote `createExtension` API 的 `keyboardShortcuts` 与 `inputRules` 字段在 0.51.4 中的精确形状,须实施前以 Context7 确认。
- AI SDK v7 `toUIMessageStream()` 返回的 `ReadableStream<UIMessageChunk>` 中 `tool-call` chunk 的 input JSON 分片模式,须实施前以最小示例验证。
- `useFloatingMenu` 在 `@blocknote/react@0.51.4` 中的 API 形状,须实施前确认。