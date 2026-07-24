## 1. 接口扩展

- [x] 1.1 在 `packages/tap-note-editor/src/types.ts` 中新增 `TapNoteInlineAssistantContext` 接口（submit/accept/reject/abort/retry/close + store）
- [x] 1.2 扩展 `TapNoteInlineAssistant` 接口，增加可选 `context` 字段
- [x] 1.3 在 `packages/tap-note-editor/src/index.ts` 中导出新类型
- [x] 1.4 在 `TapNoteEditorProps` 中增加 `aiTools?: readonly AIToolItem[]` 可选字段
- [x] 1.5 在 `packages/tap-note-editor/package.json` 的 dependencies 中添加 `lucide-react`

## 2. 自定义 FormattingToolbarController

- [x] 2.1 新建 `packages/tap-note-editor/src/formatting-toolbar/tap-note-formatting-toolbar-controller.tsx`，参考 `@blocknote/react` 的 `FormattingToolbarController` 实现定位逻辑（使用 `@blocknote/core` 的 `FormattingToolbarExtension` + `@blocknote/react` 的 popover 定位）
- [x] 2.2 在 controller 中支持 `aiMode` 状态：AI 模式下 `onOpenChange(false)` 被忽略（阻止 dismiss）
- [x] 2.3 传递 `floatingUIOptions`（offset/shift/flip）保持与默认工具栏一致的定位

## 3. AI 工具栏 UI 组件（依赖 Task 5 的字典字段定义）

- [x] 3.1 定义 `AIToolItem` 类型和内置 `DEFAULT_AI_TOOLS`：至少包含扩写、总结、润色、精简，图标字段使用 Lucide 组件类型
- [x] 3.2 新建 `packages/tap-note-editor/src/formatting-toolbar/ai-toolbar-button.tsx`：AI 工具按钮，使用 Lucide 图标，busy 时禁用
- [x] 3.3 新建 `packages/tap-note-editor/src/formatting-toolbar/ai-toolbar-tools.tsx`：技能列表，点击技能调用对应 `tool.prompt`，不使用 emoji 图标
- [x] 3.4 新建 `packages/tap-note-editor/src/formatting-toolbar/ai-toolbar-input.tsx`：自定义指令输入框 + 发送 + 关闭按钮，Enter 提交，Escape 关闭（进行中时先调用 abort）
- [x] 3.5 新建 `packages/tap-note-editor/src/formatting-toolbar/ai-toolbar-status.tsx`：根据 AI 状态显示 thinking/writing（+中止）、reviewing（接受/拒绝）、error（+重试/关闭）
- [x] 3.6 新建 `packages/tap-note-editor/src/formatting-toolbar/index.tsx`：组合组件，管理 `mode: 'formatting' | 'ai'` 状态，格式行保持显示，AI 模式向下展开技能列表和输入/状态 UI

## 4. TapNoteEditor 集成

- [x] 4.1 修改 `tap-note-editor.tsx`：当 `inlineAssistant?.context` 存在时，`BlockNoteView` 设 `formattingToolbar={false}` 并渲染自定义 controller
- [x] 4.2 当 `inlineAssistant?.context` 不存在时，保持默认 `formattingToolbar` 行为（不传 false）
- [x] 4.3 将 `inlineAssistant.context`、`aiBusyState` 和解析后的 `aiTools` 传递给自定义工具栏组件
- [x] 4.4 在 `TapNoteEditor` props 中增加 `aiTools?: readonly AIToolItem[]`；未传使用默认列表，空数组隐藏技能列表

## 5. i18n 字典扩展

- [x] 5.1 在 `packages/tap-note-editor/src/i18n/zh-cn.ts` 中增加 AI 工具栏相关文案：`aiToolbarPlaceholder`、`aiToolbarSend`、`aiToolbarClose`、`aiToolbarWriting`、`aiToolbarAbort`、`aiToolbarAccept`、`aiToolbarReject`、`aiToolbarRetry`，以及内置技能的 label
- [x] 5.2 扩展 `TapNoteDictionary` 类型包含新字段
- [x] 5.3 新建 `packages/tap-note-editor/src/i18n/en.ts` 英文字典（或在 README 中标注"仅中文，英文后续 change 补充"）
- [x] 5.4 更新 `packages/tap-note-editor/README.md`，补充 AI toolbar 接入说明

## 6. Web Demo 适配

- [x] 6.1 修改 `apps/web/src/App.tsx`：移除独立的 `AIMenuPanel` 组件和相关状态（`menuOpen`、`useAIInlineState`）
- [x] 6.2 移除顶部 AI 助手按钮（三个路由 /inline、/chat、/both 的 inline AI 入口统一改为 toolbar 内联）
- [x] 6.3 清理 `apps/web/src/app.css` 中 `.tn-demo-ai-menu` 相关样式

## 7. 测试

- [x] 7.1 为 `TapNoteInlineAssistantContext` 接口兼容性编写类型测试（鸭子类型验证）
- [x] 7.2 为自定义工具栏组件编写渲染测试：有 context 时显示 AI 工具按钮，无 context 时不显示
- [x] 7.3 为 AI 面板展开编写测试：点击 AI 工具按钮后格式行仍存在，技能列表和输入框出现，Escape 关闭
- [x] 7.4 为默认和自定义技能列表编写测试：默认列表、props 替换、空数组仅保留输入框
- [x] 7.5 为技能点击编写测试：调用对应 `context.submit(tool.prompt)` 并进入处理中状态
- [x] 7.6 为 AI 面板无障碍编写测试：role/aria-label 存在，技能项可 Tab 聚焦
- [x] 7.7 验证现有 `tap-note-editor` 和 `tap-note-ai-inline` 测试不受影响

## 8. 验证

- [x] 8.1 运行 `bun run lint` 确认无新增 lint 错误
- [x] 8.2 运行 `bun run typecheck` 确认类型安全
- [x] 8.3 运行 `bun run test` 确认所有测试通过
