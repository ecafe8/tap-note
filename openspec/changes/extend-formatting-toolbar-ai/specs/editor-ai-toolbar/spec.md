## ADDED Requirements

### Requirement: 格式工具栏包含 AI 工具按钮

当 `TapNoteEditor` 接收到 `inlineAssistant` prop 时，选区格式工具栏 SHALL 在默认格式按钮末尾追加一个 AI 工具按钮。按钮图标 SHALL 使用 Lucide 图标，不得使用 emoji 或 Unicode 图标字符。未注入 `inlineAssistant` 时 SHALL NOT 显示 AI 工具按钮，工具栏保持 BlockNote 默认行为。

#### Scenario: 有 inlineAssistant 时显示 AI 按钮

- **WHEN** 集成方传入 `inlineAssistant` 且用户选中编辑器中的文本
- **THEN** 格式工具栏 SHALL 出现，末尾包含 AI 按钮
- **THEN** AI 工具按钮 SHALL 显示 `dictionary.aiInlineTrigger` 作为 tooltip

#### Scenario: 无 inlineAssistant 时不显示 AI 按钮

- **WHEN** 集成方未传入 `inlineAssistant` 且用户选中文本
- **THEN** 格式工具栏 SHALL 仅显示 BlockNote 默认按钮，不包含 AI 按钮

#### Scenario: AI busy 时按钮禁用

- **WHEN** `aiBusyState.isBusy` 为 true（另一 AI 任务进行中）
- **THEN** AI 按钮 SHALL 置灰不可点击，tooltip 显示 `dictionary.aiBusy`

#### Scenario: 只读模式不显示工具栏

- **WHEN** `editable={false}`
- **THEN** 格式工具栏 SHALL NOT 出现，AI 按钮 SHALL NOT 显示

### Requirement: 点击 AI 工具按钮后展开 AI 面板

点击 AI 工具按钮后，格式工具栏 SHALL 保持默认格式按钮，并在同一浮动容器内向下展开 AI 技能列表和自定义指令输入框。工具栏 SHALL 保持打开状态（不因外部点击或选区变化而关闭），位置 SHALL 保持不变（锚定原选区）。

#### Scenario: 工具栏展开 AI 面板

- **WHEN** 用户点击 AI 按钮
- **THEN** 工具栏 SHALL 保留格式按钮，并在下方展开技能列表和输入框
- **THEN** AI 技能列表和输入框 SHALL 出现
- **THEN** 输入框 SHALL 自动获得焦点
- **THEN** 输入框 placeholder SHALL 为 `dictionary.aiToolbarPlaceholder`

#### Scenario: AI 面板展开时再次点击 AI 按钮

- **WHEN** 工具栏已处于 AI 模式且 AI 状态为 `user-input`，用户再次点击 AI 按钮
- **THEN** AI 面板 SHALL 收起，工具栏回到 formatting 模式

#### Scenario: AI 面板展开时格式按钮保持可交互

- **WHEN** 工具栏处于 AI 模式
- **THEN** 格式行的按钮（加粗/斜体等）SHALL 保持可点击
- **THEN** 点击格式按钮 SHALL 正常执行格式操作，不关闭 AI 面板

#### Scenario: AI 面板模式下阻止外部点击关闭

- **WHEN** 工具栏处于 AI 输入模式
- **THEN** 点击工具栏外部区域 SHALL NOT 关闭工具栏
- **THEN** 工具栏 SHALL 保持可见和可交互

#### Scenario: AI 面板模式下选区变化不移动工具栏

- **WHEN** 工具栏处于 AI 模式且用户点击编辑器内其他位置（选区变化）
- **THEN** 工具栏 SHALL 保持原位，不跟随新选区移动

#### Scenario: Escape 关闭 AI 面板（空闲态）

- **WHEN** 工具栏处于 AI 输入模式且 AI 状态为 `user-input`，用户按 Escape
- **THEN** 工具栏 SHALL 关闭

#### Scenario: Escape 关闭 AI 面板（进行中）

- **WHEN** 工具栏处于 AI 模式且 AI 状态为 `thinking` 或 `ai-writing`，用户按 Escape
- **THEN** 系统 SHALL 先调用 `context.abort()` 中止流式请求
- **THEN** 工具栏 SHALL 关闭

#### Scenario: 关闭按钮退出 AI 面板（空闲态）

- **WHEN** 工具栏处于 AI 输入模式且 AI 状态为 `user-input`，用户点击关闭按钮
- **THEN** 工具栏 SHALL 关闭

#### Scenario: 关闭按钮退出 AI 面板（进行中）

- **WHEN** 工具栏处于 AI 模式且 AI 状态为 `thinking` 或 `ai-writing`，用户点击关闭按钮
- **THEN** 系统 SHALL 先调用 `context.abort()` 中止流式请求
- **THEN** 工具栏 SHALL 关闭

### Requirement: AI 技能列表可配置

编辑器 SHALL 提供内置 AI 技能列表，至少包含扩写、总结、润色和精简。`aiTools` 未传入时 SHALL 使用内置列表；传入空数组时 SHALL 隐藏技能项但保留自定义输入；传入非空数组时 SHALL 完全替换内置列表。每个技能项 SHALL 包含稳定的 `id`、展示用 `label` 和提交用 `prompt`，可选使用 Lucide 图标。

#### Scenario: 使用内置技能

- **WHEN** 集成方传入 `inlineAssistant` 但未传入 `aiTools`
- **THEN** AI 面板 SHALL 显示内置技能列表

#### Scenario: 替换技能列表

- **WHEN** 集成方传入自定义 `aiTools`
- **THEN** AI 面板 SHALL 按传入顺序显示自定义技能，不显示默认技能

#### Scenario: 仅使用自定义指令

- **WHEN** 集成方传入空的 `aiTools`
- **THEN** AI 面板 SHALL 不显示技能项，但 SHALL 保留自定义指令输入框

#### Scenario: 技能列表溢出

- **WHEN** 技能数量超出一行显示范围
- **THEN** 技能列表 SHALL 自动换行
- **THEN** 超过面板最大高度时 SHALL 内部滚动

### Requirement: AI 面板无障碍

AI 面板 SHALL 提供基本的键盘可访问性。

#### Scenario: 面板 aria 标注

- **WHEN** AI 面板展开
- **THEN** 面板容器 SHALL 设置 `role="group"` 和 `aria-label`（值为 `dictionary.aiToolbarPlaceholder` 或等效描述）

#### Scenario: 技能列表键盘导航

- **WHEN** AI 面板展开且焦点在技能列表区域
- **THEN** 技能项 SHALL 可通过 Tab 或方向键切换焦点
- **THEN** Enter 或 Space SHALL 触发对应技能

### Requirement: 输入框提交指令

用户在 AI 输入框中输入指令后，按 Enter 或点击发送按钮 SHALL 调用 `inlineAssistant.context.submit(prompt)`。空输入 SHALL NOT 触发提交。

#### Scenario: 提交指令

- **WHEN** 用户输入非空指令并按 Enter（无 Shift）
- **THEN** 系统 SHALL 调用 `context.submit(prompt)`
- **THEN** 输入框内容 SHALL 清空

#### Scenario: 提交预设技能

- **WHEN** 用户点击 AI 技能列表中的一个技能
- **THEN** 系统 SHALL 调用 `context.submit(tool.prompt)`
- **THEN** AI 技能列表和输入框 SHALL 切换为处理中状态 UI

#### Scenario: Shift+Enter 不提交

- **WHEN** 用户按 Shift+Enter
- **THEN** 系统 SHALL NOT 提交（允许换行，若为 textarea）

#### Scenario: 空输入不提交

- **WHEN** 输入框为空或仅含空白字符时点击发送
- **THEN** 系统 SHALL NOT 调用 `context.submit`

### Requirement: AI 处理中工具栏显示状态 UI

提交后工具栏 SHALL 根据 `inlineAssistant.context.store` 的状态实时切换 UI：

- `user-input`: 显示输入框 + 发送按钮（AI 模式初始态）
- `thinking` / `ai-writing`: 显示状态文案 + 中止按钮
- `user-reviewing`: 显示接受 + 拒绝按钮
- `error`: 显示错误信息 + 重试 + 关闭按钮

#### Scenario: 思考/写作中显示中止

- **WHEN** AI 状态为 `thinking` 或 `ai-writing`
- **THEN** 工具栏 SHALL 显示 `dictionary.aiWriting` 文案和中止按钮
- **WHEN** 用户点击中止
- **THEN** 系统 SHALL 调用 `context.abort()`

#### Scenario: 审阅显示接受/拒绝

- **WHEN** AI 状态为 `user-reviewing`
- **THEN** 工具栏 SHALL 显示接受和拒绝按钮
- **WHEN** 用户点击接受
- **THEN** 系统 SHALL 调用 `context.accept()` 并关闭工具栏
- **WHEN** 用户点击拒绝
- **THEN** 系统 SHALL 调用 `context.reject()` 并关闭工具栏

#### Scenario: 错误显示重试

- **WHEN** AI 状态为 `error`
- **THEN** 工具栏 SHALL 显示错误信息和重试按钮
- **WHEN** 用户点击重试
- **THEN** 系统 SHALL 调用 `context.retry()`

### Requirement: AI 完成后工具栏关闭或恢复

AI 任务完成（接受/拒绝）或用户主动关闭后，工具栏 SHALL 关闭。下次选区出现时恢复为格式工具栏（含 AI 按钮）。

#### Scenario: 接受后关闭

- **WHEN** 用户点击接受且 `context.accept()` 完成
- **THEN** 工具栏 SHALL 关闭
- **THEN** 下次选区出现时 SHALL 显示格式工具栏（AI 面板收起）

#### Scenario: 中止后恢复

- **WHEN** 用户点击中止且 `context.abort()` 完成
- **THEN** 工具栏 SHALL 关闭
