## ADDED Requirements

### Requirement: 提供 `createTapNoteChatAssistant` 入口函数

系统 SHALL 提供 `createTapNoteChatAssistant(options)` 入口函数,接收 `{ transport, documentStateBuilder, editor, model?, getAuthHeaders?, dictionary?, allowSnapshotTool? }` 选项,返回 `TapNoteChatAssistant` 对象。返回对象 SHALL 实现 `packages/tap-note-editor` 已定义的 `TapNoteChatAssistant` 接口 `{ mount(editor), unmount(editor) }`,并扩展 `panel` 字段返回 `TapNoteChatPanel` React 组件引用。`mount(editor)` SHALL 注册选区订阅、创建 `useTapNoteChat` 上下文、安装客户端 tools;`unmount(editor)` SHALL 释放 busy、移除事件监听、清理选区高亮。

#### Scenario: 入口返回对象结构正确

- **WHEN** 集成方调用 `createTapNoteChatAssistant({ transport, documentStateBuilder, editor })`
- **THEN** 返回对象 SHALL 含 `mount: (editor) => void`、`unmount: (editor) => void`、`panel: TapNoteChatPanel`
- **THEN** `panel` SHALL 是合法的 React 组件,可直接渲染

#### Scenario: mount/unmount 生命周期

- **WHEN** `TapNoteEditor` 挂载并调用 `chatAssistant.mount(editor)`
- **THEN** 系统 SHALL 注册选区订阅、创建 useTapNoteChat 上下文
- **WHEN** `TapNoteEditor` 卸载并调用 `chatAssistant.unmount(editor)`
- **THEN** 系统 SHALL 释放 busy(若持有)、移除事件监听、清除选区高亮

#### Scenario: 与 TapNoteEditor 接口兼容

- **WHEN** 集成方通过 `<TapNoteEditor chatAssistant={assistant} />` 注入
- **THEN** 编辑器 SHALL 在挂载时调用 `mount(editor)`,卸载时调用 `unmount?.(editor)`
- **THEN** 集成方 SHALL 能通过 `assistant.panel` 渲染 ChatPanel 到任意区域

### Requirement: 提供 `TapNoteChatPanel` 位置无关组件

系统 SHALL 提供 `TapNoteChatPanel` React 组件,组件 SHALL 位置无关:不内置抽屉开关、布局容器或路由,只渲染 header、上下文三态 segmented(选区/全文/无)、消息列表、输入区。组件根容器 SHALL 设置 `data-tap-note-chat-panel` 数据属性与 `min-width: 320px`。

#### Scenario: 位置无关渲染

- **WHEN** 集成方把 `<TapNoteChatPanel />` 放在右侧抽屉、左侧固定列、浮动层或独立路由
- **THEN** 组件 SHALL 在所有位置正常渲染,不依赖特定父容器
- **THEN** 组件 SHALL 保持最小宽度 320px,父容器更窄时 SHALL 出现横向滚动而非内容压缩

#### Scenario: 内部结构

- **WHEN** ChatPanel 渲染
- **THEN** SHALL 包含 header(含面板标题与可选关闭按钮,关闭按钮由集成方 `onClose` prop 控制)、上下文 segmented(默认 `无`)、消息列表(可滚动)、输入区(含发送/中止按钮)
- **THEN** header 与 segmented 与输入区 SHALL 固定置顶/置底,消息列表占据中部可滚动区域

#### Scenario: 焦点陷阱与可访问性

- **WHEN** 用户按 `Tab` 在 ChatPanel 内导航
- **THEN** 焦点 SHALL 限制在面板内的可交互元素(输入框、发送、中止、重试按钮、上下文 segmented)
- **WHEN** 用户按 `Escape` 且集成方提供了 `onClose`
- **THEN** 系统 SHALL 调用 `onClose`,焦点 SHALL 回到打开面板前的元素
- **THEN** 流式状态 SHALL 通过 `aria-live="polite"` 播报

### Requirement: 提供 `useTapNoteChat` hook

系统 SHALL 提供 `useTapNoteChat` hook 封装 AI SDK v7 `useChat`,接收 transport(来自 ai-core `createServerTransport`)、clientTools、documentStateBuilder、editor、model 选项,返回 `{ messages, input, setInput, sendMessage, abort, status }`。`sendMessage(message)` SHALL 在发送前 `busy.acquire("chat")`,失败则输入框置灰;per-request 的 `documentState` 与 `documentRevision` SHALL 通过 `sendMessage(message, { body: { documentState, documentRevision } })` 动态注入请求 body。

#### Scenario: 发送前 acquire busy

- **WHEN** 用户在输入框输入消息并按 `Enter`(或点发送按钮)
- **THEN** 系统 SHALL 先调用 `busy.acquire("chat")`
- **WHEN** acquire 成功
- **THEN** 系统 SHALL 通过 transport 发送 `{ messages, documentState?, documentRevision?, model }` 到 `/api/ai/chat`
- **WHEN** acquire 失败(另一 AI 进行中)
- **THEN** 输入框 SHALL 置灰,显示 `AICoreDictionary.aiBusy` 文案,不发送请求

#### Scenario: 流式渲染 text 与 tool part

- **WHEN** 服务端返回 UIMessageStream
- **THEN** hook SHALL 增量更新 `messages` 状态
- **THEN** `text` part SHALL 渲染为 AI 文本气泡(左对齐,流式光标 `◌`)
- **THEN** `tool-call` part SHALL 渲染为输入中状态(`◔/◑/◐` 旋转图标 + toolName + 目标块 ID),嵌入同一条 assistant 消息气泡内

#### Scenario: 中止当前轮

- **WHEN** 用户在流式中点击中止按钮
- **THEN** 系统 SHALL 调用 `abort()` 中断流式请求
- **THEN** 已成功的 tool-call 结果 SHALL 保留,不被回退
- **THEN** 系统 SHALL 调用 `busy.release()`,输入框恢复可用

#### Scenario: 完成或失败释放 busy

- **WHEN** 流式完成(收到 `data: [DONE]` 或等价结束标记)
- **THEN** 系统 SHALL 调用 `busy.release()`,输入框恢复可用,可继续多轮
- **WHEN** 流式失败(网络错误、服务端 4xx/5xx)
- **THEN** 系统 SHALL 调用 `busy.release()`,显示错误气泡(可重试或继续多轮)

### Requirement: 提供客户端 tools execute

系统 SHALL 提供客户端 tools 实现,与服务端 `ChatToolSet` schema 同源(从 ai-core 导入 `blockOperationSchema`,不在 ai-chat 包重新定义)。tools 列表:`insertBlock`/`updateBlock`/`deleteBlock`/`replaceBlocks`/`moveBlock`/`getDocumentSnapshot`。每个 `execute(args, { toolCallId })` SHALL 先校验 `args.baseDocumentRevision` 与目标块前置条件,冲突返回 ai-core `ConflictResult`;成功调用 `editor.insertBlocks/updateBlock/removeBlocks` 作用于编辑器。

#### Scenario: insertBlock 成功

- **WHEN** LLM 返回 `tool-call: insertBlock, args: { block, referenceBlockId, baseDocumentRevision }`
- **WHEN** `baseDocumentRevision` 与当前文档 revision 一致且 `referenceBlockId` 存在
- **THEN** `execute` SHALL 调用 `editor.insertBlocks([block], referenceBlockId, "after")`
- **THEN** `execute` SHALL 返回 `{ ok: true }` 作为 tool result,按 `toolCallId` 回传进入后续消息

#### Scenario: revision 冲突返回 ConflictResult

- **WHEN** `execute` 校验 `baseDocumentRevision` 与当前文档 revision 不一致
- **THEN** `execute` SHALL 不调用 editor API,不修改文档
- **THEN** `execute` SHALL 返回 ai-core `ConflictResult`(`reason: "revision-mismatch"`,携带当前 revision)
- **THEN** tool 结果气泡 SHALL 显示 `⚠` + `AICoreDictionary.conflict` 文案 + 「仅重试该操作」按钮

#### Scenario: 前置条件冲突返回 ConflictResult

- **WHEN** `execute` 校验 `targetBlockId` 不存在(已被删除)
- **THEN** `execute` SHALL 不调用 editor API,不修改文档
- **THEN** `execute` SHALL 返回 `ConflictResult`(`reason: "precondition-failed"`)
- **THEN** tool 结果气泡 SHALL 显示 `⚠` + `AICoreDictionary.preconditionFailed` 文案 + 「仅重试该操作」按钮

#### Scenario: getDocumentSnapshot 仅在引用全文时暴露

- **WHEN** 上下文模式为 `none`
- **THEN** clientTools SHALL 不包含 `getDocumentSnapshot`,LLM 无法调用
- **WHEN** 上下文模式为 `selection`
- **THEN** clientTools SHALL 不包含 `getDocumentSnapshot`
- **WHEN** 上下文模式为 `full` 且集成方 `allowSnapshotTool: true`(默认)
- **THEN** clientTools SHALL 包含 `getDocumentSnapshot`,但 `execute` 内 SHALL 受 `maxBlocks`(默认 10)与 `maxTokens`(默认 2K)约束,超额返回截断结果

### Requirement: 提供 `ToolResultBubble` 工具结果气泡

系统 SHALL 提供 `<ToolResultBubble>` React 组件,作为独立气泡渲染 tool 结果回执,通过 `toolCallId` 关联回 UIMessage.parts 中的 tool-call。气泡 SHALL 支持 4 种状态:成功(`✓` + 操作类型 + 目标块 ID + 跳转按钮)、冲突(`⚠` + 冲突类型 + 仅重试按钮)、前置失败(`⚠` + 失败原因 + 重试按钮)、错误(`✗` + 错误文案)。操作类型 SHALL 以文字 + 图标表达(如「已插入块」「已更新块」「已删除块」「已移动块」),不依赖颜色区分。

#### Scenario: 成功气泡

- **WHEN** `execute` 返回 `{ ok: true }`
- **THEN** 气泡 SHALL 显示 `✓ insertBlock 已插入块 #b3` + `[跳转到该块]` 按钮
- **WHEN** 用户点击跳转
- **THEN** 系统 SHALL 滚动编辑器到该块位置并聚焦

#### Scenario: 冲突气泡可重试

- **WHEN** `execute` 返回 `ConflictResult`(`reason: "revision-mismatch"`)
- **THEN** 气泡 SHALL 显示 `⚠ updateBlock 版本冲突 #b3` + 当前 revision + 期望 revision
- **THEN** 气泡 SHALL 显示 `[仅重试该操作]` 按钮
- **WHEN** 用户点击重试
- **THEN** 系统 SHALL 用当前编辑器最新 `documentRevision` 重新 execute 同一 `toolCallId`,不重发整轮用户消息,不影响其他已成功 tool-call 结果

#### Scenario: 操作类型不依赖颜色

- **WHEN** 工具结果气泡渲染
- **THEN** 操作类型 SHALL 通过文字标签(如「已插入块」)+ 图标(如 `✓`/`⚠`/`✗`)同时表达
- **THEN** 不 SHALL 仅以颜色区分状态(满足可访问性)

### Requirement: 支持上下文三态引用

系统 SHALL 支持上下文三态 segmented control(选区/全文/无,默认 `无`),通过 ai-core `DocumentStateBuilder` 序列化为 documentState 随消息发送。选区超 4K tokens 前端拦截;全文预算 8K 截断带 `[文档已截断:共 N 块,此处含前 M 块]` 标记,>2× 改发结构化大纲;`none` 不发 documentState,不暴露 `getDocumentSnapshot`。

#### Scenario: 选区超 4K 拦截

- **WHEN** 用户切换到 `selection` 模式且选区 token 估算 > 4096
- **THEN** segmented 下方 SHALL 显示 `AICoreDictionary.selectionBlocked` 文案
- **THEN** 发送按钮 SHALL 置灰,不发送请求

#### Scenario: 全文预算内发完整快照

- **WHEN** 用户切换到 `full` 模式且全文 token 估算 ≤ 8192
- **THEN** segmented 下方 SHALL 显示 `全文 N 块 / 约 X tokens ✓`
- **WHEN** 用户发送消息
- **THEN** 请求 body SHALL 包含完整 documentState

#### Scenario: 全文超预算截断带标记

- **WHEN** 用户切换到 `full` 模式且全文 token 估算 > 8192 且 ≤ 16384(2× 预算)
- **THEN** segmented 下方 SHALL 显示 `AICoreDictionary.documentTruncated` 文案(含 total 与 included)
- **WHEN** 用户发送消息
- **THEN** 请求 body SHALL 包含截断后的 documentState,体积 ≤ 预算

#### Scenario: 全文超 2× 改发大纲

- **WHEN** 用户切换到 `full` 模式且全文 token 估算 > 16384
- **THEN** segmented 下方 SHALL 显示 `AICoreDictionary.outlineMode` 文案
- **WHEN** 用户发送消息
- **THEN** 请求 body SHALL 包含结构化大纲(标题块 + 各块首段摘要)

#### Scenario: 不引用模式

- **WHEN** 用户保持默认 `none` 模式
- **THEN** 请求 body SHALL NOT 包含 documentState
- **THEN** clientTools SHALL NOT 包含 `getDocumentSnapshot`

### Requirement: 选区高亮保留与 chip 回执

系统 SHALL 在「引用选区」模式下,发送前在编辑器侧保留选区高亮(ProseMirror Decoration 或 CSS 类),消息气泡显示 chip(`§ 选区 N 块`)。发送后 SHALL 清除编辑器侧高亮,保留 chip 作为审计回执。

#### Scenario: 选区高亮保留到发送

- **WHEN** 用户切换到 `selection` 模式且有选区
- **THEN** 编辑器 SHALL 在选区范围应用高亮(可见的视觉标记)
- **WHEN** 用户在发送前修改选区
- **THEN** 高亮 SHALL 跟随选区更新
- **WHEN** 用户发送消息
- **THEN** 编辑器 SHALL 清除选区高亮
- **THEN** 用户消息气泡 SHALL 显示 `§ 选区 N 块` chip(保留作为审计回执)

#### Scenario: 多轮中选区 chip 累积

- **WHEN** 用户在第 1 轮引用选区(3 块),第 2 轮引用选区(2 块)
- **THEN** 第 1 轮用户消息气泡 SHALL 显示 `§ 选区 3 块` chip
- **THEN** 第 2 轮用户消息气泡 SHALL 显示 `§ 选区 2 块` chip
- **THEN** 编辑器侧 SHALL 只保留当前轮的高亮(发送后清除)

### Requirement: busy 互斥与 inline 共享

系统 SHALL 通过 ai-core `createAIBusyState` 与 inline 助手共享同一 `AIBusyState` 实例。chat 触发前 SHALL `busy.acquire("chat")`,失败则输入框置灰并显示原因;完成/中止/失败/卸载时 SHALL `busy.release()`。任一 AI 进行中时另一助手入口 SHALL 禁用。

#### Scenario: 内联进行中时 chat 置灰

- **WHEN** inline 助手处于 `thinking` 或 `ai-writing` 态
- **THEN** ChatPanel 输入框 SHALL 置灰,显示 `AICoreDictionary.aiBusy` 文案
- **THEN** 发送按钮 SHALL 禁用,不响应点击

#### Scenario: chat 进行中时 inline 入口禁用

- **WHEN** chat 助手处于 `sending` 或 `streaming` 态
- **THEN** inline slash 项 `/ai` SHALL 置灰
- **THEN** 选区 AI 工具栏按钮 SHALL 置灰
- **THEN** 显示 `AICoreDictionary.aiBusy` 文案

#### Scenario: 完成或中止后立即恢复

- **WHEN** chat 助手完成(流式结束)或中止(用户点击中止)
- **THEN** 系统 SHALL 调用 `busy.release()`
- **THEN** inline 入口 SHALL 立即恢复可用
- **THEN** ChatPanel 输入框 SHALL 恢复可用

### Requirement: 提供默认 zh-CN 字典扩展 ai-core

系统 SHALL 提供 `ChatDictionary` 接口扩展 ai-core `AICoreDictionary`,新增 chat 特有字段:`chatPlaceholder`、`abort`、`retryToolCall`、`contextSelection`、`contextFull`、`contextNone`、`chatBusy`、`authExpired`、`toolInputting`、`toolUpdated`、`toolConflict`、`toolPreconditionFailed`、`toolFailed`、`jumpToBlock`。SHALL 提供 `chatDictionaryZhCN` 默认值,扩展 `aiCoreDictionaryZhCN` 并新增 chat 字段,通过 ai-core `mergeDictionary` 支持 Partial 覆盖。

#### Scenario: 默认字典覆盖

- **WHEN** 集成方不传 `dictionary`
- **THEN** 系统 SHALL 使用 `chatDictionaryZhCN`,所有 chat 文案为 zh-CN 默认值
- **WHEN** 集成方传 `{ chatPlaceholder: "Ask anything..." }`
- **THEN** 系统 SHALL 通过 `mergeDictionary` 合并,只覆盖 `chatPlaceholder`,其他字段保留默认

#### Scenario: 继承 ai-core 字段

- **WHEN** 系统在 chat 上下文使用 `aiBusy`/`conflict`/`preconditionFailed`/`selectionBlocked`/`documentTruncated`/`outlineMode` 等字段
- **THEN** 字段值 SHALL 来自 ai-core `aiCoreDictionaryZhCN` 或集成方覆盖
- **THEN** ai-chat 包 SHALL NOT 重新定义这些字段

### Requirement: 发布包授权干净

系统 SHALL 保证 `@tap-note/ai-chat` 的 `dependencies` 闭包不含 `@blocknote/xl-ai` 或任何 GPL/AGPL 依赖。`@blocknote/core@0.51.4` 与 `@blocknote/react@0.51.4` 的授权 SHALL 为 MPL-2.0。

#### Scenario: 依赖闭包扫描

- **WHEN** 对 `@tap-note/ai-chat` 运行依赖闭包扫描
- **THEN** 闭包 SHALL 不含 `@blocknote/xl-ai`、`@blocknote/xl-ai-server`、`@blocknote/xl-pdf-exporter`、`@blocknote/xl-docx-exporter`、`@blocknote/xl-multi-column` 或任何 GPL/AGPL 许可证依赖
- **THEN** `@blocknote/core`/`@blocknote/react` 的 LICENSE SHALL 为 MPL-2.0
