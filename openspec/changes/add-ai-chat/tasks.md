## 1. 研究闸门:AI SDK v7 `useChat` + client-side tools + `toolCallId` 回传

- [ ] 1.1 使用 Context7 查询 `@ai-sdk/react` v7 的 `useChat` hook 精确 API,确认 `sendMessage(message, { body, tools, abortSignal })` 是否支持 per-call 动态 body 合并(把 `documentState` 与 `documentRevision` 注入请求 body)与 per-call clientTools 切换(根据上下文模式动态增减 `getDocumentSnapshot`);若不支持,确认回退方案(自定义 transport wrapper 或直接 `fetch` + `readUIMessageStream`)
- [ ] 1.2 使用 Context7 查询 AI SDK v7 的 `useChat` 的 `tools` 选项形状,确认 client-side tools `execute({ args, toolCallId })` 与 tool result 回传的精确 API(`execute` 返回值如何按 `toolCallId` 进入后续 messages)
- [ ] 1.3 使用 Context7 查询 AI SDK v7 `UIMessage.parts` 数组结构,确认 `text` part 与 `tool-call` part 的精确形状,以及 partial tool-call input 是否通过 `tool-input-start`/`tool-input-delta`/`tool-input-end` chunks 增量到达
- [ ] 1.4 使用 Context7 查询 `@ai-sdk/alibaba@2` 与 `@ai-sdk/google@4` 与 `ai@7` 的 peerDep 兼容性,记录到 tech.md(若不兼容,降级为只用 `@ai-sdk/alibaba`,Gemini 暂不支持)
- [ ] 1.5 阅读 `resource/BlockNote/packages/xl-ai/src` 的 client-side tools 模式(StreamToolExecutor.ts、AIExtension.ts 中 tool 相关逻辑、blocknoteAIClient/),理解 v6 的 client-side tools `execute`/tool result 回传、UIMessage parts 渲染范式,记录重写要点(v6→v7 翻译差异)
- [ ] 1.6 将 1.1-1.5 结论写入 `docs/prd/sub-ai-assistant/feat-ai-chat/tech.md`(新增研究闸门结论小节),包括锁定版本、`useChat` API、client-side tools execute/toolCallId 回传、UIMessage.parts 渲染、provider peerDep 兼容性、xl-ai client-side tools 重写要点
- [ ] 1.7 只有 1.1-1.6 全部有可复核结果后,才允许进入第 2 组;若研究结论改变目标方案,先更新本 change 的 design.md 与任务依赖

## 2. 包基础设施

- [ ] 2.1 参照 `packages/tap-note-ai-inline` 创建 `packages/tap-note-ai-chat` 目录和 `package.json`,包名 `@tap-note/ai-chat`,`private: true`
- [ ] 2.2 创建 `tsconfig.json`(ES2022/DOM/ESNext/bundler/react-jsx/strict/noEmit/verbatimModuleSyntax/erasableSyntaxOnly,路径别名 `@tap-note/ai-chat/*`)
- [ ] 2.3 创建 `eslint.config.js` / `bunfig.toml`(preload happy-dom + Testing Library)
- [ ] 2.4 创建 `src/index.ts` 空入口骨架
- [ ] 2.5 写入运行时依赖:`@blocknote/core@0.51.4`、`@blocknote/react@0.51.4`、`@tap-note/ai-core@workspace:*`、`zod`;peerDeps:`ai@7.0.x`、`@ai-sdk/react@7.0.x`、`react@^19`、`react-dom@^19`
- [ ] 2.6 写入 devDependencies:`@happy-dom/global-registrator`、`@testing-library/{jest-dom,react}`、`eslint`、`typescript-eslint`、`react`、`react-dom`、`@types/react`、`@types/react-dom`、`typescript`
- [ ] 2.7 执行 `bun install`,检查 lockfile 变更仅含预期依赖,确认依赖树无 `@blocknote/xl-ai`/GPL/AGPL
- [ ] 2.8 运行 `typecheck`、`lint`,修复基础配置问题后进入核心实现

## 3. 上下文模式与分层

- [ ] 3.1 创建 `src/context/context-mode.ts`,定义 `ContextMode = "selection" | "full" | "none"` 类型与默认值 `"none"`;提供 `isSnapshotToolAllowed(mode, allowSnapshotTool)` 纯函数
- [ ] 3.2 创建 `src/context/context-layer.ts`,封装 ai-core `layerContext`,实现 chat 版本:选区模式调 `layerContext(documentState, { selectionBudget: 4096 })`,超限返回 `LayeredContext { kind: "selection-blocked" }`;全文模式调 `layerContext(documentState, { fullBudget: 8192, outlineThreshold: 16384 })`,返回 `ok`/`truncated`/`outline` 三种 kind;`none` 模式不发 documentState
- [ ] 3.3 实现 segmented control 下方提示行:根据 `LayeredContext.kind` 渲染 `selectionBlocked`/`documentTruncated`/`outlineMode` 文案,以及 token 估算展示
- [ ] 3.4 实现 `buildDocumentState(editor, mode, documentStateBuilder)`:根据 mode 返回 `DocumentState | undefined`,`selection` 模式取当前选区,`full` 模式取全文,`none` 返回 `undefined`
- [ ] 3.5 编写单元测试:三态切换正确、选区超 4K 拦截、全文预算内/截断/大纲三种情况、`none` 不发 documentState 与不暴露 snapshot tool

## 4. 客户端 tools

- [ ] 4.1 创建 `src/tools/client-tools.ts`,定义 `createClientTools({ editor, documentStateBuilder, allowSnapshotTool, contextMode })` 工厂,返回 AI SDK v7 `tools` 对象(从 ai-core 导入 `blockOperationSchema`,不在 ai-chat 重新定义)
- [ ] 4.2 实现 `insertBlock` execute:校验 `args.baseDocumentRevision` 与 `referenceBlockId` 前置条件,成功调用 `editor.insertBlocks([block], referenceBlockId, "after")`,返回 `{ ok: true }`;冲突返回 ai-core `ConflictResult`
- [ ] 4.3 实现 `updateBlock` execute:校验 `args.baseDocumentRevision` 与 `targetBlockId`,成功调用 `editor.updateBlock(targetBlockId, block)`
- [ ] 4.4 实现 `deleteBlock` execute:校验 `args.baseDocumentRevision` 与 `targetBlockId`,成功调用 `editor.removeBlocks([targetBlockId])`
- [ ] 4.5 实现 `replaceBlocks` execute:校验 `args.baseDocumentRevision` 与 `targetBlockIds`,成功调用 `editor.insertBlocks(blocks, targetBlockIds[0], "before")` + `editor.removeBlocks(targetBlockIds)`(或等价 API)
- [ ] 4.6 实现 `moveBlock` execute:校验 `args.baseDocumentRevision` 与 `targetBlockId`/`referenceBlockId`/`position`,成功调用 `editor.insertBlocks([block], referenceBlockId, position)` + `editor.removeBlocks([原 targetBlockId])`
- [ ] 4.7 实现 `getDocumentSnapshot` execute:校验 `contextMode === "full"` 且 `allowSnapshotTool === true`(否则不声明该 tool);`execute` 内受 `maxBlocks`(默认 10)与 `maxTokens`(默认 2K)约束,返回 `{ blocks, fromBlock, includedBlocks, truncated }`
- [ ] 4.8 编写工具单元测试:每个工具成功路径、revision 冲突返回 ConflictResult、前置条件冲突(目标块不存在)、`getDocumentSnapshot` 在 `none`/`selection` 模式不声明、在 `full` + allowSnapshot 模式声明且超额受限

## 5. ChatPanel 与 useTapNoteChat

- [ ] 5.1 创建 `src/use-tap-note-chat.ts`,封装 AI SDK v7 `useChat`:接收 `{ transport, clientTools, documentStateBuilder, editor, model, getAuthHeaders, aiBusyState }` 选项,返回 `{ messages, input, setInput, sendMessage, abort, status, busy }`
- [ ] 5.2 `sendMessage(message)` 实现先 `busy.acquire("chat")`,失败则输入框置灰不发送;成功后调 `buildDocumentState(editor, contextMode, documentStateBuilder)` 构造 documentState,通过 `sendMessage(message, { body: { documentState, documentRevision }, tools: clientTools })` 注入
- [ ] 5.3 实现 `abort()`:调用 `useChat` 的 `abort()` 中断流式,保留已成功 tool-call 结果,调用 `busy.release()`
- [ ] 5.4 实现流式状态:`sending`/`streaming` 状态期间输入框置灰显示中止按钮;`completed`/`error` 状态调用 `busy.release()`,输入框恢复可用
- [ ] 5.5 创建 `src/tap-note-chat-panel.tsx`,实现 `TapNoteChatPanel` 组件:根容器 `data-tap-note-chat-panel` + `min-width: 320px`;内部含 header、ContextSelector、MessageList、InputArea;支持 `onClose` prop(由集成方控制关闭)
- [ ] 5.6 创建 `src/ui/context-selector.tsx`,实现三段式 segmented control(选区/全文/无),默认 `无`;下方条件性显示提示行(超限/截断/大纲)
- [ ] 5.7 创建 `src/ui/message-list.tsx`,渲染消息列表:用户消息右对齐 + chip;AI 消息左对齐 + UIMessage.parts 渲染(text part + tool-call 输入中状态)
- [ ] 5.8 创建 `src/ui/message-bubble.tsx`,渲染单条消息气泡:用户气泡(右对齐 + 上下文 chip)、AI 气泡(左对齐 + text part + tool-call 输入中 `◔/◑/◐` 图标 + toolName + 目标块 ID)
- [ ] 5.9 创建 `src/ui/input-area.tsx`,实现输入框 + 发送/中止按钮:`Enter` 发送(Shift+Enter 换行)、空则发送禁用、流式中显示中止按钮、busy 时置灰显示原因
- [ ] 5.10 实现焦点陷阱、`Escape` 关闭(若 `onClose` 提供)、发送后焦点恢复、`aria-live="polite"` 流式状态播报
- [ ] 5.11 编写组件行为测试(happy-dom + Testing Library):ChatPanel 显隐、segmented 切换、消息气泡渲染、输入框置灰、busy 文案、焦点陷阱、Escape 关闭、aria-live 播报

## 6. tool-result-bubble 与冲突重试

- [ ] 6.1 创建 `src/tools/tool-result-bubble.tsx`,实现 `<ToolResultBubble>` 独立气泡:接收 `{ toolCallId, toolName, result, onRetry, onJumpToBlock }`,渲染 4 种状态(成功/冲突/前置失败/错误)
- [ ] 6.2 实现成功状态(`✓` + 操作类型文字 + 目标块 ID + 跳转按钮):操作类型从 toolName 派生(insertBlock→「已插入块」、updateBlock→「已更新块」、deleteBlock→「已删除块」、replaceBlocks→「已替换块」、moveBlock→「已移动块」)
- [ ] 6.3 实现冲突状态(`⚠` + `AICoreDictionary.conflict` 文案 + 当前 revision + 期望 revision + 「仅重试该操作」按钮):点击重试触发 `onRetry(toolCallId)`
- [ ] 6.4 实现前置失败状态(`⚠` + `AICoreDictionary.preconditionFailed` 文案 + 失败原因 + 「重试」按钮)
- [ ] 6.5 实现错误状态(`✗` + 错误文案,不暴露服务端堆栈)
- [ ] 6.6 实现「仅重试该 toolCallId」逻辑:用户点击重试 → 系统读取当前 `editor.document` 最新 `documentRevision` → 用原 toolName + 原 args + 新 `baseDocumentRevision` 重新调用 `execute` → 成功更新气泡为 `✓`,失败保持 `⚠` 状态
- [ ] 6.7 实现跳转按钮:`onJumpToBlock(targetBlockId)` 由 ChatPanel 传入,调用 `editor.setTextCursorPosition(targetBlockId)` + 滚动到该块
- [ ] 6.8 编写气泡测试:4 种状态正确渲染、操作类型不依赖颜色(文字 + 图标)、重试触发新 revision execute、跳转按钮调用 editor API

## 7. i18n 字典

- [ ] 7.1 创建 `src/i18n/zh-cn.ts`,定义 `ChatDictionary` 接口**扩展** ai-core `AICoreDictionary`,只新增 chat 特有字段:`chatPlaceholder`/`abort`/`retryToolCall`/`contextSelection`/`contextFull`/`contextNone`/`chatBusy`/`authExpired`/`toolInputting`/`toolUpdated`/`toolConflict`/`toolPreconditionFailed`/`toolFailed`/`jumpToBlock`;不重复定义 `aiBusy`/`conflict`/`preconditionFailed`/`selectionBlocked`/`documentTruncated`/`outlineMode` 等已有字段
- [ ] 7.2 实现 `chatDictionaryZhCN: ChatDictionary`(扩展 ai-core `aiCoreDictionaryZhCN` 并新增 chat 字段),从 ai-core 导入 `mergeDictionary` 复用
- [ ] 7.3 从 `src/index.ts` 导出 `ChatDictionary` 类型与 `chatDictionaryZhCN` 字典
- [ ] 7.4 编写字典测试:默认值(含继承自 ai-core 的字段)、Partial 覆盖合并(用 ai-core `mergeDictionary`)、undefined 时返回 base、扩展字段正确

## 8. createTapNoteChatAssistant 入口

- [ ] 8.1 创建 `src/index.ts`,实现 `createTapNoteChatAssistant(options)` 入口函数
- [ ] 8.2 `options` 接收 `{ transport, documentStateBuilder, editor, model?, getAuthHeaders?, dictionary?, allowSnapshotTool? = true, aiBusyState }`
- [ ] 8.3 返回 `TapNoteChatAssistant` 对象,**实现 `{ mount(editor), unmount(editor), panel }` 接口**(与 `packages/tap-note-editor` 的 `TapNoteChatAssistant` 类型兼容,扩展 `panel` 字段返回 `TapNoteChatPanel` 组件引用)
- [ ] 8.4 `mount(editor)` 时:注册选区订阅、创建 `useTapNoteChat` 上下文、安装 clientTools(根据 contextMode 动态切换 `getDocumentSnapshot`)
- [ ] 8.5 `unmount(editor)` 时:释放 busy(若持有)、移除事件监听、清除选区高亮、abort 未完成请求
- [ ] 8.6 在发送请求前调用 `layerContext(documentState)` 检查预算:`selection-blocked` 时输入框置灰并提示,不发送
- [ ] 8.7 若 `allowSnapshotTool: false`,即使 contextMode 为 `full` 也不声明 `getDocumentSnapshot`
- [ ] 8.8 从 `src/index.ts` 导出 `createTapNoteChatAssistant`、`TapNoteChatPanel`、`ChatDictionary` 类型与 `chatDictionaryZhCN` 字典、`useTapNoteChat` hook、`ContextMode` 类型
- [ ] 8.9 编写入口函数测试:返回对象结构正确、mount/unmount 生命周期、与 TapNoteEditor 接口兼容、layerContext 拦截、allowSnapshotTool 控制 getDocumentSnapshot 暴露

## 9. apps/web demo 接入

- [ ] 9.1 `apps/web/package.json` 新增 `react-router-dom` 依赖,执行 `bun install`
- [ ] 9.2 `apps/web/vite.config.ts` 配置 Vite proxy `/api` → `http://localhost:3000`(指向 server-api)
- [ ] 9.3 创建 `apps/web/src/components/sidemenu.tsx`,实现侧边菜单切换 `/inline`、`/chat`、`/both` 三路由
- [ ] 9.4 创建 `apps/web/src/components/editor-paper-layout.tsx`,实现 A4 纸面布局(灰色工作区 + 居中白纸 + 阴影,纸面最大宽 820px),作为 demo example 样式
- [ ] 9.5 创建 `apps/web/src/components/chat-drawer.tsx`,实现右侧可开合抽屉(开关按钮 + 抽屉容器 + ChatPanel 装载),作为 demo example 布局
- [ ] 9.6 改造 `apps/web/src/App.tsx`:用 React Router 配置 `/inline`、`/chat`、`/both` 三路由,共享 `aiBusyState` 与 `inlineAssistant`/`chatAssistant` 单例;每个路由都套用 `editor-paper-layout`
- [ ] 9.7 `/inline` 路由:仅 inline 助手 demo(保留现有 inline 交互),套用 A4 纸面
- [ ] 9.8 `/chat` 路由:仅 chat 助手 demo,ChatPanel 装载到右侧抽屉;模型下拉调 `/api/ai/models` 渲染
- [ ] 9.9 `/both` 路由:inline + chat 共存,共享 `aiBusyState`,验证互斥(inline 进行中时 chat 输入框置灰,反之亦然)
- [ ] 9.10 创建 `apps/web/src/components/model-selector.tsx`,启动时 GET `/api/ai/models` 渲染下拉,切换后写入 transport body
- [ ] 9.11 `apps/web/src/app.css` 补充 A4 纸面与抽屉样式(灰色工作区背景、白纸阴影、抽屉动画)
- [ ] 9.12 手动冒烟:`bun dev` 启动 web + server-api,三路由切换正常,A4 纸面可见,模型下拉可切换,内联与对话互斥生效

## 10. 集成测试与质量门禁

- [ ] 10.1 编写跨模块集成测试:`useChat` → clientTools execute → editor.insertBlocks/updateBlock/removeBlocks 全链路(用 mock transport 模拟 v7 UIMessageStream)
- [ ] 10.2 编写 busy + chat 生命周期集成测试:acquire → sendMessage → tool execute → release;中止 → abort → release;失败 → release
- [ ] 10.3 编写 ConflictResult 集成测试:revision 冲突触发 `⚠` 气泡、「仅重试该操作」用最新 revision 重新 execute 成功;前置条件冲突(目标块不存在)触发 `⚠` 气泡
- [ ] 10.4 编写 layerContext 上下文三态集成测试:selection 超 4K 拦截不发请求;full 预算内发完整;full 超预算截断;full >2× 大纲;none 不发 documentState 不暴露 snapshot tool
- [ ] 10.5 编写选区高亮 + chip 集成测试:切换到 selection 模式时编辑器侧高亮可见;发送后清除高亮,消息气泡 chip 保留;多轮中 chip 累积
- [ ] 10.6 编写 busy 互斥集成测试:与 inline 共享 aiBusyState,chat 进行中时 inline 入口禁用,反之亦然;完成/中止后立即恢复
- [ ] 10.7 运行包 `bun test`,修复测试环境问题,保留稳定的行为断言
- [ ] 10.8 运行包 `bun run typecheck`,确认 `import type` 正确、与 ai-core/ai-backend schema 对齐
- [ ] 10.9 运行包 `bun run lint`,确认新增包通过 ESLint
- [ ] 10.10 运行根 `bun run typecheck`,确认 workspace 依赖和所有受影响包通过
- [ ] 10.11 运行根 `bun run lint`,确认新增包通过
- [ ] 10.12 运行根 `bun run test`,确认 Turbo 能发现并执行 ai-chat 测试
- [ ] 10.13 确认测试不依赖真实 LLM API、网络或持久化服务

## 11. 授权、文档与收尾

- [ ] 11.1 生成 `@tap-note/ai-chat` 的生产依赖闭包清单,确认无 `@blocknote/xl-ai` 或任何 GPL/AGPL 依赖
- [ ] 11.2 确认 `@blocknote/core@0.51.4`/`@blocknote/react@0.51.4` 授权为 MPL-2.0,记录到 tech.md
- [ ] 11.3 将依赖闭包和许可证检查结果写入 `docs/prd/sub-ai-assistant/feat-ai-chat/tech.md`,发现禁止依赖时阻塞 change 完成
- [ ] 11.4 把研究闸门(1.x)的 v7 API 结论、client-side tools execute/toolCallId 回传精确形状、UIMessage.parts 渲染要点落地到 `feat-ai-chat/tech.md`
- [ ] 11.5 编写 `packages/tap-note-ai-chat/README.md`,包含最小接入示例、API 表、与 FEAT-002/005 契约对齐说明;明确说明 ai-chat 包位置无关,最小宽 320px,不提供抽屉开关组件,A4 与抽屉布局属 apps/web demo example
- [ ] 11.6 在 README 中写明建议用户通过 `TapNoteEditor.chatAssistant` prop 注入,而非直接操作 mount/unmount
- [ ] 11.7 为 `src/index.ts` 的公开导出补充简洁 JSDoc,确保 API 意图和类型用途清晰
- [ ] 11.8 检查所有新增目录和文件遵循 kebab-case、index 入口和项目 TypeScript 命名约定
- [ ] 11.9 最终复核 ai-chat spec 的每条 requirement 都有代码、测试对应物
- [ ] 11.10 只有 typecheck、lint、test 和许可证检查全部通过后,才将 change 标记为可归档
