# 技术方案：富文本编辑器

## 0. 文档信息

- 功能 ID：FEAT-001；所属 Sub：SUB-002；状态：草稿；依据：总 PRD v7、SUB-002 `tech.md`。

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
├── tsup.config.ts          # 构建配置（待确认，见 §11）
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
// 方案草稿，待与 FEAT-002 对齐助手实例类型
interface TapNoteEditorProps {
  initialContent?: PartialBlock[]
  editable?: boolean                // default true
  theme?: 'light' | 'dark'
  onChange?: (blocks: Block[]) => void
  inlineAssistant?: TapNoteInlineAssistant  // 来自 FEAT-003，可选
  chatAssistant?: TapNoteChatAssistant    // 来自 FEAT-004，可选
  dictionary?: Partial<TapNoteDictionary>
}
```

`useCreateTapNoteEditor(options)` 返回 `{ editor, ref }`，`editor` 暴露 `insertBlocks`/`updateBlock`/`removeBlocks` 等 BlockNote API 供 FEAT-002 applier 调用。

## 5. 数据模型与状态变化

- 文档状态为 BlockNote 内部 Prosemirror doc；`onChange` 输出 `Block[]`。
- 编辑器不持有 AI busy 状态；由 FEAT-002 `createAIBusyState` 逐会话创建，经 props/注入传入，编辑器据此呈现入口禁用。
- 无迁移、无持久化（纯组件）。

## 6. 核心流程与错误处理

```text
挂载 TapNoteEditor
  -> useCreateBlockNote({ initialContent })
  -> BlockNoteView (shadcn 皮肤, editable, theme)
  -> BlockNoteView onChange -> 转换为 Block[] -> props.onChange
```

错误处理：
- `initialContent` 非法：try/catch 兜底空文档 + console.warn，不抛错。
- 助手注入版本不匹配：存在性检查失败时 console.warn 并忽略，不阻断编辑。

## 7. 权限、安全、输入校验与隐私

- 组件不读 API Key、不发起 HTTP；模型与鉴权属 FEAT-005。
- `initialContent` 经 BlockNote schema 校验；外部传入的 blocks 不被信任为权威，仅作渲染输入。
- 无隐私数据落盘。

## 8. 测试策略

- 组件测试：props（initialContent/editable/theme/onChange）渲染与回调断言。
- 装配测试：注入/不注入助手两种情形，断言入口显隐。
- 跨 sub 集成：模型选择、AI 互斥、刷新无持久化（由 FEAT-006 E2E 覆盖）。
- 依赖闭包测试：构建产物不含 `@blocknote/xl-*`（许可证扫描由 FEAT-007 统一）。

## 9. 发布、兼容与回滚

- 独立包发布；demo 不是其运行时依赖。
- 以 semver 维护公开 props；破坏性 schema/API 变更须同 FEAT-007 发布说明。
- UI 回归可回滚独立 web 部署；包回滚通过上一稳定 npm 版本，不改变集成方文档数据。
- `exports` 字段、类型声明、tsup/vite 构建配置在 P1 由 FEAT-007 统一落地；MVP 阶段可在 monorepo 内以 workspace 直接消费，暂不发布 npm。

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
| `@blocknote/shadcn` | 0.51.4 | MPL-2.0 | 同上 | 与 `@workspace/ui` 样式隔离待实测 |
| `react` | ^19 | MIT | 代码库现状 | peerDep |
| `tailwindcss` | ^4 | MIT | 代码库现状 | peerDep |

> 实施前必须用 Context7 查询 BlockNote 最新稳定 API 与版本兼容性，并以最小 demo 验证 React 19 + BlockNote 0.51.4 组合，锁定到 workspace lockfile。

## 12. 备选方案与决策

- 备选 A：直接暴露 BlockNote UI（不封装）。优点：工作量小；缺点：无法稳定 tap-note 公开 API，集成方升级易碎。排除。
- 备选 B：包装一层 `TapNoteEditor`（采纳）。维护成本略增，但满足产品目标（稳定 API、授权干净、可发布）。
- 构建工具：tsup vs vite 库模式——待 P1 FEAT-007 统一决策，MVP 不阻塞。

## 13. 技术风险与待确认

- shadcn 样式与 `@workspace/ui`（base-ui + tailwind-merge@3）的样式作用域冲突尚未实测（总 PRD §17 item 3）。
- BlockNote 精确 API 与依赖版本须实施前以官方文档 + lockfile 确认。
- npm scope `@tap-note/*` 待用户确认（总 PRD §17 item 8）。
- `@blocknote/shadcn` 自带 radix + tailwind-merge@2 与 `@workspace/ui` tailwind-merge@3 共存方案待实测。
