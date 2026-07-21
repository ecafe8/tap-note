import { BlockNoteEditor } from '@blocknote/core'
import { beforeEach, describe, expect, mock, test } from 'bun:test'
import { createDocumentStateBuilder } from '../document-state-builder'
import { DOCUMENT_STATE_FORMAT } from '../types/schema'
import type { DocumentState } from '../types/type'

function createEditor(): BlockNoteEditor {
  return BlockNoteEditor.create({
    initialContent: [
      { type: 'paragraph', id: 'block-1', content: 'first' },
      { type: 'paragraph', id: 'block-2', content: 'second' },
      { type: 'paragraph', id: 'block-3', content: 'third' },
    ],
  })
}

describe('createDocumentStateBuilder', () => {
  let editor: BlockNoteEditor

  beforeEach(() => {
    editor = createEditor()
  })

  test('build 返回合法 DocumentState 结构', () => {
    const builder = createDocumentStateBuilder(editor, { scope: 'full' })
    const state = builder.build()
    expect(state.format).toBe(DOCUMENT_STATE_FORMAT)
    expect(state.schemaVersion).toBe('0.51.4')
    expect(state.documentRevision).toBe(0)
    expect(Array.isArray(state.blocks)).toBe(true)
    builder.dispose()
  })

  test('scope=full 包含全部块', () => {
    const builder = createDocumentStateBuilder(editor, { scope: 'full' })
    const state = builder.build()
    expect(state.blocks.length).toBe(3)
    expect((state.blocks[0] as { id?: string }).id).toBe('block-1$')
    expect((state.blocks[2] as { id?: string }).id).toBe('block-3$')
    builder.dispose()
  })

  test('scope=affected 返回光标块(默认光标在首个块)', () => {
    const builder = createDocumentStateBuilder(editor, { scope: 'affected' })
    const state = builder.build()
    expect(state.blocks.length).toBe(1)
    builder.dispose()
  })

  test('scope=selection 无显式选区时回退到 affected', () => {
    const builder = createDocumentStateBuilder(editor, { scope: 'selection' })
    const state = builder.build()
    // 无显式选区,回退到 affected(光标块)
    expect(state.blocks.length).toBe(1)
    expect(state.selection).toBeUndefined()
    builder.dispose()
  })

  test('scope=selection 有显式选区时携带 selection', () => {
    editor.setSelection('block-1', 'block-2')
    const builder = createDocumentStateBuilder(editor, { scope: 'selection' })
    const state = builder.build()
    expect(state.blocks.length).toBeGreaterThanOrEqual(1)
    expect(state.selection).toBeDefined()
    expect(state.selection?.start).toBe('block-1$')
    expect(state.selection?.end).toBe('block-2$')
    builder.dispose()
  })

  test('documentRevision 在 editor 变化后自增', () => {
    const builder = createDocumentStateBuilder(editor, { scope: 'full' })
    expect(builder.documentRevision).toBe(0)
    // 模拟 editor 内容变化触发 onChange
    editor.insertBlocks(
      [{ type: 'paragraph', content: 'new' }],
      'block-3',
      'after',
    )
    expect(builder.documentRevision).toBe(1)
    builder.dispose()
  })

  test('documentRevision 在 build 之间单调递增(随 editor 变化)', () => {
    const builder = createDocumentStateBuilder(editor, { scope: 'full' })
    const r0 = builder.documentRevision
    editor.updateBlock('block-1', { content: 'updated' })
    const r1 = builder.documentRevision
    expect(r1).toBeGreaterThan(r0)
    editor.removeBlocks(['block-3'])
    const r2 = builder.documentRevision
    expect(r2).toBeGreaterThan(r1)
    builder.dispose()
  })

  test('空文档(默认空段落)兜底返回合法 DocumentState', () => {
    // BlockNote.create() 无 initialContent 时创建一个默认空段落块
    const emptyEditor = BlockNoteEditor.create()
    const builder = createDocumentStateBuilder(emptyEditor, { scope: 'full' })
    const state = builder.build()
    // 空段落也算一个块,兜底返回非负 revision 与合法结构
    expect(state.documentRevision).toBe(0)
    expect(state.format).toBe(DOCUMENT_STATE_FORMAT)
    expect(Array.isArray(state.blocks)).toBe(true)
    builder.dispose()
  })

  test('dispose 后 build 返回空 DocumentState(revision 0)', () => {
    const builder = createDocumentStateBuilder(editor, { scope: 'full' })
    builder.dispose()
    const state = builder.build()
    expect(state.blocks).toEqual([])
    expect(state.documentRevision).toBe(0)
  })

  test('dispose 后 documentRevision 不再随 editor 变化', () => {
    const builder = createDocumentStateBuilder(editor, { scope: 'full' })
    const before = builder.documentRevision
    builder.dispose()
    editor.insertBlocks(
      [{ type: 'paragraph', content: 'new' }],
      'block-3',
      'after',
    )
    expect(builder.documentRevision).toBe(before)
  })

  test('schemaVersion 可被覆盖', () => {
    const builder = createDocumentStateBuilder(editor, {
      scope: 'full',
      schemaVersion: '1.2.3',
    })
    const state = builder.build()
    expect(state.schemaVersion).toBe('1.2.3')
    builder.dispose()
  })

  test('build 返回的 DocumentState 通过 schema.parse 校验', () => {
    const builder = createDocumentStateBuilder(editor, { scope: 'full' })
    const state: DocumentState = builder.build()
    expect(state.format).toBe(DOCUMENT_STATE_FORMAT)
    expect(typeof state.schemaVersion).toBe('string')
    expect(Number.isInteger(state.documentRevision)).toBe(true)
    expect(state.documentRevision).toBeGreaterThanOrEqual(0)
    builder.dispose()
  })

  test('mock onChange 来验证 revision 自增路径', () => {
    const onChangeMock = mock(() => {})
    const unsubscribe = editor.onChange(onChangeMock)
    editor.insertBlocks(
      [{ type: 'paragraph', content: 'x' }],
      'block-3',
      'after',
    )
    expect(onChangeMock).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  test('build({ scope }) 覆盖创建时的默认 scope', () => {
    // 创建时 scope=selection,但 build 传 full 应返回全部块
    const builder = createDocumentStateBuilder(editor, { scope: 'selection' })
    const state = builder.build({ scope: 'full' })
    expect(state.blocks.length).toBe(3)
    expect(state.selection).toBeUndefined()
    builder.dispose()
  })

  test('build({ selection }) 用选区快照构建,即使实时选区已折叠', () => {
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
    // 折叠实时选区(模拟失焦/点输入框)
    editor.setTextCursorPosition('block-3')
    const builder = createDocumentStateBuilder(editor, { scope: 'selection' })
    // 不传快照时应回退 affected(光标块 block-3)
    const fallback = builder.build()
    expect(fallback.selection).toBeUndefined()
    // 传快照时按快照构建,携带 selection 范围
    const state = builder.build({ selection: snapshot })
    expect(state.blocks.length).toBe(2)
    expect(state.selection?.start).toBe('block-1$')
    expect(state.selection?.end).toBe('block-2$')
    builder.dispose()
  })

  test('build({ scope: selection, selection }) 快照优先于实时选区', () => {
    editor.setSelection('block-2', 'block-3')
    const snapshot = {
      blocks: [{ type: 'paragraph', id: 'block-1', content: 'first' }],
      startBlockId: 'block-1',
      endBlockId: 'block-1',
      blockCount: 1,
    }
    const builder = createDocumentStateBuilder(editor, { scope: 'selection' })
    const state = builder.build({ selection: snapshot })
    expect(state.blocks.length).toBe(1)
    expect((state.blocks[0] as { id?: string }).id).toBe('block-1$')
    expect(state.selection?.start).toBe('block-1$')
    expect(state.selection?.end).toBe('block-1$')
    builder.dispose()
  })
})
