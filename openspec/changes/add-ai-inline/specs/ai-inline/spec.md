## ADDED Requirements

### Requirement: 提供 `TapNoteAIInlineExtension` 状态机

系统 SHALL 提供 `TapNoteAIInlineExtension` 基于 `@blocknote/core` 的 `createExtension`,状态机转换 `user-input → thinking → ai-writing → user-reviewing → error`。转换 SHALL 严格按顺序:用户提交指令后进入 `thinking`;收到首工具调用后进入 `ai-writing`;流式完成后进入 `user-reviewing`;失败时进入 `error`(可重试回到 `thinking`);接受/拒绝/中止后回到 `user-input`(或关闭)。`error` 态 SHALL 携带错误信息,支持重试。

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

系统 SHALL 提供 `createTapNoteInlineAssistant(options)` 入口函数,返回 `TapNoteInlineAssistant` 对象,含 `extension`、`menuController`、`toolbarButton`、`slashMenuItems`。集成方通过 `TapNoteEditor` 的 `inlineAssistant` prop 注入。

#### Scenario: 一行接入

- **WHEN** 集成方调用 `createTapNoteInlineAssistant({ transport: createServerTransport({...}), aiBusyState })`
- **THEN** 返回的 `TapNoteInlineAssistant` SHALL 包含 `mount(editor)` 和 `unmount(editor)` 方法

#### Scenario: 复用 ai-core 组件

- **WHEN** 检查 `createTapNoteInlineAssistant` 的实现
- **THEN** 内部 SHALL 使用 ai-core 的 `createAIBusyState`/`createDocumentStateBuilder`/`createServerTransport`/`injectDocumentStateMessages`/`applyOperationsToEditor`

### Requirement: 提供默认 zh-CN 字典

系统 SHALL 提供默认 zh-CN 字典,包含 `aiInlineTrigger`、`aiBusy`、`aiWriting`、`accept`、`reject`、`abort`、`retry`、`error` 等文案,可被集成方通过 `dictionary` 参数覆盖。

#### Scenario: 默认中文文案

- **WHEN** 集成方不传入 `dictionary`
- **THEN** 系统 SHALL 使用默认 zh-CN 文案,UI 显示中文

#### Scenario: 集成方覆盖

- **WHEN** 集成方传入部分字典
- **THEN** 系统 SHALL 合并覆盖指定字段,未指定字段保留默认值

### Requirement: 保持纯库与授权边界

`@tap-note/ai-inline` SHALL NOT 引入 `@blocknote/xl-ai` 或任何 GPL/AGPL 依赖。系统 SHALL 只阅读 `resource/BlockNote` submodule 作思路参考,SHALL NOT 复制其源码。

#### Scenario: 依赖闭包检查

- **WHEN** 执行 `bun pm ls --all` 检查 `@tap-note/ai-inline` 的依赖闭包
- **THEN** 结果 SHALL NOT 包含 `@blocknote/xl-ai` 或任何 GPL/AGPL 授权的包

### Requirement: 提供自动化测试覆盖

系统 SHALL 用 `bun:test` 覆盖状态机转换、`filterNewOrUpdatedOperations` 去重、Zod 校验、busy acquire/release、流式工具 fixture、组件行为。测试 MUST NOT 依赖真实 LLM API、网络或持久化服务。

#### Scenario: 状态机测试

- **WHEN** 运行 `bun test`
- **THEN** `user-input → thinking → ai-writing → user-reviewing` 的正确转换与 `error→重试→thinking` 的恢复路径 SHALL 全部通过

#### Scenario: 去重测试

- **WHEN** 运行 `bun test`
- **THEN** `filterNewOrUpdatedOperations` 对重复操作与更新操作的去重逻辑 SHALL 全部通过

#### Scenario: 流式工具 fixture 测试

- **WHEN** 运行 `bun test`
- **THEN** partial 增量、非法 partial 丢弃、去重后提交的测试用例 SHALL 全部通过,不依赖网络