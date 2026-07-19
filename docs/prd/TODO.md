# TODO

## 真正的流式输出（AI 内联助手）

**状态**: 待办
**优先级**: 中
**关联模块**: `packages/tap-note-ai-inline`、`packages/tap-note-ai-core`、`apps/server-api`

### 问题

当前 `qwen-plus`（DashScope）在 `applyDocumentOperations` 工具调用时，把完整的 `operations[]` 数组放在一个 `tool-input-available` chunk 里一次性送达，`processToolCallStream` 里的 `tool-input-delta`（增量 JSON）分支从未触发。

所以现状是：

1. LLM 生成完整 12 个 operations（约 5-10 秒等待）
2. 客户端一次性收到全部 operations
3. 用 `referenceIdMap` + 逐块 `editor.exec` + `delayForOperation` 模拟流式（50-100ms/块）

前期等待感强（用户点"✨ AI 助手 → 发送"后要等数秒才看到第一个块），不够"AI 在打字"的即时反馈。

### 目标

实现真正的流式输出：LLM 边生成边送达，客户端边解析边应用，第一个块在 1-2 秒内出现。

### 候选方案

1. **确认 DashScope qwen-plus 是否支持 tool call JSON 增量流**
   - 检查 AI SDK v7 `streamText` 对 DashScope provider 的 tool streaming 支持
   - 若支持，`tool-input-delta` 会自然触发，`onOperations` 被多次调用，无需额外改动
   - 若不支持，走方案 2 或 3

2. **改用 `streamText` 的 text 流 + 客户端解析**
   - 不走 tool call，让 LLM 直接流式输出 markdown/JSON 文本
   - 客户端用 `parsePartialJson` 增量解析，每解析出一个完整 operation 就 `applyOperationsToEditor`
   - 需要重新设计 system prompt（让 LLM 输出 NDJSON 或 JSON array stream）
   - 失去 tool call 的 schema 校验，需在客户端补

3. **参考 BlockNote xl-ai 的 `StreamToolExecutor` + `streamTool` 抽象**
   - `resource/BlockNote/packages/xl-ai/src/streamTool/StreamToolExecutor.ts`
   - `resource/BlockNote/packages/xl-ai/src/streamTool/streamTool.ts`
   - 它们处理 partial tool call 的 `isPossiblyPartial` / `isUpdateToPreviousOperation` 标记
   - 当前 `stream-tool-executor.ts` 已借鉴 `filterNewOrUpdatedOperations`，但 `isPossiblyPartial` 处理可加强：partial 时只更新最后一个 block，不重复插入

4. **切换到原生支持 tool streaming 的 provider/model**
   - 如 OpenAI、Anthropic 等主流模型支持 tool call 增量流
   - DashScope qwen 系列的 tool streaming 支持情况需确认

### 前置工作

- [ ] 调研 DashScope qwen-plus 的 tool call streaming 能力（查文档/抓包）
- [ ] 若不支持，评估方案 2（text 流 + 客户端解析）的改动量
- [ ] 评估方案 3（增强 `StreamToolExecutor` 的 partial 处理）是否够用

### 非目标

- 不改变 `applyOperationsToEditor` 的接口
- 不引入新的 BlockNote 依赖（如 `@blocknote/xl-ai`）
