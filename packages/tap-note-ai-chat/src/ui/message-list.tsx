import type { FC, ReactNode } from 'react'

export interface MessageListProps {
  /** 消息列表渲染节点。 */
  children: ReactNode
  /** 空状态渲染节点(无消息时显示)。 */
  emptyState?: ReactNode
}

/**
 * 消息列表(可滚动)。用户消息右对齐,AI 消息左对齐(由 MessageBubble 控制)。
 */
export const MessageList: FC<MessageListProps> = ({ children, emptyState }) => {
  return (
    <div className="tn-chat-message-list" role="log" aria-live="polite" aria-label="对话消息列表">
      {children ?? emptyState}
    </div>
  )
}
