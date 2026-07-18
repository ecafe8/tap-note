## 1. 研究闸门:AI SDK v7 与 suggest-changes 兼容性

- [x] 1.1 使用 Context7 查询 AI SDK v7 官方文档,确认 `DefaultChatTransport`、`streamText`、`UIMessage`、`UIMessageStream` 的精确 API 形状(构造参数、返回类型、流式协议)
- [x] 1.2 确认 v7 的 `UIMessage.parts` 数组结构,与 v6 `UIMessage.content` 的差异,记录 `injectDocumentStateMessages` 适配方式
- [x] 1.3 确认 v7 的 client-side tools `execute`/tool result 回传机制(`onToolCall`/`addToolOutput` 或等价 API),记录 FEAT-004 接入点
- [x] 1.4 确认 v7 的 partial tool call streaming API(内联用),记录 `StreamToolExecutor` 的解析契约
- [x] 1.5 核查 `@ai-sdk/alibaba@2`、`@ai-sdk/google@4` 与 `ai@7` 的 peerDependencies 兼容性,锁定 provider 版本组合
- [x] 1.6 顺带核查 v7 是否保留 `ToolLoopAgent`/`createAgentUIStreamResponse`(影响 FEAT-005 审批代理重写,不阻塞本 change)
- [x] 1.7 阅读 `resource/BlockNote/packages/xl-ai` 源码,理解 v6 的 `injectDocumentStateMessages`、`toolDefinitionsToToolSet`、`toUIMessageStreamResponse` 实现思路,记录 v6→v7 翻译要点
- [x] 1.8 查询 `@handlewithcare/prosemirror-suggest-changes` npm registry 与文档,确认版本 `0.1.8`、授权、API(`suggestChanges`/`applySuggestions`/`revertSuggestions`)与 Prosemirror 依赖
- [x] 1.9 编写最小端到端示例:BlockNote editor + suggest-changes,验证 `suggestChanges` → 编辑器实时变化 → `applySuggestions`/`revertSuggestions` 正确工作
- [x] 1.10 验证流式期间人工编辑同一块后 `revertSuggestions` 不覆盖人工编辑
- [x] 1.11 将 1.1-1.10 结论写入 `docs/prd/sub-ai-assistant/feat-ai-core/tech.md`(新增研究闸门结论小节),包括锁定版本、v6→v7 翻译要点、suggest-changes 兼容性、仍待确认风险
- [x] 1.12 只有 1.1-1.11 全部有可复核结果后,才允许进入第 2 组;若研究结论改变目标方案,先更新本 change 的 design.md 与任务依赖

## 2. 包基础设施

- [x] 2.1 参照 `packages/tap-note-editor` 创建 `packages/tap-note-ai-core` 目录和 `package.json`,包名固定为 `@tap-note/ai-core`,MVP 标记为 workspace 源码消费,`private: true`
- [x] 2.2 为 ai-core 包创建严格 TypeScript 配置,启用 ES2022/DOM/ESNext/bundler/react-jsx/strict/noEmit/verbatimModuleSyntax/erasableSyntaxOnly,配置包内路径别名 `@tap-note/ai-core/*`
- [x] 2.3 为 ai-core 包创建 ESLint 配置,复用 `packages/tap-note-editor` 的 TypeScript + React Hooks + React Refresh 规则(本包无 React 组件,但 transport 类型可能引用 React)
- [x] 2.4 创建 `src/index.ts` 空入口和最小公开导出骨架,使包可以被 TypeScript 解析但不提前承诺未实现 API
- [x] 2.5 为 ai-core 包创建 `bunfig.toml`(preload happy-dom + Testing Library),复用 FEAT-001 建立的测试模式
- [x] 2.6 将确定后的运行时依赖写入 ai-core 包:`@blocknote/core@0.51.4`、`@handlewithcare/prosemirror-suggest-changes@0.1.8`、`ai@7.0.x`、`zod`(与 monorepo 一致)
- [x] 2.7 为 ai-core 包添加 `react@^19`、`react-dom@^19` 作为 peerDep(类型与 transport 可能引用)
- [x] 2.8 执行 `bun install`,检查 lockfile 变更仅包含预期依赖,并确认依赖树没有 `@blocknote/xl-ai`/GPL/AGPL
- [x] 2.9 分别运行 ai-core 包的 `typecheck`、`lint`,修复基础配置问题后再进入核心实现

## 3. BlockOperation 与 DocumentState schema

- [x] 3.1 创建 `src/types/schema.ts`,用 Zod 定义 `BlockOperation` schema,覆盖 `insertBlock`/`updateBlock`/`deleteBlock`/`replaceBlocks`/`moveBlock` 五种操作
- [x] 3.2 每个操作定义 `baseDocumentRevision`(number)、`targetBlockId`/`referenceBlockId`/`targetBlockIds`(string/string[])、`block`/`blocks`(`PartialBlock[]`)字段
- [x] 3.3 在 `src/types/schema.ts` 用 Zod 定义 `DocumentState` schema:`{ format: "blocks-json", schemaVersion: string, documentRevision: number, blocks: PartialBlock[], selection?: { start: string, end: string } }`
- [x] 3.4 在 `src/types/type.ts` 从 schema 派生 TypeScript 类型(`BlockOperation`、`DocumentState`、`ConflictResult`),用 `z.infer`
- [x] 3.5 定义 `ConflictResult` 类型:revision 冲突或前置条件冲突时返回的可重试结果形状
- [x] 3.6 创建 `src/types/index.ts` 集中导出 schema 与类型
- [x] 3.7 从 `src/index.ts` 导出 `BlockOperation`、`DocumentState`、`ConflictResult` schema 与类型
- [x] 3.8 运行包 typecheck,确认 Zod schema 与 `@blocknote/core` 的 `PartialBlock`/`Block` 类型兼容
- [x] 3.9 编写 schema 单元测试:合法操作通过、非法操作(缺字段/错类型)抛 ZodError、revision 冲突返回 ConflictResult

## 4. DocumentStateBuilder

- [x] 4.1 创建 `src/document-state-builder.ts`,实现 `createDocumentStateBuilder(editor, options?)`
- [x] 4.2 从 editor 实例读取受影响块或选区范围,序列化为 `DocumentState`(含 `schemaVersion`、`documentRevision`、`blocks`、可选 `selection`)
- [x] 4.3 实现 `documentRevision` 单调递增:从 editor 的 Prosemirror state 或内部计数器获取
- [x] 4.4 支持三种 scope 模式:`"selection"`(用户显式选区)、`"full"`(全文)、`"affected"`(内联自动取受影响块)
- [x] 4.5 对非法 editor 状态或空文档兜底返回空 `DocumentState`(空 blocks 数组 + revision 0),不抛错
- [x] 4.6 从 `src/index.ts` 导出 `createDocumentStateBuilder` 与相关类型
- [x] 4.7 编写 builder 单元测试:合法 editor → 正确序列化、空文档兜底、revision 递增、selection/full/affected 三模式

## 5. injectDocumentStateMessages

- [x] 5.1 创建 `src/inject-document-state.ts`,实现 `injectDocumentStateMessages(messages, documentState?)`
- [x] 5.2 适配 AI SDK v7 的 `UIMessage.parts` 数组结构(根据 T-001 锁定的 API),把 documentState 注入为 `system` 或 `user` 消息的 part
- [x] 5.3 documentState 为 `undefined`/`null` 时原样返回 messages,不附加 part
- [x] 5.4 注入后的消息形状必须能被 FEAT-005 `streamText` 端点解析(契约对齐,实际联调在 FEAT-005)
- [x] 5.5 用 Zod 校验 documentState 形状后再注入,非法 documentState 抛 ZodError
- [x] 5.6 从 `src/index.ts` 导出 `injectDocumentStateMessages`
- [x] 5.7 编写注入测试:有/无 documentState 两种情形、非法 documentState 抛错、注入后消息结构符合 v7 UIMessage.parts

## 6. applyOperationsToEditor(suggest-changes 集成)

- [x] 6.1 创建 `src/apply-operations.ts`,引入 `@handlewithcare/prosemirror-suggest-changes`
- [x] 6.2 实现 `applyOperationsToEditor(editor, operations, { mode: "suggest" | "apply" | "revert" })`
- [x] 6.3 `mode: "suggest"`:把 BlockOperation 数组转换为 Prosemirror transaction,经 `suggestChanges` 创建建议事务
- [x] 6.4 `mode: "apply"`:调用 `applySuggestions` 合并建议到正式文档
- [x] 6.5 `mode: "revert"`:调用 `revertSuggestions` 回退所属建议事务
- [x] 6.6 实现 BlockOperation → Prosemirror 步骤的映射:`insertBlock`→`insertBlocks`,`updateBlock`→`updateBlock`,`deleteBlock`→`removeBlocks`,`replaceBlocks`→`replaceBlocks`,`moveBlock`→`moveBlocks*`
- [x] 6.7 实现 revision 冲突检测:操作的 `baseDocumentRevision` 与当前 editor revision 不匹配时不执行,返回 `ConflictResult`
- [x] 6.8 实现前置条件检查:目标块 ID 不存在或状态不符时不执行,返回 `ConflictResult`
- [x] 6.9 确保拒绝只回退 AI 建议事务,不覆盖用户在 suggest 期间的手动编辑(用 happy-dom + 真实 BlockNote editor 验证)
- [x] 6.10 从 `src/index.ts` 导出 `applyOperationsToEditor` 与 `ConflictResult`
- [x] 6.11 编写 applier 集成测试(用真实 BlockNote editor + happy-dom):suggest → apply、suggest → revert、revision 冲突、前置条件冲突、流式期间手动编辑后 revert 不覆盖

## 7. transport 工厂

- [x] 7.1 创建 `src/transport/server-transport.ts`,实现 `createServerTransport({ baseUrl, model, getAuthHeaders? })`
- [x] 7.2 根据 T-001 锁定的 v7 API,返回 `DefaultChatTransport` 实例或等价封装对象
- [x] 7.3 transport 的 `body` 携带 `model` 字段,`headers` 通过 `getAuthHeaders` 注入短期 JWT(不持有 LLM Key)
- [x] 7.4 transport 指向 `/api/ai/editor/streamText`(内联)或 `/api/ai/chat`(对话)端点,由调用方通过 `api` 参数指定
- [x] 7.5 创建 `src/transport/proxy-transport.ts`,实现 `createProxyTransport(...)`(P1 候选 ClientSideTransport 等价能力,MVP 可只占位接口)
- [x] 7.6 创建 `src/transport/index.ts` 导出两个工厂与 `Transport` 类型
- [x] 7.7 从 `src/index.ts` 导出 `createServerTransport`、`createProxyTransport`、`Transport` 类型
- [x] 7.8 编写 transport 单元测试:不持有 Key、携带 model、getAuthHeaders 注入、非法 baseUrl 抛错

## 8. AIBusyState

- [x] 8.1 创建 `src/busy-state.ts`,实现 `createAIBusyState()`
- [x] 8.2 返回 `{ isBusy: boolean, type?: "inline" | "chat", acquire(type), release(), subscribe(listener) }`
- [x] 8.3 `acquire(type)`:若当前 idle 则置为 in-progress 并记录 type,返回 true;若已 in-progress 则返回 false
- [x] 8.4 `release()`:置为 idle,清空 type,通知所有订阅者
- [x] 8.5 `subscribe(listener)`:注册监听器,返回 unsubscribe 函数;状态变化时调用 listener 携带新值
- [x] 8.6 `isBusy` 作为快照值,适配 React 19 `useSyncExternalStore`(FEAT-001 editor 已用此模式)
- [x] 8.7 确保跨包共享:同一 busy 实例可被内联与对话助手共享,不同编辑器会话创建独立实例
- [x] 8.8 从 `src/index.ts` 导出 `createAIBusyState` 与 `AIBusyState` 类型
- [x] 8.9 编写 busy 单元测试:互斥 acquire/release、订阅通知、卸载释放、并发场景

## 9. 上下文预算与 estimateTokens

- [x] 9.1 创建 `src/context-budget/estimate-tokens.ts`,实现 `estimateTokens(text): number`
- [x] 9.2 采用近似算法(字符数/4)作为 MVP,记录算法选择与偏差容忍(总 PRD §17 item 13 仍待确认)
- [x] 9.3 创建 `src/context-budget/layer.ts`,实现 `layerContext(documentState, { selectionBudget?, fullBudget?, threshold? })`
- [x] 9.4 选区模式:估算选区 token,超 `selectionBudget`(默认 4K)返回 `{ kind: "selection-blocked" }`,不发送
- [x] 9.5 全文模式:估算全文 token,≤ `fullBudget`(默认 8K)返回 `{ kind: "full" }`;超预算但 ≤ 2× 返回 `{ kind: "truncated", data: 截断快照 + 标记 }`;> 2× 返回 `{ kind: "outline", data: 大纲 }`
- [x] 9.6 不引用模式:由调用方决定不调用 layerContext,也不发送 documentState
- [x] 9.7 默认预算可配:`selectionBudget`、`fullBudget`、`threshold` 均有默认值且可被 options 覆盖
- [x] 9.8 截断快照附 `[文档已截断:共 N 块,此处含前 M 块]` 标记
- [x] 9.9 大纲格式:标题块 + 各块首段摘要
- [x] 9.10 创建 `src/context-budget/index.ts` 导出
- [x] 9.11 从 `src/index.ts` 导出 `estimateTokens`、`layerContext` 与 `LayeredContext` 类型
- [x] 9.12 编写预算单元测试:选区拦截、全文完整/截断/大纲、默认值与覆盖、不引用模式

## 10. zh-CN 字典与共享类型

- [x] 10.1 创建 `src/i18n/zh-cn.ts`,定义 `AICoreDictionary` 类型与默认 zh-CN 字典(`aiBusy`、`conflict`、`retry` 等)
- [x] 10.2 实现 `mergeDictionary(base, override?)` 的 Partial 合并逻辑
- [x] 10.3 字典可由 FEAT-003/004 助手包覆盖,未覆盖字段保留默认值
- [x] 10.4 从 `src/index.ts` 导出 `AICoreDictionary` 类型与默认 zh-CN 字典
- [x] 10.5 编写字典测试:默认值、Partial 覆盖合并、undefined 时返回 base

## 11. 错误类型与边界

- [x] 11.1 创建 `src/errors/index.ts`,定义 `AICoreError` 基类与子类(`ConflictError`、`BudgetExceededError`、`TransportError`)
- [x] 11.2 `ConflictError` 携带 `ConflictResult`(revision 冲突或前置条件冲突)
- [x] 11.3 `BudgetExceededError` 携带超限的预算信息(选区/全文)
- [x] 11.4 所有错误不泄漏内部堆栈或路径,对外脱敏
- [x] 11.5 从 `src/index.ts` 导出错误类型
- [x] 11.6 编写错误测试:ConflictError 携带 ConflictResult、BudgetExceededError 携带预算信息

## 12. 集成测试与质量门禁

- [x] 12.1 编写跨模块集成测试:DocumentStateBuilder → layerContext → injectDocumentStateMessages → applyOperationsToEditor 全链路
- [x] 12.2 编写 busy + applier 集成测试:acquire → suggest → revert → release 的生命周期
- [x] 12.3 运行 ai-core 包 `bun test`,修复测试环境问题,保留稳定的行为断言
- [x] 12.4 运行 ai-core 包 `bun run typecheck`,确认 `import type`、Zod schema 与 BlockNote 类型无冲突
- [x] 12.5 运行 ai-core 包 `bun run lint`,确认新增包通过 ESLint
- [x] 12.6 运行根 `bun run typecheck`,确认 workspace 依赖和所有受影响包通过
- [x] 12.7 运行根 `bun run lint`,确认新增包通过(预存在的 ui/button.tsx 错误与本 change 无关)
- [x] 12.8 运行根 `bun run test`,确认 Turbo 能发现并执行 ai-core 测试
- [x] 12.9 确认测试不依赖真实 LLM、网络或持久化服务

## 13. 授权、文档与收尾

- [x] 13.1 生成 `@tap-note/ai-core` 的生产依赖闭包清单,确认无 `@blocknote/xl-ai`、`xl-ai-server`、`xl-pdf-exporter`、`xl-docx-exporter`、`xl-multi-column` 或其他 GPL/AGPL 依赖
- [x] 13.2 确认 `@handlewithcare/prosemirror-suggest-changes` 授权为独立第三方(非 BlockNote/GPL),记录到 tech.md
- [x] 13.3 将依赖闭包和许可证检查结果写入 feat tech.md,发现禁止依赖时阻塞 change 完成
- [x] 13.4 编写 `packages/tap-note-ai-core/README.md`,包含最小接入示例、API 表、与 FEAT-005 契约对齐说明
- [x] 13.5 在 README 中写明 AI SDK v7 依赖、`DefaultChatTransport` 封装、不持有 Key 的安全边界
- [x] 13.6 在 README 中写明 suggest-changes 集成、accept/reject/revert 语义、revision 冲突处理
- [x] 13.7 在 README 中写明上下文体积分层(4K/8K/2×)、选区拦截、不引用模式
- [x] 13.8 为 `src/index.ts` 的公开导出补充简洁 JSDoc,确保 API 意图和类型用途清晰
- [x] 13.9 检查所有新增目录和文件遵循 kebab-case、index 入口和项目 TypeScript 命名约定
- [x] 13.10 最终复核 ai-core spec 的每条 requirement 都有代码、测试对应物
- [x] 13.11 只有 typecheck、lint、test 和许可证检查全部通过后,才将 change 标记为可归档
