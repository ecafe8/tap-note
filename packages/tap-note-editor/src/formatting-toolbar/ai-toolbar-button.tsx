import { Sparkles } from 'lucide-react'
import { useComponentsContext } from '@blocknote/react'
import type { TapNoteDictionary } from '../i18n/zh-cn'

interface AIToolbarButtonProps {
  dictionary: TapNoteDictionary
  disabled: boolean
  active: boolean
  onClick: () => void
}

export function AIToolbarButton({ dictionary, disabled, active, onClick }: AIToolbarButtonProps) {
  const Components = useComponentsContext()!

  return (
    <span onMouseDown={(event) => event.preventDefault()}>
      <Components.FormattingToolbar.Button
        className="bn-button"
        data-test="ai-toolbar-button"
        onClick={onClick}
        isDisabled={disabled}
        isSelected={active}
        mainTooltip={disabled ? dictionary.aiBusy : dictionary.aiInlineTrigger}
      >
        <Sparkles size={16} />
      </Components.FormattingToolbar.Button>
    </span>
  )
}
