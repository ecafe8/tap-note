import { useMemo, useState, useCallback } from 'react'
import {
  FormattingToolbarExtension,
  blockHasType,
  defaultProps,
  type BlockSchema,
  type InlineContentSchema,
  type StyleSchema,
} from '@blocknote/core'
import {
  useBlockNoteEditor,
  useEditorState,
  useExtension,
  useExtensionState,
  PositionPopover,
  type FloatingUIOptions,
} from '@blocknote/react'
import { flip, offset, shift } from '@floating-ui/react'
import { TapNoteFormattingToolbar } from './index'
import type { TapNoteInlineAssistantContext, AIToolItem } from '../types'
import type { TapNoteDictionary } from '../i18n/zh-cn'

const textAlignmentToPlacement = (textAlignment: string | undefined) => {
  switch (textAlignment) {
    case 'center':
      return 'top'
    case 'right':
      return 'top-end'
    default:
      return 'top-start'
  }
}

interface TapNoteFormattingToolbarControllerProps {
  context: TapNoteInlineAssistantContext
  aiBusy: boolean
  dictionary: TapNoteDictionary
  aiTools: readonly AIToolItem[]
  portalElement?: HTMLElement | null
}

export function TapNoteFormattingToolbarController({
  context,
  aiBusy,
  dictionary,
  aiTools,
  portalElement,
}: TapNoteFormattingToolbarControllerProps) {
  const [aiMode, setAiMode] = useState(false)

  const editor = useBlockNoteEditor<BlockSchema, InlineContentSchema, StyleSchema>()
  const formattingToolbar = useExtension(FormattingToolbarExtension, { editor })
  const show = useExtensionState(FormattingToolbarExtension, { editor })

  const position = useEditorState({
    editor,
    selector: ({ editor: e }) =>
      formattingToolbar.store.state
        ? { from: e.prosemirrorState.selection.from, to: e.prosemirrorState.selection.to }
        : undefined,
  })

  const placement = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const block = e.getTextCursorPosition().block
      if (!blockHasType(block, e, block.type, { textAlignment: defaultProps.textAlignment })) {
        return 'top-start' as const
      }
      return textAlignmentToPlacement(block.props.textAlignment)
    },
  })

  const handleAiModeChange = useCallback((mode: boolean) => {
    setAiMode(mode)
  }, [])

  const floatingUIOptions = useMemo<FloatingUIOptions>(
    () => ({
      useFloatingOptions: {
        open: show,
        onOpenChange: (open: boolean, _event: unknown, reason?: string) => {
          if (!open && aiMode && reason !== 'escape-key') {
            return
          }
          if (!open && aiMode && reason === 'escape-key') {
            setAiMode(false)
          }
          formattingToolbar.store.setState(open)
          if (reason === 'escape-key') {
            editor.focus()
          }
        },
        placement,
        middleware: [offset(10), shift(), flip()],
      },
      focusManagerProps: { disabled: true },
      elementProps: {
        style: { zIndex: 40 },
        onMouseDown: (e: React.MouseEvent) => {
          const target = e.target as HTMLElement
          if (target.closest('input, textarea')) return
          e.preventDefault()
        },
      },
    }),
    [show, aiMode, placement, formattingToolbar.store, editor],
  )

  return (
    <PositionPopover position={position} portalElement={portalElement} {...floatingUIOptions}>
      {show && (
        <TapNoteFormattingToolbar
          context={context}
          aiBusy={aiBusy}
          dictionary={dictionary}
          aiTools={aiTools}
          aiMode={aiMode}
          onAiModeChange={handleAiModeChange}
          onClose={() => {
            setAiMode(false)
            formattingToolbar.store.setState(false)
            editor.focus()
          }}
        />
      )}
    </PositionPopover>
  )
}
