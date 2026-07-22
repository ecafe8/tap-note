import { createExtension, BlockNoteEditor, type Block } from '@blocknote/core'
import { suggestChanges } from '@handlewithcare/prosemirror-suggest-changes'
import { beforeEach, describe, expect, test } from 'bun:test'
import {
  applyReplaceTextToEditor,
  resolveReplaceText,
  type ReplaceTextOperation,
} from '../replace-text'
import { applyOperationsToEditor } from '../apply-operations'
import type { BlockOperation, ConflictResult } from '../types/type'

const SuggestChangesExtension = createExtension(() => ({
  key: 'suggestChanges' as const,
  prosemirrorPlugins: [suggestChanges()],
}))

function createPlainEditor(initialContent?: unknown): BlockNoteEditor {
  return BlockNoteEditor.create({ initialContent: initialContent as never })
}

function createEditorWithSuggestChanges(initialContent?: unknown): BlockNoteEditor {
  return BlockNoteEditor.create({
    initialContent: initialContent as never,
    extensions: [SuggestChangesExtension()],
  } as never)
}

function getBlockText(block: Block | undefined): string {
  if (!block?.content) return ''
  const content = block.content as unknown
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((c: unknown) => (typeof c === 'object' && c !== null && 'text' in c ? String((c as { text: unknown }).text) : ''))
      .join('')
  }
  return ''
}

function textOf(editor: BlockNoteEditor, id: string): string {
  return getBlockText(editor.document.find((b) => b.id === id))
}

/** 递归检查文档(含 children)中是否存在指定文本。suggest+apply 后更新文本可能落在子块。 */
function docContainsText(blocks: Block[], text: string): boolean {
  for (const b of blocks) {
    if (getBlockText(b).includes(text)) return true
    if (b.children && b.children.length > 0 && docContainsText(b.children as Block[], text)) return true
  }
  return false
}

const INITIAL = [
  { type: 'paragraph', id: 'b1', content: 'hello world' },
  { type: 'paragraph', id: 'b2', content: 'second' },
]

function replaceOp(overrides: Partial<ReplaceTextOperation> = {}): ReplaceTextOperation {
  return {
    type: 'replaceText',
    baseDocumentRevision: 0,
    targetBlockId: 'b1',
    from: 6,
    to: 11,
    expectedText: 'world',
    replacement: '斜线',
    ...overrides,
  }
}

describe('resolveReplaceText', () => {
  let editor: BlockNoteEditor
  beforeEach(() => {
    editor = createPlainEditor(INITIAL)
  })

  test('合法操作解析出绝对 position,且 textBetween 等于 expectedText', () => {
    const doc = editor.prosemirrorState.doc
    const r = resolveReplaceText(doc, replaceOp(), 0)
    expect('fromPos' in r).toBe(true)
    if ('fromPos' in r) {
      expect(doc.textBetween(r.fromPos, r.toPos)).toBe('world')
      expect(r.replacedText).toBe('world')
    }
  })

  test('expectedText 不匹配返回 precondition 冲突', () => {
    const doc = editor.prosemirrorState.doc
    const r = resolveReplaceText(doc, replaceOp({ expectedText: 'wrong' }), 0)
    expect((r as ConflictResult).kind).toBe('conflict')
    expect((r as ConflictResult).reason).toBe('precondition-failed')
  })

  test('目标块不存在返回 precondition 冲突', () => {
    const doc = editor.prosemirrorState.doc
    const r = resolveReplaceText(doc, replaceOp({ targetBlockId: 'missing' }), 0)
    expect((r as ConflictResult).reason).toBe('precondition-failed')
  })
})

describe('applyReplaceTextToEditor(chat 路径,直接应用)', () => {
  let editor: BlockNoteEditor
  beforeEach(() => {
    editor = createPlainEditor(INITIAL)
  })

  test('成功替换文本并返回 ok 与被替换原文', () => {
    const result = applyReplaceTextToEditor(editor, replaceOp(), 0)
    expect(result).toEqual({ ok: true, replacedText: 'world', currentDocumentRevision: 0 })
    expect(textOf(editor, 'b1')).toBe('hello 斜线')
  })

  test('带 $ 后缀的 targetBlockId 正确剥离后命中', () => {
    const result = applyReplaceTextToEditor(editor, replaceOp({ targetBlockId: 'b1$' }), 0)
    expect('ok' in result && result.ok).toBe(true)
    expect(textOf(editor, 'b1')).toBe('hello 斜线')
  })

  test('范围外的文本保持不变(仅替换 [from,to))', () => {
    const result = applyReplaceTextToEditor(
      editor,
      replaceOp({ from: 0, to: 5, expectedText: 'hello', replacement: 'hi' }),
      0,
    )
    expect('ok' in result && result.ok).toBe(true)
    expect(textOf(editor, 'b1')).toBe('hi world')
  })

  test('空 replacement 删除该范围文本', () => {
    const result = applyReplaceTextToEditor(
      editor,
      replaceOp({ from: 5, to: 11, expectedText: ' world', replacement: '' }),
      0,
    )
    expect('ok' in result && result.ok).toBe(true)
    expect(textOf(editor, 'b1')).toBe('hello')
  })

  test('expectedText 不匹配时不修改文档并返回冲突', () => {
    const result = applyReplaceTextToEditor(editor, replaceOp({ expectedText: 'wrong' }), 0)
    expect((result as ConflictResult).reason).toBe('precondition-failed')
    expect(textOf(editor, 'b1')).toBe('hello world')
  })

  test('非法 range(from >= to)返回冲突且不修改', () => {
    const result = applyReplaceTextToEditor(editor, replaceOp({ from: 8, to: 5 }), 0)
    expect((result as ConflictResult).reason).toBe('precondition-failed')
    expect(textOf(editor, 'b1')).toBe('hello world')
  })

  test('to 超出文本长度返回冲突且不修改', () => {
    const result = applyReplaceTextToEditor(editor, replaceOp({ to: 99, expectedText: 'x' }), 0)
    expect((result as ConflictResult).reason).toBe('precondition-failed')
    expect(textOf(editor, 'b1')).toBe('hello world')
  })

  test('目标块不存在返回冲突', () => {
    const result = applyReplaceTextToEditor(editor, replaceOp({ targetBlockId: 'missing' }), 0)
    expect((result as ConflictResult).reason).toBe('precondition-failed')
  })

  test('revision 不匹配返回 revision-mismatch 且不修改', () => {
    const result = applyReplaceTextToEditor(editor, replaceOp({ baseDocumentRevision: 5 }), 0)
    expect((result as ConflictResult).reason).toBe('revision-mismatch')
    expect(textOf(editor, 'b1')).toBe('hello world')
  })
})

describe('applyOperationsToEditor 接入 replaceText(suggest 路径)', () => {
  let editor: BlockNoteEditor
  beforeEach(() => {
    editor = createEditorWithSuggestChanges(INITIAL)
  })

  test('suggest 后 apply,文本替换生效', () => {
    const ops: BlockOperation[] = [replaceOp()]
    applyOperationsToEditor(editor, ops, { mode: 'suggest', currentDocumentRevision: 0 })
    applyOperationsToEditor(editor, [], { mode: 'apply' })
    expect(textOf(editor, 'b1')).toBe('hello 斜线')
  })

  test('expectedText 不匹配时整批被拒绝,文档不变', () => {
    const ops: BlockOperation[] = [replaceOp({ expectedText: 'wrong' })]
    const result = applyOperationsToEditor(editor, ops, { mode: 'suggest', currentDocumentRevision: 0 })
    expect((result as ConflictResult).reason).toBe('precondition-failed')
    applyOperationsToEditor(editor, [], { mode: 'apply' })
    expect(textOf(editor, 'b1')).toBe('hello world')
  })

  test('revision 冲突不执行', () => {
    const ops: BlockOperation[] = [replaceOp({ baseDocumentRevision: 5 })]
    const result = applyOperationsToEditor(editor, ops, { mode: 'suggest', currentDocumentRevision: 0 })
    expect((result as ConflictResult).reason).toBe('revision-mismatch')
    expect(textOf(editor, 'b1')).toBe('hello world')
  })
})

describe('带 $ 后缀 block ID 回归(全部 block 操作)', () => {
  let editor: BlockNoteEditor
  beforeEach(() => {
    editor = createEditorWithSuggestChanges([
      { type: 'paragraph', id: 'block-1', content: 'first' },
      { type: 'paragraph', id: 'block-2', content: 'second' },
      { type: 'paragraph', id: 'block-3', content: 'third' },
    ])
  })

  test('updateBlock 带 $ ID 命中真实块', () => {
    applyOperationsToEditor(
      editor,
      [{ type: 'updateBlock', baseDocumentRevision: 0, targetBlockId: 'block-1$', block: { type: 'paragraph', content: 'first-updated' } }],
      { mode: 'suggest', currentDocumentRevision: 0 },
    )
    applyOperationsToEditor(editor, [], { mode: 'apply' })
    expect(docContainsText(editor.document, 'first-updated')).toBe(true)
  })

  test('deleteBlock 带 $ ID 命中真实块', () => {
    applyOperationsToEditor(
      editor,
      [{ type: 'deleteBlock', baseDocumentRevision: 0, targetBlockId: 'block-2$' }],
      { mode: 'suggest', currentDocumentRevision: 0 },
    )
    applyOperationsToEditor(editor, [], { mode: 'apply' })
    expect(editor.document.find((b) => b.id === 'block-2')).toBeUndefined()
  })

  test('insertBlock 带 $ referenceBlockId 命中真实块', () => {
    applyOperationsToEditor(
      editor,
      [{ type: 'insertBlock', baseDocumentRevision: 0, referenceBlockId: 'block-2$', position: 'after', block: { type: 'paragraph', content: 'inserted' } }],
      { mode: 'suggest', currentDocumentRevision: 0 },
    )
    applyOperationsToEditor(editor, [], { mode: 'apply' })
    expect(editor.document.find((b) => getBlockText(b) === 'inserted')).toBeDefined()
  })

  test('replaceBlocks 带 $ targetBlockIds 命中真实块', () => {
    applyOperationsToEditor(
      editor,
      [{ type: 'replaceBlocks', baseDocumentRevision: 0, targetBlockIds: ['block-3$'], blocks: [{ type: 'paragraph', content: 'replaced' }] }],
      { mode: 'suggest', currentDocumentRevision: 0 },
    )
    applyOperationsToEditor(editor, [], { mode: 'apply' })
    expect(editor.document.find((b) => getBlockText(b) === 'replaced')).toBeDefined()
    expect(editor.document.find((b) => b.id === 'block-3')).toBeUndefined()
  })

  test('moveBlock 带 $ ID 命中真实块', () => {
    const result = applyOperationsToEditor(
      editor,
      [{ type: 'moveBlock', baseDocumentRevision: 0, targetBlockId: 'block-1$', referenceBlockId: 'block-3$', position: 'after' }],
      { mode: 'suggest', currentDocumentRevision: 0 },
    )
    // moveBlock 不应因 $ ID 报前置条件冲突
    expect(result).toBeUndefined()
  })
})
