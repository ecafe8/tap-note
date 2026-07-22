# @tap-note/ai-chat

位置无关的对话 AI 助手(FEAT-004)。基于 AI SDK v7 `useChat` + `onToolCall`/`addToolOutput` 模式,支持引用选区/全文/不引用三态上下文,通过离散工具调用(单次单操作)修改编辑器文档,与 `@tap-note/ai-inline` 共享会话级 busy 状态实现互斥。

## 设计边界

- **位置无关**:`TapNoteChatPanel` 组件最小宽 320px,可由集成方放置在任意区域(右侧抽屉/左侧固定列/浮动层/独立路由)。包不导出抽屉开关或布局容器,这些由集成方应用层实现。
- **不持 LLM Key**:transport 由 ai-core `createServerTransport` 创建,只配置 `baseUrl` 与可选 `getAuthHeaders`(短期 JWT)。
- **不引入 `@blocknote/xl-ai`**(GPL),仅参考思路自行重写。
- **授权干净**:依赖闭包仅含 MPL-2.0(BlockNote)、Apache-2.0(AI SDK)、MIT(zod/react)。

## 最小接入

```tsx
import { createAIBusyState, createServerTransport } from '@tap-note/ai-core'
import { createTapNoteChatAssistant } from '@tap-note/ai-chat'
import { TapNoteEditor } from '@tap-note/editor'

const aiBusyState = createAIBusyState()

const chatAssistant = createTapNoteChatAssistant({
  transport: createServerTransport({
    baseUrl: '/api/ai/chat',
    model: 'dashscope:qwen3.7-plus',
  }),
  aiBusyState,
  // 可选:覆盖字典、关闭 getDocumentSnapshot 工具等
  // dictionary: { chatPlaceholder: 'Ask anything...' },
  // allowSnapshotTool: false,
})

// 推荐:通过 TapNoteEditor.chatAssistant prop 注入(由编辑器在 mount/unmount 时调用)
function App() {
  return (
    <TapNoteEditor chatAssistant={chatAssistant} aiBusyState={aiBusyState} />
  )
}

// 集成方应用层自行渲染 ChatPanel 到任意区域(右侧抽屉/侧边等)
function ChatDrawer() {
  return chatAssistant.panel ? <chatAssistant.panel onClose={() => {}} /> : null
}
```

## API 速查

| 导出 | 类型 | 用途 |
|---|---|---|
| `createTapNoteChatAssistant(options)` | function | 入口工厂,返回 `{ mount, unmount, panel, dictionary, defaultContextMode }` |
| `TapNoteChatPanel` | React component | 位置无关的 ChatPanel 组件(最小宽 320px) |
| `useTapNoteChat(options)` | React hook | 封装 `useChat`,返回 messages/sendMessage/abort/status 等 |
| `executeClientTool(toolName, input, ctx)` | async function | 6 个 client-side tools 执行(insertBlock/updateBlock/deleteBlock/replaceBlocks/moveBlock/getDocumentSnapshot) |
| `ToolResultBubble` | React component | 工具结果气泡(成功/冲突/前置失败/错误 4 种状态) |
| `chatDictionaryZhCN` / `ChatDictionary` | object / type | zh-CN 字典,扩展 ai-core `AICoreDictionary` |
| `ContextMode` | type | `"selection" \| "full" \| "none"`(默认 `"none"`) |
| `chatLayerContext` / `buildDocumentState` | function | 上下文三态分层与 documentState 构造 |

## 接入建议

- **推荐**通过 `<TapNoteEditor chatAssistant={assistant} aiBusyState={busy} />` 注入,编辑器在 mount/unmount 时自动调用生命周期方法。
- 不推荐直接调用 `assistant.mount(editor)` / `assistant.unmount(editor)`(应由编辑器协调)。
- `assistant.panel` 是 React 组件,集成方按需渲染到任意区域。布局/抽屉开关/sidemenu 由集成方应用层实现。
- 与 `@tap-note/ai-inline` 共享同一 `aiBusyState` 实例实现互斥:任一 AI 进行中时另一助手入口禁用,完成/中止/失败后释放。

## 与 FEAT-002/005 契约对齐

- 复用 ai-core 的 `BlockOperation`/`DocumentState`/`ConflictResult` schema(单 source of truth)
- 复用 ai-core 的 `createDocumentStateBuilder`、`applyOperationsToEditor`、`createServerTransport`、`createAIBusyState`、`layerContext`/`estimateTokens`
- 消费 FEAT-005 `/api/ai/chat` 与 `/api/ai/models` 端点
- 服务端 `apps/server-api` `streamChat` 按 `contextMode` 过滤 tools 声明:`none`/`selection` 模式不声明 `getDocumentSnapshot`,`full` 模式声明全部 6 个 tools
- 客户端 `useChat` 用 `onToolCall` + `addToolOutput` 模式(v7 标准),不使用 `tools: { execute }`(v6 形式已废弃)

## apps/web demo example

`apps/web` 提供带 sidemenu 的多路由 demo(`/inline`、`/chat`、`/both`),含 A4 纸面布局与右侧可开合抽屉作为 example 样式。**这些布局与样式属 demo example,不在 `@tap-note/ai-chat` 或 `@tap-note/editor` 包范围内**,集成方可参考或自行实现任意布局。

## 安全边界

- 不发起 HTTP(由集成方 transport 配置 `baseUrl`)
- 不持 LLM Key(只接收 `getAuthHeaders` 回调)
- 不记录正文日志(日志在 FEAT-005 服务端)
- client-side tools 前期不限制 `deleteAll` 类危险操作(总 PRD §17 item 14,接受 prompt injection 风险,P2 候选加输入校验/数量上限)

## 不在本包范围

- `needsApproval` 审批开关(P2 候选,总 PRD §5.2)
- 批量操作(严格单次单操作,总 PRD §17 item 11)
- 移动端窄屏 sheet(由集成方实现,见 feat-ai-chat/ui.md §5)
- npm 发布构建(MVP 阶段 workspace 直接消费)
- A4 纸面样式与抽屉开关组件(属 apps/web demo example)
