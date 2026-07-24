import { Square, Check, X, RotateCcw } from 'lucide-react'
import type { AIInlineStatus, TapNoteInlineAssistantContext } from '../types'
import type { TapNoteDictionary } from '../i18n/zh-cn'

interface AIToolbarStatusProps {
  status: AIInlineStatus
  error?: string
  dictionary: TapNoteDictionary
  context: TapNoteInlineAssistantContext
  onClose: () => void
}

export function AIToolbarStatus({ status, error, dictionary, context, onClose }: AIToolbarStatusProps) {
  if (status === 'thinking' || status === 'ai-writing') {
    return (
      <div className="tn-ai-status" data-test="ai-toolbar-status">
        <span className="tn-ai-status-text">{dictionary.aiToolbarWriting}</span>
        <button
          type="button"
          className="tn-ai-abort-btn"
          onClick={() => context.abort()}
          aria-label={dictionary.aiToolbarAbort}
        >
          <Square size={14} />
          <span>{dictionary.aiToolbarAbort}</span>
        </button>
      </div>
    )
  }

  if (status === 'user-reviewing') {
    return (
      <div className="tn-ai-status" data-test="ai-toolbar-status">
        <button
          type="button"
          className="tn-ai-accept-btn"
          onClick={() => {
            context.accept()
            onClose()
          }}
          aria-label={dictionary.aiToolbarAccept}
        >
          <Check size={14} />
          <span>{dictionary.aiToolbarAccept}</span>
        </button>
        <button
          type="button"
          className="tn-ai-reject-btn"
          onClick={() => {
            context.reject()
            onClose()
          }}
          aria-label={dictionary.aiToolbarReject}
        >
          <X size={14} />
          <span>{dictionary.aiToolbarReject}</span>
        </button>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="tn-ai-status" data-test="ai-toolbar-status">
        <span className="tn-ai-error-text">{error}</span>
        <button
          type="button"
          className="tn-ai-retry-btn"
          onClick={() => context.retry()}
          aria-label={dictionary.aiToolbarRetry}
        >
          <RotateCcw size={14} />
          <span>{dictionary.aiToolbarRetry}</span>
        </button>
        <button
          type="button"
          className="tn-ai-close-btn"
          onClick={onClose}
          aria-label={dictionary.aiToolbarClose}
        >
          <X size={14} />
        </button>
      </div>
    )
  }

  return null
}
