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

## 14. 研究闸门结论（FEAT-004 add-ai-chat T-1.1–1.7 完成）

本节为 OpenSpec change `add-ai-chat` 任务 1.1–1.7 的可复核结论。研究阶段完成后锁定以下事实，后续实现严格基于此。**重大订正**:FEAT-002 ai-core tech.md §14.4 已记录 v7 client-side tools 的真实模式(`onToolCall` + `addToolOutput`,非 `tools: { execute }`),本 change 原 design.md Decision 2/11 假设有误,已在 design.md 修订。

### 14.1 锁定版本组合(复用 FEAT-002 §14.1)

| 包 | 版本 | 授权 | 备注 |
|---|---|---|---|
| `ai` | `7.0.31` | Apache-2.0 | FEAT-002 已锁定,本 change 复用 |
| `@ai-sdk/react` | `7.0.x` | Apache-2.0 | peerDep `ai@7.0.x`,提供 `useChat` |
| `@ai-sdk/alibaba` | `2.0.14` | Apache-2.0 | FEAT-005 已在 server-api 引入 |
| `@ai-sdk/google` | `4.0.18` | Apache-2.0 | FEAT-005 已在 server-api 引入(可选) |
| `@blocknote/core` | `0.51.4` | MPL-2.0 | FEAT-001 已引入 |
| `@blocknote/react` | `0.51.4` | MPL-2.0 | FEAT-001 已引入 |
| `@tap-note/ai-core` | workspace | 自有 | 复用 schema/builder/busy/transport/layerContext |
| `zod` | 与 monorepo 一致 | MIT | peerDep `^3.25.76 || ^4.1.8` |
| `react` / `react-dom` | `^19` | MIT | peerDep |

### 14.2 `useChat` hook v7 精确 API(T-1.1 / 1.2 / 1.3)

通过 Context7 `/websites/ai-sdk_dev` 查询与复用 FEAT-002 §14.2 结论:

- **`useChat(options)`** 返回 `{ messages, input, setInput, sendMessage, abort, status, addToolOutput, ... }`
- **`sendMessage(message, { body, headers })`** 支持 per-call 动态 body 与 headers:
  - `body` 字段会被合并到 HTTP request body,服务端通过 `await req.json()` 读取
  - 用于 per-request 注入 `documentState`、`documentRevision`、`model`、`contextMode`(动态字段)
  - 不依赖 transport 的 static body,transport 只配置 `api`、静态 `headers`、`credentials`
- **`transport: new DefaultChatTransport({ api, headers, body, credentials })`**:静态配置,创建时设置 `api: "/api/ai/chat"`、可选 `headers`(如 `Authorization` 由集成方 `getAuthHeaders` 注入)
- **`messages: UIMessage[]`**:`UIMessage = { id, role, parts: Part[] }`,`content` 属性在 v5+ 已移除,统一用 `parts` 数组
- **`Part` 类型**:
  - `{ type: "text", text }` — 文本 part
  - `{ type: "reasoning", text }` — 推理 part
  - `{ type: "tool-call", toolCallId, toolName, input, state }` — 工具调用 part(`state: "input-streaming" | "input-available" | "output-available" | "output-error"`)
  - `{ type: "tool-result", toolCallId, toolName, output, state }` — 工具结果 part
  - `{ type: "data-*", ... }` — 自定义数据 part
- **`status`**:`"ready" | "submitted" | "streaming" | "ready" | "error"` 等;`"submitted"` 表示已发送等待响应,`"streaming"` 表示流式接收中
- **`abort()`**:中断当前流式请求,保留已收到 messages 与已成功 tool-call 结果

### 14.3 client-side tools `onToolCall` + `addToolOutput` 模式(T-1.2 关键订正)

通过 Context7 `/websites/ai-sdk_dev` 查询确认(参考 https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage 与 https://ai-sdk.dev/docs/troubleshooting/tool-invocation-missing-result):

v7 `useChat` 的 client-side tools **不使用 `tools: { toolName: { execute } }` 模式**(原 design.md Decision 2 假设有误),而是用以下模式:

```tsx
const { messages, sendMessage, addToolOutput } = useChat({
  transport: new DefaultChatTransport({ api: '/api/ai/chat' }),
  // 自动提交 tool result 给模型,触发下一轮
  sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  // 处理 client-side tool 调用
  onToolCall: async ({ toolCall }) => {
    const { toolName, toolCallId, input } = toolCall
    try {
      const result = await executeClientTool(toolName, input) // 调用 editor API
      // 关键:不能 await addToolOutput,否则死锁
      addToolOutput({ tool: toolName, toolCallId, output: result })
    } catch (err) {
      addToolOutput({
        tool: toolName,
        toolCallId,
        state: 'output-error',
        errorText: err instanceof Error ? err.message : String(err),
      })
    }
  },
})
```

关键约束:
- **不能在 `onToolCall` 内 `await addToolOutput`**,否则死锁
- `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls`(来自 `ai` 包)自动触发下一轮请求,把 tool result 提交给模型
- `addToolOutput({ tool, toolCallId, output })` 把 tool result 注入到对应 `toolCallId` 的 tool-call part,state 转为 `output-available`
- `addToolOutput({ tool, toolCallId, state: 'output-error', errorText })` 报告错误,state 转为 `output-error`
- 服务端 `streamText` 的 `tools` 选项声明 schema(只含 `description` + `inputSchema`,不含 `execute`);客户端 `useChat` 不重复声明 schema,只通过 `onToolCall` 处理执行

**对本 change 的影响**:
- `useTapNoteChat` hook 不接收 `clientTools` 选项,改为接收 `onToolCall` 回调的实现(`executeClientTool(toolName, input)`)
- 冲突重试「仅重试该 toolCallId」:重新调用 `executeClientTool(toolName, input)` + 用最新 revision,成功后调 `addToolOutput` 更新该 toolCallId 的 output
- `getDocumentSnapshot` 可见性:服务端在 `streamText` 调用前根据请求 body 的 `contextMode` 过滤 tools 声明(`none`/`selection` 模式不声明 `getDocumentSnapshot`),客户端 `onToolCall` 只需处理 5 个核心 tools + 在 `full` 模式下处理 `getDocumentSnapshot`

### 14.4 `UIMessage.parts` 渲染(T-1.3)

通过 Context7 与 FEAT-002 §14.2/14.4 确认:

- partial tool-call input 通过 `tool-input-start` → `tool-input-delta`(JSON delta 字符串)→ `tool-input-end` → `tool-call`(最终完整 input)chunks 增量到达
- 客户端 `useChat` 自动累积 partial,UI 渲染时:
  - `state: "input-streaming"` — 显示 `◔/◑/◐` 输入中动画
  - `state: "input-available"` — 输入完整,等待 execute
  - `state: "output-available"` — execute 成功,显示 `✓` + 结果气泡
  - `state: "output-error"` — execute 失败,显示 `⚠` 或 `✗` + 重试按钮
- 工具结果气泡独立于 UIMessage.parts 渲染(在 AI 消息气泡下方独立组件),通过 `toolCallId` 关联

### 14.5 provider peerDep 兼容性(T-1.4,复用 FEAT-002 §14.5)

- `ai@7.0.31` peerDep:`zod: ^3.25.76 || ^4.1.8`
- `@ai-sdk/alibaba@2.0.14` peerDep:`zod: ^3.25.76 || ^4.1.8`
- `@ai-sdk/google@4.0.18` peerDep:`zod: ^3.25.76 || ^4.1.8`
- 三者共享 `@ai-sdk/provider@4.0.3` + `@ai-sdk/provider-utils@5.0.11`,peerDep 完全一致,可安全锁定组合

### 14.6 xl-ai client-side tools 重写要点(T-1.5,复用 FEAT-002 §14.3)

通过阅读 `resource/BlockNote/packages/xl-ai/src/streamTool/vercelAiSdk/` 源码:

- xl-ai v6 已使用 v7 形状的 UIMessage parts(`{ type: "text", text }`),无需翻译
- v6 `ClientSideTransport implements ChatTransport<UI_MESSAGE>` 的 `sendMessages` + `reconnectToStream` 模式与 v7 `ChatTransport` 接口同形状
- v6 的 `injectDocumentStateMessages` 把 documentState 注入为一条 `assistant` 消息携带多个 `text` parts,紧贴在原 user 消息之前 — FEAT-002 已实现并复用
- v6 `ToolLoopAgent` 在 v7 保留,`needsApproval` 已废弃改 `toolApproval` — 不影响本 change(对话助手不用 Agent)

### 14.7 研究闸门放行结论(T-1.7)

T-1.1–1.7 全部有可复核结果(已写入 14.1–14.6),无需进一步研究。**关键修订**:
- 原 design.md Decision 2 假设 `tools: { execute }` 模式 — **订正为 `onToolCall` + `addToolOutput` 模式**(详见 14.3)
- 原 design.md Decision 11 假设客户端 useChat 的 `tools` 选项动态暴露 getDocumentSnapshot — **订正为服务端按请求 body `contextMode` 过滤 tools 声明**

design.md、specs/ai-chat/spec.md、tasks.md 已同步修订。后续实现严格基于此。

### 14.8 依赖闭包与许可证检查(FEAT-004 收尾)

通过 `bun pm ls --all` 扫描 `@tap-note/ai-chat` 的依赖闭包,确认:

| 依赖 | 版本 | 授权 | 来源 |
|---|---|---|---|
| `@blocknote/core` | 0.51.4 | MPL-2.0 | `apps/server-api`/`packages/tap-note-editor` 间接引入 |
| `@blocknote/react` | 0.51.4 | MPL-2.0 | 同上 |
| `@ai-sdk/react` | 4.0.34 | Apache-2.0 | `packages/tap-note-ai-chat` peerDep+devDep |
| `ai` | 7.0.31 | Apache-2.0 | 间接引入(provider 共享) |
| `@ai-sdk/alibaba` | 2.0.14 | Apache-2.0 | 间接引入(可选) |
| `@ai-sdk/google` | 4.0.18 | Apache-2.0 | 间接引入(可选) |
| `@tap-note/ai-core` | workspace | 自有 | workspace:* |
| `zod` | 与 monorepo 一致 | MIT | peerDep |
| `react` / `react-dom` | ^19 | MIT | peerDep |

**禁止依赖扫描结论**:
- 闭包不含 `@blocknote/xl-ai`、`@blocknote/xl-ai-server`、`@blocknote/xl-pdf-exporter`、`@blocknote/xl-docx-exporter`、`@blocknote/xl-multi-column`
- 闭包不含任何 GPL-3.0、AGPL-3.0 或专有许可证依赖
- 满足总 PRD §10 授权规则,可继续推进到 archive
