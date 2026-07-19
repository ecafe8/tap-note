import type { FC, ReactNode } from 'react'
import type { ChatDictionary } from '../i18n/zh-cn'

export interface MessageBubbleProps {
  /** 消息角色。 */
  role: 'user' | 'assistant'
  /** 消息内容(已渲染的 React 节点)。 */
  children: ReactNode
  /** 字典。 */
  dictionary: ChatDictionary
  /** 用户消息的引用上下文 chip(如「§ 选区 2 块」)。 */
  contextChip?: string
  /** AI 消息是否流式中(显示流式光标)。 */
  streaming?: boolean
}

/**
 * 单条消息气泡。
 * - 用户消息右对齐 + 上下文 chip
 * - AI 消息左对齐 + UIMessage.parts 渲染(text part + tool-call 状态图标)
 */
export const MessageBubble: FC<MessageBubbleProps> = ({
  role,
  children,
  dictionary,
  contextChip,
  streaming,
}) => {
  if (role === 'user') {
    return (
      <div className="tn-chat-message tn-chat-message-user" data-role="user">
        <div className="tn-chat-message-content">
          {contextChip ? (
            <div className="tn-chat-message-chip" aria-label="引用上下文">{contextChip}</div>
          ) : null}
          <div className="tn-chat-message-text">{children}</div>
        </div>
      </div>
    )
  }
  // assistant
  return (
    <div className="tn-chat-message tn-chat-message-assistant" data-role="assistant">
      <div className="tn-chat-message-content">
        <div className="tn-chat-message-text">
          {children}
          {streaming ? (
            <span className="tn-chat-streaming-cursor" aria-hidden="true">◌</span>
          ) : null}
        </div>
      </div>
      <span className="tn-chat-sr-only" aria-live="polite">
        {streaming ? dictionary.toolInputting : undefined}
      </span>
    </div>
  )
}

void (null as unknown as ChatDictionary)
