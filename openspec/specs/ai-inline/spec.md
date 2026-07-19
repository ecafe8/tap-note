### Requirement: 提供 `TapNoteAIInlineExtension` 状态机

系统 SHALL 提供 `TapNoteAIInlineExtension` 基于 `@blocknote/core` 的 `createExtension`,状态机转换 `user-input → thinking → ai-writing → user-reviewing → error`。转换 SHALL 严格按顺序:用户提交指令后进入 `thinking`;收到首工具调用后进入 `ai-writing`;流式完成后进入 `user-reviewing`;失败时进入 `error`(可重试回到 `thinking`);接受/拒绝/中止后回到 `user-input`(或关闭)。`error` 态 SHALL 携带错误信息,支持重试。`ConflictResult`(revision 冲突或前置条件冲突)SHALL 触发 `error` 态,不执行操作,不污染文档。

#### Scenario: 状态转换正确

- **WHEN** 用户通过 `/ai` 提交指令
- **THEN** 状态 SHALL 从 `user-input` 转换为 `thinking`
- **WHEN** 收到首个 `tool-call` chunk
- **THEN** 状态 SHALL 从 `thinking` 转换为 `ai-writing`
- **WHEN** 流式完成
- **THEN** 状态 SHALL 从 `ai-writing` 转换为 `user-reviewing`
- **WHEN** 用户点击拒绝
- **THEN** 状态 SHALL 回到 `user-input`(或关闭),文档回退到写作前状态

#### Scenario: error 态可重试

- **WHEN** `thinking` 或 `ai-writing` 状态中发生错误
- **THEN** 状态 SHALL 转换为 `error`,携带错误信息
- **WHEN** 用户在 `error` 态点击重试
- **THEN** 状态 SHALL 回到 `thinking`,重新发起请求(无需重输指令)

#### Scenario: revision 冲突触发 error 态

- **WHEN** `applyOperationsToEditor` 返回 `ConflictResult`(`reason: "revision-mismatch"`)
- **THEN** 状态 SHALL 转换为 `error`,携带冲突信息(使用 ai-core `AICoreDictionary.conflict` 文案)
- **THEN** 文档 SHALL NOT 被修改(没有成功应用任何操作)
- **WHEN** 用户点击重试
- **THEN** 系统 SHALL 重新构建 `documentState`(新 revision)并重新发送请求

#### Scenario: 前置条件冲突触发 error 态

- **WHEN** `applyOperationsToEditor` 返回 `ConflictResult`(`reason: "precondition-failed"`,目标块不存在)
- **THEN** 状态 SHALL 转换为 `error`,携带冲突信息(使用 ai-core `AICoreDictionary.preconditionFailed` 文案)
- **WHEN** 用户点击重试
- **THEN** 系统 SHALL 重新构建 `documentState` 并重新发送请求

### Requirement: 提供 `StreamToolExecutor` 增量解析 partial 工具调用

系统 SHALL 提供 `StreamToolExecutor`,增量解析 AI SDK v7 `tool-call` 的 partial JSON input,通过 `parsePartialJson` 累积与校验,去重后提交完整 `BlockOperation[]` 到 `applyOperationsToEditor(mode: "suggest")`。非法 partial 丢弃,不中断流;重复操作通过 `filterNewOrUpdatedOperations` 去重。

#### Scenario: partial 增量解析

- **WHEN** `StreamToolExecutor` 收到 `{ type: "tool-call", toolName: "applyDocumentOperations", input: "{\"opera" }`(partial JSON)
- **THEN** 解析器 SHALL 累积到缓存,不提交
- **WHEN** 后续收到 `{ ... input: "tions\":[{\"type\":\"updateBlock\"}]}" }`(完整 JSON)
- **THEN** 解析器 SHALL 校验并通过 `filterNewOrUpdatedOperations` 去重,提交完整 `BlockOperation[]` 到 applier

#### Scenario: 非法 partial 丢弃不中断流

- **WHEN** `StreamToolExecutor` 收到无法解析的 chunk
- **THEN** 解析器 SHALL 丢弃该 partial,不中断流,记录警告但不暴露给用户

### Requirement: 提供 `applyDocumentOperations` 流式工具

系统 SHALL 提供 `applyDocumentOperations` 流式工具,输入 `{ operations: BlockOperation[] }`,复用 ai-core 的 `applyOperationsToEditor(editor, operations, { mode: "suggest" })`。每次增量去重后只提交新操作,不重复应用已处理的工具调用。

#### Scenario: 应用可回退

- **WHEN** 工具调用应用后用户选择拒绝
- **THEN** `revertSuggestions` SHALL 回退该 AI 事务,文档回到写作前状态
- **WHEN** 用户选择接受
- **THEN** `applySuggestions` SHALL 合并建议到正式文档,undo 历史正确

#### Scenario: 中止立即停止并回退

- **WHEN** 用户在 `ai-writing` 态点击中止按钮
- **THEN** 系统 SHALL 调用 `AbortController.abort()` 中断流式请求
- **THEN** 系统 SHALL 调用 `applyOperationsToEditor(editor, [], { mode: "revert" })` 回退已应用的建议事务
- **THEN** 系统 SHALL 调用 `busy.release()` 释放互斥锁
- **THEN** 状态 SHALL 回到 `user-input`(或关闭)

#### Scenario: 流式期间人工编辑后拒绝不覆盖

- **WHEN** AI 流式写入期间用户手动编辑同一块(不带建议标记)
- **WHEN** 用户点击拒绝
- **THEN** `revertSuggestions` SHALL 只回退 AI 建议事务,用户的手动编辑 SHALL 保留

### Requirement: 提供 `AIMenuController` / `AIToolbarButton` / `getAISlashMenuItems`

系统 SHALL 提供 `AIMenuController`(输入指令的浮层)、`AIToolbarButton`(选区时出现的 AI 按钮)、`getAISlashMenuItems`(`/ai` 触发块末尾的 slash 菜单项)。`/ai` 唤起 slash 菜单,选择后显示 AIMenu 输入框。选区或光标在空块时 AI 按钮可见。AIMenu 在 `ai-writing` 态显示中止按钮,`user-reviewing` 态显示接受/拒绝按钮,`error` 态显示错误信息与重试按钮。

#### Scenario: /ai 唤起 slash 菜单

- **WHEN** 用户在空块输入 `/ai`
- **THEN** slash 菜单 SHALL 出现,包含"AI 续写"项
- **WHEN** 用户选择该项
- **THEN** slash 菜单 SHALL 隐藏,AIMenu 输入框 SHALL 在光标位置出现

#### Scenario: 选区 AI 按钮

- **WHEN** 用户选中编辑器中的文本
- **THEN** 选区上方 SHALL 出现 AI 按钮(类似 Notion)
- **WHEN** 点击按钮
- **THEN** AIMenu 输入框 SHALL 出现,询问"改什么?"

#### Scenario: 写作中 UI 状态

- **WHEN** 状态为 `ai-writing`
- **THEN** AIMenu SHALL 显示中止按钮(而非发送按钮)
- **WHEN** 状态为 `user-reviewing`
- **THEN** AIMenu SHALL 显示接受/拒绝按钮
- **WHEN** 状态为 `error`
- **THEN** AIMenu SHALL 显示错误信息与重试按钮

### Requirement: 提供 `createTapNoteInlineAssistant` 入口函数

系统 SHALL 提供 `createTapNoteInlineAssistant(options)` 入口函数,返回 `TapNoteInlineAssistant` 对象,**实现 `packages/tap-note-editor` 已定义的 `{ mount(editor), unmount(editor) }` 接口**。`mount` 时安装扩展与 UI 组件;`unmount` 时清理扩展、释放 busy、回退未完成建议事务。集成方通过 `TapNoteEditor` 的 `inlineAssistant` prop 注入。

#### Scenario: 一行接入

- **WHEN** 集成方调用 `createTapNoteInlineAssistant({ transport: createServerTransport({...}), aiBusyState })`
- **THEN** 返回的 `TapNoteInlineAssistant` SHALL 包含 `mount(editor)` 和 `unmount(editor)` 方法,与 `TapNoteEditor.inlineAssistant` prop 接口兼容

#### Scenario: 复用 ai-core 组件

- **WHEN** 检查 `createTapNoteInlineAssistant` 的实现
- **THEN** 内部 SHALL 使用 ai-core 的 `createAIBusyState`/`createDocumentStateBuilder`/`createServerTransport`/`applyOperationsToEditor`/`layerContext`

#### Scenario: mount/unmount 生命周期

- **WHEN** `mount(editor)` 被调用
- **THEN** 系统 SHALL 安装 `TapNoteAIInlineExtension`(含 suggest-changes 插件)到 editor,注册 UI 组件
- **WHEN** `unmount(editor)` 被调用
- **THEN** 系统 SHALL 回退未完成的建议事务,释放 busy,移除 UI 组件与事件监听

### Requirement: busy 互斥禁用入口

系统 SHALL 在触发 AI 任务前查询 ai-core `AIBusyState`。若 `busy.isBusy` 为 true(另一 AI 进行中),slash 项与 AI 按钮 SHALL 置灰并显示原因文案(使用 ai-core `AICoreDictionary.aiBusy`)。任一 AI 完成/中止/失败/卸载后另一助手入口立即可用。

#### Scenario: 另一 AI 进行中时入口禁用

- **WHEN** 对话助手(chat)正在进行(`busy.isBusy === true`)
- **THEN** 内联助手的 slash 项 SHALL 置灰(不可选择),AI 按钮 SHALL 不可点击
- **THEN** UI SHALL 显示原因文案"AI 正在处理,请稍候..."

#### Scenario: 释放后入口恢复

- **WHEN** 对话助手释放 busy(`busy.release()`)
- **THEN** 内联助手的 slash 项与 AI 按钮 SHALL 立即恢复可用

### Requirement: 上下文预算检查

系统 SHALL 在发送 AI 请求前调用 ai-core `layerContext(documentState)` 检查选区/全文预算。选区超 4K 软上限时拦截,不发送请求,进入 `error` 态显示提示(使用 ai-core `AICoreDictionary.selectionBlocked`)。

#### Scenario: 选区超限拦截

- **WHEN** 用户选中超过 4K tokens 的文本并触发 AI
- **THEN** 系统 SHALL NOT 发送请求,进入 `error` 态
- **THEN** AIMenu SHALL 显示选区超限提示"选区过大,请减少选区或改用「引用全文+指令」模式"

### Requirement: 提供默认 zh-CN 字典

系统 SHALL 提供默认 zh-CN 字典,**扩展** ai-core `AICoreDictionary`(用 `interface InlineDictionary extends AICoreDictionary`),不重复定义 `aiBusy`/`aiInlineTrigger`/`acceptSuggestion`/`rejectSuggestion`/`retry`/`conflict`/`preconditionFailed`/`selectionBlocked` 等已有字段。只新增内联特有字段:`aiWriting`(AI 写作中)、`abort`(中止按钮)、`aiMenuPlaceholder`(输入框占位)、`aiMenuPrompt`(选区改写提示)。`mergeDictionary` 直接从 ai-core 导入复用。可被集成方通过 `dictionary` 参数覆盖。

#### Scenario: 默认中文文案

- **WHEN** 集成方不传入 `dictionary`
- **THEN** 系统 SHALL 使用默认 zh-CN 文案,UI 显示中文
- **THEN** ai-core 已有字段(如 `aiBusy`/`acceptSuggestion`)SHALL 继承 ai-core 默认值,不重复定义

#### Scenario: 集成方覆盖

- **WHEN** 集成方传入部分字典
- **THEN** 系统 SHALL 用 ai-core `mergeDictionary` 合并覆盖指定字段,未指定字段保留默认值

### Requirement: streamToolsProvider 与服务端 schema 校验

`createTapNoteInlineAssistant` 可选接收 `streamToolsProvider` 参数。若提供,系统 SHALL 在发送请求前校验其工具 schema 是否与服务端 `applyDocumentOperations` 的 `inputSchema`(来自 ai-core `blockOperationSchema`)对齐。不匹配 SHALL 进入 `error` 态,不发送请求。MVP 阶段默认不提供 `streamToolsProvider`(服务端持有 streamTool schema,客户端不提交工具定义)。

#### Scenario: 不提供 streamToolsProvider(默认)

- **WHEN** 集成方不传入 `streamToolsProvider`
- **THEN** 系统 SHALL 使用服务端持有的 streamTool schema,不校验客户端工具定义,正常发送请求

#### Scenario: streamToolsProvider 与服务端 schema 不匹配

- **WHEN** 集成方传入 `streamToolsProvider` 且其工具 schema 与 `blockOperationSchema` 不匹配
- **THEN** 系统 SHALL 进入 `error` 态,不发送请求,显示校验失败提示

### Requirement: 保持纯库与授权边界

`@tap-note/ai-inline` SHALL NOT 引入 `@blocknote/xl-ai` 或任何 GPL/AGPL 依赖。系统 SHALL 只阅读 `resource/BlockNote` submodule 作思路参考,SHALL NOT 复制其源码。

#### Scenario: 依赖闭包检查

- **WHEN** 执行 `bun pm ls --all` 检查 `@tap-note/ai-inline` 的依赖闭包
- **THEN** 结果 SHALL NOT 包含 `@blocknote/xl-ai` 或任何 GPL/AGPL 授权的包

### Requirement: 提供自动化测试覆盖

系统 SHALL 用 `bun:test` 覆盖状态机转换、`filterNewOrUpdatedOperations` 去重、Zod 校验、busy acquire/release、流式工具 fixture、组件行为、ConflictResult 处理、中止回退、layerContext 选区拦截。测试 MUST NOT 依赖真实 LLM API、网络或持久化服务。

#### Scenario: 状态机测试

- **WHEN** 运行 `bun test`
- **THEN** `user-input → thinking → ai-writing → user-reviewing` 的正确转换与 `error→重试→thinking` 的恢复路径 SHALL 全部通过

#### Scenario: 去重测试

- **WHEN** 运行 `bun test`
- **THEN** `filterNewOrUpdatedOperations` 对重复操作与更新操作的去重逻辑 SHALL 全部通过

#### Scenario: 流式工具 fixture 测试

- **WHEN** 运行 `bun test`
- **THEN** partial 增量、非法 partial 丢弃、去重后提交的测试用例 SHALL 全部通过,不依赖网络

#### Scenario: ConflictResult 处理测试

- **WHEN** 运行 `bun test`
- **THEN** `applyOperationsToEditor` 返回 `ConflictResult` 时状态转换为 `error`、文档不被修改、重试重新构建 documentState 的测试用例 SHALL 全部通过

#### Scenario: 中止回退测试

- **WHEN** 运行 `bun test`
- **THEN** 中止后 `AbortController.abort()` 被调用、`revertSuggestions` 回退建议事务、`busy.release()` 释放的测试用例 SHALL 全部通过

#### Scenario: layerContext 选区拦截测试

- **WHEN** 运行 `bun test`
- **THEN** 选区超 4K tokens 时进入 `error` 态、不发送请求、显示拦截提示的测试用例 SHALL 全部通过