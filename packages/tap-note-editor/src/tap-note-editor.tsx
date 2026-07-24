import '@blocknote/shadcn/style.css'
import { BlockNoteView } from '@blocknote/shadcn'
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import {
  tapNoteDictionaryZhCN,
  mergeDictionary,
} from './i18n/zh-cn'
import { useCreateTapNoteEditor } from './use-create-tap-note-editor'
import { createDefaultAITools } from './formatting-toolbar/ai-tools'
import { TapNoteFormattingToolbarController } from './formatting-toolbar/tap-note-formatting-toolbar-controller'
import type { TapNoteAIBusyState, TapNoteEditorProps } from './types'

const noopSubscribe = () => () => {}
const idleState: TapNoteAIBusyState = {
  isBusy: false,
  subscribe: noopSubscribe,
}

function useAIBusy(state: TapNoteAIBusyState | undefined): boolean {
  const resolved = state ?? idleState
  return useSyncExternalStore(resolved.subscribe, () => resolved.isBusy, () => false)
}

export function TapNoteEditor(props: TapNoteEditorProps): React.ReactElement {
  const {
    initialContent,
    editable = true,
    theme,
    onChange,
    inlineAssistant,
    chatAssistant,
    aiBusyState,
    aiTools,
    shadCNComponents,
    dictionary,
  } = props

  const extensions = useMemo(
    () => inlineAssistant?.extension ? [inlineAssistant.extension] : undefined,
    [inlineAssistant],
  )
  const editor = useCreateTapNoteEditor({ initialContent, extensions })
  const mergedDictionary = useMemo(
    () => mergeDictionary(tapNoteDictionaryZhCN, dictionary),
    [dictionary],
  )
  const isBusy = useAIBusy(aiBusyState)

  const hasAIContext = !!inlineAssistant?.context
  const resolvedAITools = useMemo(
    () => aiTools ?? createDefaultAITools(mergedDictionary),
    [aiTools, mergedDictionary],
  )

  useEffect(() => {
    if (inlineAssistant?.mount) {
      try {
        inlineAssistant.mount(editor)
      } catch (error) {
        console.warn('[TapNoteEditor] inlineAssistant 挂载失败:', error)
      }
    }
    if (chatAssistant?.mount) {
      try {
        chatAssistant.mount(editor)
      } catch (error) {
        console.warn('[TapNoteEditor] chatAssistant 挂载失败:', error)
      }
    }
    return () => {
      inlineAssistant?.unmount?.(editor)
      chatAssistant?.unmount?.(editor)
    }
  }, [editor, inlineAssistant, chatAssistant])

  const handleChange = onChange
    ? () => {
      try {
        onChange(editor.topLevelBlocks)
      } catch (error) {
        console.warn('[TapNoteEditor] onChange 回调失败:', error)
      }
    }
    : undefined

  useEffect(() => {
    if (onChange) {
      try {
        onChange(editor.topLevelBlocks)
      } catch (error) {
        console.warn('[TapNoteEditor] onChange 初始回调失败:', error)
      }
    }
  }, [editor, onChange])

  return (
    <div
      data-tap-note-editor=""
      data-tap-note-busy={isBusy ? 'true' : 'false'}
      aria-busy={isBusy}
      aria-label={isBusy ? mergedDictionary.aiBusy : undefined}
    >
      <BlockNoteView
        editor={editor}
        editable={editable && !isBusy}
        theme={theme}
        onChange={handleChange}
        shadCNComponents={shadCNComponents}
        formattingToolbar={hasAIContext ? false : undefined}
      >
        {hasAIContext && (
          <TapNoteFormattingToolbarController
            context={inlineAssistant!.context!}
            aiBusy={isBusy}
            dictionary={mergedDictionary}
            aiTools={resolvedAITools}
          />
        )}
      </BlockNoteView>
    </div>
  )
}
