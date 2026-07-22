import type { FC, FormEvent, KeyboardEvent } from 'react'
import type { ChatDictionary } from '../i18n/zh-cn'

export interface InputAreaProps {
  /** 输入框当前值。 */
  value: string
  /** 输入框值更新。 */
  onChange: (value: string) => void
  /** 发送消息(Enter 或点击发送按钮)。 */
  onSubmit: () => void
  /** 中止当前轮(流式中点击中止按钮)。 */
  onAbort: () => void
  /** 字典。 */
  dictionary: ChatDictionary
  /** 是否流式中(显示中止按钮替代发送)。 */
  isStreaming: boolean
  /** 是否 busy(输入框置灰,显示原因)。 */
  isBusy: boolean
  /** busy 原因文案。 */
  busyReason: string | null
  /** 输入框 ref(用于焦点恢复)。 */
  inputRef?: React.RefObject<HTMLInputElement | null>
  /** selection 模式下已捕获选区的块数量(undefined 表示无选区)。 */
  selectionChipBlockCount?: number
  /** 清除已捕获选区(chip ✕ 按钮)。 */
  onClearSelection?: () => void
}

/**
 * 输入区:输入框 + 发送/中止按钮。
 * - `Enter` 发送(Shift+Enter 换行)
 * - 空则发送禁用
 * - 流式中显示中止按钮
 * - busy 时置灰显示原因
 */
export const InputArea: FC<InputAreaProps> = ({
  value,
  onChange,
  onSubmit,
  onAbort,
  dictionary,
  isStreaming,
  isBusy,
  busyReason,
  inputRef,
  selectionChipBlockCount,
  onClearSelection,
}) => {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!isBusy && !isStreaming && value.trim()) {
        onSubmit()
      }
    }
  }

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!isBusy && !isStreaming && value.trim()) {
      onSubmit()
    }
  }

  const disabled = isBusy || (isStreaming ? false : !value.trim())

  return (
    <form className="tn-chat-input-area" onSubmit={handleFormSubmit}>
      {selectionChipBlockCount != null ? (
        <div className="tn-chat-selection-chip" role="status">
          <span className="tn-chat-selection-chip-text">
            📍 {dictionary.selectionChip.replace('{count}', String(selectionChipBlockCount))}
          </span>
          <button
            type="button"
            className="tn-chat-selection-chip-clear"
            onClick={onClearSelection}
            aria-label={dictionary.clearSelection}
          >
            ✕
          </button>
        </div>
      ) : null}
      <input
        ref={inputRef}
        type="text"
        className="tn-chat-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={dictionary.chatPlaceholder}
        disabled={isBusy}
        aria-label={dictionary.chatPlaceholder}
        aria-busy={isBusy}
        aria-disabled={isBusy}
      />
      {isStreaming ? (
        <button
          type="button"
          className="tn-chat-abort-button"
          onClick={onAbort}
          aria-label={dictionary.abort}
        >
          {dictionary.abort}
        </button>
      ) : (
        <button
          type="submit"
          className="tn-chat-send-button"
          disabled={disabled}
          aria-label="发送"
        >
          发送
        </button>
      )}
      {isBusy && busyReason ? (
        <div className="tn-chat-busy-reason" role="status" aria-live="polite">
          ⏸ {busyReason}
        </div>
      ) : null}
    </form>
  )
}
