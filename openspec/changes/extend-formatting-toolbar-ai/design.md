## Context

`TapNoteEditor` 当前直接渲染 `<BlockNoteView>` 并使用默认 `formattingToolbar={true}`，选中文字后出现 BlockNote 内置格式工具栏（加粗/斜体/链接等）。内联 AI 的 `context.submit()` 已由 `@tap-note/ai-inline` 暴露，但 editor 包的 `TapNoteInlineAssistant` 接口仅定义了 `mount/unmount/extension`，未暴露 context。

BlockNote 的工具栏自定义机制：`BlockNoteView` 设 `formattingToolbar={false}` 后，通过 children 渲染 `<FormattingToolbarController formattingToolbar={CustomComponent} />`。`FormattingToolbarController` 内部用 `FormattingToolbarExtension` store 控制显隐，用 floating-ui 的 `useDismiss` 处理外部点击关闭。

xl-ai 的做法是 AI 按钮关闭 toolbar 后打开独立的 `AIMenuController`（BlockPopover）。本 change 采用单一浮动容器的展开方案：格式工具栏保持为同一个定位容器，点击 AI 工具按钮后在其下方增加 AI 技能和输入区域，避免嵌套 popover。

## Goals / Non-Goals

**Goals:**

- 选中文字后格式工具栏末尾出现 AI 按钮
- 点击 AI 工具按钮后工具栏保持格式行，并向下展开技能列表和自定义指令输入框
- 选择技能或提交输入后展开区域跟随 AI 状态机显示进度/审阅/错误 UI
- 提供内置 AI 技能列表，并允许通过 `aiTools` prop 完全替换
- 所有 AI 工具栏图标使用 Lucide 图标，不使用 emoji 或 Unicode 图标字符
- AI 模式下阻止 floating-ui dismiss（外部点击不关闭）
- 无 inlineAssistant 时行为完全不变
- editor 包不 import ai-inline，仅依赖接口

**Non-Goals:**

- 不改变 ai-inline 的状态机、流式处理、suggest-changes 逻辑
- 不实现 slash `/ai` 触发（已有独立实现）
- 不实现移动端适配（后续 change）
- 不引入 `@blocknote/xl-ai`

## Decisions

### D1: 自定义 FormattingToolbarController 而非复用默认

**选择**: 在 `tap-note-editor` 内新建 `TapNoteFormattingToolbarController` 组件（~120 行），参考 `@blocknote/react` 的 `FormattingToolbarController` 实现。

**原因**: 默认 controller 的 `useDismiss` 行为无法动态控制（AI 模式下需阻止外部点击关闭）。通过 `floatingUIOptions.useDismissProps.enabled` 的 prop 传递无法响应内部 AI 模式状态变化。自写 controller 可以在 `onOpenChange` 中判断 AI 模式并忽略 `false`。

**替代方案**: 在 AI 按钮点击后立即 `formattingToolbar.store.setState(true)` 强制重开——会导致闪烁和焦点丢失，放弃。

### D2: 单一浮动容器展开 AI 面板

**选择**: 自定义 toolbar 组件内部维护 `mode: 'formatting' | 'ai'` state。`formatting` 只渲染默认格式行，`ai` 保留格式行并向下渲染 AI 技能列表和输入区域。AI 状态（thinking/writing/reviewing/error）通过 `useSyncExternalStore` 订阅 `inlineAssistant.context.store`。`TapNoteEditor` 通过已有的 `useAIBusy(aiBusyState)` 获取 busy 状态，作为 `disabled` prop 传入工具栏组件。

**原因**: 使用同一浮动容器可以保持定位和选区锚点不变，避免嵌套 floating-ui popover 的 dismiss、层级和焦点问题。模式切换是纯 UI 关注点，不需要提升到 editor 组件或全局状态。

**交互参照（实现时必须对齐）**:

```
步骤 2: 选中文字，出现工具栏（formatting 模式）
  ┌───┬───┬───┬────┬──────────┐
  │ B │ I │ U │ link │ [AI]   │  ← Lucide 图标，无 emoji
  └───┴───┴───┴────┴──────────┘

步骤 3: 点 AI 按钮 → 同一浮动容器向下展开（ai 模式）
  ┌───┬───┬───┬────┬──────────┐
  │ B │ I │ U │ link │ [AI]   │  ← 格式行保留且可交互
  ├─────────────────────────────┤
  │ [expand] 扩写  [sum] 总结  │  ← 技能行（Lucide 图标 + label，超出换行，超高滚动）
  │ [pen] 润色    [cut] 精简   │
  ├─────────────────────────────┤
  │ 输入你的指令...      [>] [x]│  ← 自定义输入行
  └─────────────────────────────┘

步骤 4: 点技能或提交指令 → 面板区切换为状态 UI（格式行仍在）
  ┌───┬───┬───┬────┬──────────┐
  │ B │ I │ U │ link │ [AI]   │
  ├─────────────────────────────┤
  │ AI 写作中...        [stop] │
  └─────────────────────────────┘

步骤 5: 审阅
  ┌───┬───┬───┬────┬──────────┐
  │ B │ I │ U │ link │ [AI]   │
  ├─────────────────────────────┤
  │ [check] 接受   [x] 拒绝   │
  └─────────────────────────────┘
```

**状态流转**:

```
              选中文字
                 │
                 ▼
        ┌─────────────────┐
        │   formatting    │◄──────────────────┐
        │ (格式行+AI按钮) │                    │
        └────────┬────────┘                    │
                 │ 点击 AI 按钮                 │
                 ▼                             │
        ┌─────────────────┐   Escape/关闭      │
        │    ai-panel     │────────────────────┤──→ 关闭工具栏
        │ 技能行 + 输入行  │                    │
        └────────┬────────┘                    │
        点技能 / 提交指令                        │
        submit(prompt)                         │
                 ▼                             │
        ┌─────────────────┐                    │
        │ thinking /      │──── abort ─────────┤──→ 关闭工具栏
        │ ai-writing      │                    │
        └────────┬────────┘                    │
                 │ 流式完成                     │
                 ▼                             │
        ┌─────────────────┐                    │
        │ user-reviewing  │── accept/reject ───┘──→ 关闭工具栏
        │ 接受 / 拒绝      │
        └────────┬────────┘
                 │ error
                 ▼
        ┌─────────────────┐
        │     error       │── retry → 回到 thinking
        │ 错误+重试/关闭   │── 关闭 → 关闭工具栏
        └─────────────────┘
```

### D3: 内置技能列表加 props 完全替换

**选择**: 提供 `DEFAULT_AI_TOOLS`，包含扩写、总结、润色、精简等常用技能。`TapNoteEditor` 增加可选 `aiTools?: readonly AIToolItem[]`：未传时使用默认列表，传入空数组时隐藏技能项但保留自定义输入，传入非空数组时完全替换默认列表。

```ts
interface AIToolItem {
  id: string
  label: string
  prompt: string
  icon?: React.ComponentType<{ className?: string }>
}
```

技能点击统一转换为 `context.submit(tool.prompt)`，因此增加技能不需要扩展 ai-inline 协议。需要二次选择参数的复杂技能不在本 change 范围内，可在后续 change 中扩展工具项行为类型。

内置技能推荐 Lucide 图标映射（实现时可微调，统一使用线性风格）：

| 技能 | 图标 | prompt 模板 |
|------|------|-------------|
| 扩写 | `Maximize2` | 请将选中内容扩写，补充更多细节和论述 |
| 总结 | `AlignLeft` | 请将选中内容总结为简洁要点 |
| 润色 | `PenLine` | 请润色选中内容，改善表达和流畅度 |
| 精简 | `Minimize2` | 请精简选中内容，去除冗余保留核心 |

### D4: 扩展 TapNoteInlineAssistant 接口暴露 context

**选择**: 在 `types.ts` 中扩展接口：

```ts
interface TapNoteInlineAssistantContext {
  submit: (prompt: string) => void
  accept: () => void
  reject: () => void
  abort: () => void
  retry: () => void
  close: () => void
  store: {
    state: { state: { status: 'user-input' | 'thinking' | 'ai-writing' | 'user-reviewing' | 'error'; error?: string } }
    subscribe: (listener: () => void) => () => void
  }
}

interface TapNoteInlineAssistant {
  readonly context?: TapNoteInlineAssistantContext
  // ...existing fields
}
```

**原因**: editor 包需要调用 submit/accept/reject 等方法并订阅状态变化。通过接口而非具体类型保持包边界。ai-inline 的 `createTapNoteInlineAssistant` 返回值已满足此接口（鸭子类型兼容），无需改动 ai-inline 代码。

### D5: AI 模式下工具栏定位保持不变

**选择**: 进入 AI 模式后不改变 floating-ui 的 position reference（仍锚定原选区）。工具栏高度和宽度会增加，通过 CSS 限制面板最大高度并允许技能列表滚动；输入框保持可用宽度。

**原因**: 避免跳动，用户视线不离开选区位置。

## Risks / Trade-offs

- **[Risk] 自写 controller 与 BlockNote 升级不兼容** → 保持最小实现（仅 position + dismiss 逻辑），升级时对照上游 diff 调整。
- **[Risk] AI 模式下选区丢失（用户点击输入框导致编辑器失焦）** → ai-inline 已有 `SelectionTracker` 在失焦前保存选区快照，submit 时使用快照，无需额外处理。
- **[Trade-off] 工具栏在 AI 写作期间持续占用屏幕空间** → 可接受，用户需要看到进度和中止按钮；写作完成后自动切换为审阅 UI。
- **[Trade-off] 接口用结构化类型而非品牌类型** → 鸭子类型兼容即可，避免 editor 对 ai-inline 的硬依赖。
- **[Trade-off] editor 字典与 ai-inline 字典字段重复** → editor 独立定义 AI toolbar 文案（不 import ai-inline 字典），字段名使用 `aiToolbar` 前缀区分（如 `aiToolbarPlaceholder`），避免语义耦合和双向依赖。
- **[Constraint] 图标实现** → AI 工具按钮、技能项、发送、关闭、状态和操作按钮统一使用 Lucide React 图标；禁止在实现和文案中使用 emoji 作为图标。
