import { useSyncExternalStore, type FC } from 'react'
import type { BlockNoteEditor } from '@blocknote/core'
import type {
  AIBusyState,
  DocumentStateBuilder,
  SelectionTracker,
  Transport,
} from '@tap-note/ai-core'
import { createDocumentStateBuilder, createSelectionTracker, stripBlockIdSuffix, DEFAULT_MODEL_ID } from '@tap-note/ai-core'
import { TapNoteChatPanel } from './tap-note-chat-panel'
import type { TapNoteChatPanelProps } from './tap-note-chat-panel'
import { type ChatDictionary, mergeChatDictionary } from './i18n/zh-cn'
import { chatLayerContext, getContextHintKey, buildDocumentState } from './context/context-layer'
import { useTapNoteChat } from './use-tap-note-chat'
import { ToolResultBubble, type ToolResult } from './tools/tool-result-bubble'
import { findTargetBlockIdFromMessages } from './tools/tool-result-helpers'

/**
 * `createTapNoteChatAssistant` 选项。
 */
export interface CreateTapNoteChatAssistantOptions {
  /** AI-core transport 实例(来自 `createServerTransport`)。 */
  transport: Transport
  /** AI-core busy state 实例(来自 `createAIBusyState`,与 `TapNoteEditor.aiBusyState` 共享)。 */
  aiBusyState: AIBusyState
  /** 模型 ID(如 `"dashscope:qwen3.7-plus"`)。 */
  model?: string
  /** 字典覆盖(扩展 ai-core `AICoreDictionary`)。 */
  dictionary?: Partial<ChatDictionary>
  /** 是否允许 `getDocumentSnapshot` 工具(默认 `true`)。 */
  allowSnapshotTool?: boolean
  /** 可选的认证头注入(短期 JWT)。 */
  getAuthHeaders?: () => Record<string, string>
  /** DocumentStateBuilder(可选,默认在 `mount` 时按当前 editor 创建)。 */
  documentStateBuilder?: DocumentStateBuilder
}

/**
 * TapNote 对话助手实例(与 `TapNoteEditor.chatAssistant` 接口兼容)。
 */
export interface TapNoteChatAssistant {
  readonly __brand?: 'TapNoteChatAssistant'
  /** 挂载到编辑器:注册选区订阅、创建 DocumentStateBuilder。 */
  mount: (editor: BlockNoteEditor) => void
  /** 卸载:释放 busy、移除事件监听、清除选区高亮、abort 未完成请求。 */
  unmount: (editor: BlockNoteEditor) => void
  /** ChatPanel 组件(位置无关,集成方自行布局)。 */
  readonly panel: FC<ChatPanelProps>
  /** 字典。 */
  readonly dictionary: ChatDictionary
}

/**
 * `assistant.panel` 接收的 props。
 */
export interface ChatPanelProps {
  /** 关闭面板回调(由集成方控制,如抽屉 ✕ 按钮)。 */
  onClose?: () => void
  /** 自定义 ToolResultBubble 组件(可选,默认用内置)。 */
  toolResultBubbleComponent?: typeof ToolResultBubble
}

/**
 * 从 tool-call part 的真实状态/输出派生 `ToolResult`(供 `ToolResultBubble` 渲染)。
 */
function deriveToolResult(
  p: { state?: string; output?: unknown; errorText?: string },
  dictionary: ChatDictionary,
): ToolResult | undefined {
  if (p.state === 'output-available') {
    return p.output as ToolResult
  }
  if (p.state === 'output-error') {
    return { kind: 'error', message: p.errorText ?? dictionary.toolFailed }
  }
  return undefined
}

/**
 * 创建 TapNote 对话助手实例。
 *
 * 上下文自动检测:有选区发选区,无选区发全文(受 token 预算截断)。
 */
export function createTapNoteChatAssistant(
  options: CreateTapNoteChatAssistantOptions,
): TapNoteChatAssistant {
  const dictionary = mergeChatDictionary(options.dictionary)
  const modelId = options.model ?? DEFAULT_MODEL_ID
  const allowSnapshotTool = options.allowSnapshotTool ?? true

  let editorRef: BlockNoteEditor | undefined
  let documentStateBuilderRef: DocumentStateBuilder | undefined = options.documentStateBuilder
  let selectionTrackerRef: SelectionTracker | undefined
  const aiBusyStateRef: AIBusyState | undefined = options.aiBusyState

  function ChatPanelComponent(props: ChatPanelProps) {
    const editor = editorRef
    const dsb = documentStateBuilderRef
    const busy = aiBusyStateRef
    const tracker = selectionTrackerRef

    if (!editor || !dsb || !busy) {
      return (
        <div className="tn-chat-panel tn-chat-panel-not-mounted" data-tap-note-chat-panel="" style={{ minWidth: '320px' }}>
          <p>ChatPanel 等待 mount(editor)…</p>
        </div>
      )
    }

    return (
      <ChatPanelReady
        editor={editor}
        documentStateBuilder={dsb}
        aiBusyState={busy}
        selectionTracker={tracker}
        onClose={props.onClose}
        toolResultBubbleComponent={props.toolResultBubbleComponent}
      />
    )
  }

  function ChatPanelReady(props: {
    editor: BlockNoteEditor
    documentStateBuilder: DocumentStateBuilder
    aiBusyState: AIBusyState
    selectionTracker?: SelectionTracker
    onClose?: () => void
    toolResultBubbleComponent?: typeof ToolResultBubble
  }) {
    const { editor, documentStateBuilder: dsb, aiBusyState: busy, selectionTracker, onClose, toolResultBubbleComponent } = props

    const selectionSnapshot = useSyncExternalStore(
      (cb) => (selectionTracker ? selectionTracker.subscribe(cb) : () => {}),
      () => selectionTracker?.getSnapshot(),
      () => selectionTracker?.getSnapshot(),
    )

    const documentState = buildDocumentState(editor, dsb, selectionSnapshot)
    const layered = chatLayerContext(documentState)
    const hintKey = getContextHintKey(layered)
    const truncatedMessage = layered.kind === 'truncated' ? layered.message : undefined
    const tokenInfo = layered.kind === 'full'
      ? `约 ${layered.estimatedTokens} tokens ✓`
      : (layered.kind === 'truncated' || layered.kind === 'outline')
        ? `约 ${layered.estimatedTokens} tokens`
        : undefined

    const chat = useTapNoteChat({
      transport: options.transport,
      documentStateBuilder: dsb,
      editor,
      model: modelId,
      getAuthHeaders: options.getAuthHeaders,
      dictionary,
      aiBusyState: busy,
      allowSnapshotTool,
      selectionTracker,
    })

    const messageList = chat.messages.map((m: { id?: string; role: string; parts?: Array<{ type?: string; text?: string; state?: string }> }) => {
      if (m.role === 'user') {
        return (
          <div key={m.id} className="tn-chat-message tn-chat-message-user" data-role="user">
            <div className="tn-chat-message-text">
              {m.parts?.filter((p) => p.type === 'text').map((p, i) => <span key={i}>{p.text}</span>)}
            </div>
          </div>
        )
      }
      const textParts = m.parts?.filter((p) => p.type === 'text') ?? []
      const streaming = m.parts?.some((p) => p.type === 'tool-call' && p.state === 'input-streaming')
      return (
        <div key={m.id} className="tn-chat-message tn-chat-message-assistant" data-role="assistant">
          <div className="tn-chat-message-text">
            {textParts.map((p, i) => <span key={i}>{p.text}</span>)}
            {streaming ? <span className="tn-chat-streaming-cursor" aria-hidden="true">◌</span> : null}
          </div>
        </div>
      )
    })

    const toolResultBubbles = chat.messages.flatMap((m: { parts?: Array<{ type?: string; toolCallId?: string; toolName?: string; input?: unknown; state?: string; output?: unknown; errorText?: string }> }) => {
      const parts = m.parts ?? []
      return parts
        .filter((p) => p.type === 'tool-call')
        .map((p) => {
          const targetBlockId = findTargetBlockIdFromMessages(chat.messages, p.toolCallId ?? '')
          const Bubble = toolResultBubbleComponent ?? ToolResultBubble
          return (
            <Bubble
              key={p.toolCallId}
              toolCallId={p.toolCallId ?? ''}
              toolName={p.toolName ?? ''}
              targetBlockId={targetBlockId}
              result={deriveToolResult(p, dictionary)}
              dictionary={dictionary}
              onRetry={(tcid) => {
                void tcid
              }}
              onJumpToBlock={(targetId) => {
                try {
                  editor.setTextCursorPosition(stripBlockIdSuffix(targetId) as never)
                } catch {
                  // 目标块不存在时忽略
                }
              }}
            />
          )
        })
    })

    return (
      <TapNoteChatPanel
        dictionary={dictionary}
        messageList={messageList}
        inputValue={chat.input}
        onInputChange={chat.setInput}
        onSendMessage={chat.sendMessage}
        onAbort={chat.abort}
        isStreaming={chat.status === 'submitted' || chat.status === 'streaming'}
        isBusy={chat.isBusy}
        busyReason={chat.busyReason}
        contextHintKey={hintKey}
        truncatedMessage={truncatedMessage}
        tokenInfo={tokenInfo}
        onClose={onClose}
        toolResultBubbles={toolResultBubbles}
        selectionChipBlockCount={selectionSnapshot && selectionSnapshot.blocks.length > 0 ? selectionSnapshot.blockCount : undefined}
        onClearSelection={() => selectionTracker?.clear()}
      />
    )
  }

  const assistant: TapNoteChatAssistant = {
    __brand: 'TapNoteChatAssistant',
    mount: (editor: BlockNoteEditor) => {
      editorRef = editor
      if (!documentStateBuilderRef) {
        documentStateBuilderRef = createDocumentStateBuilder(editor, { scope: 'selection' })
      }
      if (!selectionTrackerRef) {
        selectionTrackerRef = createSelectionTracker(editor)
      }
    },
    unmount: (editor: BlockNoteEditor) => {
      void editor
      try {
        if (aiBusyStateRef?.isBusy) {
          aiBusyStateRef?.release()
        }
      } catch {
        // ignore
      }
      try {
        documentStateBuilderRef?.dispose()
      } catch {
        // editor 已销毁时忽略
      }
      try {
        selectionTrackerRef?.dispose()
      } catch {
        // editor 已销毁时忽略
      }
      documentStateBuilderRef = undefined
      selectionTrackerRef = undefined
      editorRef = undefined
    },
    panel: ChatPanelComponent,
    dictionary,
  }

  return assistant
}

export type { TapNoteChatPanelProps }
