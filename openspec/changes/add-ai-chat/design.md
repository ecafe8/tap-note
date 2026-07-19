## Context

FEAT-002 ai-core 已归档,提供 `BlockOperation`/`DocumentState`/`ConflictResult` Zod schema、`createDocumentStateBuilder`、`injectDocumentStateMessages`、`applyOperationsToEditor`(suggest/apply/revert)、`createAIBusyState`、`createServerTransport`/`createProxyTransport`、`layerContext`/`estimateTokens`、`aiCoreDictionaryZhCN`/`mergeDictionary`。FEAT-005 ai-backend 已归档,提供 `POST /api/ai/chat` 端点(服务端声明版本化 client-side tools `ChatToolSet` schema,不 execute)与 `GET /api/ai/models`。FEAT-003 ai-inline 已归档,验证了 busy 互斥、suggest-changes 链路与 v7 `Chat` 类 + `DefaultChatTransport` 集成。`packages/tap-note-editor` 已暴露 `TapNoteChatAssistant` 接口(`{ mount, unmount }`)与 `aiBusyState`/`chatAssistant` 注入点。

当前缺失:
- `packages/tap-note-ai-chat` 尚不存在。
- 侧边 Cursor/Copilot Chat 式对话面板、上下文三态引用、离散工具调用作用于编辑器、多轮对话与冲突重试工作流。
- BlockNote `xl-ai` 基于 v6 AI SDK 且 GPL 授权,不能直接使用;需参考其 client-side tools 模式思路自行重写,不复制其源码。

## Goals / Non-Goals

**Goals:**

- 创建 `@tap-note/ai-chat` workspace 包,提供 `createTapNoteChatAssistant` 入口函数。
- 返回的 `TapNoteChatAssistant` 实现 `packages/tap-note-editor` 已定义的 `{ mount, unmount }` 接口,并扩展 `panel` 字段返回 `TapNoteChatPanel` 组件引用。
- `TapNoteChatPanel` 位置无关,最小宽度 320px,由集成方放置在任意区域;包不导出抽屉开关/布局容器组件。
- `useTapNoteChat` hook 封装 AI SDK v7 `useChat` + ai-core `createServerTransport`,per-request 注入 `documentState` 与 `documentRevision`。
- 客户端 tools `execute` 实现 6 个工具(`insertBlock`/`updateBlock`/`deleteBlock`/`replaceBlocks`/`moveBlock`/`getDocumentSnapshot`),每个 `execute` 校验 `baseDocumentRevision` 与块前置条件,冲突返回 ai-core `ConflictResult`(可重试)。
- 工具结果气泡:tool-call 输入状态(`◔/◑/◐`)嵌入 AI 消息 UIMessage.parts;tool 结果(成功/冲突/前置失败/错误)用独立气泡作回执,冲突可「仅重试该 toolCallId」用最新 revision。
- 上下文三态 segmented(选区/全文/无,默认 `无`);选区引用经 ai-core `DocumentStateBuilder` 序列化,发送前编辑器侧保留高亮 + 消息气泡 chip,发送后清除编辑器侧高亮保留 chip 作为审计回执。
- 复用 ai-core 的 `layerContext`/`estimateTokens` 实现选区超 4K 拦截、全文 8K 截断/>2× 大纲;`none` 不发 documentState,不暴露 `getDocumentSnapshot`。
- 与 inline 共享 `aiBusyState`:触发前 `busy.acquire("chat")`,完成/中止/失败/卸载时 `busy.release`;任一 AI 进行中时另一助手入口禁用。
- 默认 zh-CN 字典,**扩展** ai-core `AICoreDictionary`(不重复定义已有字段),可被集成方替换。
- 消费 FEAT-005 `POST /api/ai/chat` 与 `GET /api/ai/models` 端点。
- `apps/web` demo 新增 sidemenu + `/inline`、`/chat`、`/both` 三路由作为 example;A4 纸面样式与右侧可开合抽屉布局属 demo 自有,不在 ai-chat/editor 包范围内。

**Non-Goals:**

- 不修改 `packages/tap-note-editor`、`packages/tap-note-ai-core`、`packages/tap-note-ai-inline`、`apps/server-api` 的运行时代码。
- 不引入 `@blocknote/xl-ai` 或任何 GPL/AGPL 依赖。
- 不实现 `needsApproval` 审批开关(P2 候选,总 PRD §5.2)。
- 不实现批量操作(严格单次单操作,总 PRD §17 item 11)。
- 不实现移动端窄屏 sheet(由集成方按宿主应用实现,ui.md §5 已说明)。
- 不实现 npm 发布构建(MVP 阶段 workspace 直接消费)。
- 不在 ai-chat 包内实现 A4 纸面样式与抽屉开关(属 apps/web demo example)。
- 不在 ai-chat 包内实现模型选择 UI(由 demo 提供,ai-chat 只接收 `model` 字符串)。

## Decisions

### 1. ai-chat 包位置无关,只导出 ChatPanel 本体

`@tap-note/ai-chat` 只导出 `TapNoteChatPanel` React 组件、`createTapNoteChatAssistant` 入口与 `useTapNoteChat` hook;不导出抽屉开关、布局容器、sidemenu 等组件。ChatPanel 内部用 `min-width: 320px` 保证可用性,根容器暴露 `data-tap-note-chat-panel` 数据属性供集成方 CSS 选择器覆盖。

备选:在 ai-chat 包内同时导出 `<ChatDrawer>` 包装组件(含开关/位置/动画)。放弃原因是会绑定特定布局模式,违反"位置无关"目标;集成方布局需求多样(右侧抽屉/左侧/浮动/独立路由),由集成方应用层实现更灵活。

### 2. 用 AI SDK v7 `useChat` hook 而非 `Chat` 类

对话助手用 `@ai-sdk/react` v7 的 `useChat` hook 管理与服务端的通信,而非内联使用的 `Chat` 类:
- `useChat` 绑定 React state,适合在 React 组件(`TapNoteChatPanel`)内使用,自动管理 messages 状态、流式 chunk 增量、tool-call 状态
- `useChat` 的 `transport` 选项接收 ai-core `createServerTransport` 创建的 `DefaultChatTransport` 实例
- per-request 的 `documentState` 通过 `sendMessage(message, { body: { documentState, documentRevision } })` 动态注入到请求 body
- client-side tools 通过 `useChat` 的 `tools` 选项传入,`execute` 在浏览器内调用 `editor.insertBlocks/updateBlock/removeBlocks`

备选 A:用 `Chat` 类(与内联一致)。放弃原因是 `Chat` 类不绑定 React state,需要手动同步 messages 到 React state 渲染,增加复杂度。
备选 B:直接用 `fetch` + 手动 SSE 解析。放弃原因是 v7 UIMessage stream 协议解析复杂,`useChat` 已内置且类型安全。

### 3. 工具结果气泡独立于 UIMessage.parts 渲染

AI SDK v7 的 `UIMessage.parts` 数组天然支持混合 `text` part 与 `tool-call` part。本设计把 UI 渲染分为两层:
- **UIMessage.parts 内渲染**:`text` part 渲染为 AI 文本气泡;`tool-call` part 渲染为"输入中"状态指示(`◔/◑/◐` 旋转图标 + toolName + 目标块 ID),与 AI 文本同属一条 assistant 消息气泡。
- **独立工具结果气泡**:在 AI 消息气泡下方独立渲染 tool 结果回执(成功 `✓` + 跳转、冲突 `⚠` + 重试按钮、前置失败 `⚠` + 重试、错误 `✗`),作为单独的 React 组件 `<ToolResultBubble>`,通过 `toolCallId` 关联回 UIMessage.parts 的 tool-call。

备选:把 tool 结果也嵌入 UIMessage.parts(用 `tool-result` part)。放弃原因是 tool 结果需要可行动 UI(跳转/重试按钮),嵌入 part 内会限制交互区域;独立气泡更灵活,符合 Cursor/Copilot Chat 的展示模式。

### 4. 冲突「仅重试该 toolCallId」用最新 revision

冲突重试不重发整轮用户消息,而是用当前编辑器的最新 `documentRevision` 重新 execute 同一个 `toolCallId` 对应的 tool:
1. 用户点击「仅重试该操作」按钮
2. 客户端读取当前 `editor.document` 的最新 `documentRevision`(可通过 ai-core `DocumentStateBuilder.build({ scope: "revision" })` 获取)
3. 用原 toolName + 原 args + 新 `baseDocumentRevision` 重新调用 `execute`
4. 成功则更新 tool 结果气泡为 `✓`;失败则保持 `⚠` 状态,可再次重试
5. 不影响其他已成功的 tool-call 结果,不重发整轮(节省 token)

备选 A:重发整轮用户消息。放弃原因是浪费 token,且可能触发已成功操作的重复执行。
备选 B:用原 `baseDocumentRevision` 重试。放弃原因是 revision 已过期,必定再次冲突,无意义。

### 5. client-side tools 与服务端 ChatToolSet schema 同源

客户端 tools 的输入 schema 不在 ai-chat 包内重新定义,而是从 ai-core 导入 `blockOperationSchema` 与派生类型,与 FEAT-005 服务端 `ChatToolSet` schema 同源(单 source of truth)。客户端只实现 `execute`,不声明 schema;服务端声明 schema 但不 execute。两者通过 tool name 对齐:`insertBlock`/`updateBlock`/`deleteBlock`/`replaceBlocks`/`moveBlock`/`getDocumentSnapshot`。

备选:客户端各自定义等价 schema。放弃原因是 schema 漂移会导致客户端 execute 与服务端声明不一致,运行时才发现冲突。

### 6. 选区高亮保留 + chip 回执的跨组件协调

「引用选区」模式下,发送前编辑器侧保留选区高亮,消息气泡显示 chip(如 `§ 选区 2 块`);发送后清除编辑器侧高亮,保留 chip 作为审计回执。实现方式:
- ChatPanel 内部维护 `selectionHighlight` 状态(ProseMirror Decoration 或 CSS 类)
- 用户切换到 `selection` 模式时,ChatPanel 通过 `editor` 实例订阅选区变化,在选区范围应用高亮
- 发送时记录选区块数与 token 估算,生成 chip 元数据附加到消息气泡
- 发送后清除高亮(撤销 Decoration 或移除 CSS 类),chip 保留

备选:发送后立即清除编辑器侧选区,只保留 chip。放弃原因是用户在多轮中需要持续看到当前轮引用的选区,立即清除会丢失上下文。

### 7. busy 状态通过 ai-core `createAIBusyState` 共享(与 inline 一致)

对话助手与内联助手共享同一 `AIBusyState` 实例(来自 `TapNoteEditor` 的 `aiBusyState` prop)。`createTapNoteChatAssistant` 接收 `aiBusyState` 参数,触发时 `busy.acquire("chat")`,失败则输入框置灰并显示"内联 AI 进行中,完成后可用";完成/中止/失败/卸载时 `busy.release()`。`useTapNoteChat` 内部用 `useSyncExternalStore` 订阅 busy 状态,UI 实时响应。

备选:各自独立 busy state。放弃原因是不互斥,违反总 PRD §4.6"同一会话不并行"约束。

### 8. ai-chat 包自带最少组件基线,只复用 `@workspace/ui` 的 `Button`

ai-chat 包内 ChatPanel 的子组件(ContextSelector、MessageList、MessageBubble、InputArea、ToolResultBubble)由 ai-chat 包自带实现,基于 Tailwind 4 + shadcn 风格,只复用 `@workspace/ui` 的 `Button` 组件。不硬依赖 `@workspace/ui` 的其他组件,保持包可独立发布(符合总 PRD §9 shadcn 复用策略)。

备选:全部复用 `@workspace/ui`。放弃原因是 `@workspace/ui` 目前只有 Button,且独立发布包不应硬依赖私有 workspace 包;ai-chat 自带组件基线更符合"独立发布"目标。

### 9. `getDocumentSnapshot` 仅「引用全文」+ 允许按需读取时暴露

`getDocumentSnapshot` 工具的可见性受上下文模式约束:
- `none` 模式:完全不声明该 tool,LLM 无法调用
- `selection` 模式:不声明该 tool(LLM 应基于选区回答,不需要全文)
- `full` 模式 + 允许按需读取:声明该 tool,但 `execute` 内受 `maxBlocks`(默认 10)与 `maxTokens`(默认 2K)约束,防止无限读取

集成方通过 `createTapNoteChatAssistant` 的 `allowSnapshotTool?: boolean` 选项控制 `full` 模式下是否暴露该 tool,默认 `true`。

备选:总是声明该 tool。放弃原因是不引用模式不应向 LLM 暴露读取文档能力,违反总 PRD §9 上下文规则。

### 10. `apps/web` demo 用 React Router 实现多路由

demo 引入 `react-router-dom` 实现 `/inline`、`/chat`、`/both` 三路由 + sidemenu 切换。各路由独立组件,共享 `aiBusyState` 与 `inlineAssistant`/`chatAssistant` 单例。A4 纸面样式(灰色工作区 + 居中白纸 + 阴影)与右侧可开合抽屉开关属 demo 自有样式与逻辑,在 `apps/web/src/app.css` 与 `apps/web/src/components/` 实现。

备选 A:用简单状态切换(无 router)。放弃原因是 URL 不可分享、刷新丢路由、不符合 demo "可分享可二次开发" 定位。
备选 B:用 TanStack Router。放弃原因是引入成本高,React Router 已满足 demo 需求。

## Risks / Trade-offs

- **AI SDK v7 `useChat` + client-side tools `execute`/`toolCallId` 回传精确 API 未锁定** → 研究闸门(任务 1.x)以 Context7 + 最小示例验证,锁定后才开始核心实现;若 API 与假设不符,先更新本 design.md 再继续。
- **v7 UIMessage.parts 中 tool-call 状态的渲染时机** → tool-call 可能在 partial 状态下到达(input 增量),UI 需要处理"输入中"动画;若 v7 不提供 partial 事件,降级为"tool-call 完整后一次性显示"。
- **选区高亮与 ProseMirror Decoration 集成** → BlockNote 的 ProseMirror PluginView 可能与 ChatPanel 的高亮 Decoration 冲突;若冲突,降级为 CSS 类选区包裹(不修改 ProseMirror state)。
- **`@ai-sdk/alibaba@2`/`@ai-sdk/google@4` 与 `ai@7` peerDep 兼容性** → 研究闸门核查;不兼容时降级为只用 `@ai-sdk/alibaba`,Gemini 暂不支持。
- **冲突重试 N 次后仍失败** → MVP 不设上限,用户可无限重试;P2 候选加"重发整轮"兜底。
- **ai-chat 包自带组件与 `@workspace/ui` 风格不一致** → 接受短期不一致;P1 切 base-ui 皮肤时统一(总 PRD §15 P1)。
- **demo 多路由改造范围较大** → 评估 React Router 引入对现有 inline demo 的影响;若 App.tsx 改造阻力大,先保留 `/inline` 现状,新增 `/chat`、`/both` 路由增量推进。
