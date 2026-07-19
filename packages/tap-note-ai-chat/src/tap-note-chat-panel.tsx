import type { FC, ReactNode, Ref } from 'react'
import type { ChatDictionary } from './i18n/zh-cn'
import type { ContextMode } from './context/context-mode'
import type { ContextHintKey } from './context/context-layer'
import { ContextSelector } from './ui/context-selector'
import { MessageList } from './ui/message-list'
import { InputArea } from './ui/input-area'
import type { ToolResultBubbleProps } from './tools/tool-result-bubble'

export interface TapNoteChatPanelProps {
  /** 字典。 */
  dictionary: ChatDictionary
  /** 当前消息列表渲染(由调用方传入,通常基于 useTapNoteChat.messages 渲染)。 */
  messageList: ReactNode
  /** 输入框值。 */
  inputValue: string
  /** 输入框值更新。 */
  onInputChange: (value: string) => void
  /** 发送消息。 */
  onSendMessage: (message: string) => void
  /** 中止当前轮。 */
  onAbort: () => void
  /** 是否流式中。 */
  isStreaming: boolean
  /** 是否 busy。 */
  isBusy: boolean
  /** busy 原因文案。 */
  busyReason: string | null
  /** 上下文模式。 */
  contextMode: ContextMode
  /** 上下文模式更新。 */
  onContextModeChange: (mode: ContextMode) => void
  /** 提示 key(根据 LayeredContext.kind 派生)。 */
  contextHintKey: ContextHintKey
  /** 截断标记文案。 */
  truncatedMessage?: string
  /** token 估算展示文案。 */
  tokenInfo?: string
  /** 关闭面板回调(由集成方控制,如抽屉 ✕ 按钮)。 */
  onClose?: () => void
  /** 输入框 ref(用于焦点恢复)。 */
  inputRef?: React.RefObject<HTMLInputElement | null>
  /** 自定义工具结果气泡渲染(由调用方基于 messages 渲染)。 */
  toolResultBubbles?: ReactNode
  /** 自定义 ToolResultBubble 组件(供 demo/集成方覆盖)。 */
  ToolResultBubbleComponent?: FC<ToolResultBubbleProps>
}

/**
 * `TapNoteChatPanel` — 位置无关的对话面板组件。
 *
 * 根容器暴露 `data-tap-note-chat-panel` 数据属性与 `min-width: 320px`。
 * 集成方可放置在任意区域(右侧/左侧/浮动/独立路由)。
 *
 * 由 `createTapNoteChatAssistant` 返回的 `panel` 字段提供,
 * 集成方传入 `<TapNoteEditor chatAssistant={assistant} />` 时由编辑器挂载,
 * 或自行在应用层渲染。
 */
export const TapNoteChatPanel: FC<TapNoteChatPanelProps> = ({
  dictionary,
  messageList,
  inputValue,
  onInputChange,
  onSendMessage,
  onAbort,
  isStreaming,
  isBusy,
  busyReason,
  contextMode,
  onContextModeChange,
  contextHintKey,
  truncatedMessage,
  tokenInfo,
  onClose,
  inputRef,
  toolResultBubbles,
}) => {
  const empty = (
    <div className="tn-chat-empty" role="status">
      <div className="tn-chat-empty-icon">💬</div>
      <div className="tn-chat-empty-title">{dictionary.aiChatTrigger}</div>
      <ul className="tn-chat-empty-tips">
        <li>{dictionary.contextSelection}</li>
        <li>{dictionary.contextFull}</li>
        <li>{dictionary.contextNone}</li>
      </ul>
    </div>
  )

  return (
    <section
      className="tn-chat-panel"
      data-tap-note-chat-panel=""
      aria-label={dictionary.aiChatTrigger}
      style={{ minWidth: '320px' }}
    >
      <header className="tn-chat-header">
        <h2 className="tn-chat-title">{dictionary.aiChatTrigger}</h2>
        {onClose ? (
          <button
            type="button"
            className="tn-chat-close-button"
            onClick={onClose}
            aria-label="关闭"
          >
            ✕
          </button>
        ) : null}
      </header>
      <ContextSelector
        mode={contextMode}
        onModeChange={onContextModeChange}
        dictionary={dictionary}
        hintKey={contextHintKey}
        truncatedMessage={truncatedMessage}
        tokenInfo={tokenInfo}
      />
      <MessageList emptyState={empty}>
        {messageList}
        {toolResultBubbles}
      </MessageList>
      <InputArea
        value={inputValue}
        onChange={onInputChange}
        onSubmit={() => onSendMessage(inputValue)}
        onAbort={onAbort}
        dictionary={dictionary}
        isStreaming={isStreaming}
        isBusy={isBusy}
        busyReason={busyReason}
        inputRef={inputRef}
      />
    </section>
  )
}

void (null as unknown as Ref<HTMLElement>)
