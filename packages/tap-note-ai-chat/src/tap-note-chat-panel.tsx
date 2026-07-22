import type { FC, ReactNode, Ref } from 'react'
import type { ChatDictionary } from './i18n/zh-cn'
import type { ContextHintKey } from './context/context-layer'
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
  /** 已捕获选区的块数量(undefined 表示无选区)。 */
  selectionChipBlockCount?: number
  /** 清除已捕获选区(chip ✕ 按钮)。 */
  onClearSelection?: () => void
}

/**
 * `TapNoteChatPanel` — 位置无关的对话面板组件。
 *
 * 上下文自动检测:有选区发选区,无选区发全文(受 token 预算截断)。
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
  contextHintKey,
  truncatedMessage,
  tokenInfo,
  onClose,
  inputRef,
  toolResultBubbles,
  selectionChipBlockCount,
  onClearSelection,
}) => {
  const empty = (
    <div className="tn-chat-empty" role="status">
      <div className="tn-chat-empty-icon">💬</div>
      <div className="tn-chat-empty-title">{dictionary.aiChatTrigger}</div>
      <ul className="tn-chat-empty-tips">
        <li>选中文字后提问,AI 会引用选区上下文</li>
        <li>未选中时,AI 自动引用全文(受预算截断)</li>
        <li>支持搜索、插入、替换、删除等文档操作</li>
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
      {tokenInfo ? (
        <div className="tn-chat-context-tokens" aria-live="polite">{tokenInfo}</div>
      ) : null}
      {contextHintKey === 'selectionBlocked' ? (
        <div className="tn-chat-context-hint tn-chat-context-hint-blocked" role="alert">
          {dictionary.selectionBlocked}
        </div>
      ) : null}
      {contextHintKey === 'documentTruncated' ? (
        <div className="tn-chat-context-hint tn-chat-context-hint-truncated" role="status">
          {truncatedMessage ?? dictionary.documentTruncated}
        </div>
      ) : null}
      {contextHintKey === 'outlineMode' ? (
        <div className="tn-chat-context-hint tn-chat-context-hint-outline" role="status">
          {dictionary.outlineMode}
        </div>
      ) : null}
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
        selectionChipBlockCount={selectionChipBlockCount}
        onClearSelection={onClearSelection}
      />
    </section>
  )
}

void (null as unknown as Ref<HTMLElement>)
