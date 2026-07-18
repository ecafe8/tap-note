# @tap-note/ai-core

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

TapNote AI 共享核心:为内联助手(FEAT-003)与对话助手(FEAT-004)提供共享的协议、schema、执行器、transport 工厂与会话级状态。纯库,不提供 UI 组件、不发起 HTTP、不持有 LLM Key、不记录正文日志。

## 安装

MVP 阶段以 workspace 直接消费源码,不发布 npm。

```json
{
  "dependencies": {
    "@tap-note/ai-core": "workspace:*"
  }
}
```

## 依赖

### AI SDK v7

- 锁定 `ai@7.0.31`(总 PRD v11 决策)
- 通过 `createServerTransport` 封装 AI SDK v7 的 `DefaultChatTransport<UIMessage>`
- transport 只构造请求对象,不发起 HTTP;由 `useChat` / `Chat` 实际发起
- transport **不持有 LLM Key**:服务端由 FEAT-005 处理 provider 凭据,客户端只通过 `getAuthHeaders` 注入短期 JWT
- 与 `@ai-sdk/alibaba@2.0.14`、`@ai-sdk/google@4.0.18` peerDep 兼容(共享 `@ai-sdk/provider@4.0.3` + `@ai-sdk/provider-utils@5.0.11`)

### suggest-changes 集成

- 使用 `@handlewithcare/prosemirror-suggest-changes@0.1.8`(MIT,独立第三方,非 BlockNote/GPL)
- 经 `transformToSuggestionTransaction` 把 AI 操作事务转为建议事务
- `applySuggestions` / `revertSuggestions` 用于接受/拒绝建议
- **关键安全边界**:AI 操作经 `transformToSuggestionTransaction` 包装,带建议标记;用户编辑走正常事务,不带建议标记;`revertSuggestions` 只回退建议标记的变更,不覆盖用户在 suggest 期间的手动编辑
- 假设 suggest-changes 插件已由调用方(FEAT-003/004)通过 BlockNote 扩展系统安装到编辑器

## API 表

| 导出 | 类型 | 说明 |
|---|---|---|
| `blockOperationSchema` | Zod schema | `BlockOperation` schema,覆盖 `insertBlock`/`updateBlock`/`deleteBlock`/`replaceBlocks`/`moveBlock` |
| `documentStateSchema` | Zod schema | `DocumentState` schema |
| `conflictResultSchema` | Zod schema | `ConflictResult` schema |
| `createDocumentStateBuilder(editor, options?)` | 函数 | 把编辑器受影响块(含选区)序列化为 `DocumentState`,`documentRevision` 单调递增 |
| `injectDocumentStateMessages(messages, documentState?)` | 函数 | 把文档状态注入 AI 消息列表,适配 AI SDK v7 `UIMessage.parts` 数组结构 |
| `applyOperationsToEditor(editor, operations, options)` | 函数 | 经 suggest-changes 可回退应用 `BlockOperation[]`,支持 `mode: "suggest" \| "apply" \| "revert"` |
| `createServerTransport(options)` | 函数 | 创建 AI SDK v7 `DefaultChatTransport`,携带 `model`、`getAuthHeaders`,不持有 LLM Key |
| `createProxyTransport(options)` | 函数 | MVP 占位,FEAT-004 实现 ClientSideTransport 等价能力 |
| `createAIBusyState()` | 函数 | 创建会话级 AI 互斥 busy 状态,`isBusy` 快照 + `subscribe` 适配 React 19 `useSyncExternalStore` |
| `estimateTokens(text)` | 函数 | 估算文本 token 数(MVP 字符数/4 近似算法) |
| `layerContext(documentState, options?)` | 函数 | 上下文体积分层:选区 4K 软上限、全文 8K 预算、2× 改大纲 |
| `aiCoreDictionaryZhCN` | 字典 | 默认 zh-CN 字典 |
| `mergeDictionary(base, override?)` | 函数 | Partial 合并字典 |
| `AICoreError` / `ConflictError` / `BudgetExceededError` / `TransportError` | 错误类 | ai-core 错误基类与子类,不泄漏内部堆栈 |

## 最小接入示例

```ts
import {
  createDocumentStateBuilder,
  layerContext,
  injectDocumentStateMessages,
  createServerTransport,
  createAIBusyState,
  applyOperationsToEditor,
  type BlockOperation,
} from '@tap-note/ai-core'
import { useChat } from '@ai-sdk/react'

// 1. 创建 busy 状态(每编辑器会话一个)
const busy = createAIBusyState()

// 2. 创建 transport(指向 FEAT-005 服务端,不持有 LLM Key)
const transport = createServerTransport({
  baseUrl: '/api/ai/editor/streamText',
  model: 'dashscope:qwen-plus',
  getAuthHeaders: () => ({ Authorization: `Bearer ${getJwt()}` }),
})

// 3. 在 useChat 中消费
const { messages, sendMessage } = useChat({
  transport,
  // onToolCall 等 FEAT-003/004 接入
})

// 4. AI 任务流程
async function runInlineAI(editor: BlockNoteEditor, prompt: string) {
  if (!busy.acquire('inline')) {
    return // 另一 AI 进行中,入口禁用
  }
  try {
    // 4a. 序列化 DocumentState
    const builder = createDocumentStateBuilder(editor, { scope: 'selection' })
    const state = builder.build()

    // 4b. 上下文体积分层
    const layer = layerContext(state)
    if (layer.kind === 'selection-blocked') {
      alert(layer.message)
      return
    }
    const documentState = layer.kind === 'full' ? layer.documentState : undefined

    // 4c. 注入 documentState 到 messages(由 FEAT-003/004 调用方组装)
    const messagesWithState = injectDocumentStateMessages(messages, documentState)

    // 4d. 发送(由 useChat 实际发起 HTTP)
    await sendMessage({ text: prompt })

    // 4e. 收到 BlockOperation[] 后应用(suggest 模式)
    const operations: BlockOperation[] = [] // 从 AI 响应解析
    const result = applyOperationsToEditor(editor, operations, {
      mode: 'suggest',
      currentDocumentRevision: builder.documentRevision,
    })
    if (result && typeof result === 'object' && 'kind' in result) {
      // revision 冲突或前置条件冲突,提示用户重试
      console.warn('AI conflict:', result)
    }

    // 4f. 用户在 UI 中接受/拒绝
    //   applyOperationsToEditor(editor, [], { mode: 'apply' })  // 接受
    //   applyOperationsToEditor(editor, [], { mode: 'revert' }) // 拒绝
  } finally {
    busy.release()
  }
}
```

## suggest-changes 集成说明

`applyOperationsToEditor` 的三种模式:

- **`mode: "suggest"`**:把 `BlockOperation[]` 转换为 Prosemirror transaction,经 `transformToSuggestionTransaction(tr, state)` 转为建议事务并 dispatch。AI 操作带建议标记,用户编辑走正常事务,因此 `revertSuggestions` 只回退 AI 建议,不覆盖人工编辑。
- **`mode: "apply"`**:调用 `applySuggestions(state, dispatch)` 合并建议到正式文档。
- **`mode: "revert"`**:调用 `revertSuggestions(state, dispatch)` 回退建议事务。

### accept / reject / revert 语义

- **接受**:调用 `mode: "apply"`。`applySuggestions` 删除 `deletion` 标记内容、移除 `insertion`/`modification` 标记保留内容。
- **拒绝**:调用 `mode: "revert"`。`revertSuggestions` 删除 `insertion` 标记内容、移除 `deletion`/`modification` 标记保留原内容。

### revision 冲突处理

- `BlockOperation.baseDocumentRevision` 由调用方从 `DocumentStateBuilder.documentRevision` 提供
- `applyOperationsToEditor({ mode: "suggest", currentDocumentRevision })` 比对每个操作的 `baseDocumentRevision` 与当前 revision
- 不匹配返回 `ConflictResult`(`{ kind: "conflict", reason: "revision-mismatch", ... }`),不执行任何操作,不污染文档
- 调用方(FEAT-003/004)根据 `ConflictResult` 决定如何呈现给用户(内联回退建议事务、对话返回可重试结果)

### 前置条件检查

- 目标块 ID 不存在时返回 `ConflictResult`(`reason: "precondition-failed"`),不执行

## 上下文体积分层

| 场景 | 触发条件 | 返回 `kind` | 行为 |
|---|---|---|---|
| 选区超软上限 | 选区估算 token > `selectionBudget`(默认 4096) | `selection-blocked` | 前端拦截,不发请求,提示减少选区或改用「引用全文+指令」 |
| 全文在预算内 | 全文估算 token ≤ `fullBudget`(默认 8192) | `full` | 发送完整 documentState 快照 |
| 全文超预算截断 | `fullBudget` < token ≤ `threshold × fullBudget`(默认 2×) | `truncated` | 截断到 `fullBudget`,附 `[文档已截断:共 N 块,此处含前 M 块]` 标记 |
| 全文超大改大纲 | token > `threshold × fullBudget` | `outline` | 改发结构化大纲(标题块 + 各块首段摘要) |
| 不引用模式 | 调用方决定不调用 `layerContext` | — | 不发送 documentState,也不暴露读取文档工具 |

预算阈值均有默认值且可被 `options` 覆盖:`{ selectionBudget?, fullBudget?, threshold? }`。

## 与 FEAT-005 契约对齐

- `injectDocumentStateMessages` 产出的 `UIMessage[]` 形状符合 AI SDK v7 `UIMessage.parts` 数组结构
- `BlockOperation` schema 由 FEAT-005 服务端与 FEAT-003/004 客户端共享同一模块,不允许各自定义等价 schema
- transport 指向 `/api/ai/editor/streamText`(内联)或 `/api/ai/chat`(对话),由调用方通过 `baseUrl` 参数指定
- transport 在 `body` 中携带 `model` 字段,供 FEAT-005 服务端路由解析为具体 provider
- 服务端 `streamText` 调用 `convertToModelMessages(messages)` 解析 UIMessage 并将 documentState 作为上下文传给模型

## 安全边界

- transport **不持有 LLM Key**:凭据仅在服务端由 FEAT-005 处理,客户端只通过 `getAuthHeaders` 注入短期 JWT
- 不发起 HTTP:transport 只构造请求对象,实际请求由 `useChat`/`Chat` 触发
- 不记录正文日志:ai-core 不输出正文,日志在 FEAT-005 服务端处理
- 所有输入 Zod `.parse()` 校验,非法输入抛 `ZodError` 不静默

## 测试

```bash
# 在包内运行测试(134 个单元 + 集成测试)
cd packages/tap-note-ai-core
bun test

# typecheck
bun run typecheck

# lint
bun run lint
```

测试覆盖:
- `BlockOperation` / `DocumentState` / `ConflictResult` schema 合法与非法输入
- `createDocumentStateBuilder`:`scope=selection/full/affected`、`documentRevision` 递增、空文档兜底
- `injectDocumentStateMessages`:有/无 documentState、非法 documentState 抛错、注入后结构符合 v7 `UIMessage.parts`
- `applyOperationsToEditor`:`suggest → apply`、`suggest → revert`、revision 冲突、前置条件冲突、流式期间手动编辑后 revert 不覆盖
- `createServerTransport`:不持有 Key、携带 `model`、`getAuthHeaders` 注入、非法 `baseUrl` 抛错
- `createAIBusyState`:互斥 acquire/release、订阅通知、跨包共享、不同会话独立
- `estimateTokens` / `layerContext`:选区拦截、全文完整/截断/大纲、默认值与覆盖、不引用模式
- `aiCoreDictionaryZhCN` / `mergeDictionary`:默认值、Partial 覆盖合并、`undefined` 时返回 base
- `AICoreError` / `ConflictError` / `BudgetExceededError` / `TransportError`:不泄漏内部路径
- 跨模块集成:Builder → layer → inject → applier 全链路;busy + applier 生命周期

测试不依赖真实 LLM、网络或持久化服务。

## 授权

依赖闭包许可证:
- `@blocknote/*@0.51.4` — MPL-2.0
- `@handlewithcare/prosemirror-suggest-changes@0.1.8` — MIT(独立第三方,非 BlockNote/GPL)
- `prosemirror-*` — MIT
- `ai@7.0.31` — Apache-2.0
- `zod@4.4.3` — MIT

闭包不含 `@blocknote/xl-ai`(GPL-3.0)、`xl-ai-server`、`xl-pdf-exporter`、`xl-docx-exporter`、`xl-multi-column` 或任何 GPL/AGPL 依赖。`@handlewithcare/prosemirror-suggest-changes` 是规避 BlockNote `xl-ai` GPL 的关键。
