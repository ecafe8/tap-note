import { useState, type FC, type ReactNode } from 'react'
import { Button } from '@workspace/ui/components/button'

interface ChatDrawerProps {
  /** ChatPanel 内容(由集成方传入 assistant.panel)。 */
  children: ReactNode
  /** 抽屉开关按钮的初始状态。 */
  defaultOpen?: boolean
  /** 抽屉开关按钮的标签(关闭态显示)。 */
  openLabel?: string
}

/**
 * ChatDrawer:右侧可开合抽屉 demo example。
 *
 * 默认收起,点击按钮展开挤压编辑器宽度。
 * 这是 apps/web demo 自有样式与逻辑,不在 @tap-note/ai-chat 包范围内。
 */
export const ChatDrawer: FC<ChatDrawerProps> = ({
  children,
  defaultOpen = false,
  openLabel = '💬 对话',
}) => {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="tn-chat-drawer-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="tn-chat-drawer-content"
      >
        {open ? '✕ 关闭' : openLabel}
      </Button>
      {open ? (
        <div id="tn-chat-drawer-content" className="tn-chat-drawer-content" role="region" aria-label="对话面板">
          {children}
        </div>
      ) : null}
    </>
  )
}
