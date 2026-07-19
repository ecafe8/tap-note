import type { FC } from 'react'
import type { ChatDictionary } from '../i18n/zh-cn'
import type { ContextMode } from '../context/context-mode'
import type { ContextHintKey } from '../context/context-layer'

export interface ContextSelectorProps {
  /** 当前上下文模式。 */
  mode: ContextMode
  /** 模式切换回调。 */
  onModeChange: (mode: ContextMode) => void
  /** 字典。 */
  dictionary: ChatDictionary
  /** 提示 key(根据 LayeredContext.kind 派生)。 */
  hintKey: ContextHintKey
  /** 截断标记文案(当 hintKey='documentTruncated' 时使用,含 total/included 占位符)。 */
  truncatedMessage?: string
  /** token 估算展示文案(可选,如「全文 12 块 / 约 3.2K tokens ✓」)。 */
  tokenInfo?: string
}

const MODES: Array<{ value: ContextMode; labelKey: keyof ChatDictionary }> = [
  { value: 'selection', labelKey: 'contextSelection' },
  { value: 'full', labelKey: 'contextFull' },
  { value: 'none', labelKey: 'contextNone' },
]

/**
 * 三段式 segmented control:选区 / 全文 / 无。默认 `无`。
 * 下方条件性显示提示行(超限/截断/大纲)。
 */
export const ContextSelector: FC<ContextSelectorProps> = ({
  mode,
  onModeChange,
  dictionary,
  hintKey,
  truncatedMessage,
  tokenInfo,
}) => {
  return (
    <div className="tn-chat-context-selector" role="radiogroup" aria-label="上下文引用模式">
      <div className="tn-chat-context-segmented" role="group">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={mode === m.value}
            className={`tn-chat-context-option ${mode === m.value ? 'active' : ''}`}
            onClick={() => onModeChange(m.value)}
          >
            {dictionary[m.labelKey]}
          </button>
        ))}
      </div>
      {tokenInfo ? (
        <div className="tn-chat-context-tokens" aria-live="polite">{tokenInfo}</div>
      ) : null}
      {hintKey === 'selectionBlocked' ? (
        <div className="tn-chat-context-hint tn-chat-context-hint-blocked" role="alert">
          {dictionary.selectionBlocked}
        </div>
      ) : null}
      {hintKey === 'documentTruncated' ? (
        <div className="tn-chat-context-hint tn-chat-context-hint-truncated" role="status">
          {truncatedMessage ?? dictionary.documentTruncated}
        </div>
      ) : null}
      {hintKey === 'outlineMode' ? (
        <div className="tn-chat-context-hint tn-chat-context-hint-outline" role="status">
          {dictionary.outlineMode}
        </div>
      ) : null}
    </div>
  )
}
