## ADDED Requirements

### Requirement: 提供 BlockOperation Zod schema 与类型

系统 SHALL 提供 `BlockOperation` Zod schema 与派生类型,覆盖 `insertBlock`、`updateBlock`、`deleteBlock`、`replaceBlocks`、`moveBlock` 五种操作。每个操作 MUST 携带 `baseDocumentRevision` 与目标块 ID 或前置条件。系统 SHALL 通过 Zod `.parse()` 校验非法操作,校验失败时抛出 `ZodError`,不静默忽略。

#### Scenario: 合法操作校验通过

- **WHEN** 调用方传入携带 `baseDocumentRevision` 与 `targetBlockId` 的 `updateBlock` 操作
- **THEN** `.parse()` SHALL 返回类型化的操作对象,字段与输入一致

#### Scenario: 非法操作被拒绝

- **WHEN** 调用方传入缺少 `baseDocumentRevision` 或 `targetBlockId` 的操作
- **THEN** `.parse()` SHALL 抛出 `ZodError`,错误信息包含失败路径,不返回部分结果

#### Scenario: 服务端与客户端共享同一 schema

- **WHEN** FEAT-005 服务端与 FEAT-003/004 客户端引用同一 `BlockOperation` schema
- **THEN** 两端 MUST 使用相同的 Zod schema 模块,不允许各自定义等价 schema

### Requirement: 提供 DocumentStateBuilder

系统 SHALL 提供 `DocumentStateBuilder`,把编辑器受影响块(含选区)序列化为 `{ format: "blocks-json", schemaVersion, documentRevision, blocks, selection? }`。`documentRevision` MUST 单调递增。`selection` 在用户显式选择时包含起止块 ID,未选区时不出现。

#### Scenario: 序列化受影响块

- **WHEN** 调用方传入 editor 实例与选区范围
- **THEN** builder SHALL 返回包含 `schemaVersion`、`documentRevision`、`blocks` 与可选 `selection` 的 `DocumentState`

#### Scenario: documentRevision 单调递增

- **WHEN** 同一编辑器会话内多次调用 builder
- **THEN** 后续返回的 `documentRevision` MUST 大于前一次

### Requirement: 提供 injectDocumentStateMessages

系统 SHALL 提供 `injectDocumentStateMessages(messages, documentState)`,把文档状态注入 AI 消息列表。注入后的消息 MUST 能被 FEAT-005 的 `streamText` 端点消费。注入逻辑 SHALL 适配 AI SDK v7 的 `UIMessage.parts` 数组结构(总 PRD v11 决策)。

#### Scenario: 注入后消息可被 streamText 消费

- **WHEN** 调用方把注入后的 messages 发往 `/api/ai/editor/streamText`
- **THEN** 服务端 SHALL 能解析 documentState 并将其作为上下文传给模型

#### Scenario: 不引用模式不注入

- **WHEN** documentState 为 `undefined` 或 `null`
- **THEN** 函数 SHALL 原样返回 messages,不附加文档相关 part

### Requirement: 提供 applyOperationsToEditor 经 suggest-changes 可回退应用

系统 SHALL 提供 `applyOperationsToEditor(editor, operations, { mode })`,经 `@handlewithcare/prosemirror-suggest-changes` 的 `suggestChanges`/`applySuggestions`/`revertSuggestions` 实现可回退应用。`mode: "suggest"` SHALL 创建建议事务;`mode: "apply"` SHALL 合并建议到正式文档;`mode: "revert"` SHALL 回退所属建议事务。拒绝只回退该 AI 事务,不覆盖用户后续编辑。

#### Scenario: 建议事务可接受

- **WHEN** 调用 `applyOperationsToEditor(editor, ops, { mode: "suggest" })` 后调用 `mode: "apply"`
- **THEN** 建议 SHALL 合并到正式文档,undo 历史正确(接受后 undo 跳回写作前)

#### Scenario: 建议事务可拒绝

- **WHEN** 调用 `mode: "suggest"` 后用户手动编辑同一块,再调用 `mode: "revert"`
- **THEN** 系统 SHALL 只回退 AI 建议事务,不覆盖用户的手动编辑

#### Scenario: revision 冲突不执行

- **WHEN** 操作的 `baseDocumentRevision` 与当前编辑器 revision 不匹配
- **THEN** 系统 SHALL 不执行该操作,返回可重试的冲突结果,不污染文档

### Requirement: 提供 transport 工厂

系统 SHALL 提供 `createServerTransport({ baseUrl, model, getAuthHeaders? })` 与 `createProxyTransport(...)`,封装 AI SDK v7 的 `DefaultChatTransport` 对象。transport SHALL 携带 `model` 字段,SHALL NOT 持有任何 LLM API Key。`getAuthHeaders` 由集成方提供,用于注入短期 JWT。

#### Scenario: transport 不持有 LLM Key

- **WHEN** 检查 transport 实例的字段
- **THEN** 实例 MUST 不包含 `apiKey`、`apiSecret` 或任何 LLM provider 凭据字段

#### Scenario: transport 携带 model

- **WHEN** 调用方传入 `{ baseUrl, model: "dashscope:qwen-plus" }`
- **THEN** transport SHALL 在请求 body 中携带该 model 字段,供服务端路由

### Requirement: 提供会话级 AIBusyState

系统 SHALL 提供 `createAIBusyState()`,返回会话级 AI 互斥状态,支持 `acquire(type)`、`release()`、`subscribe(listener)` 与 `isBusy` 快照。每个编辑器会话创建一个实例并注入内联与对话助手。任一 AI 进行中时另一助手入口禁用,完成/中止/失败/卸载后释放。不同编辑器会话互不阻塞。

#### Scenario: 互斥获取

- **WHEN** 内联助手调用 `acquire("inline")` 后,对话助手调用 `acquire("chat")`
- **THEN** 第二次 acquire SHALL 返回 false,对话助手入口禁用

#### Scenario: 释放后可重新获取

- **WHEN** 内联助手调用 `release()` 后,对话助手调用 `acquire("chat")`
- **THEN** 第二次 acquire SHALL 返回 true,对话助手可用

#### Scenario: 订阅状态变化

- **WHEN** 订阅者注册后,busy 状态从 idle 变为 in-progress
- **THEN** 订阅者 SHALL 收到通知,携带新的 busy 值

### Requirement: 提供 estimateTokens 与上下文体积分层

系统 SHALL 提供 `estimateTokens(text)`,返回 token 估算值。系统 SHALL 提供上下文体积分层处理:选区软上限默认 4K tokens(可配),超限前端拦截提示减少选区,不静默截断;引用全文预算默认 8K(可配),超预算截断带 `[文档已截断]` 标记,超过 2× 预算改发结构化大纲。不引用模式不发送 documentState,也不暴露读取文档的工具。

#### Scenario: 选区超软上限拦截

- **WHEN** 选区估算 token 超过 4K 软上限
- **THEN** 系统 SHALL 返回拦截结果,提示减少选区或改用「引用全文+指令」,不发送请求

#### Scenario: 全文在预算内发完整快照

- **WHEN** 全文估算 token ≤ 8K 预算
- **THEN** 系统 SHALL 发送完整 documentState 快照

#### Scenario: 全文超预算截断

- **WHEN** 全文估算 token 在 8K 预算与 2× 预算之间
- **THEN** 系统 SHALL 截断到预算,附 `[文档已截断:共 N 块,此处含前 M 块]` 标记

#### Scenario: 全文超大改发大纲

- **WHEN** 全文估算 token 超过 2× 预算
- **THEN** 系统 SHALL 改发结构化大纲(标题块 + 各块首段摘要),不发送完整快照

### Requirement: 提供默认 zh-CN 字典基础

系统 SHALL 提供默认 zh-CN 字典基础与 `TapNoteDictionary` 类型,允许 FEAT-003/004 助手包覆盖部分文案。

#### Scenario: 默认中文文案

- **WHEN** 助手包不传入字典覆盖
- **THEN** 系统 SHALL 使用默认 zh-CN 字典

#### Scenario: 助手包覆盖

- **WHEN** 助手包传入部分字典
- **THEN** 系统 SHALL 合并覆盖指定字段,未指定字段保留默认值

### Requirement: 保持纯库与授权边界

`@tap-note/ai-core` SHALL 不提供 UI 组件、不发起 HTTP(transport 只构造请求对象)、不持有 LLM Key、不记录正文日志。生产依赖闭包 SHALL 不包含 `@blocknote/xl-ai` 或任何 GPL/AGPL 依赖。`@handlewithcare/prosemirror-suggest-changes` 作为独立第三方依赖,是规避 BlockNote xl-ai GPL 的关键。

#### Scenario: 纯库行为

- **WHEN** 检查包的公开导出
- **THEN** 导出 SHALL 不包含任何 React 组件、fetch 调用或持久化 API

#### Scenario: 依赖许可证检查

- **WHEN** 检查包的依赖树和 lockfile
- **THEN** 结果 SHALL 不包含 `@blocknote/xl-ai`、`xl-ai-server` 或任何 GPL/AGPL 依赖

### Requirement: 提供自动化测试覆盖

系统 SHALL 为 schema 校验、estimateTokens、layerContext 分层、busy acquire/release、revision 冲突、suggest-changes 集成提供自动化测试。测试 MUST NOT 依赖真实 LLM、网络或持久化服务。

#### Scenario: schema 校验测试

- **WHEN** 运行 `bun test`
- **THEN** BlockOperation schema 的合法与非法输入用例 SHALL 全部通过

#### Scenario: 预算分层测试

- **WHEN** 运行 `bun test`
- **THEN** 选区拦截、全文截断、2× 改大纲的分层逻辑 SHALL 全部通过,不依赖网络

#### Scenario: busy 互斥测试

- **WHEN** 运行 `bun test`
- **THEN** acquire/release/订阅 的互斥与通知语义 SHALL 全部通过
