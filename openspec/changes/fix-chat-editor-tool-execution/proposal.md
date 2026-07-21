## Why

对话助手当前把 client-side tools 错误地配置了服务端占位 `execute`,模型收到 `{ ok: true }` 后会声称文档已修改,但浏览器中的 BlockNote editor 实际没有执行任何操作。即使改为客户端执行,chat 工具还存在 `$` block ID 未规范化和缺少文本范围替换的问题,无法可靠完成“把 slash 改为斜线”这类编辑。

## What Changes

- 移除 chat client-side tools 的服务端占位执行,明确由客户端 `onToolCall` 执行编辑器操作。
- 新增 chat system prompt,约束模型修改文档必须调用编辑工具,不得仅用自然语言声称完成。
- 让客户端只在真实 editor 操作成功后回传 `addToolOutput`,模型的最终成功消息必须建立在真实结果之上。
- 统一处理带 `$` 后缀的模型 block ID,避免合法 tool call 被误判为目标块不存在。
- 增加文本范围替换操作,支持在 block 内精确替换选中的文本,并校验原文与文档 revision。
- 修正 tool result UI,展示真实执行结果、冲突和前置条件失败,禁止仅凭 assistant 文本或 `output-available` 伪造成功。
- 增加服务端声明、客户端执行、真实结果回传、冲突和文本替换的测试覆盖。

## Capabilities

### New Capabilities

- `chat-editor-operations`: 对话助手通过客户端工具安全、可验证地修改 BlockNote 文档,包含 block 操作、文本范围替换和真实结果回传。

### Modified Capabilities

- `ai-core`: 扩展编辑操作契约,统一 block ID 后缀处理,并为文本范围操作提供 revision/原文校验规则。

## Impact

- 影响 `apps/server-api/src/modules/ai/services/chat.ts` 及 chat 请求/工具声明,新增 chat system prompt。
- 影响 `packages/tap-note-ai-core/src/inject-document-state.ts` 的注入提示(与 system prompt 协同)。
- 影响 `packages/tap-note-ai-chat` 的 `useTapNoteChat`、client tools、tool result bubble 和消息状态处理。
- 影响 `packages/tap-note-ai-core` 的操作 schema、执行器和 editor 应用逻辑。
- 可能影响 `apps/web` demo 的对话编辑行为和手动冒烟测试。
- 不引入新的 BlockNote 或 GPL/AGPL 依赖;不负责实现 JWT 集成。
