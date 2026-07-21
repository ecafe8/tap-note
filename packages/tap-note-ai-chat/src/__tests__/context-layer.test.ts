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

  test('mode=none 返回 undefined', () => {
    const builder = createDocumentStateBuilder(editor, { scope: 'selection' })
    expect(buildDocumentState(editor, 'none', builder)).toBeUndefined()
    builder.dispose()
  })

  test('mode=full 返回全文(尊重 mode,而非 builder 固定 scope)', () => {
    // builder 固定 scope=selection,但 mode=full 应返回全部 3 块
    const builder = createDocumentStateBuilder(editor, { scope: 'selection' })
    const state = buildDocumentState(editor, 'full', builder)
    expect(state?.blocks.length).toBe(3)
    expect(state?.selection).toBeUndefined()
    builder.dispose()
  })

  test('mode=selection 无快照且无实时选区时回退光标块', () => {
    const builder = createDocumentStateBuilder(editor, { scope: 'selection' })
    const state = buildDocumentState(editor, 'selection', builder)
    expect(state).toBeDefined()
    expect(state?.selection).toBeUndefined()
    builder.dispose()
  })

  test('mode=selection 传快照时按快照构建,即使实时选区已折叠', () => {
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
    const state = buildDocumentState(editor, 'selection', builder, snapshot)
    expect(state?.blocks.length).toBe(2)
    expect(state?.selection?.start).toBe('block-1$')
    expect(state?.selection?.end).toBe('block-2$')
    builder.dispose()
  })
})
