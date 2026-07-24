import { useState } from 'react'
import { Send, X } from 'lucide-react'
import type { TapNoteDictionary } from '../i18n/zh-cn'

interface AIToolbarInputProps {
  dictionary: TapNoteDictionary
  onSubmit: (prompt: string) => void
  onClose: () => void
  onAbortAndClose: () => void
  processing: boolean
}

export function AIToolbarInput({ dictionary, onSubmit, onClose, onAbortAndClose, processing }: AIToolbarInputProps) {
  const [value, setValue] = useState('')

  const handleSubmit = () => {
    const trimmed = value.trim()
    if (!trimmed) return
    onSubmit(trimmed)
    setValue('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      if (processing) {
        onAbortAndClose()
      } else {
        onClose()
      }
    }
  }

  const handleClose = () => {
    if (processing) {
      onAbortAndClose()
    } else {
      onClose()
    }
  }

  return (
    <div className="tn-ai-input-row" data-test="ai-toolbar-input">
      <input
        type="text"
        className="tn-ai-input"
        placeholder={dictionary.aiToolbarPlaceholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label={dictionary.aiToolbarPlaceholder}
      />
      <button
        type="button"
        className="tn-ai-send-btn"
        onClick={handleSubmit}
        disabled={!value.trim()}
        aria-label={dictionary.aiToolbarSend}
      >
        <Send size={14} />
      </button>
      <button
        type="button"
        className="tn-ai-close-btn"
        onClick={handleClose}
        aria-label={dictionary.aiToolbarClose}
      >
        <X size={14} />
      </button>
    </div>
  )
}
