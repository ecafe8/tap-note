# 技术方案：AI 内联助手

## 0. 文档信息

- 功能 ID：FEAT-003；所属 Sub：SUB-003；状态：草稿；依据：总 PRD v7、SUB-003 `tech.md`、FEAT-002 `tech.md`。

## 1. 当前项目事实与复用点

- `packages/tap-note-ai-inline` 尚不存在。
- BlockNote `0.51.4` 在 `resource/BlockNote` submodule；`xl-ai` 可阅读作思路参考（AIExtension 状态机、StreamTool 增量解析/校验/去重、suggest-changes 集成、AIMenu/AIToolbarButton/Slash 项交互范式），不复制源码。
- 复用 FEAT-002 的 schema/DocumentStateBuilder/applier/busy/transport。

## 2. 本 feat 在 sub 中的位置与职责

inline 管理 suggestion transaction 与状态机；服务端永远不接收客户端定义的工具 schema（SUB-003 tech.md §2）。本 feat 不复用 chat 的 executor。

```text
editor + inlineExtension
  -> user-input -> thinking -> ai-writing -> user-reviewing -> (error)
  -> StreamToolExecutor 增量解析 partial -> ai-core applyOperationsToEditor(suggest)
  -> 接受 applySuggestions / 拒绝 revertSuggestions / busy.release
```

## 3. 模块职责与目录范围

```text
packages/tap-note-ai-inline/
├── package.json            # name=@tap-note/ai-inline
├── tsconfig.json
├── tsup.config.ts
└── src/
    ├── index.ts
    ├── extension/
    │   ├── tap-note-ai-inline-extension.ts   # createExtension 状态机
    │   └── state-machine.ts
    ├── stream-tool-executor.ts                # 增量解析/校验/去重
    ├── tools/
    │   └── apply-document-operations.ts        # 流式工具，复用 ai-core applier
    ├── ui/
    │   ├── ai-menu-controller.ts
    │   ├── ai-toolbar-button.tsx
    │   └── ai-slash-menu-items.ts
    ├── i18n/zh-cn.ts
    └── types/
```

## 4. 数据模型、迁移与状态

### 状态机

```text
user-input --提交--> thinking --首工具调用--> ai-writing --流式完成--> user-reviewing
thinking/ai-writing --error--> error --重试--> thinking
ai-writing --中止--> user-reviewing(回退) / 直接 revert
user-reviewing --接受--> applySuggestions / --拒绝/Esc--> revertSuggestions
```

### 流式工具

`applyDocumentOperations({ operations: BlockOperation[] })`：
- 复用 FEAT-002 `applyOperationsToEditor(editor, operations, { mode: "suggest" })`。
- 每次 partial 增量去重（`filterNewOrUpdatedOperations`），不重复应用。

### busy 集成

触发时 `busy.acquire("inline")`，失败则入口禁用；接受/拒绝/中止/失败/卸载时 `busy.release()`。无持久化、无迁移。

## 5. 接口与组件接口

```ts
interface TapNoteInlineAssistant {
  extension: TapNoteAIInlineExtension       // 注入编辑器
  menuController: AIMenuController
  toolbarButton: AIToolbarButton
  slashMenuItems: getAISlashMenuItems
}

function createTapNoteInlineAssistant(options: {
  transport: Transport                      // 来自 ai-core
  documentStateBuilder: DocumentStateBuilder
  model?: string
  streamToolsProvider?: () => ToolSet       // 可选，与服务端 schema 对齐
  dictionary?: Partial<TapNoteDictionary>
}): TapNoteInlineAssistant
```

`TapNoteAIInlineExtension` 基于 `@blocknote/core` 的 `createExtension`（API 待实施前以官方文档确认，见 §13）。

## 6. 核心流程与错误处理

```text
/ai 或选区按钮
  -> busy.acquire("inline")？失败 -> 入口禁用
  -> user-input 态：AIMenu 输入指令
  -> thinking 态：transport POST /api/ai/editor/streamText
  -> ai-writing 态：StreamToolExecutor 增量解析 partial -> 去重 -> applyOperationsToEditor(suggest)
  -> user-reviewing 态：接受/拒绝
  -> 接受 applySuggestions；拒绝/Esc revertSuggestions；中止 revertSuggestions
  -> busy.release
```

错误处理：
- 流失败：error 态，AIMenu 显示错误，点重试回到 thinking，无需重输指令。
- 流式中人工修改同一块：拒绝不得覆盖该人工修改（建议事务只含 AI 操作）。
- revision/前置条件冲突：不执行该操作，error 态可重试。
- partial 解析异常：丢弃非法 partial，不中断流；记录但不暴露给用户。

## 7. 权限、安全、输入校验与隐私

- transport 不持 Key；认证头由集成方 `getAuthHeaders` 注入短期 JWT。
- 所有 BlockOperation 经 FEAT-002 Zod `.parse()` 校验；客户端不得提交或覆盖服务端工具定义。
- `streamToolsProvider` 与服务端 schema 对齐校验；不匹配则不发送。
- 不记录正文到日志（日志在 FEAT-005）。
- 触发前查询 busy，进行中则禁用入口。

## 8. 测试策略

- 单元测试：状态机转换、`filterNewOrUpdatedOperations` 去重、Zod 校验、busy acquire/release。
- 流式工具 fixture：partial 增量、非法 partial 丢弃、去重。
- 集成测试：stream、accept/revert、中止、重试、revision 冲突、人工修改不被覆盖。
- 组件测试：AIMenu/AIToolbarButton/slash 项显隐与禁用态。

## 9. 发布、兼容与回滚

- 独立包；`dependencies` 不含 `@blocknote/xl-ai`；仅阅读 submodule 作思路参考。
- 公开 `createTapNoteInlineAssistant` API 以 semver 维护；破坏性变更同 FEAT-007 发布说明。
- 故障可禁用助手或回滚包，不回滚用户文档。
- MVP 阶段 workspace 直接消费，暂不发布 npm。

## 10. 类似产品与开源方案调研

| 来源 | 日期 | 可借鉴 | 限制 |
|---|---|---|---|
| BlockNote `xl-ai` | 2026-07-17 | AIExtension 状态机、StreamTool 增量解析/校验/去重、suggest-changes 集成、AIMenu/AIToolbarButton/Slash 项交互 | GPL-3.0 OR 专有；**不 fork 源码**，仅参考思路自行重写 |
| BlockNote 官方 core | 2026-07-17 | `createExtension` API 作为扩展边界 | MPL-2.0 可依赖；精确 API 须实施前确认 |
| Notion AI | 2026-07-17 | 逐块流式写入、接受/拒绝、`/ai` 唤起体验 | 闭源，仅体验对标 |
| Context7 `/websites/ai-sdk_dev` | 2026-07-17 | partial tool call streaming | 精确版本/API 须实施前锁定 |

## 11. 第三方依赖、版本与 Context7 记录

| 包 | 版本 | 授权 | 来源 | 备注 |
|---|---|---|---|---|
| `@tap-note/ai-core` | workspace | MPL-2.0/自有 | FEAT-002 | 复用 schema/applier/busy/transport |
| `@blocknote/core` | 0.51.4 | MPL-2.0 | sub tech.md | `createExtension` API |
| `@blocknote/react` | 0.51.4 | MPL-2.0 | 同上 | UI 集成 |
| AI SDK React/UI 包 | 待锁定 | Apache-2.0 | Context7 | partial tool call streaming；实施前锁定 |
| `react` | ^19 | MIT | — | peerDep |

> 实施前必须用 Context7 查询 BlockNote `createExtension` API 与 AI SDK partial tool call streaming 的精确 API，并以最小端到端示例验证流式写入 + 接受/拒绝，锁定到 workspace lockfile。

## 12. 备选方案与决策

- 备选 A：依赖 xl-ai 作 peerDep。排除：GPL 传染。
- 备选 B：fork xl-ai 源码标 GPL。排除：违反授权干净目标。
- 备选 C：参考思路自行重写（采纳）。工作量大，但用 `@handlewithcare/prosemirror-suggest-changes` + AI SDK 降低难度。
- 简化替换 vs 完整流式：总 PRD v1 决策完整流式，不做半成品。

## 13. 技术风险与待确认

- AI SDK 精确版本与 partial tool call streaming API 未锁定（总 PRD §17 item 5）——实施前阻塞项。
- `TapNoteAIInlineExtension` 与 BlockNote `createExtension` API 兼容性须实施前以官方文档确认。
- suggest-changes 与 BlockNote 0.51.4 交互、流中人工编辑冲突需最小端到端验证（SUB-003 tech.md §6）。
- `needsApproval` 审批开关为 P2 候选，当前不实现（总 PRD §5.2）。
