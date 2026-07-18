## 1. 研究闸门:BlockNote createExtension + AI SDK partial tool call streaming

- [ ] 1.1 使用 Context7 查询 BlockNote 官方文档,确认 `createExtension` API 在 0.51.4 中的精确形状(Extension 接口的 `key`/`mount`/`store`/`prosemirrorPlugins`/`keyboardShortcuts`/`inputRules` 等字段)
- [ ] 1.2 使用 Context7 查询 `@blocknote/react` 官方文档,确认 `useFloatingMenu`/`useBlockNoteEditor` 等 hook 的变量与用法
- [ ] 1.3 使用 Context7 查询 AI SDK v7 的 `tool-call` chunk 精确形状,最小示例验证 partial JSON 分片模式与 `parsePartialJson` 的累积行为
- [ ] 1.4 阅读 `resource/BlockNote/packages/xl-ai/src/AIExtension.ts` 与 `StreamToolExecutor.ts` 源码,理解 v6 的 AIExtension 状态机、StreamTool 增量解析/校验/去重、AIMenu/AIToolbarButton/Slash 交互范式,记录重写要点
- [ ] 1.5 将 1.1-1.4 结论写入 `docs/prd/sub-ai-assistant/feat-ai-inline/tech.md`(新增研究闸门结论小节),包括锁定版本、createExtension API、partial tool call streaming 解析、xl-ai 重写要点
- [ ] 1.6 只有 1.1-1.5 全部有可复核结果后,才允许进入第 2 组;若研究结论改变目标方案,先更新本 change 的 design.md 与任务依赖

## 2. 包基础设施

- [ ] 2.1 参照 `packages/tap-note-ai-core` 创建 `packages/tap-note-ai-inline` 目录和 `package.json`,包名 `@tap-note/ai-inline`,`private: true`
- [ ] 2.2 创建 `tsconfig.json`(ES2022/DOM/ESNext/bundler/react-jsx/strict/noEmit/verbatimModuleSyntax/erasableSyntaxOnly,路径别名 `@tap-note/ai-inline/*`)
- [ ] 2.3 创建 `eslint.config.js` / `bunfig.toml`(preload happy-dom + Testing Library)
- [ ] 2.4 创建 `src/index.ts` 空入口骨架
- [ ] 2.5 写入运行时依赖:`@blocknote/core@0.51.4`、`@blocknote/react@0.51.4`、`@tap-note/ai-core@workspace:*`、`zod`;peerDeps:`ai@7.0.x`、`react@^19`、`react-dom@^19`
- [ ] 2.6 写入 devDependencies:`@happy-dom/global-registrator`、`@testing-library/{jest-dom,react}`、`eslint`、`typescript-eslint`、`react`、`react-dom`、`@types/react`、`@types/react-dom`、`typescript`
- [ ] 2.7 执行 `bun install`,检查 lockfile 变更仅含预期依赖,确认依赖树无 `@blocknote/xl-ai`/GPL/AGPL
- [ ] 2.8 运行 `typecheck`、`lint`,修复基础配置问题后进入核心实现

## 3. 状态机与 TapNoteAIInlineExtension

- [ ] 3.1 创建 `src/extension/state-machine.ts`,定义 `InlineState` 类型(`user-input`/`thinking`/`ai-writing`/`user-reviewing`/`error`)与转换函数 `transition(state, event)`(纯函数,不依赖 React)
- [ ] 3.2 `error` 态携带 `error` 字段,`ai-writing` 态携带 `operations` 累积字段,`user-reviewing` 态携带 `operations` 最终字段
- [ ] 3.3 创建 `src/extension/tap-note-ai-inline-extension.ts`,用 `@blocknote/core` 的 `createExtension` 创建扩展,`key: "ai-inline"`;`store` 管理状态机状态;`prosemirrorPlugins` 安装 `suggestChanges()` 插件
- [ ] 3.4 扩展的 `keyboardShortcuts` 响应 `/ai` 输入(触发 `user-input` 态);`mount` 时注册服务端请求与流式响应处理
- [ ] 3.5 确保 `suggestChanges()` 插件只安装一次(扩展单例)
- [ ] 3.6 编写状态机单元测试:5 个状态的正确转换、error→重试→thinking 恢复路径、非法转换抛错

## 4. StreamToolExecutor

- [ ] 4.1 创建 `src/stream-tool-executor.ts`,用 `TransformStream` 模式实现 `StreamToolExecutor`
- [ ] 4.2 输入 `ReadableStream<UIMessageChunk>`(来自 transport),输出 `BlockOperation[]`
- [ ] 4.3 用 `parsePartialJson` 累积解析 partial JSON input,`isPossiblyPartial` 标记判断是否完成
- [ ] 4.4 实现 `filterNewOrUpdatedOperations(operations, previousOperations)` 去重:用 `operation.id` + `isUpdateToPreviousOperation` 标记,不重复应用已处理的工具调用
- [ ] 4.5 非法 partial 丢弃,不中断流;记录警告但不暴露给用户
- [ ] 4.6 完整操作提交到 `applyOperationsToEditor(editor, ops, { mode: "suggest" })`
- [ ] 4.7 编写 StreamToolExecutor 单元测试:partial 增量解析、非法 partial 丢弃、去重(重复/更新)、完整操作提交

## 5. applyDocumentOperations 流式工具

- [ ] 5.1 创建 `src/tools/apply-document-operations.ts`,用 AI SDK `tool({ ... })` 定义 `applyDocumentOperations` 工具
- [ ] 5.2 输入 schema:`{ operations: BlockOperation[] }`(使用 ai-core 的 `blockOperationSchema` 数组,同源,不重复定义)
- [ ] 5.3 `execute` 调用 `applyOperationsToEditor(editor, operations, { mode: "suggest" })`(从 ai-core 导入)
- [ ] 5.4 确保 `execute` 不抛错(错误由 StreamToolExecutor 处理,execute 只返回 `{ ok: true }`)
- [ ] 5.5 编写工具测试:合法操作返回 `{ ok: true }`、非法操作抛 ZodError

## 6. UI 组件

- [ ] 6.1 创建 `src/ui/ai-menu-controller.tsx`,实现 `AIMenuController` React 组件:输入框 + 发送/中止/接受/拒绝/重试按钮
- [ ] 6.2 AIMenu 在 `ai-writing` 态显示中止按钮,`user-reviewing` 态显示接受/拒绝按钮,`error` 态显示错误信息与重试按钮
- [ ] 6.3 创建 `src/ui/ai-toolbar-button.tsx`,实现 `AIToolbarButton` React 组件:选区时出现的 AI 按钮
- [ ] 6.4 创建 `src/ui/ai-slash-menu-items.ts`,实现 `getAISlashMenuItems`: `/ai` 触发块末尾的 slash 菜单项
- [ ] 6.5 确保组件不直接发起 HTTP 或持有 LLM Key(通过 ai-core transport 间接发起)
- [ ] 6.6 编写组件行为测试(用 happy-dom + Testing Library):UI 渲染、按钮显隐、状态联动

## 7. createTapNoteInlineAssistant 入口

- [ ] 7.1 创建 `src/index.ts`,实现 `createTapNoteInlineAssistant(options)` 入口函数
- [ ] 7.2 `options` 接收 `{ transport, aiBusyState, model?, documentStateBuilder?, dictionary? }`
- [ ] 7.3 返回 `TapNoteInlineAssistant` 对象,含 `extension`/`menuController`/`toolbarButton`/`slashMenuItems`
- [ ] 7.4 内部使用 ai-core 的 `createAIBusyState`/`createDocumentStateBuilder`/`createServerTransport`/`injectDocumentStateMessages`/`applyOperationsToEditor`
- [ ] 7.5 从 `src/index.ts` 导出 `createTapNoteInlineAssistant` 与 `InlineState` 类型
- [ ] 7.6 编写入口函数测试:返回对象结构正确、复用 ai-core 组件

## 8. i18n 字典

- [ ] 8.1 创建 `src/i18n/zh-cn.ts`,定义 `InlineDictionary` 类型与默认 zh-CN 字典(`aiInlineTrigger`、`aiBusy`、`aiWriting`、`accept`、`reject`、`abort`、`retry`、`error` 等)
- [ ] 8.2 实现 `mergeDictionary(base, override?)` 的 Partial 合并逻辑(与 ai-core 一致)
- [ ] 8.3 从 `src/index.ts` 导出 `InlineDictionary` 类型与默认字典
- [ ] 8.4 编写字典测试:默认值、Partial 覆盖合并、undefined 时返回 base

## 9. 集成测试与质量门禁

- [ ] 9.1 编写跨模块集成测试:Transport → StreamToolExecutor → applyOperationsToEditor 全链路(用 mock transport)
- [ ] 9.2 编写 busy + inline 生命周期集成测试:acquire → suggest → accept/reject → release
- [ ] 9.3 运行包 `bun test`,修复测试环境问题,保留稳定的行为断言
- [ ] 9.4 运行包 `bun run typecheck`,确认 `import type` 正确、与 ai-core/ai-backend schema 对齐
- [ ] 9.5 运行包 `bun run lint`,确认新增包通过 ESLint
- [ ] 9.6 运行根 `bun run typecheck`,确认 workspace 依赖和所有受影响包通过
- [ ] 9.7 运行根 `bun run lint`,确认新增包通过(预存在的 ui/button.tsx 错误与本 change 无关)
- [ ] 9.8 运行根 `bun run test`,确认 Turbo 能发现并执行 ai-inline 测试
- [ ] 9.9 确认测试不依赖真实 LLM API、网络或持久化服务

## 10. 授权、文档与收尾

- [ ] 10.1 生成 `@tap-note/ai-inline` 的生产依赖闭包清单,确认无 `@blocknote/xl-ai` 或任何 GPL/AGPL 依赖
- [ ] 10.2 确认 `@blocknote/core@0.51.4`/`@blocknote/react@0.51.4` 授权为 MPL-2.0,记录到 tech.md
- [ ] 10.3 将依赖闭包和许可证检查结果写入 feat tech.md,发现禁止依赖时阻塞 change 完成
- [ ] 10.4 编写 `packages/tap-note-ai-inline/README.md`,包含最小接入示例、API 表、与 FEAT-002/005 契约对齐说明
- [ ] 10.5 在 README 中写明建议用户通过 `TapNoteEditor.inlineAssistant` prop 注入,而非直接操作扩展
- [ ] 10.6 为 `src/index.ts` 的公开导出补充简洁 JSDoc,确保 API 意图和类型用途清晰
- [ ] 10.7 检查所有新增目录和文件遵循 kebab-case、index 入口和项目 TypeScript 命名约定
- [ ] 10.8 最终复核 ai-inline spec 的每条 requirement 都有代码、测试对应物
- [ ] 10.9 只有 typecheck、lint、test 和许可证检查全部通过后,才将 change 标记为可归档