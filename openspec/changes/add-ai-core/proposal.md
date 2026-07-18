## Why

FEAT-001 editor 已交付,但内联助手(FEAT-003)和对话助手(FEAT-004)都还没有共享的协议层。如果两个助手各自实现 documentState 序列化、BlockOperation schema、editor 操作应用、transport、busy 状态和上下文预算,会出现重复代码、写入语义不一致、revision 冲突处理分歧。现在先交付 `@tap-note/ai-core` 这个共享核心,可以让两类助手在统一契约上各自演进,并为集成开发者提供自定义助手的入口。

## What Changes

- 新增 `@tap-note/ai-core` workspace 包,位于 `packages/tap-note-ai-core`,提供内联与对话助手共享的协议、schema、执行器、transport 工厂和会话级状态。
- 提供 `BlockOperation` Zod schema + 类型,覆盖 `insertBlock`/`updateBlock`/`deleteBlock`/`replaceBlocks`/`moveBlock`,所有操作携带 `baseDocumentRevision` 与目标块 ID/前置条件。
- 提供 `DocumentStateBuilder`,把编辑器受影响块(含选区)序列化为 `{ format: "blocks-json", schemaVersion, documentRevision, blocks, selection? }`。
- 提供 `injectDocumentStateMessages(messages, documentState)`,适配 AI SDK v7 的 `UIMessage.parts` 数组结构,把文档状态注入 AI 消息。
- 提供 `applyOperationsToEditor(editor, operations, { mode })`,经 `@handlewithcare/prosemirror-suggest-changes` 的 `suggestChanges`/`applySuggestions`/`revertSuggestions` 实现可回退应用。
- 提供 `createServerTransport({ baseUrl, model, getAuthHeaders? })` 与 `createProxyTransport(...)`,封装 AI SDK v7 的 `DefaultChatTransport` 对象,不持有 LLM Key。
- 提供 `createAIBusyState()`,编辑器会话级 AI 互斥状态,支持 `acquire(type)`/`release()`/`subscribe`。
- 提供 `estimateTokens(text)` 与上下文体积分层处理(选区 4K 软上限、全文 8K 预算、2× 改大纲)。
- 提供 zh-CN 字典基础与共享类型。
- 所有公开输入用 Zod `.parse()` 校验,非法输入抛 ZodError 不静默。
- 锁定并验证 AI SDK v7(`ai@7.0.x`)的 `DefaultChatTransport`/`streamText`/`UIMessage`/`UIMessageStream` 精确 API(总 PRD v11 决策)。
- 验证 `@handlewithcare/prosemirror-suggest-changes@0.1.8` 与 BlockNote 0.51.4 的兼容性。
- 检查生产依赖闭包,确保不引入 `@blocknote/xl-ai` 或任何 GPL/AGPL 依赖。
- 为包建立 `bun:test` 测试基础设施,覆盖 schema 校验、预算分层、busy acquire/release、revision 冲突、suggest-changes 集成。

## Capabilities

### New Capabilities

- `ai-core`: 提供 AI 助手共享的 BlockOperation schema、DocumentStateBuilder、操作应用器、transport 工厂、会话级 busy 状态和上下文预算分层。

### Modified Capabilities

无。当前 `openspec/specs/` 只有 `editor`(FEAT-001 已归档),`ai-core` 是全新能力。

## Impact

- 新增 `packages/tap-note-ai-core` 包及其源码、测试、配置和文档。
- 新增并锁定依赖:`@blocknote/core@0.51.4`(类型与 blocks 操作)、`@handlewithcare/prosemirror-suggest-changes@0.1.8`、AI SDK v7(`ai@7.0.x`)、`prosemirror-{state,view,model,transform}`、`zod`。
- 根 workspace 增加测试编排所需脚本和 Turbo task(已在 FEAT-001 建立,本 change 复用)。
- 不修改 `apps/web`、`apps/server-api` 或 `packages/tap-note-editor` 的运行时代码。
- 不实现内联状态机、AIMenu/AIToolbarButton UI(属 FEAT-003)、聊天面板 UI(属 FEAT-004)、服务端 streamText/JWT/模型路由(属 FEAT-005)。
- npm 发布构建配置仍属于后续 FEAT-007;MVP 阶段 workspace 直接消费源码。
