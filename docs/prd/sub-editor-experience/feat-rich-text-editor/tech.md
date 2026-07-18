# 技术方案：富文本编辑器

## 0. 文档信息

- 功能 ID：FEAT-001；所属 Sub：SUB-002；状态：草稿；依据：总 PRD v9、SUB-002 `tech.md`。

## 1. 当前项目事实与复用点

- `apps/web` 使用 Vite 8、React 19、Tailwind 4 与 `@workspace/ui`（base-ui + tailwind-merge@3）。
- `packages/tap-note-editor` 尚不存在；不得把规划目录写成已实现事实。
- `packages/ui` 为 shadcn 组件包，`apps/web/components.json` 已配置 shadcn。
- BlockNote `0.51.4` 在 `resource/BlockNote` submodule（仅参考，不参与构建）。
- sub tech.md 已记 Context7 `/websites/blocknotejs` 结论：React seam 为 `useCreateBlockNote` + `BlockNoteView`。

## 2. 本 feat 在 sub 中的位置与职责

`@tap-note/editor` 只封装 BlockNote 创建、默认 UI 与受控/非受控桥接；不导入 server-api、导出器或字体工具；AI 能力由注入的 SUB-003 实例提供（见 SUB-002 tech.md §2）。

```text
集成方 -> <TapNoteEditor> -> useCreateBlockNote + BlockNoteView (shadcn)
              |                |
              +-> optional SUB-003 assistants（注入）
```

## 3. 模块职责与目录范围

```text
packages/tap-note-editor/
├── package.json            # name=@tap-note/editor, exports
├── tsconfig.json
├── eslint.config.js
├── bunfig.toml             # bun:test preload 配置
├── test/                   # happy-dom 与 Testing Library preload 脚本
└── src/
    ├── index.ts            # 对外导出
    ├── tap-note-editor.tsx # TapNoteEditor 组件
    ├── use-create-tap-note-editor.ts
    ├── theme/              # 默认主题与 shadcn 皮肤装配
    ├── i18n/               # zh-CN 字典与替换接口
    └── types.ts            # 对外 props/实例类型
```

入口 `src/index.ts` 导出 `TapNoteEditor`、`useCreateTapNoteEditor`、props 类型与默认字典。

## 4. 组件接口

```ts
// 助手实例类型待与 FEAT-002/003/004 对齐
interface TapNoteEditorProps {
  initialContent?: PartialBlock[]
  editable?: boolean                // default true
  theme?: 'light' | 'dark'
  onChange?: (blocks: Block[]) => void
  inlineAssistant?: TapNoteInlineAssistant  // 来自 FEAT-003，可选
  chatAssistant?: TapNoteChatAssistant    // 来自 FEAT-004，可选
  aiBusyState?: TapNoteAIBusyState
  shadCNComponents?: Partial<ShadCNComponents>
  dictionary?: Partial<TapNoteDictionary>
}
```

`useCreateTapNoteEditor(options)` 返回 editor 实例，暴露 `insertBlocks`/`updateBlock`/`removeBlocks` 等 BlockNote API 供 FEAT-002 applier 调用；当前不承诺额外 DOM ref，后续只有出现明确测量或滚动场景才新增。

## 5. 数据模型与状态变化

- 文档状态为 BlockNote 内部 Prosemirror doc；`onChange` 输出 `Block[]`。
- 编辑器不持有 AI busy 状态；由 FEAT-002 `createAIBusyState` 逐会话创建，经 props/注入传入，编辑器据此呈现入口禁用。
- `@blocknote/shadcn` 的 `ShadCNDefaultComponents` 是独立包的完整默认组件基线；`shadCNComponents` 只接受通过接口验证的局部覆盖，不直接导入私有 `@workspace/ui`。
- 无迁移、无持久化（纯组件）。

## 6. 核心流程与错误处理

```text
挂载 TapNoteEditor
  -> useCreateBlockNote({ initialContent })
  -> BlockNoteView (shadcn 默认组件 + 可选局部 override, editable, theme)
  -> BlockNoteView onChange -> 转换为 Block[] -> props.onChange
```

错误处理：
- `initialContent` 非法：try/catch 兜底空文档 + console.warn，不抛错。
- 助手注入版本不匹配：存在性检查失败时 console.warn 并忽略，不阻断编辑。
- `editable=false`：禁用编辑、slash 唤起、格式化命令、拖拽与缩进操作。

## 7. 权限、安全、输入校验与隐私

- 组件不读 API Key、不发起 HTTP；模型与鉴权属 FEAT-005。
- `initialContent` 经 BlockNote schema 校验；外部传入的 blocks 不被信任为权威，仅作渲染输入。
- 无隐私数据落盘。

## 8. 测试策略

- 使用 `bun:test`；通过 `bunfig.toml` 的 `[test].preload` 加载 happy-dom 与 Testing Library 初始化脚本。
- 组件测试：props（initialContent/editable/theme/onChange）渲染与回调断言。
- 装配测试：注入/不注入助手两种情形，断言入口显隐。
- 跨 sub 集成：模型选择、AI 互斥、刷新无持久化（由 FEAT-006 E2E 覆盖）。
- 依赖闭包测试：构建产物不含 `@blocknote/xl-*`（许可证扫描由 FEAT-007 统一）。

## 9. 发布、兼容与回滚

- 独立包发布；demo 不是其运行时依赖。
- 以 semver 维护公开 props；破坏性 schema/API 变更须同 FEAT-007 发布说明。
- UI 回归可回滚独立 web 部署；包回滚通过上一稳定 npm 版本，不改变集成方文档数据。
- `exports` 字段、类型声明、tsup/vite 构建配置在 P1 由 FEAT-007 统一落地；MVP 阶段可在 monorepo 内以 workspace 直接消费，暂不发布 npm。
- 独立集成时，宿主必须按 README 配置 Tailwind 对 `@blocknote/shadcn` 的 `@source` 扫描；不能只依赖 monorepo 的 `packages/ui/src/styles/globals.css`。

## 10. 类似产品与开源方案调研

| 来源 | 日期 | 可借鉴 | 限制 |
|---|---|---|---|
| Context7 `/websites/blocknotejs` | 2026-07-17 | React seam `useCreateBlockNote` + `BlockNoteView`，shadcn 皮肤装配 | 具体 API/版本须实施前锁定 |
| BlockNote 官方仓库 | 2026-07-17 | core MPL-2.0 可安全依赖 | `xl-*` GPL/商业，禁止依赖 |
| Notion | 2026-07-17 | 块编辑、slash、工具栏交互 | 闭源，仅体验参考 |

## 11. 第三方依赖、版本与 Context7 记录

| 包 | 版本 | 授权 | 来源 | 备注 |
|---|---|---|---|---|
| `@blocknote/core` | 0.51.4 | MPL-2.0 | sub tech.md Context7 | 实施前以 lockfile 再次确认 |
| `@blocknote/react` | 0.51.4 | MPL-2.0 | 同上 | 同上 |
| `@blocknote/shadcn` | 0.51.4 | MPL-2.0 | 同上 | 默认完整组件基线；宿主仅可做局部 override |
| `react` | ^19 | MIT | 代码库现状 | peerDep |
| `tailwindcss` | ^4 | MIT | 代码库现状 | peerDep |
| `@happy-dom/global-registrator` | 待 T-010 锁定 | MIT | Bun 官方文档 | 仅测试 devDependency |
| `@testing-library/react` / `jest-dom` | 待 T-010 锁定 | MIT | Bun 官方文档 | 仅测试 devDependency |

> 实施前必须用 Context7 查询 BlockNote 最新稳定 API 与版本兼容性，并以最小 demo 验证 React 19 + BlockNote 0.51.4 组合，锁定到 workspace lockfile。

## 12. 备选方案与决策

- 备选 A：直接暴露 BlockNote UI（不封装）。优点：工作量小；缺点：无法稳定 tap-note 公开 API，集成方升级易碎。排除。
- 备选 B：包装一层 `TapNoteEditor`（采纳）。维护成本略增，但满足产品目标（稳定 API、授权干净、可发布）。
- 构建工具：tsup vs vite 库模式——待 P1 FEAT-007 统一决策，MVP 不阻塞。
- shadcn 组件复用策略（总 PRD v9 §9、§17 item 23）：独立包默认使用 `@blocknote/shadcn` 的 `ShadCNDefaultComponents`；`shadCNComponents` 只接受通过 `Partial<ShadCNComponents>` 兼容性验证的局部宿主 override。当前 `@workspace/ui` 仅有基于 base-ui 的 Button，不能假定提供 Select/Popover 等完整组件组；不兼容时保持默认基线，需深度定制时参考源码独立实现。
- shadcn CLI（总 PRD v9 §17 item 25）：若需新增宿主 shadcn 组件，先通过 Context7 查询当前官方安装命令、依赖与 Tailwind 兼容要求，再执行 CLI。
- 测试框架（总 PRD v9 §17 item 24）：采用 `bun:test`，以 `bunfig.toml` preload 注册 happy-dom 与 Testing Library 初始化脚本；具体版本由 FEAT-001 T-010 锁定。
- 参考代码（总 PRD v9 §9、§17 item 22）：`resource/BlockNote` submodule 为首要参考来源，实现优先阅读源码再独立编写，不复制受保护表达。

## 13. 技术风险与待确认

- `@blocknote/shadcn` 默认组件与宿主 Tailwind 4 `@source`/CSS 变量的集成尚未实测；独立集成与 monorepo 集成均须验证。
- `@workspace/ui` base-ui Button 是否可作为 `shadCNComponents.Button.Button` 的局部 override 尚待实测；不通过则保持 `ShadCNDefaultComponents`，不阻塞 MVP。
- BlockNote 精确 API 与依赖版本须实施前以官方文档 + lockfile 确认。
- npm scope `@tap-note/*` 待用户确认（总 PRD §17 item 8）。
- `@blocknote/shadcn` 自带 Radix + tailwind-merge@2；若宿主局部 override 使用 base-ui，需验证同页共存，但默认基线不依赖 `@workspace/ui`。
- `@happy-dom/global-registrator`/`@testing-library/react` 与 React 19 + `bun:test` 的具体版本须 T-010 锁定。

## 14. 研究闸门结论（add-rich-text-editor change, 2026-07-18）

通过 `resource/BlockNote` submodule 源码 + Context7 `/websites/blocknotejs` + npm registry 共同确认。

### 14.1 React seam 与 API 形状

- `useCreateBlockNote({ initialContent?: PartialBlock[] })` → `BlockNoteEditor` 实例
- `<BlockNoteView editor={editor} editable? theme? onChange? />`（shadcn 版内部封装 `BlockNoteViewRaw`）
- `initialContent` 进入 hook,**不是** `BlockNoteView` 的 prop
- editor 实例暴露 `insertBlocks`/`updateBlock`/`removeBlocks`/`replaceBlocks`/`moveBlocksUp`/`moveBlocksDown`,供 FEAT-002 ai-core 调用
- `onChange` 签名 `(editor: BlockNoteEditor) => void`,回调内通过 `editor.topLevelBlocks` 取最新 blocks

### 14.2 shadcn 组件基线

- `ShadCNDefaultComponents` 14 个 section:Avatar/Badge/Button/Card/DropdownMenu/Form/Input/Label/Popover/Select/Skeleton/Tabs/Toggle/Tooltip
- `Partial<ShadCNComponents>` 浅合并覆盖;`BlockNoteView` 内部 `{ ...defaults, ...overrides }`
- `@workspace/ui` 现仅 base-ui Button,与 radix 契约不同 → 本 change 不做任何 override,默认保留基线

### 14.3 依赖版本与许可证

| 包 | 版本 | peerDeps | 授权 |
|---|---|---|---|
| `@blocknote/core` | 0.51.4 | — | MPL-2.0 |
| `@blocknote/react` | 0.51.4 | react/react-dom `^18‖^19‖>=19-rc` | MPL-2.0 |
| `@blocknote/shadcn` | 0.51.4 | + `tailwindcss@^4.1.12` | MPL-2.0 |

`@blocknote/shadcn` 运行时依赖含 radix-ui、`lucide-react@^0.525`、`tailwind-merge@^2.6`、`react-hook-form@^7.65`。已知差异:web 用 `lucide-react@^1.24`,`packages/ui` 用 `tailwind-merge@^3`,Bun 会并存 hoist,需 T-003 后核查。`@blocknote/xl-*` 不在闭包中。

### 14.4 Tailwind 4 样式接入

Context7 确认 `@blocknote/shadcn` 需要:`@source "../node_modules/@blocknote/shadcn"` + 完整 shadcn CSS 变量 + `@custom-variant dark` + `.bn-shadcn *` 边框规则。

monorepo 现状核查(`packages/ui/src/styles/globals.css`):
- ✅ 已有 `@import "tailwindcss"`、`@import "shadcn/tailwind.css"`、`@custom-variant dark`、`@theme inline` 全部 color/radius 映射、`:root`/`.dark` 全部变量、`@layer base` 全局 border
- ❌ 仅缺 `@source` 指向 `@blocknote/shadcn`

monorepo 集成只需追加一行 `@source`;独立集成方需按 README 配置 `@source`、shadcn CSS 变量与 `.bn-shadcn` 边框规则。`@source` 路径在 Bun workspace 下应指向 hoist 后的 `node_modules/@blocknote/shadcn`,T-008 实测后锁定。

### 14.5 仍待确认

- `lucide-react`/`tailwind-merge` hoist 后的精确版本,需 T-003 安装后核查
- `@source` 在 workspace 下的最终相对路径,需 T-008 实测
- happy-dom/Testing Library 与 React 19 + bun:test 的具体版本,需 T-010 锁定

## 15. 实施闸门结果（add-rich-text-editor change, 2026-07-18）

### 15.1 依赖版本核查结果

`bun pm ls --all` 确认实际 hoist 版本:
- `@blocknote/core@0.51.4`、`@blocknote/react@0.51.4`、`@blocknote/shadcn@0.51.4`(均 MPL-2.0)
- `lucide-react@0.525.0`(@blocknote/shadcn 内嵌)、`tailwind-merge@2.6.1`(shadcn 内嵌)
- `apps/web` 的 `lucide-react@^1.24.0` 与 `packages/ui` 的 `tailwind-merge@^3` 各自独立解析,与 shadcn 版本并存,无冲突
- 无 `@blocknote/xl-*`、无 GPL/AGPL 依赖进入闭包

### 15.2 样式接入实测

`packages/ui/src/styles/globals.css` 追加 `@source "../../../node_modules/@blocknote/shadcn";` 后,Vite 8 dev/build 均通过,无 Tailwind 4 解析错误。CSS 变量齐备(`:root`/`.dark`/`@theme inline`),无需新增 shadcn 组件。

### 15.3 测试基础设施锁定

- `bun:test`(Bun 1.3.11 内置)+ `@happy-dom/global-registrator@^18.0.0` + `@testing-library/react@^16.3.0` + `@testing-library/jest-dom@^6.8.0`
- `bunfig.toml` 配置 `[test].preload = ["./test/happydom.ts", "./test/testing-library.ts"]`
- tsconfig 排除 `src/**/__tests__/**` 与 `test/**`,避免 `bun:test` 模块类型污染发布包 typecheck
- 11 个测试全绿(hook 3 + 组件 5 + 字典 3)

### 15.4 仍待人工验证

- slash 菜单弹出、格式工具栏交互、拖拽重排、缩进嵌套的浏览器视觉验证(T-8.2/T-8.3)
- light/dark 主题切换、窄屏布局、键盘焦点恢复的实际渲染效果(T-8.3)
- `onChange` 在真实输入下返回最新 blocks 的端到端确认(T-8.4,自动化测试已覆盖 handler 接线)

### 15.5 全屏布局修复(T-8.2 人工验证反馈)

人工验证发现:`<TapNoteEditor>` 默认按内容自适应高度,不会占满视口,导致 demo 中编辑器很小。核查 `resource/BlockNote/playground/src/style.css` 与 `examples/01-basic/14-editor-scrollable/src/style.css` 确认:**BlockNote 不在包内强制布局**,集成方必须显式设置 `.bn-container`(居中、限宽)和 `.bn-editor`(高度、滚动)。

修复:
- `apps/web/src/app.css` 新增 Notion 风格全屏布局:`html/body/#root` 100% 高度 + `.tap-note-app` flex column 100vh + `.bn-container` `max-width: 731px; margin: 0 auto` + `.bn-editor` `flex:1; overflow: auto`
- `apps/web/src/App.tsx` 改为 `<div class="tap-note-app"><header/><main class="tap-note-app-editor"><TapNoteEditor/></main></div>` 结构
- `packages/tap-note-editor/README.md` 新增"布局与高度(全屏可滚动)"小节,记录最小全屏模式与固定高度模式两种集成方式
- 不修改编辑器包源码:布局属集成方职责,与"纯组件"边界一致(总 PRD §5.1、§9)

### 15.6 无法输入字符修复(T-8.2 人工验证反馈)

人工验证发现:编辑器可见但任何字符都输不进去,只有 D 键能切换主题(`apps/web` theme-provider 的全局 keydown)。

根因分析:
- D 键能切主题 → `theme-provider` 的 `isEditableTarget(event.target)` 返回 false → `event.target` 不是 contenteditable → BlockNote 编辑器从未进入可编辑态
- 进一步排查 `useCreateTapNoteEditor` 实现:`useMemo(..., [initialContent])` 把 `initialContent` 数组当依赖
- `apps/web/src/App.tsx` 传的是 inline 数组字面量 `[{ type: "paragraph", content: "..." }]`,每次 render 都是新引用
- 触发循环:按键 → `onChange` → `setBlocks` → App 重渲染 → `initialContent` 新引用 → `useMemo` 重建 editor → `BlockNoteView` 收到新 editor 重新 mount → contenteditable 重新初始化 → 焦点丢失 → 下一个字符又触发循环
- editor 永远无法进入稳定可编辑态

修复:
- `useCreateTapNoteEditor` 改用 `useState(() => BlockNoteEditor.create(...))` 懒初始化,editor 在组件生命周期内只创建一次
- 这符合 design.md §Decisions 2 "非受控模型"决策:`initialContent` 只在 editor 创建时生效,后续变更不自动同步
- 也符合 React 19 推荐的一次性实例创建模式(React Compiler 友好,无 `react-hooks/refs` / `react-hooks/preserve-manual-memoization` 违规)
- `apps/web/src/App.tsx` 同时把 `initialContent` 提到模块顶层 `INITIAL_CONTENT` 常量,作为集成方最佳实践示范
- README 的 hook 文档显式说明"非受控模型"语义,提醒集成方稳定 `initialContent` 引用或用 `key` prop 强制重建
- 不接受 `deps` 参数(对比官方 `useCreateBlockNote(options, deps)`),因为非受控模型下 editor 不应在 props 变化时重建,集成方需要重建时用 `key` 即可

`tap-note-editor.tsx` 的 `useAIBusy` 用 `useSyncExternalStore` 不受影响,仍正确订阅 busy 状态。11 个组件测试全绿,无回归。

### 15.7 编辑器皮肤决策(MVP 用 @blocknote/shadcn,P1 切自研 base-ui)

人工验证发现 `@blocknote/shadcn` 样式不工作,根因是 Bun 1.3 隔离式 node_modules + Tailwind 4 `@source` 的工程兼容问题(`@blocknote/shadcn` 装在 `node_modules/.bun/<pkg>+<hash>/node_modules/@blocknote/shadcn`,根 `node_modules/@blocknote/` 不存在,Tailwind 4 默认 `@source` 路径扫不到)。

讨论两个方案:
- **A. 修 `@source` 路径**:继续用 `@blocknote/shadcn`,工程修复让样式可见
- **B. 重写皮肤**:参考 `@blocknote/shadcn` 源码,用 `packages/ui` 的 base-ui + Tailwind 4 + 最新 shadcn 栈自己实现一套 BlockNote 皮肤,彻底解决 `@source` 问题 + 对齐 `packages/ui` 栈

**决策(v10)**:MVP 走 A,P1 切 B。

理由:
1. MVP 焦点是端到端可运行编辑器,B 方案 5-10 天工作量(14 个组件 section + `components.ts` 适配层 + `BlockNoteView` 等价物)足以撑满独立 change,不应塞进 FEAT-001 阻塞 MVP
2. P1 切 B 的收益清晰:对齐 `packages/ui` 全栈 base-ui、解除 `@tap-note/editor` 对 radix 的传递依赖、彻底解决 Bun 1.3 + Tailwind 4 `@source` 工程问题、视觉迭代与 `packages/ui` 一致
3. `components.ts` 是 BlockNote 私有契约(没有公开文档,要逆向 `@blocknote/react` 源码),P1 时有充足时间做这个逆向工作
4. MPL-2.0 重写有合规边界:不能复制 `components.ts` 的逻辑结构,需要真正的独立设计 + 保留来源记录,P1 时可从容处理

P1 新开 change `replace-shadcn-skin-with-base-ui`,届时同步更新:
- 本 feat `tech.md` §12 备选方案 B 决策记录
- `openspec/changes/add-rich-text-editor/design.md` Decision 3(改为"自研 base-ui 皮肤")
- `openspec/changes/add-rich-text-editor/specs/editor/spec.md` "提供兼容的 shadcn 组件基线" requirement(改为"提供 base-ui 皮肤")
- 本 feat `dev-plan.md` 不变,P1 时由新 change 接管皮肤工作

MVP 阶段仅修 `@source` 路径(指向 Bun 1.3 真实 hoisting 路径 `node_modules/.bun/node_modules/@blocknote/shadcn` symlink 或带 hash 的真实路径),让 `@blocknote/shadcn` 样式可见,完成 T-6.5/T-8.2/T-8.3 人工验证。

### 15.8 `@source` 路径修复(T-8.2 人工验证反馈)

人工验证发现编辑器与 slash 菜单完全无样式。根因排查链:

1. **Bun 1.3 隔离式 hoisting**:`@blocknote/shadcn` 装在 `node_modules/.bun/@blocknote+shadcn@0.51.4+<hash>/node_modules/@blocknote/shadcn`,根 `node_modules/@blocknote/` **不存在**(Bun 1.3 不创建根级 symlink,与 npm/pnpm/yarn 不同)。`.bun/node_modules/@blocknote/shadcn` 是稳定 symlink,不带 hash。
2. **Tailwind 4 `@source` 路径层级数错**:`packages/ui/src/styles/globals.css` 在第 4 层深度(`packages/ui/src/styles/`),回到 monorepo 根需要 4 个 `../`。我之前用了 3 个 `../`(`../../../node_modules/...`),路径解析到 `packages/node_modules/`(不存在),Tailwind 4 静默跳过不报错。
3. **静默跳过不报错**:Tailwind 4 对不存在的 `@source` 路径不报警,utility class 直接不生成,导致 `bg-popover`/`text-popover-foreground`/`size-4`/`rounded-md` 等 BlockNote shadcn 组件用到的关键 class 全缺,编辑器与 slash 菜单无样式。

修复:
- `packages/ui/src/styles/globals.css` 的所有 `@source` 路径从 3 个 `../` 改为 4 个 `../`:
  - `../../../../apps/**/*.{ts,tsx}`
  - `../**/*.{ts,tsx}`(相对路径,扫 `packages/ui/src/`)
  - `../../../../node_modules/.bun/node_modules/@blocknote/shadcn`(Bun 1.3 symlink)
  - `../../../../node_modules/@blocknote/shadcn`(npm/pnpm/yarn 标准路径,Bun 下不存在但无害)
- Tailwind 4 跟随 symlink 扫描真实文件,CSS 体积从 23KB 跳到 45KB,`bg-popover`/`text-popover-foreground`/`size-4`/`rounded-md` 等关键 class 全部生成

`packages/tap-note-editor/README.md` "Tailwind 4 样式接入"小节同步更新,记录 Bun 1.3 特殊处理与路径层级注意,提醒集成方 `@source` 路径是相对当前 CSS 文件解析、静默跳过不报错这一排查线索。
