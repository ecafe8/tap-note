# @tap-note/ai-inline

TapNote AI 内联助手:BlockNote `createExtension` 状态机、StreamToolExecutor、AIMenu/AIToolbarButton/Slash 项。

## 安装

MVP 阶段以 workspace 直接消费源码,不发布 npm。

```json
{
  "dependencies": {
    "@tap-note/ai-inline": "workspace:*"
  }
}
```

## 最小接入

```tsx
import { createServerTransport, createAIBusyState } from '@tap-note/ai-core'
import { createTapNoteInlineAssistant } from '@tap-note/ai-inline'
import { TapNoteEditor } from '@tap-note/editor'

const busy = createAIBusyState()

const inlineAssistant = createTapNoteInlineAssistant({
  transport: createServerTransport({
    baseUrl: '/api/ai/editor/streamText',
    model: 'dashscope:qwen3.7-plus',
    getAuthHeaders: () => ({ Authorization: `Bearer ${getJwt()}` }),
  }),
  aiBusyState: busy,
})

function App() {
  return (
    <TapNoteEditor
      inlineAssistant={inlineAssistant}
      aiBusyState={busy}
    />
  )
}
```

## API

| 导出 | 类型 | 说明 |
|---|---|---|
| `createTapNoteInlineAssistant(options)` | 函数 | 创建内联助手实例,实现 `{ mount, unmount }` 接口 |
| `createAIInlineExtension(options)` | 函数 | 创建 BlockNote 扩展(含 suggestChanges 插件 + 状态机) |
| `transition(state, event)` | 函数 | 状态机纯函数转换 |
| `filterNewOrUpdatedOperations` | 函数 | 去重操作(partial streaming) |
| `processToolCallStream` | 函数 | 从 `ReadableStream<UIMessageChunk>` 提取 `BlockOperation[]` |
| `startStreamSession` | 函数 | 用 transport `sendMessages` 发起流式请求 |
| `serverApplyDocumentOperationsTool` | 工具 | 服务端 streamTool(FEAT-005 用) |
| `inlineDictionaryZhCN` | 字典 | 默认 zh-CN(扩展 ai-core `AICoreDictionary`) |

## 安全边界

- 不持有 LLM Key(通过 ai-core transport 间接发起)
- 复用 ai-core 的 schema/DocumentStateBuilder/applier/busy/transport/layerContext
- 不引入 `@blocknote/xl-ai`(GPL)

## 测试

```bash
cd packages/tap-note-ai-inline
bun test          # 42 个测试
bun run typecheck
bun run lint
```
