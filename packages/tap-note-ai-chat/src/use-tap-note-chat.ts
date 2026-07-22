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
import type { ContextMode } from './context/context-mode'
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
  /** 上下文模式(默认 `none`)。可由外部 segmented control 更新。 */
  contextMode: ContextMode
  /** 上下文模式更新回调。 */
  onContextModeChange?: (mode: ContextMode) => void
  /** 选区跟踪器(可选)。selection 模式发送时读取其快照,避免失焦丢选区。 */
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
  /** 上下文模式。 */
  contextMode: ContextMode
  /** 上下文模式更新。 */
  setContextMode: (mode: ContextMode) => void
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
 * 封装 AI SDK v7 `useChat`,实现 `onToolCall` + `addToolOutput` 模式
 * (详见 feat-ai-chat/tech.md §14.3)。
 *
 * 关键约束:
 * - 触发前 `busy.acquire("chat")`,失败则不发送
 * - per-request 的 `documentState`/`documentRevision`/`contextMode`/`model` 通过
 *   `sendMessage(message, { body: {...} })` 动态注入
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
    contextMode,
    onContextModeChange,
    selectionTracker,
  } = options

  const [contextModeState, setContextModeState] = useState<ContextMode>(contextMode)
  const [inputValue, setInputValue] = useState('')
  const acquiredRef = useRef(false)

  const executeCtx: ExecuteClientToolContext = {
    editor,
    documentStateBuilder,
    contextMode: contextModeState,
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
        // 多工具 revision 链:模型在同一消息内用相同 baseDocumentRevision 生成多个工具,
        // 前一个工具执行后 revision 自增,后续工具会 revision-mismatch。此时用最新 revision
        // 自动重放一次(executeClientTool 会重新校验 expectedText/块存在性;仍不满足则返回
        // 冲突交由 UI 重试,不会应用过期编辑)。
        if (isRevisionMismatch(result)) {
          const replayedInput = {
            ...(input as Record<string, unknown>),
            baseDocumentRevision: executeCtx.documentStateBuilder.documentRevision,
          }
          result = await executeClientTool(toolName as ChatToolName, replayedInput, executeCtx)
        }
        // 成功与结构化冲突(revision/precondition)均作为真实 output 回传(output-available),
        // UI 据 output 形状区分成功/冲突;仅 Zod 校验等未预期异常走下方 catch → output-error。
        // addToolOutput 不能 await(避免死锁)。绝不伪造成功。
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

  // 把 addToolOutput 存到 ref,供 onToolCall 与外部重试共用。
  // 用 useEffect 同步,避免在 render 阶段修改 ref(react-hooks/refs 规则)。
  const addToolOutputRef = useRef(chat.addToolOutput)
  useEffect(() => {
    addToolOutputRef.current = chat.addToolOutput
  }, [chat.addToolOutput])

  // busy 释放:status 转入 ready/error 且无 pending tool-call 时
  useEffect(() => {
    if (!acquiredRef.current) return
    if (chat.status === 'submitted' || chat.status === 'streaming') return
    // status === 'ready' 或 'error'
    // 检查是否还有 pending tool-call(若有,sendAutomaticallyWhen 会自动再发,不释放)
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
        // selection 模式优先用选区快照(失焦后实时选区丢失时仍可用)。
        const snapshot = selectionTracker?.getSnapshot()
        documentState = buildDocumentState(editor, contextModeState, documentStateBuilder, snapshot)
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
            contextMode: contextModeState,
            model,
          },
          headers: getAuthHeaders?.(),
        },
      )
      // 清除已成功提交到 chat 的消息;busy 状态仍由当前 AI 轮次控制输入框。
      setInputValue('')
    },
    [aiBusyState, editor, contextModeState, documentStateBuilder, model, getAuthHeaders, chat, selectionTracker],
  )

  const abort = useCallback(() => {
    chat.stop?.()
    if (acquiredRef.current) {
      aiBusyState.release()
      acquiredRef.current = false
    }
  }, [chat, aiBusyState])

  const setContextMode = useCallback(
    (mode: ContextMode) => {
      setContextModeState(mode)
      onContextModeChange?.(mode)
    },
    [onContextModeChange],
  )

  // 订阅 aiBusyState:release() 后必须触发重渲染,否则 UI 会卡在「进行中」、输入框永久禁用。
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
    contextMode: contextModeState,
    setContextMode,
    addToolOutput: (opts) => {
      addToolOutputRef.current(opts as Parameters<typeof addToolOutputRef.current>[0])
    },
  }
}
