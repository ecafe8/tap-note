import { useState, type FC } from 'react'
import type { AIInlineContext } from '../extension/tap-note-ai-inline-extension'
import type { InlineDictionary } from '../i18n/zh-cn'

/**
 * `AIMenuController` Props。
 */
export interface AIMenuControllerProps {
  /** AI 内联上下文(来自扩展 store)。 */
  context: AIInlineContext
  /** 字典。 */
  dictionary: InlineDictionary
}

/**
 * AIMenu 输入框控制器。
 *
 * 状态联动:
 * - `user-input`:显示输入框 + 发送按钮
 * - `thinking`:显示"思考中..." + 中止按钮
 * - `ai-writing`:显示"AI 写作中..." + 中止按钮
 * - `user-reviewing`:显示接受/拒绝按钮
 * - `error`:显示错误信息 + 重试按钮
 */
export const AIMenuController: FC<AIMenuControllerProps> = ({ context, dictionary }) => {
  const [input, setInput] = useState('')
  const state = context.store.state.state

  const handleSubmit = () => {
    if (input.trim()) {
      context.submit(input.trim())
      setInput('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape') {
      context.close()
    }
  }

  // 根据状态渲染不同 UI
  if (state.status === 'error') {
    return (
      <div className="ai-menu error" role="alert">
        <span className="ai-menu-error">{state.error}</span>
        <button onClick={() => context.retry()} className="ai-menu-retry">
          {dictionary.retry}
        </button>
        <button onClick={() => context.close()} className="ai-menu-close">
          ✕
        </button>
      </div>
    )
  }

  if (state.status === 'thinking' || state.status === 'ai-writing') {
    return (
      <div className="ai-menu writing" role="status">
        <span className="ai-menu-status">{dictionary.aiWriting}</span>
        <button onClick={() => context.abort()} className="ai-menu-abort">
          {dictionary.abort}
        </button>
      </div>
    )
  }

  if (state.status === 'user-reviewing') {
    return (
      <div className="ai-menu reviewing" role="dialog">
        <button onClick={() => context.accept()} className="ai-menu-accept">
          {dictionary.acceptSuggestion}
        </button>
        <button onClick={() => context.reject()} className="ai-menu-reject">
          {dictionary.rejectSuggestion}
        </button>
      </div>
    )
  }

  // user-input 状态:显示输入框
  return (
    <div className="ai-menu input" role="form">
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={dictionary.aiMenuPlaceholder}
        className="ai-menu-input"
        autoFocus
      />
      <button
        onClick={handleSubmit}
        disabled={!input.trim()}
        className="ai-menu-send"
      >
        发送
      </button>
    </div>
  )
}
