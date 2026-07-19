import type { FC } from 'react'
import type { AIInlineContext } from '../extension/tap-note-ai-inline-extension'
import type { InlineDictionary } from '../i18n/zh-cn'

/**
 * `AIToolbarButton` Props。
 */
export interface AIToolbarButtonProps {
  /** AI 内联上下文。 */
  context: AIInlineContext
  /** 字典。 */
  dictionary: InlineDictionary
  /** 是否禁用(busy 互斥)。 */
  disabled?: boolean
}

/**
 * 选区时出现的 AI 按钮。
 *
 * 点击后唤起 AIMenu 输入框。
 * busy 互斥:另一 AI 进行中时按钮置灰。
 */
export const AIToolbarButton: FC<AIToolbarButtonProps> = ({ context, dictionary, disabled }) => {
  return (
    <button
      onClick={() => !disabled && context.submit('')}
      disabled={disabled}
      className="ai-toolbar-button"
      title={disabled ? dictionary.aiBusy : dictionary.aiInlineTrigger}
      aria-label={dictionary.aiInlineTrigger}
      aria-disabled={disabled}
    >
      ✨ AI
    </button>
  )
}
