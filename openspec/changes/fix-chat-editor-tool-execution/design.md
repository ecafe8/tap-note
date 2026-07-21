## Context

当前对话助手在 `apps/server-api` 声明的 chat tools 同时提供了占位 `execute`,但真正的编辑器实例只存在于浏览器客户端。服务端因此会把 `{ ok: true }` 当作工具结果返回给模型,模型随后报告“已完成”,而客户端没有执行 BlockNote 操作。

当前客户端已有 `useChat({ onToolCall })` 和 `executeClientTool`,但执行链路还不完整:

- server tool schema 与 client-side tool ownership 冲突。
- `streamChat` 没有 system prompt,也没有任何“必须调用工具才能修改文档”的约束,模型可能只回文本而不调工具。
- BlockNote 文档状态中的 `$` 后缀 block ID 未在 chat client tools 中统一剥离。
- 写操作只覆盖 block 级别,无法可靠表达段落内的精确文本替换;且 BlockNote 0.51.4 没有 block 内文本范围替换的高层 API。
- tool result bubble 只根据 `output-available` 构造假的成功结果,没有消费真实 output 或验证 editor 状态。

约束:

- 编辑器操作必须在客户端执行,服务端不得持有 editor 实例。
- 不引入 `@blocknote/xl-ai` 或其他 GPL/AGPL 依赖。
- 所有操作必须经过 Zod schema、document revision 和目标前置条件校验。
- 测试不得依赖真实 LLM、网络、JWT 或持久化服务。

## Goals / Non-Goals

**Goals:**

- 明确 chat tools 为 client-side tools:服务端只声明 schema,客户端负责执行。
- 用 system prompt 约束模型:修改文档必须调用编辑工具,不得仅用自然语言声称完成。
- 只有真实 editor 操作成功后,模型和 UI 才能收到成功结果。
- 统一处理带 `$` 后缀的 block ID。
- 支持带 `expectedText`、文本范围和 revision 的 block 内文本替换,并固定坐标协议与实现机制。
- 让冲突、前置条件失败、schema 错误和 editor 执行错误可观察、可重试。
- 保持 `sendAutomaticallyWhen` 多轮工具调用流程正确工作。

**Non-Goals:**

- 不实现服务端直接修改文档或持久化文档。
- 不实现 JWT 集成;认证由集成方负责。
- 不重做完整富文本 diff/协同编辑冲突合并算法。
- 不引入新的 BlockNote AI/GPL 依赖。
- 第一版不支持跨多个 block、跨链接/mention 的文本范围替换。

## Decisions

### 1. Client-side tool ownership

服务端 `streamText` 的 chat tools 移除 `execute` 字段(包括 `getDocumentSnapshot` 在内全部 6 个 client-side tool),保留 `description` 与 `inputSchema`。客户端继续通过 `onToolCall` 调用 `executeClientTool`,执行成功或失败后使用 `addToolOutput` 回传真实结果。

选择该方案而不是保留服务端占位 execute,因为服务端没有 editor 实例;占位结果会制造不可验证的“假成功”。不选择服务端返回自然语言再由客户端解析,因为结构化 tool schema 能提供更可靠的参数校验和多轮 tool loop。

`toolChoice` 保持默认 auto,**不**设为 `required`:chat 同时支持纯问答(如“总结这段”),强制工具调用会破坏非编辑场景。是否调用工具改由 system prompt 约束(见 Decision 7)。

### 2. 真实结果驱动状态

定义统一的 tool execution result:

- 成功:包含 `ok: true`、操作类型、执行后的 `currentDocumentRevision`,以及目标信息(如 `targetBlockId`;`replaceText` 额外携带被替换文本)。
- 失败:包含稳定的 conflict/precondition/schema/editor-error 类型、可展示消息和当前 revision。

`ToolResultBubble` 从真实 `tool output` 渲染,不得用 `output-available` 或 assistant 文本推断成功。模型最终文本只能作为说明,不能作为文档已修改的证明。

### 3. Block ID normalization

`DocumentStateBuilder` 继续给发送给模型的 block ID 加 `$` 后缀。chat client tools 在所有 `getBlock`、`updateBlock`、`removeBlocks`、`insertBlocks` 和 `replaceBlocks` 调用前统一执行 `stripBlockIdSuffix`。

剥离**仅作用于进入 BlockNote API 的入参**;tool output 与冲突结果回显给模型时**保留原始带 `$` 的 ID**,以维持“模型必须精确复制 `$` ID”的协议约束。

选择集中规范化而不是让 prompt 要求模型去掉 `$`,因为 `$` 是防止幻觉 ID 的协议标记,模型输出仍需精确复制它;剥离应只发生在进入 BlockNote API 的边界。

### 4. Text range replacement

新增 `replaceText` 操作,最小字段为 `baseDocumentRevision`、`targetBlockId`、`from`、`to`、`expectedText` 和 `replacement`。

**坐标协议(固定):** `from`/`to` 为目标 block **拼接纯文本内容**上的零基字符 offset(含 `from`、不含 `to`)。选择纯文本 offset 而非 ProseMirror 绝对 position,因为模型只能从可见文本可靠地推算 offset,无法推算编辑器内部 position;由客户端负责把 offset 转换为 ProseMirror position。

**实现机制(固定):** BlockNote 0.51.4 没有 block 内文本范围替换的高层 API,因此通过 `editor.transact`/`editor.exec` 执行一个 ProseMirror 事务:

1. 定位 target block 的起始 position,据此把 `from`/`to` 转换为绝对 position;
2. 用 `doc.textBetween(from, to)` 取当前文本,与 `expectedText` 做 compare-and-swap;
3. 校验通过后 `tr.replaceWith(from, to, replacement)`(或等价的 insertText),在**单个事务**内完成替换,保证原子性。

客户端执行前验证:

1. revision 等于当前 revision;
2. target block 存在且可编辑;
3. range 合法(0 ≤ from < to ≤ block 文本长度);
4. 当前目标文本的 `[from, to]` 等于 `expectedText`。

任一条件失败都不修改文档并返回冲突/前置条件结果。选择范围替换而不是只扩展 `updateBlock`,因为“把 slash 改为斜线”是 block 内文本操作,模型不应负责重建整个 block 的全部格式和 inline metadata。

**单一底层执行器:** `replaceText` 的事务逻辑在 ai-core 提供唯一实现,`applyOperationsToEditor`(inline 路径)与 chat `executeClientTool` 均复用该执行器,避免两处各写一套导致行为分叉。

### 5. Atomicity and continuation

单个 client tool 调用必须是原子操作。多工具调用通过 AI SDK v7 的 `addToolOutput` 与 `lastAssistantMessageIsCompleteWithToolCalls` 继续下一轮。客户端不得在 `onToolCall` 中 await `addToolOutput`;但必须等待 editor 操作完成后再调用它。失败结果也必须回传,防止模型在没有真实结果时生成完成消息。

**多工具 revision 链:** documentState 每个 user turn 只注入一次固定 revision。一次回复内模型连发多个写工具时,第二个工具的 `baseDocumentRevision` 会因第一次修改后 revision 自增而过期。处理策略:每个 tool output 返回最新 `currentDocumentRevision` 供模型下一轮使用;客户端在检测到 revision 冲突时,可用最新 revision 自动重放该单一操作(操作幂等且 expectedText 仍匹配时),否则返回冲突由 UI 提供重试。

### 6. Test strategy

使用真实 BlockNote editor 或可控 mock editor 测试 client tool 执行,使用 mock transport 测试 `useChat` 工具链。测试覆盖:

- 服务端 tools 不包含 `execute`;
- system prompt 存在且约束工具调用;
- 每种操作成功/失败路径;
- `$` ID normalization;
- text range offset→position 转换、expectedText/revision 校验;
- 真实 output 驱动成功/失败 UI;
- tool output 后自动继续和错误终止;
- 全链路不访问真实 provider。

### 7. Chat system prompt

为 `streamChat` 新增 `CHAT_SYSTEM_PROMPT`,在 `streamText` 调用时作为 `system` 传入。提示需明确:

- 修改文档**必须**调用对应的编辑工具(`updateBlock`/`replaceText`/`insertBlock`/`deleteBlock`/`replaceBlocks`/`moveBlock`);
- **绝不**在未调用工具的情况下声称已完成修改;
- block ID 必须精确复制 documentState 中的 `$` 后缀 ID;
- 文本替换优先使用 `replaceText` 并给出正确的 `from`/`to`/`expectedText`。

该提示与 `injectDocumentStateMessages` 的注入提醒协同,但二者职责不同:system prompt 约束行为,注入提醒提供最新文档/选区状态。

## Risks / Trade-offs

- [模型不调用 tool 只返回自然语言] → CHAT_SYSTEM_PROMPT 强制要求写操作调用工具;UI 在无 tool call 时显示“未执行编辑操作”;测试覆盖无 tool-call 场景。
- [模型输出带 `$` 或不带 `$` 的错误 ID] → 客户端统一剥离 `$`,并在 block 不存在时返回 precondition failure;不静默改写未知 ID。
- [文档在模型生成后发生变化] → 所有写操作携带 `baseDocumentRevision`,revision 不匹配时拒绝并提供重试路径。
- [多工具序列 revision 过期] → tool output 回传最新 revision;客户端在 expectedText 仍匹配时自动用最新 revision 重放,否则返回冲突。
- [文本 range 与当前 inline content 不一致] → 使用 `expectedText` 做 compare-and-swap 校验,失败时不修改文档。
- [纯文本 offset 无法表达跨 inline 结构的范围] → 第一版限制为单 block 可转换 inline content;跨链接/mention 的范围替换作为后续 change。
- [AI SDK provider 不支持某类 tool streaming] → 先保证完整 tool call 的 client-side 执行正确;真正 partial tool streaming 作为独立后续 change。
- [服务端仍可能返回模型自然语言“完成”] → 客户端根据 tool output 标记会话状态,最终 UI 不把纯文本当成成功证据。

## Migration Plan

1. 固定 `replaceText` 坐标协议与 ai-core 单一执行器,再扩展 schema、client executor 和服务端 tool 声明。
2. 增加 CHAT_SYSTEM_PROMPT,移除服务端占位 execute。
3. 更新 chat hook、消息 parts 和 tool result bubble,让真实 output 成为唯一成功来源。
4. 增加文本范围替换、`$` ID 和 system prompt 测试,再运行包级 `lint -> typecheck -> test`。
5. 手动验证“选中 slash → 发送把 slash 改为斜线”:文档实际改变、revision 增加、气泡显示成功。
6. 回滚时恢复服务端 tool execute 声明和旧 executor,但不得将占位 `{ ok: true }` 作为生产成功路径重新启用。

## Open Questions

- 文本替换是否需要支持跨 inline style(加粗/斜体)的范围?第一版限制为单 block 纯文本可转换内容;若 `expectedText` 跨越多种 inline style,客户端可拒绝并返回 precondition failure。
- 多工具 revision 自动重放的边界:当 expectedText 已不匹配时,自动重放应直接转为冲突,还是需要提示用户确认?建议直接转冲突,由 UI 重试。
- chat 在没有任何 tool call 时显示“AI 仅回复,未修改文档”的具体文案与位置,在实现阶段确定。
