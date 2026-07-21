## 1. 操作协议与 ai-core

- [ ] 1.1 固定 `replaceText` 的 `from`/`to` 坐标协议为目标 block 拼接纯文本的零基 offset(含 from 不含 to),并在 ai-core 契约注释中写明客户端负责 offset→ProseMirror position 转换
- [ ] 1.2 扩展 `BlockOperation` schema 与派生类型,新增 `replaceText` 的 `targetBlockId`、`from`、`to`、`expectedText`、`replacement` 字段及范围校验(0 ≤ from < to)
- [ ] 1.3 在 ai-core 增加统一 `stripBlockIdSuffix` 边界工具,覆盖单个 block ID 和 ID 数组,并补充带 `$`/不带 `$` 的单元测试
- [ ] 1.4 在 ai-core 实现 `replaceText` 的单一底层执行器:经 `editor.transact` 定位 block 起始 position、转换 offset、用 `doc.textBetween` 对 `expectedText` 做 compare-and-swap、`tr.replaceWith` 单事务替换;校验失败返回稳定冲突且不修改文档
- [ ] 1.5 扩展 `applyOperationsToEditor` 接入 `replaceText`,复用 1.4 执行器,revision/目标块/range/expectedText 校验失败时返回可重试冲突
- [ ] 1.6 确认现有 block 操作在进入 BlockNote API 前统一剥离 `$` 后缀,补充 update/delete/insert/replace/move 的带 `$` ID 回归测试
- [ ] 1.7 更新 ai-core 公开导出与文档注释,确保 schema、执行器和测试不引入 GPL/AGPL 依赖

## 2. 服务端 client-side tool 声明与 system prompt

- [ ] 2.1 更新 `apps/server-api/src/modules/ai/types/schema.ts`,导出 `replaceText` tool input schema 并与 ai-core 操作契约保持同源
- [ ] 2.2 更新 `apps/server-api/src/modules/ai/services/chat.ts`,为包括 `getDocumentSnapshot` 在内的全部 6 个 client-side tool 只声明 `description` 与 `inputSchema`,删除所有占位 `execute: async () => ({ ok: true })`
- [ ] 2.3 新增 `CHAT_SYSTEM_PROMPT`(修改文档必须调用编辑工具、不得仅用自然语言声称完成、`$` ID 精确复制、文本替换优先 `replaceText`),在 `streamText` 传入 `system`,并保持 `toolChoice` 为 auto(不使用 required)
- [ ] 2.4 保留 `contextMode` 对 `getDocumentSnapshot` 的过滤,确认所有写工具在 `none`/`selection`/`full` 模式下声明一致
- [ ] 2.5 更新 server-api chat service 测试:删除现有 `expect(typeof tool.execute).toBe('function')` 断言并反转为「编辑工具无 execute」,断言 schema 可接受 `replaceText`、snapshot tool 过滤正确、`CHAT_SYSTEM_PROMPT` 已配置

## 3. 客户端工具执行与真实结果

- [ ] 3.1 扩展 `packages/tap-note-ai-chat/src/tools/client-tools.ts` 的工具名、输入类型和分发逻辑,接入 `replaceText`
- [ ] 3.2 为 chat client tools 统一实现 `$` block ID normalization,确保 block lookup、insert、update、delete、replace、move 都使用真实 editor ID,而回显给模型的 operation 保留 `$`
- [ ] 3.3 统一定义真实 tool result 类型:成功携带 `ok`、操作类型、`currentDocumentRevision` 与目标信息(`targetBlockId`,`replaceText` 附带被替换文本);失败区分 revision/precondition/validation/editor error
- [ ] 3.4 实现 `replaceText` 客户端执行,复用 ai-core 1.4 执行器,校验 `baseDocumentRevision`、目标 block、合法 range 和 `expectedText`,成功后在单个 ProseMirror 事务中替换文本
- [ ] 3.5 更新 `useTapNoteChat.onToolCall`,确保只有 editor 操作完成后才调用 `addToolOutput`,失败路径必须回传 `output-error` 且不伪造成功
- [ ] 3.6 保持 `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls` 多轮 continuation,覆盖 tool output 成功与失败后的下一轮行为
- [ ] 3.7 处理多工具 revision 链:tool output 返回最新 `currentDocumentRevision`;revision 冲突且 `expectedText` 仍匹配时用最新 revision 自动重放单一操作,否则返回冲突交由 UI 重试

## 4. UI 成功状态与错误反馈

- [ ] 4.1 在 chat message/tool part 状态中保存并关联真实 tool output,不再用 `output-available` 构造 `{ ok: true, currentDocumentRevision: 0 }`
- [ ] 4.2 更新 `ToolResultBubble`,根据真实 output 渲染成功、revision conflict、precondition failure、validation failure 和 editor error
- [ ] 4.3 无 tool call 但模型返回“已完成”时,UI 不得显示已修改成功,应显示“未执行编辑操作”或等价明确状态
- [ ] 4.4 tool 成功时显示真实 revision/目标信息,tool 失败时提供可理解的重试入口且不泄露堆栈或 provider 信息
- [ ] 4.5 为新增状态补充 `ChatDictionary` 文案(未执行编辑操作、文本替换成功、文本替换失败、expectedText 不匹配等),并允许集成方覆盖

## 5. Prompt、上下文与集成行为

- [ ] 5.1 更新 `inject-document-state.ts` 注入提示,与 `CHAT_SYSTEM_PROMPT` 协同强调写操作必须调用编辑工具、`$` ID 精确复制
- [ ] 5.2 明确 `$` ID 只在模型协议层存在、客户端 editor API 边界负责剥离,并补充 selection/full 模式下的示例提示
- [ ] 5.3 验证选区文档状态包含足够的目标 block 和文本上下文,支持“把 slash 改为斜线”的 `replaceText` 操作(模型可据可见文本推算 from/to)
- [ ] 5.4 在 apps/web 增加或更新对话回归场景,确认选中 `slash` 后发送命令会真实改变编辑器内容,而非只更新聊天文本

## 6. 测试与质量门禁

- [ ] 6.1 增加 client-tools 单元测试:每种 block 操作成功路径、带 `$` ID、目标不存在、revision 冲突和 editor API 异常
- [ ] 6.2 增加 `replaceText` 单元测试:成功替换、expectedText 不匹配、非法 range、目标 block 不存在、revision 冲突、offset→position 转换和格式保留
- [ ] 6.3 增加 useChat/tool loop 集成测试:server declaration → client onToolCall → editor mutation → addToolOutput → continuation(含多工具 revision 链)
- [ ] 6.4 增加 tool result bubble 测试:真实成功、真实失败、无 tool call 的 assistant 完成文本不能显示成功
- [ ] 6.5 增加“slash → 斜线”端到端 mock 测试,断言 editor document 内容和 documentRevision 均发生预期变化
- [ ] 6.6 运行受影响包 `lint -> typecheck -> test`,确认测试不依赖真实 LLM、网络、JWT 或持久化服务
- [ ] 6.7 运行根 workspace 的 `bun run typecheck`、`bun run lint`、`bun run test`,记录与本 change 无关的既有门禁问题
