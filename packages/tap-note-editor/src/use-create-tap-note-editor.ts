import { BlockNoteEditor, type PartialBlock } from '@blocknote/core'
import { useState } from 'react'
import type { UseCreateTapNoteEditorOptions } from './types'

const EMPTY_CONTENT: PartialBlock[] = [{ type: 'paragraph', content: '' }]

export function useCreateTapNoteEditor(
  options: UseCreateTapNoteEditorOptions = {},
): BlockNoteEditor {
  const { initialContent, extensions } = options

  const [editor] = useState(() => {
    const content = initialContent && initialContent.length > 0
      ? initialContent
      : EMPTY_CONTENT
    try {
      return BlockNoteEditor.create({ initialContent: content, extensions })
    } catch (error) {
      console.warn('[TapNoteEditor] initialContent 无效,回退到空文档:', error)
      return BlockNoteEditor.create({ initialContent: EMPTY_CONTENT, extensions })
    }
  })

  return editor
}
