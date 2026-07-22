import { BlockNoteEditor } from '@blocknote/core'
import { beforeEach, describe, expect, test } from 'bun:test'
import { createDocumentStateBuilder } from '@tap-note/ai-core'
import { buildDocumentState } from '../context/context-layer'

function createEditor(): BlockNoteEditor {
  return BlockNoteEditor.create({
    initialContent: [
      { type: 'paragraph', id: 'block-1', content: 'first' },
      { type: 'paragraph', id: 'block-2', content: 'second' },
      { type: 'paragraph', id: 'block-3', content: 'third' },
    ],
  })
}

describe('buildDocumentState', () => {
  let editor: BlockNoteEditor

  beforeEach(() => {
    editor = createEditor()
  })

  test('无选区时返回全文', () => {
    const builder = createDocumentStateBuilder(editor, { scope: 'selection' })
    const state = buildDocumentState(editor, builder)
    expect(state.blocks.length).toBe(3)
    expect(state.selection).toBeUndefined()
    builder.dispose()
  })

  test('有选区快照时按快照构建', () => {
    editor.setSelection('block-1', 'block-2')
    const snapshot = {
      blocks: [
        { type: 'paragraph', id: 'block-1', content: 'first' },
        { type: 'paragraph', id: 'block-2', content: 'second' },
      ],
      startBlockId: 'block-1',
      endBlockId: 'block-2',
      blockCount: 2,
    }
    editor.setTextCursorPosition('block-3')
    const builder = createDocumentStateBuilder(editor, { scope: 'selection' })
    const state = buildDocumentState(editor, builder, snapshot)
    expect(state.blocks.length).toBe(2)
    expect(state.selection?.start).toBe('block-1$')
    expect(state.selection?.end).toBe('block-2$')
    builder.dispose()
  })

  test('选区快照为空数组时回退全文', () => {
    const builder = createDocumentStateBuilder(editor, { scope: 'selection' })
    const state = buildDocumentState(editor, builder, { blocks: [], blockCount: 0 } as never)
    expect(state.blocks.length).toBe(3)
    builder.dispose()
  })
})
