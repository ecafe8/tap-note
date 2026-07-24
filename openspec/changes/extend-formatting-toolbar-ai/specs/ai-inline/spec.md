## MODIFIED Requirements

### Requirement: 提供 `AIMenuController` / `AIToolbarButton` / `getAISlashMenuItems`

系统 SHALL 提供 `AIMenuController`（输入指令的浮层）、`AIToolbarButton`（选区时出现的 AI 按钮）、`getAISlashMenuItems`（`/ai` 触发块末尾的 slash 菜单项）。这些组件 SHALL 继续作为独立可用的 UI 组件导出，不废弃。`TapNoteEditor` 集成场景下 AI 工具栏 UI 由 `@tap-note/editor` 的 `editor-ai-toolbar` 能力内联实现，不再渲染这些独立组件，但组件本身保持可用。

`createTapNoteInlineAssistant` 返回的对象 SHALL 继续暴露 `context`（含 `submit`/`accept`/`reject`/`abort`/`retry`/`close`/`store`），供 `@tap-note/editor` 的工具栏 UI 消费。context 接口和行为 SHALL NOT 变更。

#### Scenario: /ai 唤起 slash 菜单

- **WHEN** 用户在空块输入 `/ai`
- **THEN** slash 菜单 SHALL 出现，包含"AI 续写"项
- **WHEN** 用户选择该项
- **THEN** slash 菜单 SHALL 隐藏，AIMenu 输入框 SHALL 在光标位置出现

#### Scenario: 独立组件仍可用

- **WHEN** 集成方不使用 `TapNoteEditor` 而直接使用 `@tap-note/ai-inline` 的组件
- **THEN** `AIMenuController` 和 `AIToolbarButton` SHALL 继续正常工作

#### Scenario: context 接口稳定

- **WHEN** `@tap-note/editor` 通过 `TapNoteInlineAssistant.context` 调用 `submit`/`accept`/`reject` 等方法
- **THEN** 行为 SHALL 与直接调用 `createTapNoteInlineAssistant` 返回的 context 完全一致
