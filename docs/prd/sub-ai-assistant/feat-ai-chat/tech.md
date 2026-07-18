# 技术方案：AI 对话助手

## 0. 文档信息

- 功能 ID：FEAT-004；所属 Sub：SUB-003；状态：草稿；类型：混合型；依据：总 PRD v7、SUB-003 `tech.md`、FEAT-002 `tech.md`。

## 1. 当前项目事实与复用点

- `packages/tap-note-ai-chat` 尚不存在。
- `apps/web` 已有 `@workspace/ui` shadcn 组件，可复用聊天相关组件。
- 复用 FEAT-002 的 schema/DocumentStateBuilder/busy/transport/上下文预算。
- 服务端工具 schema 由 FEAT-005 版本化持有；客户端只实现同名 tools 的 `execute`。

## 2. 本 feat 在 sub 中的位置与职责

chat 管理 UIMessage 与浏览器端单操作执行；服务端永远不接收客户端定义的工具 schema，客户端只 execute 同名已声明 tools 并按 `toolCallId` 回传（SUB-003 tech.md §2）。本 feat 不复用 inline 的 StreamToolExecutor。

```text
editor + chatPanel
  -> useChat(transport=/api/ai/chat)
  -> server 声明 client-side tools（不 execute）
  -> LLM 离散 tool call（单 BlockOperation）
  -> 客户端 execute + revision/前置条件校验
  -> editor.insertBlocks/updateBlock/removeBlocks
  -> toolCallId 回传 result -> 多轮
```

## 3. 模块职责与目录范围

```text
packages/tap-note-ai-chat/
├── package.json            # name=@tap-note/ai-chat
├── tsconfig.json
├── tsup.config.ts
└── src/
    ├── index.ts
    ├── tap-note-chat-panel.tsx   # 侧边对话面板
    ├── use-tap-note-chat.ts       # 封装 useChat + transport
    ├── tools/
    │   ├── client-tools.ts        # 同名 tools 的 execute 实现
    │   └── tool-result-bubble.tsx
    ├── context/
    │   ├── context-mode.ts        # 选区/全文/无 三态
    │   └── context-layer.ts       # 复用 ai-core 分层
    ├── i18n/zh-cn.ts
    └── types/
```

## 4. 数据模型、迁移与状态

### 上下文模式

```ts
type ContextMode = "selection" | "full" | "none"
```

- `selection`：经 ai-core `DocumentStateBuilder` 序列化选区；超 4K 前端拦截。
- `full`：序列化全文；≤8K 完整，超预算截断带 `[文档已截断]`，>2× 改发大纲；允许按需读取时暴露 `getDocumentSnapshot`。
- `none`：不发 documentState，不暴露 `getDocumentSnapshot`。

### 客户端 tools

```ts
const clientTools = {
  insertBlock: { execute: async ({ block, referenceBlockId, baseDocumentRevision }) => { ... } },
  updateBlock: { execute: async ({ targetBlockId, block, baseDocumentRevision }) => { ... } },
  deleteBlock: { execute: async ({ targetBlockId, baseDocumentRevision }) => { ... } },
  replaceBlocks: { execute: async ({ targetBlockIds, blocks, baseDocumentRevision }) => { ... } },
  moveBlock: { execute: async ({ targetBlockId, referenceBlockId, position, baseDocumentRevision }) => { ... } },
  getDocumentSnapshot: { execute: async ({ fromBlock, maxBlocks, maxTokens }) => { ... } },
}
```

每个 `execute` 先校验 `baseDocumentRevision` 与块前置条件，冲突则返回可重试冲突结果；成功调用 `editor.insertBlocks/updateBlock/removeBlocks`。

### busy 集成

`busy.acquire("chat")` 触发时；`busy.release()` 在完成/中止/失败/卸载时。无持久化、无迁移。

## 5. 接口与组件接口

```ts
interface TapNoteChatAssistant {
  panel: TapNoteChatPanel          // 侧边面板组件
  useChat: UseTapNoteChat
}

function createTapNoteChatAssistant(options: {
  transport: Transport
  documentStateBuilder: DocumentStateBuilder
  editor: BlockNoteEditor
  model?: string
  getAuthHeaders?: () => Record<string, string>
  dictionary?: Partial<TapNoteDictionary>
}): TapNoteChatAssistant
```

`useTapNoteChat` 封装 AI SDK `useChat`，注入 transport、`clientTools`、上下文模式与 documentState。

## 6. 核心流程与错误处理

```text
打开 ChatPanel + 选上下文模式
  -> 输入消息 -> busy.acquire("chat")？失败 -> 输入框置灰
  -> useChat 发送 messages + documentState + documentRevision
  -> server 声明 client-side tools 不 execute 返回 UIMessageStream
  -> LLM 返回离散 tool call（单 BlockOperation）
  -> 客户端 execute：校验 baseDocumentRevision + 块前置条件
    -> 冲突 -> 返回可重试冲突结果（气泡展示）
    -> 成功 -> editor.insertBlocks/updateBlock/removeBlocks
  -> 以 toolCallId 回传 tool result 进入后续消息
  -> 多轮；busy.release
```

错误处理：
- 选区超 4K：前端拦截提示，不发请求。
- 全文超预算：截断/大纲（ai-core 分层）。
- revision/前置条件冲突：不执行，返回可重试冲突结果。
- 工具 execute 失败：气泡展示失败，可重试或继续多轮。
- 流中断：中止当前轮，释放 busy，不破坏已执行成功的操作。
- `getDocumentSnapshot` 超预算：受限返回，不无限读取。

## 7. 权限、安全、输入校验与隐私

- transport 不持 Key；`getAuthHeaders` 由集成方注入短期 JWT。
- 客户端只 execute 同名 tools，不提交或覆盖服务端工具 schema。
- 所有 tool 输入经 FEAT-002 Zod `.parse()` 校验。
- `baseDocumentRevision` + 块前置条件强制校验；冲突不执行。
- 不引用模式不暴露 `getDocumentSnapshot`。
- 不记录正文到日志（日志在 FEAT-005）。
- client-side tools 前期不限制 `deleteAll` 类危险操作（总 PRD §17 item 14，接受 prompt injection 风险，P2 候选加输入校验/数量上限）。

## 8. 测试策略

- 单元测试：上下文三态、分层策略、revision/前置条件冲突、busy acquire/release。
- 契约测试：client-side tools 与服务端 `ChatToolSet` schema 对齐。
- 集成测试：`useChat` 流式 text/tool part、tool execute、`toolCallId` 回传、多轮。
- 组件测试：ChatPanel 显隐、气泡状态、输入框置灰、截断提示。
- E2E：选区/全文/不引用三场景（由 FEAT-006 覆盖）。

## 9. 发布、兼容与回滚

- 独立包；`dependencies` 不含 `@blocknote/xl-ai`。
- 公开 `createTapNoteChatAssistant` API 以 semver 维护；破坏性变更同 FEAT-007 发布说明。
- 故障可禁用助手或回滚包，不回滚用户文档。
- MVP 阶段 workspace 直接消费，暂不发布 npm。

## 10. 类似产品与开源方案调研

| 来源 | 日期 | 可借鉴 | 限制 |
|---|---|---|---|
| Context7 `/websites/ai-sdk_dev` | 2026-07-17 | `useChat`、`DefaultChatTransport`、client-side tools `execute`/tool result 回传、UIMessage part 状态 | 精确版本/API 须实施前锁定 |
| Cursor Chat / GitHub Copilot Chat | 2026-07-17 | 侧边对话面板、引用选区/文件作上下文、离散工具调用、多轮上下文 | 闭源，仅体验对标 |
| BlockNote `xl-ai` | 2026-07-17 | client-side tools 模式参考 | GPL；不复制源码 |

## 11. 第三方依赖、版本与 Context7 记录

| 包 | 版本 | 授权 | 来源 | 备注 |
|---|---|---|---|---|
| `@tap-note/ai-core` | workspace | 自有 | FEAT-002 | 复用 schema/builder/busy/transport |
| AI SDK React/UI 包 | 待锁定 | Apache-2.0 | Context7 | `useChat`/client-side tools/`toolCallId` 回传；实施前锁定 |
| `@workspace/ui` | workspace | MIT | 代码库现状 | shadcn 聊天组件 |
| `@blocknote/core` | 0.51.4 | MPL-2.0 | sub tech.md | editor API |
| `react` | ^19 | MIT | — | peerDep |

> 实施前必须用 Context7 查询 AI SDK `useChat` 与 client-side tools `execute`/tool result 回传的精确 API，并以最小端到端示例验证离散 tool call + 编辑器写入 + 多轮，锁定到 workspace lockfile。

## 12. 备选方案与决策

- 备选 A：复用 inline 的 StreamToolExecutor。排除：对话场景天然逐条展示、可解释，离散单操作更合适（总 PRD v2 决策）。
- 备选 B：服务端 execute 编辑器操作。排除：服务端无法触达浏览器编辑器实例，且破坏「客户端执行」契约。
- 采纳：服务端声明版本化 client-side tools，客户端 execute 并按 `toolCallId` 回传。
- 复用升级 approval agent vs 新建 chat 路由：总 PRD v2 决策新建独立 `/api/ai/chat`，approval 保留为独立示例。

## 13. 技术风险与待确认

- AI SDK 精确版本与 client-side tools `execute`/tool result 回传 API 未锁定（总 PRD §17 item 5）——实施前阻塞项。
- 是否支持批量操作（总 PRD §17 item 11，当前严格单操作）。
- token 估算算法待确认（总 PRD §17 item 13）。
- `needsApproval` 审批开关为 P2 候选，当前不实现（总 PRD §5.2）。
