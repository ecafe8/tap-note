# 功能 PRD：AI 内联助手

## 0. 文档信息

- 功能 ID：FEAT-003
- 所属 Sub：SUB-003 AI 助手
- 所属产品：tap-note
- 总 PRD：`docs/prd/main-prd.md`（v7）
- Sub PRD：`docs/prd/sub-ai-assistant/prd.md`
- 功能目录：`docs/prd/sub-ai-assistant/feat-ai-inline/`
- 文档版本：v1
- 文档状态：草稿
- 类型：混合型（含 UI 组件）

## 1. 功能目标

提供 `@tap-note/ai-inline` 包，参考 `@blocknote/xl-ai` 的实现思路**自行重写**（不引入其源码，规避 GPL），实现编辑器内联 Notion 式逐块流式写入 + 接受/拒绝工作流。创作者 `/ai` 唤起 AIMenu 输入指令，或选中文本点 AI 按钮；AI 流式将 BlockOperation（来自 FEAT-002）应用到文档（可回退）；用户接受/拒绝/中止/重试。

## 2. 功能边界

### 2.1 本功能包含

- `TapNoteAIInlineExtension`：基于 `@blocknote/core` 的 `createExtension`，状态机 `user-input → thinking → ai-writing → user-reviewing`（含 `error`）。
- `StreamToolExecutor`：增量解析经验证 AI SDK 的 partial 工具调用、校验、去重（`filterNewOrUpdatedOperations`）。
- 单个流式工具 `applyDocumentOperations`，输入 `{ operations: BlockOperation[] }`，复用 FEAT-002 applier。
- `AIMenuController`、`AIToolbarButton`、`getAISlashMenuItems`、zh-CN 字典。

### 2.2 本功能不包含

- 对话面板 UI（属 FEAT-004）；
- documentState 构造、transport 工厂、busy state、applier 本体（属 FEAT-002，本 feat 复用）；
- 服务端 streamText/模型路由/JWT（属 FEAT-005）；
- 编辑器内核 UI（属 FEAT-001）；
- `needsApproval` 审批开关（P2 候选，总 PRD §5.2）。

## 3. 用户角色

- 终端创作者：`/ai` 续写/改写/翻译/总结，逐块可见，接受/拒绝/中止/重试。
- 集成开发者：一行接入内联助手，配置 transport 与可选 `streamToolsProvider`。

## 4. 使用场景

```text
创作者在空块输入 /ai 或选中文本点 AI 按钮
  -> AIMenu 浮现，输入指令
  -> ai-core 构建 documentState（受影响块快照）+ 用户消息 + documentRevision
  -> busy.acquire("inline")，失败则入口禁用
  -> DefaultChatTransport POST /api/ai/editor/streamText
  -> server-api 注入 documentState，streamText 返回 BlockOperation 流式工具调用
  -> client StreamToolExecutor 增量解析 partial、校验、去重
  -> 经 ai-core applyOperationsToEditor 以可回退 transaction 应用（suggest-changes）
  -> 文档逐块实时变化（ai-writing 态）
  -> 创作者点接受/拒绝/Esc 取消
  -> 接受：applySuggestions 合并；拒绝：revertSuggestions 回退；释放 busy
```

```mermaid
flowchart TD
  A[/ai 或选区 AI 按钮] --> M[AIMenu 输入指令]
  M --> B[busy.acquire inline]
  B --> T[transport POST /api/ai/editor/streamText]
  T --> S[StreamToolExecutor 增量解析/校验/去重]
  S --> P[applyOperationsToEditor suggest]
  P --> W[ai-writing 逐块可见]
  W --> R{接受/拒绝/中止}
  R -->|接受| AC[applySuggestions]
  R -->|拒绝/中止| RV[revertSuggestions]
  AC --> RL[busy.release]
  RV --> RL
```

## 5. 用户故事

- US-002（集成开发者）：我希望通过 `createTapNoteInlineAssistant({ transport: createServerTransport({ baseUrl }) })` 一行接入内联 AI，AI 写入是逐块流式的，用户可接受/拒绝。
- US-003（终端创作者）：`/ai 续写一段`，AI 流式逐块写入，完成后点接受保留、点拒绝回退。
- US-004（终端创作者）：选中文字点 AI 按钮「改为要点列表」，AI 流式替换，可接受/拒绝。
- US-008（集成开发者）：AI 调用失败时 AIMenu 显示错误，点「重试」可重新发起，无需重输指令。

## 6. 功能需求

| 需求 ID | 需求描述 | 优先级 | 验收标准 |
|---|---|---|---|
| FR-001 | `TapNoteAIInlineExtension` 状态机 `user-input→thinking→ai-writing→user-reviewing`（含 `error`） | P0 | 状态转换正确；error 态可重试 |
| FR-002 | `StreamToolExecutor` 增量解析 partial 工具调用、Zod 校验、去重 | P0 | partial 解析不阻塞主线程；重复操作去重 |
| FR-003 | `applyDocumentOperations` 流式工具，复用 ai-core applier 经 suggest-changes | P0 | 应用可回退；拒绝只回退所属事务 |
| FR-004 | `AIMenuController`/`AIToolbarButton`/`getAISlashMenuItems` | P0 | `/ai` 唤起 slash 项；选区 AI 按钮浮现 |
| FR-005 | 接受/拒绝/中止/重试交互 | P0 | 接受保留、拒绝回退、中止立即停止并回退、重试无需重输 |
| FR-006 | 触发前查询会话 busy 状态，进行中则禁用入口 | P0 | 另一 AI 进行中时 slash 项/按钮置灰并说明原因 |
| FR-007 | 默认 zh-CN 字典，可替换 | P0 | 文案中文，可覆盖 |
| FR-008 | 发布包授权干净 | P0 | `dependencies` 不含 `@blocknote/xl-ai` |

## 7. 业务规则

- 工具执行规则（总 PRD §9）：内联 BlockOperation 流式应用在客户端完成；服务端持有 streamTool schema，客户端不得提交或覆盖工具定义。
- 操作一致性（总 PRD §9）：任务绑定起始 `documentRevision` 与建议 transaction；拒绝只回退该 AI transaction，不覆盖用户后续编辑。
- 并发规则（总 PRD §9）：触发前查询 ai-core busy；进行中则禁用入口；完成/中止/失败/卸载释放。
- 授权规则（总 PRD §9）：仅阅读 `resource/BlockNote` submodule 作思路参考，不复制源码；`dependencies` 不含 `@blocknote/xl-ai`。

## 8. 数据输入与输出

- 输入：`transport`（来自 ai-core）、可选 `streamToolsProvider`、`documentStateBuilder`、`model`。
- 输出：BlockNote `AIExtension` 等价扩展 `TapNoteAIInlineExtension`、`AIMenuController`、`AIToolbarButton`、`getAISlashMenuItems`、zh-CN 字典。
- 流式工具入参：`{ operations: BlockOperation[] }`。

## 9. 与其他功能的关系

| 功能 | 关系 |
|---|---|
| FEAT-001 editor | 注入为 `inlineAssistant`，渲染 slash 项/工具栏按钮/AIMenu |
| FEAT-002 ai-core | 复用 schema/DocumentStateBuilder/applier/busy/transport；不复用 chat executor |
| FEAT-005 ai-backend | 消费 `/api/ai/editor/streamText`（服务端 streamTool schema） |
| FEAT-006 reference-app | `/inline`、`/both` 路由装载 |

## 10. 异常和边界场景

- AI 调用失败：error 态，AIMenu 显示错误，点重试重新发起（无需重输指令）。
- 流式中：点中止立即停止并 revertSuggestions，释放 busy。
- 流式中人工修改同一块：拒绝不得覆盖该人工修改（操作一致性）。
- revision/前置条件冲突：不执行该操作，返回错误态可重试。
- 另一 AI 进行中：入口禁用并文字说明。
- `streamToolsProvider` 与服务端 schema 不匹配：校验失败提示，不发送。

## 11. 功能验收标准

1. `/ai 续写一段...` 后 AI 内容逐块流式写入文档，可见实时变化（总 PRD §16 item 2）。
2. 写作中可点「中止」立即停止并回退（§16 item 2）。
3. 点「接受」保留修改、点「拒绝」完全回退到写作前状态，undo 历史正确（接受后 undo 跳回写作前，拒绝后不污染历史）（§16 item 3）。
4. 选中文字点 AI 按钮改写，AI 流式替换选区，可接受/拒绝（§16 item 4）。
5. AI 调用失败时 AIMenu 显示错误，点「重试」可重新发起（§16 item 5）。
6. 内联进行中时对话助手 chat 输入框置灰；反之亦然；一者完成/中止/拒绝后另一者立即可用（§16 item 8）。
7. AI 流式期间人工修改同一块后，内联拒绝不得覆盖该人工修改（§16 item 10）。
8. `bun run typecheck`、`bun run lint`、流式工具 fixture、组件行为测试全绿。
9. 发布包 `dependencies` 不含 `@blocknote/xl-ai` 或 GPL/AGPL。

## 12. 待确认事项

- 【总 PRD §17 item 5 / v11 部分决策】AI SDK **v7** 锁定（见总 PRD §14 v11 决策）。v6→v7 breaking changes 已记录。**仍待 FEAT-003 实施前以 Context7 + 最小示例验证**：v7 partial tool call streaming 精确 API、`@ai-sdk/alibaba@2`/`@ai-sdk/google@4` 与 `ai@7` 的 peerDep 兼容性。
- 【AI 推断】`TapNoteAIInlineExtension` 与 BlockNote `createExtension` API 的兼容性须实施前以官方文档确认。
- 【SUB-003 §6】suggest-changes 与 BlockNote 版本交互、流中人工编辑冲突需最小端到端验证。
- 【总 PRD §5.2】`needsApproval` 审批开关为 P2 候选，当前不实现，UI 不应暗示存在该开关。

## 13. 变更记录

| 版本 | 日期 | 变更内容 |
|---|---|---|
| v1 | 2026-07-17 | 基于总 PRD v7 与 SUB-003 文档创建。 |
