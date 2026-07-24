## MODIFIED Requirements

### Requirement: 提供 AI 助手挂载和会话忙状态接口

编辑器 SHALL 接受可选的 `inlineAssistant`、`chatAssistant` 和 `aiBusyState` 挂载接口，但不得在本能力中实现 AI 协议或网络调用。未注入助手时 SHALL 不显示 AI 入口。

`TapNoteInlineAssistant` 接口 SHALL 包含可选的 `context` 字段，暴露 `submit`、`accept`、`reject`、`abort`、`retry`、`close` 方法和 `store`（含 `state` 和 `subscribe`），供编辑器渲染 AI 工具栏 UI 并驱动状态流转。编辑器 SHALL 通过结构化类型（鸭子类型）消费 context，不得 import `@tap-note/ai-inline`。

当 `inlineAssistant.context` 存在时，`TapNoteEditor` SHALL 自定义格式工具栏渲染（`formattingToolbar={false}` + 自定义 `FormattingToolbarController`），在工具栏中集成 AI 工具按钮、可配置技能列表和 AI 状态 UI。当 `inlineAssistant.context` 不存在时，SHALL 保持 BlockNote 默认格式工具栏行为。

#### Scenario: 未注入助手

- **WHEN** 集成方未提供 AI 助手实例
- **THEN** 编辑器 SHALL 正常工作，且不显示 AI 入口或发起 AI 请求
- **THEN** 格式工具栏 SHALL 使用 BlockNote 默认渲染

#### Scenario: AI 忙状态

- **WHEN** 注入的会话级 busy state 表示某个 AI 任务正在执行
- **THEN** 对应的 AI 入口 SHALL 呈现禁用状态和可理解的状态提示，编辑器本身不得创建第二个独立 busy 状态

#### Scenario: 注入含 context 的 inlineAssistant

- **WHEN** 集成方传入含 `context` 字段的 `inlineAssistant`
- **THEN** 编辑器 SHALL 自定义格式工具栏，在默认按钮后追加 AI 工具按钮
- **THEN** AI 工具按钮点击后 SHALL 保留格式行并向下展开技能列表和自定义指令输入 UI

#### Scenario: 配置 AI 技能

- **WHEN** 集成方传入 `aiTools`
- **THEN** 编辑器 SHALL 将其按传入顺序传递给 AI 工具栏
- **THEN** 未传入 `aiTools` 时 SHALL 使用内置技能列表
