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
| AI SDK (`ai`) | 待锁定 | Apache-2.0 | Context7 | transport/UIMessage 类型对齐，实施前锁定 |
| `zod` | 与 monorepo 一致 | MIT | 代码库现状 | — |
| `react` | ^19 | MIT | — | peerDep（类型） |

> 实施前必须用 Context7 查询 AI SDK transport API 与 `@handlewithcare/prosemirror-suggest-changes` 版本兼容性，并以最小端到端示例验证 suggest/apply/revert 与 BlockNote 交互，锁定到 workspace lockfile。

## 12. 备选方案与决策

- 复用 xl-ai 源码：缩短开发但违反授权目标。排除。
- 单一 assistant 包：会混淆内联/对话不同状态机。排除。
- 采纳：三包加共享 core（ai-core + ai-inline + ai-chat），共享 schema/transport/busy，各自状态机/executor。
- token 估算：近似字符数/4（方案草稿，实施前确认是否需精确 tokenizer）。

## 13. 技术风险与待确认

- AI SDK 精确版本与 transport/partial tool call API 未锁定（总 PRD §17 item 5）——实施前阻塞项。
- `@handlewithcare/prosemirror-suggest-changes` 与 BlockNote 0.51.4 的兼容性、流中人工编辑冲突需最小端到端验证（SUB-003 tech.md §6）。
- token 估算算法待确认（总 PRD §17 item 13）。
- 对话 client-side tools 是否支持批量操作（总 PRD §17 item 11，当前严格单操作）。
- `prosemirror-*` 与 BlockNote 的版本对齐方式（peerDep vs dep）待确认。
