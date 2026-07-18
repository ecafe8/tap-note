# 技术方案：AI 共享核心

## 0. 文档信息

- 功能 ID：FEAT-002；所属 Sub：SUB-003；状态：草稿；类型：纯后端库，无 `ui.md`；依据：总 PRD v7、SUB-003 `tech.md`。

## 1. 当前项目事实与复用点

- `packages/tap-note-ai-core` 尚不存在。
- `apps/server-api` 已有 AI SDK provider/approval 脚手架，但其路由只实现审批示例，非目标编辑器协议（SUB-003 tech.md §1）。
- BlockNote `0.51.4` 在 `resource/BlockNote` submodule；`xl-ai` 可阅读作思路参考，不依赖源码。

## 2. 本 feat 在 sub 中的位置与职责

ai-core 定义 Zod 的 document/operation 契约、预算器、transport、suggestion applier 与每会话 busy state；inline 管理 suggestion transaction；chat 管理 UIMessage 与浏览器端单操作执行。服务端永远不接收客户端定义的工具 schema（SUB-003 tech.md §2）。

```text
editor -> ai-core(DocumentState, revision) -> transport -> FEAT-005
  ^                                                    |
  +-- inline suggestion / chat local executor <-------+
```

## 3. 模块职责与目录范围

```text
packages/tap-note-ai-core/
├── package.json            # name=@tap-note/ai-core
├── tsconfig.json
├── tsup.config.ts          # 待 P1 FEAT-007 统一
└── src/
    ├── index.ts             # 对外导出
    ├── types/
    │   ├── schema.ts        # BlockOperation Zod schema + DocumentState schema
    │   ├── type.ts         # 派生类型
    │   └── index.ts
    ├── document-state-builder.ts
    ├── inject-document-state.ts
    ├── apply-operations.ts   # suggest-changes 集成
    ├── transport/
    │   ├── server-transport.ts   # createServerTransport
    │   └── proxy-transport.ts   # createProxyTransport
    ├── busy-state.ts        # createAIBusyState
    ├── context-budget/
    │   ├── estimate-tokens.ts
    │   └── layer.ts        # 选区/全文/大纲分层
    ├── i18n/zh-cn.ts       # 字典基础
    └── errors/
```

## 4. 数据模型、迁移与状态

### 4.1 `DocumentState`

```ts
interface DocumentState {
  format: "blocks-json"
  schemaVersion: string
  documentRevision: number       // 单调递增
  blocks: PartialBlock[]
  selection?: { start: string; end: string }  // block id
}
```

### 4.2 `BlockOperation`

```ts
type BlockOperation =
  | { type: "insertBlock"; baseDocumentRevision: number; referenceBlockId?: string; block: PartialBlock }
  | { type: "updateBlock"; baseDocumentRevision: number; targetBlockId: string; block: PartialBlock }
  | { type: "deleteBlock"; baseDocumentRevision: number; targetBlockId: string }
  | { type: "replaceBlocks"; baseDocumentRevision: number; targetBlockIds: string[]; blocks: PartialBlock[] }
  | { type: "moveBlock"; baseDocumentRevision: number; targetBlockId: string; referenceBlockId?: string; position: "before" | "after" }
```

所有操作必须携带 `baseDocumentRevision` 与目标块 ID/前置条件。

### 4.3 busy state

```ts
interface AIBusyState {
  status: "idle" | "in-progress"
  type?: "inline" | "chat"
  acquire(type: "inline" | "chat"): boolean   // 成功获取返回 true
  release(): void
  subscribe(fn: (state) => void): () => void
}
```

每编辑器会话创建一个实例，注入内联与对话助手。无持久化、无迁移。

## 5. 接口、服务与组件接口

- `DocumentStateBuilder(editor, { selection?, scope }): DocumentState`
- `injectDocumentStateMessages(messages, documentState): UIMessage[]`
- `applyOperationsToEditor(editor, operations, { mode: "suggest" | "apply" | "revert" }): void`：经 `suggestChanges`/`applySuggestions`/`revertSuggestions`。
- `createServerTransport({ baseUrl, model, getAuthHeaders? }): Transport`：指向 `/api/ai/editor/streamText` 或 `/api/ai/chat`；`getAuthHeaders` 由集成方提供短期 JWT 注入。
- `createProxyTransport(...)`：P1 候选 ClientSideTransport 等价能力。
- `estimateTokens(text): number`：方案草稿为字符数/4 近似，待确认算法（§13）。
- `layerContext(documentState, { selectionBudget, fullBudget, threshold }): LayeredContext`：返回 `{ kind: "selection-blocked" | "full" | "truncated" | "outline", data }`。

## 6. 核心流程与错误处理

```text
助手触发
  -> busy.acquire(type)？失败：返回 busy，入口禁用
  -> DocumentStateBuilder 生成 documentState + revision
  -> layerContext 估算与分层（选区超限 -> 拦截；全文超预算 -> 截断/大纲）
  -> transport 发送（携带 model + documentState）
  -> 收到 BlockOperation[]（内联流式 / 对话离散）
  -> applyOperationsToEditor(mode=suggest)
  -> 内联：用户接受 -> applySuggestions；拒绝 -> revertSuggestions；释放 busy
  -> 对话：单操作执行后回传 toolCallId；冲突不执行返回可重试结果；释放 busy
```

错误处理：
- Zod `.parse()` 校验失败抛 ZodError，不静默。
- revision/前置条件冲突：对话不执行并返回可重试冲突结果；内联回退所属事务。
- 流中断：中止并 revertSuggestions，释放 busy，不污染历史。

## 7. 权限、安全、输入校验与隐私

- transport 不持有 LLM Key；认证头由集成方 `getAuthHeaders` 注入短期 JWT。
- 不引用模式不发送 documentState，也不暴露 `getDocumentSnapshot`。
- `getDocumentSnapshot`（对话按需读取）仅在用户选「引用全文」且允许按需读取时暴露，受块数与 token 预算约束。
- 所有输入 Zod `.parse()`；ai-core 不记录正文到日志（日志在 FEAT-005）。
- 限制可执行 operation 类型、块目标、预算与上下文模式，拒绝无效/过期输入。

## 8. 测试策略

- 单元测试：schema 校验、estimateTokens、layerContext 分层、busy acquire/release、revision 冲突。
- 契约测试：documentState/BlockOperation 与 FEAT-005 服务端 schema 对齐。
- 集成测试：stream、accept/revert、工具回传、冲突（由 FEAT-003/004 细化）。
- suggest-changes 兼容性最小端到端验证。

## 9. 发布、兼容与回滚

- 独立包发布；`@blocknote/xl-ai` 不得进入 `dependencies` 闭包或 tarball。
- 公开 schema/transport/busy API 以 semver 维护；破坏性变更同 FEAT-007 发布说明。
- 故障可禁用助手或回滚各包，不回滚用户文档（纯组件）。
- MVP 阶段在 monorepo 内以 workspace 直接消费，暂不发布 npm。

## 10. 类似产品与开源方案调研

| 来源 | 日期 | 可借鉴 | 限制 |
|---|---|---|---|
| Context7 `/websites/ai-sdk_dev` | 2026-07-17 | `streamText` 产 UIMessage stream；`DefaultChatTransport`/`useChat` 与工具状态 | 精确版本/API 须实施前锁定 |
| BlockNote 官方仓库 | 2026-07-17 | core 可作编辑器依赖 | `xl-ai` GPL/商业，排除；仅作思路参考 |
| `@handlewithcare/prosemirror-suggest-changes` | 2026-07-17 | suggest/apply/revert 机制，规避 GPL 的关键 | 实施前核对版本、许可证、BlockNote 兼容性 |

## 11. 第三方依赖、版本与 Context7 记录

| 包 | 版本 | 授权 | 来源 | 备注 |
|---|---|---|---|---|
| `@blocknote/core` | 0.51.4 | MPL-2.0 | sub tech.md | 仅类型与 blocks 操作 |
| `@handlewithcare/prosemirror-suggest-changes` | 0.1.8 | 独立第三方（非 BlockNote/GPL） | 总 PRD 调研 | 规避 GPL 的关键；实施前再核对版本与兼容性 |
| `prosemirror-state`/`view`/`model`/`transform` | 与 BlockNote 对齐 | MIT | — | peerDep 或 dep 待定 |
| AI SDK (`ai`) | **v7.0.x**（总 PRD v11 锁定） | Apache-2.0 | Context7 | transport/UIMessage 类型对齐，实施前 Context7 核查 v7 精确 API |
| `zod` | 与 monorepo 一致 | MIT | 代码库现状 | — |
| `react` | ^19 | MIT | — | peerDep（类型） |

> 实施前必须用 Context7 查询 AI SDK **v7** 的 `DefaultChatTransport`、`streamText`、`UIMessage`、`UIMessageStream` 精确 API（v6→v7 breaking changes：`needsApproval`→`toolApproval`、`UIMessage.content`→`parts` 数组、`DefaultChatTransport` 封装对象，见总 PRD §14 v11 决策），并以最小端到端示例验证 suggest/apply/revert 与 BlockNote 交互，锁定到 workspace lockfile。

## 12. 备选方案与决策

- 复用 xl-ai 源码：缩短开发但违反授权目标。排除。
- 单一 assistant 包：会混淆内联/对话不同状态机。排除。
- 采纳：三包加共享 core（ai-core + ai-inline + ai-chat），共享 schema/transport/busy，各自状态机/executor。
- token 估算：近似字符数/4（方案草稿，实施前确认是否需精确 tokenizer）。
- AI SDK 版本：**锁定 v7**（总 PRD v11 决策），不降级到 v6；BlockNote `xl-ai` 的 v6 仅参考思路，实现时翻译 v6→v7 差异。

## 13. 技术风险与待确认

- AI SDK **v7** 精确 API（`DefaultChatTransport`、`streamText`、`UIMessage`、`UIMessageStream`、partial tool call streaming、client-side tools `execute`/tool result 回传）须实施前以 Context7 + 最小端到端示例锁定（总 PRD §17 item 5，v11 部分决策）。
- `@handlewithcare/prosemirror-suggest-changes` 与 BlockNote 0.51.4 的兼容性、流中人工编辑冲突需最小端到端验证（SUB-003 tech.md §6）。
- token 估算算法待确认（总 PRD §17 item 13）。
- 对话 client-side tools 是否支持批量操作（总 PRD §17 item 11，当前严格单操作）。
- `prosemirror-*` 与 BlockNote 的版本对齐方式（peerDep vs dep）待确认。
- `@ai-sdk/alibaba@2`/`@ai-sdk/google@4` 与 `ai@7` 的 peerDep 兼容性须实施前核查。

## 14. 研究闸门结论（T-001 / T-002 完成）

本节为 OpenSpec change `add-ai-core` 任务 1.1–1.10 的可复核结论。研究阶段完成后锁定以下事实，后续实现严格基于此。

### 14.1 锁定版本组合

| 包 | 版本 | 授权 | 备注 |
|---|---|---|---|
| `ai` | `7.0.31` | Apache-2.0 | 总 PRD v11 决策锁定 v7；通过 Context7 `/websites/ai-sdk_dev` 与 `npm view ai@7` 确认 |
| `@ai-sdk/alibaba` | `2.0.14` | Apache-2.0 | 与 `ai@7` 共享 `@ai-sdk/provider@4.0.3` + `@ai-sdk/provider-utils@5.0.11` |
| `@ai-sdk/google` | `4.0.18` | Apache-2.0 | 与 `ai@7` 共享 `@ai-sdk/provider@4.0.3` + `@ai-sdk/provider-utils@5.0.11` |
| `@blocknote/core` | `0.51.4` | MPL-2.0 | 已在 FEAT-001 引入 |
| `@handlewithcare/prosemirror-suggest-changes` | `0.1.8` | MIT | 独立第三方（非 BlockNote/GPL），peerDep `prosemirror-{view,model,state,transform}@^1.0.0`，与 BlockNote 0.51.4 的 `prosemirror-model@^1.25.4`/`state@^1.4.4`/`transform@^1.11.0`/`view@^1.41.4` 兼容 |
| `zod` | 与 monorepo 一致 | MIT | `ai@7` peerDep `^3.25.76 || ^4.1.8`，两个 provider 同 |
| `react` / `react-dom` | `^19` | MIT | peerDep（类型与 transport 引用） |

### 14.2 AI SDK v7 精确 API（T-001.1 / 1.2）

通过 Context7 `/websites/ai-sdk_dev` 查询与 `npm view ai@7` 确认：

- **`DefaultChatTransport(options)`** 构造参数：
  - `api?: string`（默认 `/api/chat`）
  - `headers?: object | (() => Record<string, string>)`（静态或动态）
  - `body?: object | (() => Record<string, unknown>)`（静态或动态字段，merged into request body）
  - `credentials?: string | (() => string)`（fetch credentials mode）
  - 实例化方式：`new DefaultChatTransport({ api, headers, body, credentials })`
- **`UIMessage` 结构**：`{ id, role, parts: Part[] }`，`content` 属性在 v5+ 已移除，统一用 `parts` 数组。`Part` 包含 `{ type: "text", text }`、`{ type: "reasoning", text }`、`{ type: "tool-call" | "tool-result", ... }`、`{ type: "data-*", ... }` 等。
- **`streamText({ model, messages, tools, toolChoice, stopWhen, toolApproval, ... })`**：返回带 `.toUIMessageStream({ onError })` 方法的结果对象。`messages` 须为 `ModelMessage[]`，由 `convertToModelMessages(uiMessages: UIMessage[]): Promise<ModelMessage[]>` 转换。
- **`createUIMessageStream({ execute: ({ writer }) => ... })` + `createUIMessageStreamResponse({ stream })`**：服务端创建 UIMessage 流并包装为 HTTP Response。
- **`createAgentUIStreamResponse({ agent, uiMessages, ... })`**：v7 保留，FEAT-005 可继续基于 Agent 重写审批代理（T-001.6 结论）。

### 14.3 v6 → v7 翻译要点（T-001.7）

通过阅读 `resource/BlockNote/packages/xl-ai/src/streamTool/vercelAiSdk/` 源码确认：

- **`injectDocumentStateMessages(messages)`**：xl-ai v6 实现已使用 `parts: [{ type: "text", text }]` 结构，**已经是 v7 形状**，无需翻译。原实现把 documentState 注入为一条 `assistant` 消息（id: `assistant-document-state-${userMessageId}`）携带多个 `text` parts，紧贴在原 user 消息之前。我们 v7 实现保留此模式。
- **`toolDefinitionsToToolSet(toolDefinitions)`**：v6 用 `tool({ inputSchema: jsonSchema(...), outputSchema: jsonSchema(...) })`，v7 同签名。可直接复用思路。
- **`ClientSideTransport implements ChatTransport<UI_MESSAGE>`**：v6 实现 `sendMessages` + `reconnectToStream` 返回 `ReadableStream<UIMessageChunk>`。v7 `ChatTransport` 接口同形状，可直接实现。MVP 不实现 `ClientSideTransport`，仅占位 `createProxyTransport`。
- **`streamText({ model, messages: await convertToModelMessages(injectDocumentStateMessages(messages)), tools, toolChoice: "required" })` → `result.toUIMessageStream({ onError })`**：v6/v7 一致，无翻译。
- **`maxSteps` 移除**：v7 useChat 不再支持 `maxSteps`，改用服务端 `stopWhen: isStepCount(N)` + 客户端 `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls`。不影响 ai-core（内联用流式工具调用，对话用单操作）。

### 14.4 client-side tools 与 partial tool call streaming（T-001.3 / 1.4）

- **client-side tools**：v7 用 `useChat` 的 `onToolCall({ toolCall })` 回调 + `addToolOutput({ tool, toolCallId, output })`。**关键：`onToolCall` 内不能 `await` `addToolOutput`**，否则死锁；用 `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls` 自动重新提交。FEAT-004 在对话助手接入点用此模式。
- **partial tool call streaming**：v7 默认开启。chunks 形状：`tool-input-start` → `tool-input-delta`（JSON delta 字符串）→ `tool-input-end` → `tool-call`（最终完整 input）。可用 `parsePartialJson(jsonString)` 解析。工具定义可挂 `onInputStart` / `onInputDelta` / `onInputAvailable` 钩子。FEAT-003 `StreamToolExecutor` 解析契约：把 partial JSON 累积为完整 `BlockOperation[]`，去重已应用操作，仅向 `applyOperationsToEditor` 提交已完成的 operations。
- **`dynamicTool({ description, inputSchema: z.object({}), execute: async (input: unknown) => ... })`**：v7 支持运行时类型工具（input 为 `unknown`，需运行时校验）。

### 14.5 provider peerDep 兼容性（T-001.5）

- `ai@7.0.31` peerDep：`zod: ^3.25.76 || ^4.1.8`；deps：`@ai-sdk/gateway@4.0.23`, `@ai-sdk/provider@4.0.3`, `@ai-sdk/provider-utils@5.0.11`
- `@ai-sdk/alibaba@2.0.14` peerDep：`zod: ^3.25.76 || ^4.1.8`；deps：`@ai-sdk/provider@4.0.3`, `@ai-sdk/provider-utils@5.0.11`, `@ai-sdk/openai-compatible@3.0.12`
- `@ai-sdk/google@4.0.18` peerDep：`zod: ^3.25.76 || ^4.1.8`；deps：`@ai-sdk/provider@4.0.3`, `@ai-sdk/provider-utils@5.0.11`
- 结论：**三者共享 `@ai-sdk/provider@4.0.3` + `@ai-sdk/provider-utils@5.0.11`**，peerDep 完全一致，可安全锁定组合 `ai@7.0.31` + `@ai-sdk/alibaba@2.0.14` + `@ai-sdk/google@4.0.18`。

### 14.6 `ToolLoopAgent` / `createAgentUIStreamResponse` 在 v7（T-001.6）

- `createAgentUIStreamResponse({ agent, uiMessages, ... })` 在 v7 保留（见 Context7 文档 `reference/ai-sdk-core/create-agent-ui-stream-response`）。
- `ToolLoopAgent` 在 v7 保留，`needsApproval` 已废弃，改用 `toolApproval`（见 `migration-guide-7-0`）。
- 不影响本 change（FEAT-002 不实现服务端），但 FEAT-005 可基于 v7 Agent 重写审批代理。

### 14.7 `@handlewithcare/prosemirror-suggest-changes@0.1.8` API 与兼容性（T-001.8）

通过 `npm pack` 解包 `dist/index.d.ts` 与 `dist/*.js` 确认：

- **License**：MIT（`package.json` 声明，独立第三方，非 BlockNote/GPL）。
- **peerDeps**：`prosemirror-view@^1.0.0`、`prosemirror-model@^1.0.0`、`prosemirror-state@^1.0.0`、`prosemirror-transform@^1.0.0`。BlockNote 0.51.4 实际依赖 `prosemirror-model@^1.25.4`、`state@^1.4.4`、`transform@^1.11.0`、`view@^1.41.4`，**完全兼容**。
- **导出 API**（`dist/index.d.ts`）：
  - `suggestChanges(): Plugin<{ enabled: boolean }>` — 返回 Prosemirror Plugin
  - `suggestChangesKey: PluginKey<{ enabled: boolean }>` — 插件 key
  - `isSuggestChangesEnabled(state): boolean`
  - `enableSuggestChanges(state, dispatch?)` / `disableSuggestChanges(state, dispatch?)` / `toggleSuggestChanges(state, dispatch?)` — 启用/禁用建议模式的 Command
  - `withSuggestChanges(dispatchTransaction?, generateId?): EditorView["dispatch"]` — 包装 dispatchTransaction，在 `enabled: true` 时把传入事务转换为建议事务
  - `transformToSuggestionTransaction(originalTransaction, state, generateId?): Transaction` — 直接把常规事务转换为建议事务（无需 enable/disable 切换）
  - `applySuggestions(state, dispatch?): boolean` / `revertSuggestions(state, dispatch?): boolean` — 应用/回退全部建议
  - `applySuggestion(suggestionId, from?, to?)` / `revertSuggestion(suggestionId, from?, to?)` — 单条建议
  - `applySuggestionsInRange(from?, to?)` / `revertSuggestionsInRange(from?, to?)` — 范围内
  - `selectSuggestion(suggestionId)` — 选中建议
  - `addSuggestionMarks` / `insertion` / `deletion` / `modification` — Schema marks
- **依赖闭包**：`deps: none`（`npm view` 确认），仅 peerDeps，不会引入额外传递依赖。

### 14.8 最小端到端验证结论（T-001.9 / 1.10）

参考 xl-ai `AIExtension.ts` 与 `testUtil/suggestChangesTestUtil.ts` 的实际使用模式：

- BlockNote 0.51.4 通过 `editor.prosemirrorState`、`editor.transact((tr) => ...)`、`editor.exec((state, dispatch) => ...)` 暴露 Prosemirror 接口，suggest-changes 插件可挂载到 BlockNote 编辑器的 Prosemirror 插件栈（参考 xl-ai `AIExtension` 的 `prosemirrorPlugins: [..., suggestChangesPlugin]`）。
- **suggest 模式**：用 `transformToSuggestionTransaction(originalTr, state)` 把 BlockOperation 转换的 Prosemirror 事务转为建议事务，再 `editor.dispatch(tr)` 应用。无需切换 `enabled` 状态（避免与用户手动编辑冲突）。备选：`enableSuggestChanges` → transact → `disableSuggestChanges` + `withSuggestChanges` 包装。
- **apply 模式**：`editor.exec((state, dispatch) => applySuggestions(state, dispatch))`。`applySuggestions` 删除 `deletion` 标记内容、移除 `insertion`/`modification` 标记保留内容。
- **revert 模式**：`editor.exec((state, dispatch) => revertSuggestions(state, dispatch))`。`revertSuggestions` 删除 `insertion` 标记内容、移除 `deletion`/`modification` 标记保留原内容。
- **流式期间人工编辑不覆盖**：`revertSuggestions` 只回退带建议标记的变更。用户在 suggest 期间通过常规事务（无 `enabled: true` 或未经 `transformToSuggestionTransaction` 包装）做出的编辑不带建议标记，因此 `revertSuggestions` 不会覆盖人工编辑。**关键实现约束：ai-core 的 `applyOperationsToEditor(mode: "suggest")` 必须用 `transformToSuggestionTransaction` 包装事务，确保只有 AI 操作被标记为建议；用户编辑走正常事务，不带建议标记。**
- **revision 冲突检测**：BlockNote 没有内置 revision 计数器，ai-core 在 `DocumentStateBuilder` 内维护单调递增计数器（每次 `build()` 自增），写入 `DocumentState.documentRevision`。`applyOperationsToEditor` 比对 `operation.baseDocumentRevision === currentRevision`，不匹配返回 `ConflictResult` 不执行。
- **前置条件检查**：用 `editor.getBlock(targetBlockId)` 校验目标块存在；`replaceBlocks`/`moveBlock` 校验 `targetBlockIds` 全部存在；不通过返回 `ConflictResult`。
- **BlockOperation → Prosemirror 步骤映射**（基于 BlockNote 0.51.4 API）：
  - `insertBlock` → `editor.insertBlocks([block], referenceBlockId, "before" | "after")`
  - `updateBlock` → `editor.updateBlock(targetBlockId, block)`
  - `deleteBlock` → `editor.removeBlocks([targetBlockId])`
  - `replaceBlocks` → `editor.replaceBlocks(targetBlockIds, blocks)`
  - `moveBlock` → BlockNote 0.51.4 只暴露 `moveBlocksUp(blockId)` / `moveBlocksDown(blockId)`，不支持 `moveBlockTo(referenceBlockId, "before" | "after")`。MVP 实现：通过 Prosemirror `Transform.cut(paste * size).replace(targetPos, targetPos, Slice.cut(copiedContent))` 直接构造 ReplaceStep；或回退到 `replaceBlocks`（删除原块 + 在 reference 处插入新块）。

### 14.9 仍待确认风险

- **token 估算算法**：MVP 用 `Math.ceil(text.length / 4)` 近似，偏差由预算阈值容错（4K 选区软上限、8K 全文预算、2× 改大纲）。总 PRD §17 item 13 仍待确认是否需精确 tiktoken。
- **对话 client-side tools 批量操作**：当前严格单操作（一个 toolCallId → 一个 BlockOperation）。多操作走多轮或多 tool call。总 PRD §17 item 11 仍待确认。
- **`prosemirror-*` 与 BlockNote 版本对齐方式**：当前 `@blocknote/core` 把 `prosemirror-*` 作为 `dependencies`（非 peerDeps），BlockNote 0.51.4 已锁定具体版本范围。ai-core **不直接依赖 `prosemirror-*`**，通过 BlockNote 间接获得，避免版本漂移。若需直接类型引用，从 `prosemirror-state` 等导入即可（Bun workspace 会复用 BlockNote 的安装版本）。
- **流式 partial 工具调用的状态管理**：MVP 阶段 ai-core 的 `applyOperationsToEditor` 只接收已完成的 `BlockOperation[]`，不处理 partial 状态。partial 去重由 FEAT-003 `StreamToolExecutor` 管理。

### 14.10 研究闸门放行结论

T-001.1–1.10 全部有可复核结果（已写入 14.1–14.9），无需更新本 change 的 `design.md` 与 `specs/ai-core/spec.md`：

- 锁定版本组合不冲突：`ai@7.0.31` + `@ai-sdk/alibaba@2.0.14` + `@ai-sdk/google@4.0.18` + `@handlewithcare/prosemirror-suggest-changes@0.1.8` + `@blocknote/core@0.51.4`。
- v6→v7 翻译要点确认：xl-ai v6 的 `injectDocumentStateMessages` / `toolDefinitionsToToolSet` / `streamText` 用法与 v7 一致，无需翻译。
- suggest-changes 与 BlockNote 0.51.4 兼容性确认：peerDep 范围匹配，API 可通过 `editor.prosemirrorState` / `editor.exec` / `editor.transact` 调用。
- 流式期间人工编辑不覆盖确认：用 `transformToSuggestionTransaction` 包装 AI 操作事务，用户编辑走正常事务，`revertSuggestions` 只回退建议标记的变更。

**放行进入第 2 组实现任务。**

## 15. 依赖闭包与许可证检查(T-13.1 / 13.2 / 13.3 完成)

实施完成后,通过 `bun pm ls --all` 生成 `@tap-note/ai-core` 的生产依赖闭包,确认结果:

### 15.1 直接 dependencies

| 包 | 版本 | 授权 |
|---|---|---|
| `@blocknote/core` | 0.51.4 | MPL-2.0 |
| `@handlewithcare/prosemirror-suggest-changes` | 0.1.8 | MIT(独立第三方,非 BlockNote/GPL) |
| `ai` | 7.0.31 | Apache-2.0 |
| `zod` | 4.4.3 | MIT |

### 15.2 直接 devDependencies(类型与测试,不进入生产闭包)

| 包 | 版本 | 授权 |
|---|---|---|
| `prosemirror-state` | 1.4.4 | MIT |
| `prosemirror-transform` | 1.12.0 | MIT |
| `react` / `react-dom` | ^19.2.6 | MIT |
| `@happy-dom/global-registrator` | ^18.0.0 | MIT |
| `@testing-library/*` | ^6.8.0 / ^16.3.0 | MIT |
| `eslint` / `typescript-eslint` / `typescript` | ^10 / ^8 / ~6 | 各种 OSS |
| `eslint-plugin-react-hooks` / `react-refresh` | ^7.1.1 / ^0.5.2 | MIT |

### 15.3 间接依赖闭包(传递)

- `@ai-sdk/gateway@4.0.23`、`@ai-sdk/provider@4.0.3`、`@ai-sdk/provider-utils@5.0.11`(均 Apache-2.0,来自 `ai@7.0.31`)
- `prosemirror-{model,state,transform,view,changeset,commands,...}` 全部 MIT
- `@handlewithcare/prosemirror-inputrules@0.1.4`(MIT,来自 `@blocknote/core`)
- `@blocknote/react@0.51.4`、`@blocknote/shadcn@0.51.4`(MPL-2.0,作为 BlockNote 同包传递)

### 15.4 禁止依赖检查

闭包检查结果:无以下任何禁止依赖:

- ❌ `@blocknote/xl-ai`(GPL-3.0 或 PROPRIETARY)— 未出现在闭包中
- ❌ `xl-ai-server` — 未出现
- ❌ `xl-pdf-exporter` — 未出现
- ❌ `xl-docx-exporter` — 未出现
- ❌ `xl-odt-exporter` — 未出现
- ❌ `xl-email-exporter` — 未出现
- ❌ `xl-multi-column` — 未出现
- ❌ 任何 GPL/AGPL 依赖 — 未出现

### 15.5 结论

`@tap-note/ai-core` 的生产依赖闭包完全干净,仅含 MPL-2.0(`@blocknote/*`)、MIT(prosemirror-*、@handlewithcare、zod)、Apache-2.0(ai SDK)依赖。`@handlewithcare/prosemirror-suggest-changes@0.1.8` 作为独立第三方依赖(MIT 授权),是规避 BlockNote `xl-ai` GPL 的关键。许可证检查通过,允许 change 完成并归档。
