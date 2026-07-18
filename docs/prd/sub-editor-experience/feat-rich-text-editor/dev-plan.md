# 开发计划：富文本编辑器（FEAT-001）

## 1. 概览

- 需求来源：
  - 功能目录 `docs/prd/sub-editor-experience/feat-rich-text-editor/`：`prd.md`、`tech.md`、`ui.md`
  - 所属 Sub `docs/prd/sub-editor-experience/`：`prd.md`、`tech.md`、`ui.md`
  - 总 PRD `docs/prd/main-prd.md`（v8）
- 计划状态：规划中
- 计划版本：v2
- 目标：将 `@blocknote/core` + `@blocknote/react` + `@blocknote/shadcn`（MPL-2.0）封装为开箱即用的 `@tap-note/editor` 包，提供 `TapNoteEditor` 组件与 `useCreateTapNoteEditor` hook，统一处理初始内容、主题、slash 菜单、格式工具栏与助手挂载点。
- 非目标：
  - AI 协议、状态机、流式解析、documentState 构造、accept/reject（属 FEAT-002/003）；
  - 聊天面板 UI（属 FEAT-004）；
  - 后端 API、模型路由、JWT（属 FEAT-005）；
  - 多路由 demo（属 FEAT-006，本 feat 仅在 `apps/web` 做临时冒烟挂载，FEAT-006 接管后清理）；
  - 文档持久化、账号、协作、导出、字体（总 PRD §5.2 明确排除）；
  - npm 发布与 tsup 构建（属 P1 FEAT-007，MVP 阶段 workspace 直接消费源码）。

## 2. 需求摘要

### 用户故事

- US-001（集成开发者）：我希望 `npm install @tap-note/editor` 后用 3 行代码渲染可编辑文档，且不必担心 GPL 传染。

### 功能需求

- FR-001：提供 `TapNoteEditor` 组件，接受 `initialContent`（BlockNote blocks JSON）。
- FR-002：提供 `useCreateTapNoteEditor` hook 暴露受控/非受控实例。
- FR-003：支持 `editable`、`theme`、`onChange` props。
- FR-004：预装 shadcn 皮肤、slash 菜单与格式工具栏。
- FR-005：提供助手挂载点（`inlineAssistant`/`chatAssistant` 可选注入）。
- FR-006：默认 zh-CN 文案，字典可替换。
- FR-007：发布包授权干净（不含 `@blocknote/xl-*` 或 GPL/AGPL）。

### 非功能需求

- 性能：大文档（500 块）编辑无明显卡顿（总 PRD §11）。
- 兼容性：现代 Chromium/Firefox/Safari 最新两个大版本；React 19；Node ≥ 20；Bun 1.3+（总 PRD §11）。
- 授权合规：发布前扫描依赖闭包，生成 SBOM；`LICENSE`/`NOTICE` 与第三方清单随包发布（总 PRD §11、§9）。
- 可访问性：块编辑、slash 菜单、工具栏可键盘导航、焦点恢复、屏幕阅读器状态提示（总 PRD §11）。
- 可维护性：遵循 monorepo 现有 ESLint/Prettier 与 kebab-case 目录、index 入口规范。

## 3. 现状分析

### 相关模块

- 根 monorepo：Bun + Turbo，workspaces `apps/*` + `packages/*`，`bun@1.3.14`，TS `~6`；根脚本 `build`/`dev`/`lint`/`format`/`typecheck` 经 turbo 编排（`turbo.json`：`build` 产出 `dist/**`，`lint`/`format`/`typecheck` 含 `^lint` 等上游依赖）。
- `packages/ui`（`@workspace/ui`）：private，**无构建步骤**，直接以 `exports` 暴露源码（`./globals.css`、`./lib/*`、`./components/*`、`./hooks/*`）；使用 `@base-ui/react`（非 radix）、`tailwind-merge@3`、`shadcn@4.13`、`zod@4`、`react@19.2`；tsconfig `paths` 自指 `@workspace/ui/*`。
- `apps/web`：Vite 8 + React 19.2 + Tailwind 4；`tsconfig.app.json` 含 `paths` `@/*` 与 `@workspace/ui/*`；`components.json` 指向 `packages/ui/src/styles/globals.css`，baseColor `neutral`，style `base-nova`；`App.tsx` 为模板占位（仅一个 Button）。
- `packages/ui/src/styles/globals.css`：`@import "tailwindcss"` + `@source "../../../apps/**/*.{ts,tsx}"` + `@source "../**/*.{ts,tsx}"`，已定义 shadcn CSS 变量（`--background`/`--primary` 等，neutral 主题）。
- `resource/BlockNote`：git submodule（仅参考，不参与构建），BlockNote `0.51.4`。

### 可复用内容

- `packages/ui` 的包脚手架模式（`package.json`/`tsconfig.json`/`eslint.config.js`/源码直接 exports）作为 `@tap-note/editor` 的模板。
- `packages/ui` 的 shadcn 组件（Button、Select 等）与 CSS 变量可被 `@blocknote/shadcn` 的 `BlockNoteView.shadCNComponents` 复用。
- 共享 `eslint.config.js` 风格（js + tseslint + react-hooks + react-refresh）。
- `apps/web` 的 Vite/Tailwind/alias 配置。

### 需要修改

- `apps/web/package.json`：加 `@tap-note/editor` workspace 依赖。
- `apps/web/tsconfig.app.json`：加 `@tap-note/editor` paths。
- `apps/web/src/App.tsx`：临时挂载 `TapNoteEditor` 做冒烟（FEAT-006 接管后清理）。
- `packages/ui/src/styles/globals.css`：追加 `@source` 指向 `@blocknote/shadcn`（让 Tailwind 4 扫描 BlockNote 的类名）。

### 需要新增

- `packages/tap-note-editor/` 整个包：`package.json`、`tsconfig.json`、`eslint.config.js`、`src/index.ts`、`src/tap-note-editor.tsx`、`src/use-create-tap-note-editor.ts`、`src/theme/`、`src/i18n/zh-cn.ts`、`src/types.ts`。
- 测试运行器配置（项目当前无任何测试基础设施，见 §9）。

### 已有测试覆盖

- 无。项目当前无测试文件、无 `test` 脚本、无 `vitest`/`bunfig.toml`。测试基础设施需在本 feat 内引入（见 T-010）。

### 与 PRD 事实对齐

- Context7 `/websites/blocknotejs`（2026-07-17）确认：React seam 为 `useCreateBlockNote`（创建 editor）+ `BlockNoteView`（渲染，uncontrolled）；`initialContent` 传入 `useCreateBlockNote({ initialContent })` 而非 `BlockNoteView`；`editable`/`theme`/`onChange` 为 `BlockNoteView` props。
- 关键发现：`@blocknote/shadcn` 的 `BlockNoteView` 接收 `shadCNComponents` prop 映射宿主 shadcn 组件（Button/Select/Popover 等），并要求在 Tailwind CSS 中加 `@source "../node_modules/@blocknote/shadcn"` 与 shadcn CSS 变量（`packages/ui/src/styles/globals.css` 已具备变量）。
- 待验证风险：`@workspace/ui` 基于 `@base-ui/react`（非 radix），其 shadcn 组件 API 是否满足 `BlockNoteView.shadCNComponents` 期望的接口形状，须 T-001 实测（见 §9）。

## 4. 技术方案

### 4.1 方案概述

`@tap-note/editor` 作为 `packages/ui` 风格的源码导出包（MVP 不构建、不发布 npm，workspace 直接消费）。`TapNoteEditor` 组件内部用 `useCreateBlockNote` 创建实例、`BlockNoteView`（来自 `@blocknote/shadcn`）渲染，并把 `@workspace/ui` 的 shadcn 组件经 `shadCNComponents` 注入 BlockNote，实现皮肤复用与样式统一。助手挂载点为可选注入接口，类型在 `src/types.ts` 定义并由 FEAT-002/003/004 结构性满足。

```text
集成方
  -> <TapNoteEditor initialContent editable theme onChange inlineAssistant? chatAssistant? />
  -> useCreateBlockNote({ initialContent })
  -> BlockNoteView (from @blocknote/shadcn, shadCNComponents <- @workspace/ui)
  -> BlockNoteView.onChange -> Block[] -> props.onChange
```

### 4.2 数据与接口

- 输入 props（方案草稿，助手类型与 FEAT-002 对齐）：

```ts
interface TapNoteEditorProps {
  initialContent?: PartialBlock[]
  editable?: boolean             // default true
  theme?: "light" | "dark"
  onChange?: (blocks: Block[]) => void
  inlineAssistant?: TapNoteInlineAssistant   // 来自 FEAT-003，可选
  chatAssistant?: TapNoteChatAssistant       // 来自 FEAT-004，可选
  dictionary?: Partial<TapNoteDictionary>
}
```

- `useCreateTapNoteEditor(options?): { editor, ref }`：暴露 BlockNote editor 实例，供 FEAT-002 applier 调用 `insertBlocks`/`updateBlock`/`removeBlocks`。
- 领域边界：`PartialBlock[]` / BlockNote editor 实例；无持久化、无迁移、无后端契约。
- 助手注入类型 `TapNoteInlineAssistant`/`TapNoteChatAssistant` 在 `src/types.ts` 定义为最小接口（FEAT-002 实现时结构性满足），精确形状待与 FEAT-002 协调。

### 4.3 前端与交互

- `BlockNoteView` 默认提供 slash 菜单、格式工具栏、拖拽、缩进（FR-004）。
- `editable=false` 时只读，块不可拖拽。
- `initialContent` 非法时 try/catch 兜底空文档 + `console.warn`，不抛错阻断渲染。
- 助手未注入时不出现 AI 入口且不报错；注入时由助手提供 slash 项/工具栏按钮/面板。
- busy 状态由 FEAT-002 ai-core 持有，编辑器只据其订阅呈现入口禁用态（不在本 feat 实现 busy 逻辑）。
- 默认 zh-CN 文案；`dictionary` 可覆盖（FR-006）。

### 4.4 错误、安全与兼容性

- 错误：`initialContent` 非法兜底空文档；助手版本不匹配 `console.warn` 并忽略；不向用户暴露内部异常。
- 安全：组件不读 API Key、不发起 HTTP；不信任外部 blocks 为权威，仅作渲染输入；无隐私数据落盘。
- 兼容性：React 19 + BlockNote 0.51.4 组合须 T-001 最小 demo 验证后锁定。
- 样式：`@blocknote/shadcn` 经 `shadCNComponents` 复用 `@workspace/ui` 组件 + `@source` 指令接入 Tailwind 4；CSS 变量已就绪。base-ui 组件 API 兼容性见 §9。
- 回滚：独立包；UI 回归可回滚 web 部署；包回滚不影响集成方文档数据（纯组件）。

### 4.5 测试策略

- 组件测试：props（initialContent/editable/theme/onChange）渲染与回调断言；助手注入/未注入两情形入口显隐。
- 测试运行器：采用 `bun:test`（与 Bun 工具链统一，总 PRD v8 §17 item 24 已决策；不引入 Vitest）。React 组件测试需配合 `happy-dom` 或 `@testing-library/react` 提供 DOM 环境（待 T-010 选定具体版本并锁定）。
- 冒烟验证：`apps/web` 临时挂载，人工验证渲染/编辑/slash/拖拽/缩进/格式工具栏。
- 许可证：生成依赖闭包清单，确认无 `@blocknote/xl-*`/GPL/AGPL（SBOM 与 tarball 扫描由 FEAT-007 统一，本 feat 仅做依赖闭包检查）。
- 参考代码：实现时优先阅读 `resource/BlockNote` submodule 源码理解 API 与交互模式，再独立编写（总 PRD v8 §9 参考代码规则、§17 item 22）。
- 命令：`bun run typecheck`、`bun run lint`、`bun run test`（T-010 后）。

## 5. 任务清单

### Phase 1：基础设施与依赖锁定

- [ ] T-001 调研并锁定 BlockNote 版本、API 与 shadcn 集成机制
  - 状态：待开始
  - 依赖：无
  - 涉及文件：`resource/BlockNote/packages/`（阅读，不修改）、`docs/prd/sub-editor-experience/feat-rich-text-editor/tech.md`（记录结论）
  - 验收条件：① 确认 `@blocknote/core`/`react`/`shadcn` 的精确发布版本（目标 0.51.4）；② 阅读 `resource/BlockNote` 源码确认 `useCreateBlockNote`/`BlockNoteView` API 与 `shadCNComponents` 期望的组件接口；③ 确认 `@blocknote/shadcn` 是否要求 `@source` 与 CSS 变量；④ 按三段优先级评估 shadcn 组件复用路径：`@workspace/ui`（base-ui）组件 API 是否满足 `shadCNComponents`？不兼容则降级为 `@blocknote/shadcn` 自带组件，仍不满足则参考源码自定义；⑤ 记录结论或待确认项到 `tech.md` §11/§13。
  - 验证方式：Context7 查询 + `resource/BlockNote` submodule 源码阅读 + npm registry 版本核查；结论写入 `tech.md`。

- [ ] T-002 [P] 创建 `packages/tap-note-editor` 脚手架
  - 状态：待开始
  - 依赖：无
  - 涉及文件：`packages/tap-note-editor/package.json`、`packages/tap-note-editor/tsconfig.json`、`packages/tap-note-editor/eslint.config.js`、`packages/tap-note-editor/src/index.ts`（空导出骨架）、`packages/tap-note-editor/README.md`
  - 验收条件：`package.json` `name=@tap-note/editor`、`private=true`、`type=module`、`exports` 含 `.`→`./src/index.ts`；`scripts` 含 `lint`/`format`/`typecheck`（对齐 `packages/ui`）；tsconfig 对齐 `packages/ui`（ES2022/DOM/ESNext/bundler/react-jsx/strict/noEmit + paths `@tap-note/editor/*`）；eslint.config.js 复用 `packages/ui` 风格；`src/index.ts` 存在。
  - 验证方式：`bun run typecheck` 与 `bun run lint` 在该包通过；`ls packages/tap-note-editor` 结构符合。

### Phase 2：依赖与核心实现

- [ ] T-003 添加并锁定 BlockNote 依赖
  - 状态：待开始
  - 依赖：T-001、T-002
  - 涉及文件：`packages/tap-note-editor/package.json`、`bun.lock`
  - 验收条件：`dependencies` 含 `@blocknote/core@0.51.4`、`@blocknote/react@0.51.4`、`@blocknote/shadcn@0.51.4`；`peerDependencies` 含 `react@^19`、`tailwindcss@^4`；lockfile 锁定具体版本；依赖闭包不含 `@blocknote/xl-*`/GPL/AGPL。
  - 验证方式：`bun install` 成功；`bun pm ls --all 2>/dev/null | rg '@blocknote/xl'` 无输出（或人工核查 lockfile）。

- [ ] T-004 实现 `useCreateTapNoteEditor` hook
  - 状态：待开始
  - 依赖：T-003
  - 涉及文件：`packages/tap-note-editor/src/use-create-tap-note-editor.ts`、`packages/tap-note-editor/src/index.ts`
  - 验收条件：封装 `useCreateBlockNote({ initialContent })`；返回 `{ editor, ref }`；`editor` 类型为 BlockNote editor 实例，暴露 `insertBlocks`/`updateBlock`/`removeBlocks` 供 FEAT-002 调用；从 `index.ts` 导出。
  - 验证方式：`bun run typecheck` 通过；T-010 组件测试断言 hook 返回 editor 实例。

- [ ] T-005 实现 `TapNoteEditor` 组件
  - 状态：待开始
  - 依赖：T-004
  - 涉及文件：`packages/tap-note-editor/src/tap-note-editor.tsx`、`packages/tap-note-editor/src/theme/index.ts`、`packages/tap-note-editor/src/index.ts`
  - 验收条件：渲染 `BlockNoteView`（来自 `@blocknote/shadcn`）；按 T-001 三段优先级策略装配 `shadCNComponents`——① 优先映射 `@workspace/ui` 的 Button/Select/Popover 等；② API 不兼容时降级为 `@blocknote/shadcn` 自带组件；③ 需深度定制时参考 `resource/BlockNote` 源码自定义组件；`editable`/`theme`/`onChange` props 透传；`initialContent` 经 hook 注入；`onChange` 转换为 `Block[]` 回调；非法 `initialContent` 兜底空文档 + `console.warn`；从 `index.ts` 导出 `TapNoteEditor`。
  - 验证方式：`bun run typecheck`/`bun run lint` 通过；T-009 冒烟渲染可见块编辑/slash/工具栏；T-010 组件测试断言 props 生效。

- [ ] T-006 [P] 实现助手挂载点与 props 类型
  - 状态：待开始
  - 依赖：T-004
  - 涉及文件：`packages/tap-note-editor/src/types.ts`、`packages/tap-note-editor/src/tap-note-editor.tsx`
  - 验收条件：定义 `TapNoteInlineAssistant`/`TapNoteChatAssistant` 最小注入接口（FEAT-002 结构性满足）；`TapNoteEditor` 接受可选 `inlineAssistant`/`chatAssistant`；未注入时不出现 AI 入口且不报错；注入存在性检查失败时 `console.warn` 并忽略。
  - 验证方式：`bun run typecheck` 通过；T-010 组件测试覆盖注入/未注入两情形。

- [ ] T-007 [P] 实现 i18n zh-CN 字典与替换接口
  - 状态：待开始
  - 依赖：T-002
  - 涉及文件：`packages/tap-note-editor/src/i18n/zh-cn.ts`、`packages/tap-note-editor/src/types.ts`、`packages/tap-note-editor/src/index.ts`
  - 验收条件：导出默认 zh-CN 字典 `tapNoteDictionaryZhCN` 与 `TapNoteDictionary` 类型；`TapNoteEditor` 接受可选 `dictionary` 进行 `Partial` 合并覆盖；从 `index.ts` 导出字典与类型。
  - 验证方式：`bun run typecheck` 通过；T-010 测试覆盖字典合并。

### Phase 3：样式与集成

- [ ] T-008 样式作用域隔离与 shadcn 接入
  - 状态：待开始
  - 依赖：T-001、T-005
  - 涉及文件：`packages/ui/src/styles/globals.css`、`packages/tap-note-editor/src/theme/index.ts`
  - 验收条件：在 `globals.css` 追加 `@source` 指向 `@blocknote/shadcn`（让 Tailwind 4 扫描 BlockNote 类名）；确认 shadcn CSS 变量已存在（neutral 主题）；按 T-001 三段优先级结论，若 `@workspace/ui` base-ui 组件 API 不满足 `shadCNComponents` 则降级（② `@blocknote/shadcn` 自带 / ③ 参考源码自定义），将最终策略与降级原因记录到 `tech.md` §12/§13。
  - 验证方式：`bun run dev` 启动 web，BlockNote 块/菜单/工具栏样式正确无冲突；`bun run build` 成功。

- [ ] T-009 apps/web 冒烟接入
  - 状态：待开始
  - 依赖：T-005、T-008
  - 涉及文件：`apps/web/package.json`、`apps/web/tsconfig.app.json`、`apps/web/src/App.tsx`
  - 验收条件：`apps/web/package.json` 加 `@tap-note/editor: workspace:*`；`tsconfig.app.json` paths 加 `@tap-note/editor/*`→`../../packages/tap-note-editor/src/*`；`App.tsx` 临时挂载 `<TapNoteEditor initialContent={...} onChange={...} />`（标注临时，FEAT-006 接管后清理）。
  - 验证方式：`bun run dev` 打开 web，人工验证渲染/编辑/回车建块/`/` slash/拖拽/缩进/格式工具栏；`bun run typecheck`/`bun run lint` 通过。

### Phase 4：测试与质量

- [ ] T-010 引入测试运行器并编写组件测试
  - 状态：待开始
  - 依赖：T-005、T-006
  - 涉及文件：`packages/tap-note-editor/package.json`（加 `test` 脚本）、`packages/tap-note-editor/bunfig.toml`（`[test]` 配置 `happy-dom` DOM 环境）、`packages/tap-note-editor/src/__tests__/tap-note-editor.test.tsx`、`packages/tap-note-editor/src/__tests__/use-create-tap-note-editor.test.ts`、根 `turbo.json`（加 `test` task）、`packages/tap-note-editor/package.json` devDependencies（`happy-dom`、`@testing-library/react` 等具体版本由 T-010 锁定）
  - 验收条件：采用 `bun:test`（总 PRD v8 §17 item 24 已决策）；配置 `happy-dom`（或等效）DOM 环境与 React Testing Library；编写组件测试覆盖：`initialContent` 渲染、`editable=false` 只读、`theme` 切换、`onChange` 回调、助手注入/未注入入口显隐、字典合并；hook 测试断言返回 editor 实例。
  - 验证方式：`bun run test` 全绿；`bun run typecheck`/`bun run lint` 通过。

- [ ] T-011 许可证合规检查
  - 状态：待开始
  - 依赖：T-003
  - 涉及文件：`packages/tap-note-editor/package.json`、`bun.lock`
  - 验收条件：生成 `@tap-note/editor` 依赖闭包清单；确认不含 `@blocknote/xl-ai`/`xl-ai-server`/`xl-pdf-exporter`/`xl-docx-exporter`/`xl-multi-column` 或任何 GPL/AGPL 依赖；在 `tech.md` §11 记录结论。
  - 验证方式：`bun pm ls --all`（或等效）核查闭包；人工复核无禁止依赖。

### Phase 5：文档与收尾

- [ ] T-012 编写包 README 与公开 API 文档
  - 状态：待开始
  - 依赖：T-005、T-006、T-007
  - 涉及文件：`packages/tap-note-editor/README.md`、`packages/tap-note-editor/src/index.ts`（JSDoc 注释）
  - 验收条件：README 含 3 行代码接入示例（`npm install` + `<TapNoteEditor>`）、props 表、zh-CN 字典覆盖说明、授权声明（MPL-2.0，不含 xl-*）；`index.ts` 导出含 JSDoc。
  - 验证方式：人工审阅 README；示例与 `apps/web` 冒烟用法一致。

## 6. 依赖关系

ASCII 草图：

```text
T-001 [P] ─┐
            ├─> T-003 ─> T-004 ─> T-005 ─┬─> T-008 ─> T-009
T-002 [P] ─┘                  │          │                │
                T-002 ─> T-007 [P]       │                │
                              │          ├─> T-010        │
                              │          ├─> T-012        │
                              │          │                │
                T-004 ─> T-006 [P] ──────┘                │
                T-003 ─> T-011                             ▼
                                                       (收尾)
```

Mermaid：

```mermaid
graph TD
    T001[T-001 调研锁定]
    T002[T-002 脚手架 P]
    T003[T-003 加依赖]
    T004[T-004 hook]
    T005[T-005 组件]
    T006[T-006 助手挂载点 P]
    T007[T-007 i18n P]
    T008[T-008 样式隔离]
    T009[T-009 web 冒烟]
    T010[T-010 测试]
    T011[T-011 许可证检查]
    T012[T-012 README]

    T001 --> T003
    T002 --> T003
    T002 --> T007
    T003 --> T004
    T004 --> T005
    T004 --> T006
    T001 --> T008
    T005 --> T008
    T005 --> T009
    T008 --> T009
    T005 --> T010
    T006 --> T010
    T003 --> T011
    T005 --> T012
    T006 --> T012
    T007 --> T012
```

## 7. 需求覆盖检查

| 需求 | 对应任务 | 覆盖情况 |
|---|---|---|
| US-001（3 行代码渲染 + 无 GPL） | T-002、T-005、T-009、T-011、T-012 | 已覆盖 |
| FR-001 TapNoteEditor + initialContent | T-002、T-005 | 已覆盖 |
| FR-002 useCreateTapNoteEditor hook | T-004 | 已覆盖 |
| FR-003 editable/theme/onChange | T-005 | 已覆盖 |
| FR-004 shadcn 皮肤/slash/工具栏 | T-005、T-008 | 已覆盖 |
| FR-005 助手挂载点 | T-006 | 已覆盖 |
| FR-006 zh-CN 字典可替换 | T-007 | 已覆盖 |
| FR-007 授权干净 | T-003、T-011 | 已覆盖 |

## 8. 验收标准

- [x] 所有用户故事都有对应实现任务（US-001 → T-002/T-005/T-009/T-011/T-012）
- [x] 核心成功路径已覆盖（渲染/编辑/slash/拖拽/缩进/工具栏 → T-005/T-008/T-009）
- [x] 错误、权限和边界场景已覆盖（非法 initialContent 兜底 → T-005；助手版本不匹配 → T-006；许可证 → T-011）
- [x] 相关测试和验证命令已定义（T-010 组件测试；`bun run typecheck`/`lint`/`test`/`dev`）
- [x] 文档、迁移和发布事项已处理（README → T-012；npm 发布与 tsup 构建明确为 P1 FEAT-007 非目标）

## 9. 风险与待确认事项

- [ ] **【阻塞】`@workspace/ui` base-ui 组件 API 是否满足 `BlockNoteView.shadCNComponents` 期望**：`@workspace/ui` 基于 `@base-ui/react`（非 radix），而 `@blocknote/shadcn` 的 `shadCNComponents` 期望 shadcn 组件接口（Button/Select/Popover 等）。已有三段降级策略（总 PRD v8 §17 item 23）：① `@workspace/ui` → ② `@blocknote/shadcn` 自带 → ③ 参考源码自定义。具体落到哪一段由 T-001 实测确认。影响 T-005/T-008。
- [ ] **【阻塞】BlockNote 精确发布版本与 React 19 兼容性**：目标 0.51.4，须 T-001 以 npm registry + 最小 demo 验证后锁定到 lockfile。
- [x] ~~测试运行器选择~~：已决策采用 `bun:test`（总 PRD v8 §17 item 24）；T-010 仍需锁定 `happy-dom`/`@testing-library/react` 具体版本。
- [ ] **npm scope `@tap-note/*`**：总 PRD §17 item 8 仍待用户确认；当前以 `@tap-note/editor` 为方案草稿。
- [ ] **npm 发布与 tsup 构建**：MVP 阶段 workspace 直接消费源码（对齐 `packages/ui` 模式）；`exports` 类型声明、tsup 构建配置明确为 P1 FEAT-007 范围，不在本 feat。
- [ ] **`@source` 路径稳定性**：`@source "../node_modules/@blocknote/shadcn"` 依赖 node_modules 位置，workspace hoisting 可能影响路径；T-008 需验证。
- [ ] **`erasableSyntaxOnly`/`verbatimModuleSyntax`**：`apps/web/tsconfig.app.json` 启用这两项，编辑器包 tsconfig 若对齐 `packages/ui`（未启用）可能与 web 消费端类型解析冲突；T-002/T-004 需验证 `import type` 用法。

## 10. 进度记录

| 任务 | 状态 | 完成时间 | 备注 |
|---|---|---|---|
| T-001 | 待开始 | - | - |
| T-002 | 待开始 | - | - |
| T-003 | 待开始 | - | - |
| T-004 | 待开始 | - | - |
| T-005 | 待开始 | - | - |
| T-006 | 待开始 | - | - |
| T-007 | 待开始 | - | - |
| T-008 | 待开始 | - | - |
| T-009 | 待开始 | - | - |
| T-010 | 待开始 | - | - |
| T-011 | 待开始 | - | - |
| T-012 | 待开始 | - | - |

## 11. 变更记录

| 版本 | 日期 | 变更内容 |
|---|---|---|
| v1 | 2026-07-17 | 初始计划。基于 FEAT-001 prd/tech/ui 与 SUB-002 prd/tech/ui，结合 Context7 `/websites/blocknotejs`（2026-07-17）确认的 `useCreateBlockNote`/`BlockNoteView`/`shadCNComponents` 集成模式生成。 |
| v2 | 2026-07-17 | 根据用户实施前确认订正：① 测试运行器改为 `bun:test`（T-010、§4.5、§9）；② shadcn 组件复用采用三段优先级策略——`@workspace/ui` → `@blocknote/shadcn` 自带 → 参考源码自定义（T-001/T-005/T-008、§4.5）；③ 明确 `resource/BlockNote` 为首要参考来源，实现优先阅读源码再独立编写（§4.5、§9，对齐总 PRD v8 §9 参考代码规则）；④ §9 风险项更新，移除已决策的测试运行器待确认。 |
