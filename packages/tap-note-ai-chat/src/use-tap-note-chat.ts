import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useChat } from '@ai-sdk/react'
import { lastAssistantMessageIsCompleteWithToolCalls } from 'ai'
import type { BlockNoteEditor } from '@blocknote/core'
import type {
  AIBusyState,
  DocumentState,
  DocumentStateBuilder,
  SelectionTracker,
  Transport,
} from '@tap-note/ai-core'
import type { UIMessage } from 'ai'
import type { ChatDictionary } from './i18n/zh-cn'
import { buildDocumentState } from './context/context-layer'
import { executeClientTool, type ExecuteClientToolContext } from './tools/client-tools'
import type { ChatToolName } from './types/tool-input'

/**
 * `useTapNoteChat` 选项。
 */
export interface UseTapNoteChatOptions {
  /** 来自 ai-core `createServerTransport` 的 transport 实例。 */
  transport: Transport
  /** ai-core DocumentStateBuilder,用于构建 documentState 与读取 documentRevision。 */
  documentStateBuilder: DocumentStateBuilder
  /** BlockNote editor 实例。 */
  editor: BlockNoteEditor
  /** 模型 ID(如 `"dashscope:qwen3.7-plus"`),由集成方提供。 */
  model: string
  /** 可选的认证头注入(短期 JWT)。 */
  getAuthHeaders?: () => Record<string, string>
  /** 字典。 */
  dictionary: ChatDictionary
  /** 集成方共享的会话级 busy 状态。 */
  aiBusyState: AIBusyState
  /** 是否允许 `getDocumentSnapshot` 工具(默认 `true`)。 */
  allowSnapshotTool?: boolean
  /** 选区跟踪器(可选)。发送时读取其快照,有选区则按选区构建上下文,否则发全文。 */
  selectionTracker?: SelectionTracker
}

/**
 * `useTapNoteChat` 返回值。
 */
export interface UseTapNoteChatResult {
  /** 当前消息列表。 */
  messages: UIMessage[]
  /** 输入框当前值。 */
  input: string
  /** 输入框值更新。 */
  setInput: (value: string) => void
  /** 发送消息。 */
  sendMessage: (message: string) => void
  /** 中止当前轮。 */
  abort: () => void
  /** useChat 状态。 */
  status: 'ready' | 'submitted' | 'streaming' | 'error'
  /** 当前 busy 状态(只读)。 */
  isBusy: boolean
  /** 当前 busy 原因(null 表示空闲)。 */
  busyReason: string | null
  /** `addToolOutput` 透传(供 ToolResultBubble 重试时调用)。 */
  addToolOutput: (opts: {
    tool: string
    toolCallId: string
    output?: unknown
    state?: 'output-error'
    errorText?: string
  }) => void
}

/** 判断 client tool 执行结果是否为 revision 冲突(用于多工具链自动重放)。 */
function isRevisionMismatch(result: unknown): boolean {
  return (
    typeof result === 'object' &&
    result !== null &&
    (result as { kind?: string }).kind === 'conflict' &&
    (result as { reason?: string }).reason === 'revision-mismatch'
  )
}

/**
 * 封装 AI SDK v7 `useChat`,实现 `onToolCall` + `addToolOutput` 模式。
 *
 * 关键约束:
 * - 触发前 `busy.acquire("chat")`,失败则不发送
 * - 上下文自动检测:有选区发选区,无选区发全文(受 token 预算截断)
 * - `onToolCall` 内不 `await addToolOutput`(避免死锁)
 * - `sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls` 自动触发多轮
 * - `status` 转入 `ready`/`error` 且无 pending tool-call 时释放 busy
 */
export function useTapNoteChat(options: UseTapNoteChatOptions): UseTapNoteChatResult {
  const {
    transport,
    documentStateBuilder,
    editor,
    model,
    getAuthHeaders,
    dictionary,
    aiBusyState,
    allowSnapshotTool = true,
    selectionTracker,
  } = options

  const [inputValue, setInputValue] = useState('')
  const acquiredRef = useRef(false)

  const executeCtx: ExecuteClientToolContext = {
    editor,
    documentStateBuilder,
    allowSnapshotTool,
  }

  const chat = useChat({
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    onToolCall: async ({ toolCall }) => {
      const { toolName, toolCallId, input } = toolCall
      try {
        let result = await executeClientTool(
          toolName as ChatToolName,
          input,
          executeCtx,
        )
        if (isRevisionMismatch(result)) {
          const replayedInput = {
            ...(input as Record<string, unknown>),
            baseDocumentRevision: executeCtx.documentStateBuilder.documentRevision,
          }
          result = await executeClientTool(toolName as ChatToolName, replayedInput, executeCtx)
        }
        addToolOutputRef.current({
          tool: toolName,
          toolCallId,
          output: result,
        })
      } catch (err) {
        addToolOutputRef.current({
          tool: toolName,
          toolCallId,
          state: 'output-error',
          errorText: err instanceof Error ? err.message : String(err),
        })
      }
    },
  })

  const addToolOutputRef = useRef(chat.addToolOutput)
  useEffect(() => {
    addToolOutputRef.current = chat.addToolOutput
  }, [chat.addToolOutput])

  useEffect(() => {
    if (!acquiredRef.current) return
    if (chat.status === 'submitted' || chat.status === 'streaming') return
    const hasPending = chat.messages.some((m: UIMessage) =>
      m.role === 'assistant' &&
      Array.isArray((m as { parts?: unknown[] }).parts) &&
      (m as { parts: Array<{ type?: string; state?: string }> }).parts.some(
        (p) => p.type === 'tool-call' && p.state === 'input-available',
      ),
    )
    if (hasPending) return
    aiBusyState.release()
    acquiredRef.current = false
  }, [chat.status, chat.messages, aiBusyState])

  const sendMessage = useCallback(
    (message: string) => {
      if (!message.trim()) return
      const acquired = aiBusyState.acquire('chat')
      if (!acquired) {
        acquiredRef.current = false
        return
      }
      acquiredRef.current = true

      let documentState: DocumentState | undefined
      try {
        const snapshot = selectionTracker?.getSnapshot()
        documentState = buildDocumentState(editor, documentStateBuilder, snapshot)
      } catch {
        documentState = undefined
      }
      const documentRevision = documentStateBuilder.documentRevision

      chat.sendMessage(
        { text: message },
        {
          body: {
            documentState,
            documentRevision,
            model,
          },
          headers: getAuthHeaders?.(),
        },
      )
      setInputValue('')
    },
    [aiBusyState, editor, documentStateBuilder, model, getAuthHeaders, chat, selectionTracker],
  )

  const abort = useCallback(() => {
    chat.stop?.()
    if (acquiredRef.current) {
      aiBusyState.release()
      acquiredRef.current = false
    }
  }, [chat, aiBusyState])

  const isBusy = useSyncExternalStore(
    (onChange) => aiBusyState.subscribe(() => onChange()),
    () => aiBusyState.isBusy,
    () => false,
  )
  const busyReason = isBusy ? dictionary.chatBusy : null

  return {
    messages: chat.messages,
    input: inputValue,
    setInput: setInputValue,
    sendMessage,
    abort,
    status: chat.status as 'ready' | 'submitted' | 'streaming' | 'error',
    isBusy,
    busyReason,
    addToolOutput: (opts) => {
      addToolOutputRef.current(opts as Parameters<typeof addToolOutputRef.current>[0])
    },
  }
}
