## Context

FEAT-001 editor 已交付并归档,`packages/tap-note-editor` 提供 `TapNoteEditor` 组件与 editor 实例。FEAT-003(内联)与 FEAT-004(对话)即将开始,它们共享 documentState 序列化、BlockOperation schema、editor 操作应用、transport、busy 状态和上下文预算。如果没有共享核心,两个助手各自实现会导致写入语义不一致、revision 冲突处理分歧和重复代码。

当前仓库状态:
- `packages/tap-note-ai-core` 尚不存在。
- `apps/server-api` 有 v6 AI SDK 脚手架(`ToolLoopAgent`/`createAgentUIStreamResponse`),但 v7 需重写(总 PRD v11 决策)。
- `resource/BlockNote` submodule 的 `xl-ai` 基于 AI SDK v6,我们仅参考思路,实现时翻译 v6→v7 差异。
- 根 workspace 已有 `bun:test` + Turbo test task 基础设施(FEAT-001 建立)。

总 PRD v11 决策锁定 AI SDK v7,关键 breaking changes:`needsApproval`→`toolApproval`、`UIMessage.content`→`parts` 数组、`DefaultChatTransport` 封装对象。但 v7 精确 API 仍待 Context7 + 最小示例验证(§17 item 5 部分决策)。

## Goals / Non-Goals

**Goals:**

- 创建可被 workspace 消费的 `@tap-note/ai-core` 源码包。
- 用 Zod 定义 `BlockOperation` 与 `DocumentState` schema,服务端与客户端共享。
- 用 `@handlewithcare/prosemirror-suggest-changes` 实现 suggest/apply/revert,规避 BlockNote xl-ai GPL。
- 封装 AI SDK v7 的 `DefaultChatTransport`,不持有 LLM Key。
- 提供会话级 `AIBusyState`,支持互斥与订阅。
- 提供上下文体积分层(选区 4K/全文 8K/2× 大纲),不静默截断用户显式选择。
- 在最小端到端示例中验证 AI SDK v7 + suggest-changes + BlockNote 0.51.4 的实际兼容性。
- 用 `bun:test` 建立单元测试,覆盖 schema、预算、busy、revision 冲突。

**Non-Goals:**

- 不实现内联状态机、AIMenu/AIToolbarButton、StreamToolExecutor(属 FEAT-003)。
- 不实现聊天面板 UI、`useChat` 集成(属 FEAT-004)。
- 不实现服务端 streamText/模型路由/JWT/限流(属 FEAT-005)。
- 不实现 `getDocumentSnapshot` client-side tool 的 execute 逻辑(属 FEAT-004);ai-core 只定义其受预算约束的接口。
- 不实现 npm 发布构建或 tsup(属 FEAT-007)。
- 不引入 `@blocknote/xl-ai` 源码或依赖。
- 不记录正文到日志(日志在 FEAT-005)。

## Decisions

### 1. 先验证 AI SDK v7 与 suggest-changes 兼容性,再实现核心

T-001 是硬闸门。实现者必须通过 Context7 查询 AI SDK v7 的 `DefaultChatTransport`/`streamText`/`UIMessage`/`UIMessageStream` 精确 API,并通过最小端到端示例验证 `@handlewithcare/prosemirror-suggest-changes@0.1.8` 与 BlockNote 0.51.4 的兼容性,再执行后续实现任务。

备选方案是直接按 PRD 描述的 API 形状实现。放弃原因是 v6→v7 是 major 升级,API 形状可能变化,带着未知 API 实现会让所有任务建立在错误假设上(类似 FEAT-001 的 `@source` 路径问题)。

### 2. 用 Zod 定义 schema,服务端与客户端共享同一模块

`BlockOperation` 与 `DocumentState` 用 Zod 定义,`.parse()` 校验。FEAT-005 服务端与 FEAT-003/004 客户端引用同一 schema 模块,不允许各自定义等价 schema。

备选方案是服务端与客户端各自定义等价 schema。放弃原因是会导致两端 schema 漂移,revision/前置条件校验不一致。

### 3. 用 @handlewithcare/prosemirror-suggest-changes 规避 GPL

`applyOperationsToEditor` 经 `suggestChanges`/`applySuggestions`/`revertSuggestions` 实现可回退应用。这个包是独立第三方(非 BlockNote/GPL),是规避 `@blocknote/xl-ai` GPL 的关键。

备选方案是 fork xl-ai 的 suggest 逻辑。放弃原因是会触发 GPL 传染,违反授权目标。备选方案是自己实现 prosemirror transaction 管理。放弃原因是工作量大,且 suggest-changes 已解决 accept/reject/revert 的复杂事务边界问题。

### 4. transport 封装 DefaultChatTransport 对象,不持有 Key

`createServerTransport` 返回 AI SDK v7 的 `DefaultChatTransport` 实例(或等价封装),携带 `baseUrl`/`model`/`getAuthHeaders`。`getAuthHeaders` 由集成方提供,注入短期 JWT。transport 不接触 LLM API Key。

备选方案是 transport 直接持有 provider 凭据。放弃原因是会暴露 Key 到客户端,违反总 PRD §9 安全规则。

### 5. busy state 用 useSyncExternalStore 友好接口

`createAIBusyState` 返回 `{ isBusy, subscribe, acquire, release }`。`isBusy` 是快照值,`subscribe` 返回 unsubscribe 函数,适配 React 19 的 `useSyncExternalStore`(FEAT-001 editor 已用此模式消费 busy)。

备选方案是用 React state 管理 busy。放弃原因是 busy 状态需要跨包共享(内联与对话助手),不能放在 React 树内,必须是框架无关的纯 JS 对象。

### 6. 上下文体积分层用纯函数,不依赖 DOM

`layerContext(documentState, { budgets })` 是纯函数,返回 `{ kind: "selection-blocked" | "full" | "truncated" | "outline", data }`。调用方(助手包)根据 `kind` 决定是否发请求、如何展示。

备选方案是把分层逻辑放在 transport 内自动处理。放弃原因是对话与内联对"选区超限"的响应不同(内联自动取受影响块,对话需要用户显式选择引用模式),分层逻辑必须由调用方控制。

### 7. 测试不依赖真实 LLM 或网络

所有测试用 mock transport 或纯 schema/预算/busy 测试。suggest-changes 集成测试用真实的 BlockNote editor 实例 + happy-dom,但不发起网络请求。

### 8. 目录结构遵循 feat tech.md §3

```text
packages/tap-note-ai-core/
├── package.json
├── tsconfig.json
├── eslint.config.js
├── bunfig.toml
├── test/
└── src/
    ├── index.ts
    ├── types/{schema.ts, type.ts, index.ts}
    ├── document-state-builder.ts
    ├── inject-document-state.ts
    ├── apply-operations.ts
    ├── transport/{server-transport.ts, proxy-transport.ts}
    ├── busy-state.ts
    ├── context-budget/{estimate-tokens.ts, layer.ts}
    ├── i18n/zh-cn.ts
    └── errors/
```

## Risks / Trade-offs

- [AI SDK v7 API 与 PRD 描述不一致] → T-001 必须阻塞 T-003;若 v7 `DefaultChatTransport`/`UIMessage` 形状变化,先更新本 design 与 feat tech.md,不带着错误 API 实现。
- [`@handlewithcare/prosemirror-suggest-changes` 与 BlockNote 0.51.4 不兼容] → T-002 必须最小端到端验证 suggest/apply/revert;若不兼容,评估替代方案(自研 transaction 管理 或 升级/降级 suggest-changes 版本),更新 design。
- [`@ai-sdk/alibaba@2`/`@ai-sdk/google@4` 与 `ai@7` peerDep 不兼容] → T-001 核查 peerDep 范围;若不兼容,锁定兼容的 provider 版本组合,记录到 tech.md。
- [token 估算算法不准导致上下文超限或浪费] → 近似字符数/4 作为 MVP 方案(总 PRD §17 item 13 仍待确认);估算偏差由分层策略的预算阈值容错,不追求精确 tiktoken。
- [revision 冲突处理在内联与对话间不一致] → ai-core 定义统一的 revision 比较与冲突返回类型,内联的"回退"与对话的"可重试冲突结果"都基于同一 `ConflictResult` 类型,各自包决定如何呈现。
- [suggest-changes 在流式 partial 工具调用中途的状态管理] → MVP 阶段内联流式由 FEAT-003 的 StreamToolExecutor 管理 partial 去重,ai-core 的 applier 只接收已完成的 operations 数组,不处理 partial 状态。
- [新增依赖闭包意外引入 GPL/AGPL 或 xl-ai] → 安装后立即执行依赖树检查,任务收尾前再次复核。

## Migration Plan

这是新能力,没有现有运行时数据或公开 API 需要迁移。

1. 先完成研究闸门(T-001/T-002),锁定 AI SDK v7 与 suggest-changes 兼容性。
2. 创建包并实现 schema、builder、applier、transport、busy、预算、字典。
3. 通过 typecheck、lint、单元测试和许可证检查。
4. FEAT-003/004 接入时,通过跨包类型测试校准助手接口。

回滚方式是移除 `packages/tap-note-ai-core`;新包为纯库,不产生数据迁移或持久化兼容问题。

## Open Questions

- AI SDK v7 的 `DefaultChatTransport`/`streamText`/`UIMessage`/`UIMessageStream` 精确 API 形状,由 T-001 的 Context7 查询与最小示例决定。
- `@handlewithcare/prosemirror-suggest-changes@0.1.8` 与 BlockNote 0.51.4 的实际兼容性,由 T-002 的最小端到端示例决定。
- token 估算算法:近似字符数/4 vs 精确 tiktoken(总 PRD §17 item 13 仍待确认;MVP 用近似,偏差由预算阈值容错)。
- 对话 client-side tools 是否支持批量操作(总 PRD §17 item 11;当前严格单操作,多操作走多轮)。
- `prosemirror-*` 与 BlockNote 的版本对齐方式(peerDep vs dep)。
- `@ai-sdk/alibaba@2`/`@ai-sdk/google@4` 与 `ai@7` 的 peerDep 兼容性。
- `ToolLoopAgent`/`createAgentUIStreamResponse` 是否在 v7 保留(影响 FEAT-005 审批代理重写,不影响本 change,但 T-001 顺带核查)。
