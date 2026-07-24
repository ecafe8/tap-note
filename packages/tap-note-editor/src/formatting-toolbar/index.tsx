import './formatting-toolbar.css'
import { useCallback, useSyncExternalStore } from 'react'
import {
  useComponentsContext,
  getFormattingToolbarItems,
} from '@blocknote/react'
import type { TapNoteInlineAssistantContext, AIToolItem, AIInlineStatus } from '../types'
import type { TapNoteDictionary } from '../i18n/zh-cn'
import { AIToolbarButton } from './ai-toolbar-button'
import { AIToolbarTools } from './ai-toolbar-tools'
import { AIToolbarInput } from './ai-toolbar-input'
import { AIToolbarStatus } from './ai-toolbar-status'

interface TapNoteFormattingToolbarProps {
  context: TapNoteInlineAssistantContext
  aiBusy: boolean
  dictionary: TapNoteDictionary
  aiTools: readonly AIToolItem[]
  aiMode: boolean
  onAiModeChange: (mode: boolean) => void
  onClose: () => void
}

function useAIStatus(context: TapNoteInlineAssistantContext): { status: AIInlineStatus; error?: string } {
  const subscribe = useCallback(
    (listener: () => void) => context.store.subscribe(listener),
    [context.store],
  )
  const getSnapshot = useCallback(
    () => context.store.state.state,
    [context.store],
  )
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

export function TapNoteFormattingToolbar({
  context,
  aiBusy,
  dictionary,
  aiTools,
  aiMode,
  onAiModeChange,
  onClose,
}: TapNoteFormattingToolbarProps) {
  const Components = useComponentsContext()!
  const aiStatus = useAIStatus(context)

  const processing = aiStatus.status === 'thinking' || aiStatus.status === 'ai-writing'
  const showStatus = aiMode && aiStatus.status !== 'user-input'

  const handleToolSelect = useCallback(
    (tool: AIToolItem) => {
      context.submit(tool.prompt)
    },
    [context],
  )

  const handleToggleAiMode = useCallback(() => {
    if (aiMode && aiStatus.status === 'user-input') {
      onAiModeChange(false)
    } else if (!aiMode) {
      onAiModeChange(true)
    }
  }, [aiMode, aiStatus.status, onAiModeChange])

  const handleAbortAndClose = useCallback(() => {
    context.abort()
    onClose()
  }, [context, onClose])

  return (
    <Components.FormattingToolbar.Root
      className="bn-toolbar bn-formatting-toolbar tn-formatting-toolbar"
    >
      <div className="tn-formatting-toolbar-controls">
        {getFormattingToolbarItems()}
        <AIToolbarButton
          dictionary={dictionary}
          disabled={aiBusy}
          active={aiMode}
          onClick={handleToggleAiMode}
        />
      </div>

      {aiMode && (
        <div className="tn-ai-panel-row">
          <div
            className="tn-ai-panel"
            data-test="ai-panel"
            role="group"
            aria-label={dictionary.aiToolbarPlaceholder}
          >
            {showStatus ? (
              <AIToolbarStatus
                status={aiStatus.status}
                error={aiStatus.error}
                dictionary={dictionary}
                context={context}
                onClose={onClose}
              />
            ) : (
              <div className="gap-2 flex flex-col">
                <AIToolbarTools tools={aiTools} onSelect={handleToolSelect} />
                <AIToolbarInput
                  dictionary={dictionary}
                  onSubmit={(prompt) => context.submit(prompt)}
                  onClose={onClose}
                  onAbortAndClose={handleAbortAndClose}
                  processing={processing}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </Components.FormattingToolbar.Root>
  )
}
