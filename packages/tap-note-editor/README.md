# @tap-note/editor

BlockNote 风格的可编辑文档组件包,封装 `@blocknote/core` + `@blocknote/react` + `@blocknote/shadcn`(均 MPL-2.0),提供 `TapNoteEditor` 组件与 `useCreateTapNoteEditor` hook。

> **状态**:MVP workspace 源码消费,尚未发布到 npm(npm 发布与 tsup 构建由 FEAT-007 落地)。

## 最小接入示例

```tsx
import { TapNoteEditor } from "@tap-note/editor";

export function App() {
  return (
    <TapNoteEditor
      initialContent={[{ type: "paragraph", content: "hello" }]}
      onChange={(blocks) => console.log(blocks)}
    />
  );
}
```

## Props

| Prop              | 类型                                    | 默认值      | 说明                                       |
| ----------------- | --------------------------------------- | ----------- | ------------------------------------------ |
| `initialContent`  | `PartialBlock[]`                         | 空段落      | 编辑器初始文档内容                         |
| `editable`        | `boolean`                                | `true`      | 是否允许编辑                               |
| `theme`           | `"light" \| "dark"`                      | 跟随系统    | 强制 light/dark 主题                       |
| `onChange`        | `(blocks: Block[]) => void`               | -           | 文档变更回调,返回最新顶级 blocks          |
| `inlineAssistant` | `TapNoteInlineAssistant`                | -           | 来自 FEAT-003,可选                         |
| `chatAssistant`   | `TapNoteChatAssistant`                   | -           | 来自 FEAT-004,可选                         |
| `aiBusyState`     | `TapNoteAIBusyState`                    | -           | 来自 FEAT-002,会话级 AI 互斥状态          |
| `aiTools`         | `readonly AIToolItem[]`                  | 内置列表    | AI 技能列表;未传用默认,空数组隐藏技能行  |
| `shadCNComponents` | `Partial<ShadCNComponents>`              | -           | 局部覆盖 shadcn 组件基线(须通过验证)     |
| `dictionary`      | `Partial<TapNoteDictionary>`             | zh-CN       | 局部覆盖默认中文文案                       |

## hook

```tsx
import { useCreateTapNoteEditor } from "@tap-note/editor";

const editor = useCreateTapNoteEditor({ initialContent });
// editor 暴露 insertBlocks / updateBlock / removeBlocks / replaceBlocks / moveBlocks*
```

> **非受控模型**:`initialContent` 只在 editor 首次创建时生效。后续 render 传入新
> `initialContent` 不会自动同步到 editor。如需在 `initialContent` 变化时重建 editor,
> 显式传 `deps` 参数:`useCreateTapNoteEditor({ initialContent }, [initialContent])`。
> 集成方通常应把 `initialContent` 用 `useMemo`/模块顶层常量稳定下来,避免每次 render
> 重建 editor 导致 contenteditable 反复卸载、焦点丢失。```

## Tailwind 4 样式接入(独立集成方必读)

`@tap-note/editor` 内部已 `import "@blocknote/shadcn/style.css"`,加载 BlockNote 的 `bn-*` 类、块类型样式(heading/bullet/numbered/checklist)、颜色变量(`--bn-colors-*`)。集成方**无需**再显式 import BlockNote CSS。

但仍需配置 Tailwind 4 让 shadcn 组件用到的 utility class 生成:

### 1. `@source` 指令

在宿主 Tailwind CSS 入口添加(路径相对宿主项目根目录,通常 `../node_modules/@blocknote/shadcn` 即可,因为多数包管理器在根 `node_modules/@blocknote/` 创建 symlink 或真实目录):

```css
@source "../node_modules/@blocknote/shadcn";
```

> **Bun 1.3 隔离式 hoisting 特殊处理**:Bun 1.3 不在根 `node_modules/@blocknote/` 创建 symlink,包真实位置在 `node_modules/.bun/<pkg>+<hash>/node_modules/@blocknote/shadcn`,但 `node_modules/.bun/node_modules/@blocknote/shadcn` 是稳定的 symlink 路径。Bun 用户需要追加:
> ```css
> @source "../node_modules/.bun/node_modules/@blocknote/shadcn";
> @source "../node_modules/@blocknote/shadcn";
> ```
> Tailwind 4 会跟随 symlink 扫描真实文件,并静默跳过不存在的路径,所以两条都加是安全的(适配 npm/pnpm/yarn/Bun)。

> **路径层级注意**:`@source` 路径是相对**当前 CSS 文件**解析的。在 monorepo 中,如果样式表在 `packages/<pkg>/src/styles/globals.css`(第 4 层深度),需要 4 个 `../` 回到 monorepo 根:`../../../../node_modules/...`。Tailwind 4 静默跳过不存在路径,路径错了不会报错,但 utility class 不生成 —— 这是排查"样式全无"的关键线索。

### 2. shadcn CSS 变量

引入 `@blocknote/shadcn/style.css`,或在宿主 CSS 中定义等价变量:背景/前景/primary/secondary/muted/accent/destructive/border/input/ring/radius/sidebar-*/chart-* 等变量,并通过 `@theme inline` 映射成 Tailwind color utilities。

### 3. dark 模式与容器边框(推荐)

```css
@custom-variant dark (&:is(.dark *));

@layer base {
  .bn-shadcn * {
    @apply border-border outline-ring/50;
  }
}
```

## 布局与高度(全屏可滚动)

BlockNote 默认按内容自适应高度,**不会**自动占满容器或滚动。要实现 Notion 风格的"全屏 + 内部滚动",集成方必须显式设置 `.bn-container` 和 `.bn-editor` 的样式。参考 `resource/BlockNote/playground/src/style.css` 与 `examples/01-basic/14-editor-scrollable`。

最小可用模式:

```css
html, body, #root { height: 100%; }

.app-shell { display: flex; flex-direction: column; min-height: 100vh; }
.app-editor { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }
.app-editor > [data-tap-note-editor] { flex: 1 1 auto; min-height: 0; display: flex; }

/* BlockNote 容器:居中、限宽,占满剩余空间 */
.app-editor .bn-container {
  width: 100%;
  max-width: 731px;   /* Notion 风格的舒适阅读宽度 */
  margin: 0 auto;
  padding: 1rem 1.5rem 4rem;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

/* 编辑器内容:占满容器,溢出滚动 */
.app-editor .bn-editor {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
}
```

固定高度模式(适合对话框/侧边面板):

```css
.bn-editor { height: 500px; overflow: auto; }
```

> `TapNoteEditor` 的外层包了 `<div data-tap-note-editor>`,可用作 flex 子项。BlockNote 内部的 `.bn-container` 和 `.bn-editor` 才是真正控制布局的层。

## 字典

默认 zh-CN,可通过 `dictionary` prop 局部覆盖:

```tsx
import { tapNoteDictionaryZhCN } from "@tap-note/editor";

<TapNoteEditor dictionary={{ aiBusy: "AI 处理中..." }} />
```

## 助手挂载与 busy 状态

编辑器只保存助手引用并转交 mount/unmount 生命周期,busy 状态由 `aiBusyState` 驱动(来自 FEAT-002 `createAIBusyState`),AI 进行中时编辑器入口禁用并显示 `aiBusy` 文案。未注入助手时不显示 AI 入口。

## AI 工具栏(内联 AI)

当 `inlineAssistant` 包含 `context` 字段时,格式工具栏末尾自动出现 AI 按钮(Lucide 图标)。点击后工具栏保持格式行,向下展开 AI 面板:

- **技能行**:内置扩写/总结/润色/精简,点击即提交对应 prompt
- **输入行**:自定义指令,Enter 提交,Escape 关闭
- **状态 UI**:写作中(中止)、审阅(接受/拒绝)、错误(重试)

```tsx
import { TapNoteEditor } from "@tap-note/editor";
import type { AIToolItem } from "@tap-note/editor";

const customTools: AIToolItem[] = [
  { id: "translate", label: "翻译", prompt: "请将选中内容翻译为英文" },
];

<TapNoteEditor
  inlineAssistant={inlineAssistant}
  aiBusyState={aiBusyState}
  aiTools={customTools}  // 替换默认列表;传 [] 隐藏技能行仅保留输入框
/>;
```

> 当前仅提供 zh-CN 字典,英文字典后续 change 补充。

## 授权边界

- `dependencies` 不含 `@blocknote/xl-*` 或任何 GPL/AGPL 依赖。
- 仅依赖 MPL-2.0 的 `@blocknote/{core,react,shadcn}` 与 `react@^19` / `tailwindcss@^4` peerDeps。
- 纯组件:不导出持久化、账号、协作或导出 API;刷新页面内容丢失属预期。

## TODO(FEAT-006)

- 多路由 demo 接管后,移除 `apps/web` 的临时冒烟挂载。
- npm 发布配置与类型声明构建由 FEAT-007 统一落地。
