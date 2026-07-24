## Why

当前内联 AI 的入口是 demo 顶部的独立按钮，选中文字后无法直接在格式工具栏中发起 AI 修改指令。用户期望类似 Notion AI 的体验：选中文字 → 工具栏出现 AI 工具按钮 → 点击后同一浮动工具栏向下展开 AI 技能菜单和自定义指令输入框 → 选择技能或输入指令即改。这将 AI 入口融入编辑器原生交互流，降低操作路径。

## What Changes

- 在 `TapNoteEditor` 的格式工具栏（FormattingToolbar）末尾追加 AI 工具按钮（仅当 `inlineAssistant` 已注入时，图标使用 Lucide，不使用表情符号）
- 点击 AI 工具按钮后，格式按钮保持可见，同一浮动工具栏向下展开 AI 技能列表和自定义指令输入框
- 内置常用 AI 技能（扩写、总结、润色、精简等），通过 `aiTools` prop 允许集成方完全替换列表
- 选择技能或提交自定义指令后，展开区域跟随内联 AI 状态机显示对应 UI：思考中/写作中（+中止）、审阅（接受/拒绝）、错误（+重试）
- 关闭或 Escape 关闭 AI 展开区域并完全关闭工具栏（下次选区触发时恢复为格式模式）
- 扩展 `TapNoteInlineAssistant` 接口，暴露 `context`（submit/accept/reject/abort/retry/close + store 订阅），使 editor 包无需依赖 ai-inline 具体实现
- 无 `inlineAssistant` 时，格式工具栏保持 BlockNote 默认行为不变

## Capabilities

### New Capabilities

- `editor-ai-toolbar`: 编辑器格式工具栏的 AI 扩展能力，包括 AI 工具按钮、技能菜单、自定义指令输入、状态 UI、AI 模式下的 dismiss 阻止与关闭恢复

### Modified Capabilities

- `editor`: `TapNoteInlineAssistant` 接口扩展 context 字段；新增 `AIToolItem` 和 `aiTools` 配置；`TapNoteEditor` 在有 inlineAssistant 时自定义 FormattingToolbar 渲染
- `ai-inline`: `AIMenuController` / `AIToolbarButton` 的 UI 职责由 editor 包的 toolbar 内联实现替代（ai-inline 的 context/状态机/流式逻辑不变）

## Impact

- **packages/tap-note-editor**: 新增 formatting-toolbar 组件、扩展 types.ts 接口和 `AIToolItem` 配置、修改 TapNoteEditor 渲染逻辑、扩展 i18n 字典；所有图标使用 Lucide，不使用表情符号
- **packages/tap-note-ai-inline**: 无代码改动（context 已暴露，只是 editor 侧之前未消费）
- **apps/web**: 移除独立的 AIMenuPanel 浮层，改为依赖 editor 内置 toolbar AI 入口
- **依赖**: 新增 `lucide-react`（AI 工具栏图标）；`@blocknote/react`、`@blocknote/core` 已在 editor 的 dependencies 中
