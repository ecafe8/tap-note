import { createExtension, BlockNoteEditor, type Block } from '@blocknote/core'
import { suggestChanges } from '@handlewithcare/prosemirror-suggest-changes'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { applyOperationsToEditor } from '../apply-operations'
import type { BlockOperation, ConflictResult } from '../types/type'

/**
 * 安装 suggest-changes 插件的 BlockNote Extension。
 * 由 FEAT-003/004 在集成时通过 BlockNoteEditor.create({ extensions: [...] }) 注册。
 */
const SuggestChangesExtension = createExtension(() => ({
  key: 'suggestChanges' as const,
  prosemirrorPlugins: [suggestChanges()],
}))

/** 创建带 suggest-changes 插件的 BlockNote editor。 */
function createEditorWithSuggestChanges(initialContent?: unknown): BlockNoteEditor {
  return BlockNoteEditor.create({
    initialContent: initialContent as never,
    extensions: [SuggestChangesExtension()],
  } as never)
}

/** 提取 BlockNote block 的文本内容(content 可能是 string 或 InlineContent[]) */
function getBlockText(block: Block | undefined): string {
  if (!block?.content) {
    return ''
  }
  const content = block.content as unknown
  if (typeof content === 'string') {
    return content
  }
  if (Array.isArray(content)) {
    return content
      .map((c: unknown) => (typeof c === 'object' && c !== null && 'text' in c ? String((c as { text: unknown }).text) : ''))
      .join('')
  }
  return ''
}

/** 递归在 block 及其 children 中查找文本,返回第一个匹配的 block。 */
function findBlockWithText(blocks: Block[], text: string): Block | undefined {
  for (const b of blocks) {
    if (getBlockText(b).includes(text)) {
      return b
    }
    if (b.children && b.children.length > 0) {
      const found = findBlockWithText(b.children as Block[], text)
      if (found) {
        return found
      }
    }
  }
  return undefined
}

describe('applyOperationsToEditor', () => {
  let editor: BlockNoteEditor

  beforeEach(() => {
    editor = createEditorWithSuggestChanges([
      { type: 'paragraph', id: 'block-1', content: 'first' },
      { type: 'paragraph', id: 'block-2', content: 'second' },
      { type: 'paragraph', id: 'block-3', content: 'third' },
    ])
  })

  afterEach(() => {
    try {
      editor.mount(undefined as never)
    } catch {
      // ignore
    }
  })

  test('suggest 后 apply 合并建议到正式文档', () => {
    const ops: BlockOperation[] = [
      {
        type: 'updateBlock',
        baseDocumentRevision: 0,
        targetBlockId: 'block-1',
        block: { type: 'paragraph', content: 'first-updated' },
      },
    ]
    applyOperationsToEditor(editor, ops, { mode: 'suggest' })
    applyOperationsToEditor(editor, [], { mode: 'apply' })
    const doc = editor.document
    // apply 后,新文本应在文档中(可能在 block-1 内或作为其 child,
    // 因 suggest-changes 与 BlockNote 的 blockContainer 结构交互有特性)
    const found = findBlockWithText(doc, 'first-updated')
    expect(found).toBeDefined()
  })

  test('suggest 后 revert 不污染文档', () => {
    const originalContent = getBlockText(editor.document[0])
    const ops: BlockOperation[] = [
      {
        type: 'updateBlock',
        baseDocumentRevision: 0,
        targetBlockId: 'block-1',
        block: { type: 'paragraph', content: 'should-not-persist' },
      },
    ]
    applyOperationsToEditor(editor, ops, { mode: 'suggest' })
    applyOperationsToEditor(editor, [], { mode: 'revert' })
    const doc = editor.document
    expect(getBlockText(doc[0])).toBe(originalContent)
  })

  test('revision 冲突返回 ConflictResult,不执行', () => {
    const ops: BlockOperation[] = [
      {
        type: 'updateBlock',
        baseDocumentRevision: 5,
        targetBlockId: 'block-1',
        block: { type: 'paragraph', content: 'no-change' },
      },
    ]
    const result = applyOperationsToEditor(editor, ops, {
      mode: 'suggest',
      currentDocumentRevision: 0,
    })
    expect(result).toBeDefined()
    const conflict = result as ConflictResult
    expect(conflict.kind).toBe('conflict')
    expect(conflict.reason).toBe('revision-mismatch')
    expect(conflict.currentDocumentRevision).toBe(0)
    expect(getBlockText(editor.document[0])).toBe('first')
  })

  test('前置条件冲突(目标块不存在)返回 ConflictResult', () => {
    const ops: BlockOperation[] = [
      {
        type: 'updateBlock',
        baseDocumentRevision: 0,
        targetBlockId: 'missing-block',
        block: { type: 'paragraph', content: 'nope' },
      },
    ]
    const result = applyOperationsToEditor(editor, ops, {
      mode: 'suggest',
      currentDocumentRevision: 0,
    })
    expect(result).toBeDefined()
    const conflict = result as ConflictResult
    expect(conflict.kind).toBe('conflict')
    expect(conflict.reason).toBe('precondition-failed')
    expect(conflict.message).toContain('missing-block')
  })

  test('insertBlock suggest 后 apply 在文档中可见', () => {
    const ops: BlockOperation[] = [
      {
        type: 'insertBlock',
        baseDocumentRevision: 0,
        referenceBlockId: 'block-2',
        position: 'after',
        block: { type: 'paragraph', content: 'inserted' },
      },
    ]
    applyOperationsToEditor(editor, ops, { mode: 'suggest' })
    applyOperationsToEditor(editor, [], { mode: 'apply' })
    const doc = editor.document
    const inserted = doc.find((b) => getBlockText(b) === 'inserted')
    expect(inserted).toBeDefined()
  })

  test('deleteBlock suggest 后 apply 从文档删除', () => {
    const ops: BlockOperation[] = [
      {
        type: 'deleteBlock',
        baseDocumentRevision: 0,
        targetBlockId: 'block-2',
      },
    ]
    applyOperationsToEditor(editor, ops, { mode: 'suggest' })
    applyOperationsToEditor(editor, [], { mode: 'apply' })
    const doc = editor.document
    expect(doc.find((b) => b.id === 'block-2')).toBeUndefined()
  })

  test('replaceBlocks suggest 后 apply 替换块', () => {
    const ops: BlockOperation[] = [
      {
        type: 'replaceBlocks',
        baseDocumentRevision: 0,
        targetBlockIds: ['block-2'],
        blocks: [{ type: 'paragraph', content: 'replaced' }],
      },
    ]
    applyOperationsToEditor(editor, ops, { mode: 'suggest' })
    applyOperationsToEditor(editor, [], { mode: 'apply' })
    const doc = editor.document
    expect(doc.find((b) => getBlockText(b) === 'replaced')).toBeDefined()
  })

  test('moveBlock suggest 后 apply 移动块', () => {
    const ops: BlockOperation[] = [
      {
        type: 'moveBlock',
        baseDocumentRevision: 0,
        targetBlockId: 'block-3',
        referenceBlockId: 'block-1',
        position: 'before',
      },
    ]
    applyOperationsToEditor(editor, ops, { mode: 'suggest' })
    applyOperationsToEditor(editor, [], { mode: 'apply' })
    const doc = editor.document
    const idx3 = doc.findIndex((b) => b.id === 'block-3')
    const idx1 = doc.findIndex((b) => b.id === 'block-1')
    expect(idx3).toBeGreaterThanOrEqual(0)
    expect(idx1).toBeGreaterThanOrEqual(0)
    expect(idx3).toBeLessThan(idx1)
  })

  test('非法 operation 抛 ZodError', () => {
    const badOp = { type: 'invalid', baseDocumentRevision: 0 } as unknown as BlockOperation
    expect(() =>
      applyOperationsToEditor(editor, [badOp], { mode: 'suggest' }),
    ).toThrow()
  })

  test('mode=apply 无 operations 也能调用(只应用建议)', () => {
    expect(() =>
      applyOperationsToEditor(editor, [], { mode: 'apply' }),
    ).not.toThrow()
  })

  test('mode=revert 无 operations 也能调用(只回退建议)', () => {
    expect(() =>
      applyOperationsToEditor(editor, [], { mode: 'revert' }),
    ).not.toThrow()
  })

  test('不提供 currentDocumentRevision 时跳过 revision 检查', () => {
    const ops: BlockOperation[] = [
      {
        type: 'updateBlock',
        baseDocumentRevision: 999,
        targetBlockId: 'block-1',
        block: { type: 'paragraph', content: 'ok' },
      },
    ]
    const result = applyOperationsToEditor(editor, ops, { mode: 'suggest' })
    expect(result).toBeUndefined()
  })

  test('带 $ 后缀的 referenceBlockId/targetBlockId 被透明剥后缀 lookup', () => {
    // 模拟 LLM 回传的 operations:documentStateBuilder 给 id 加了 $ 后缀,
    // LLM 复制带 $ 的 id,applyOperationsToEditor 在 lookup 前剥 $
    const ops: BlockOperation[] = [
      {
        type: 'insertBlock',
        baseDocumentRevision: 0,
        referenceBlockId: 'block-2$',
        position: 'after',
        block: { type: 'paragraph', content: 'suffixed-insert' },
      },
    ]
    applyOperationsToEditor(editor, ops, { mode: 'suggest' })
    applyOperationsToEditor(editor, [], { mode: 'apply' })
    const doc = editor.document
    const inserted = doc.find((b) => getBlockText(b) === 'suffixed-insert')
    expect(inserted).toBeDefined()
  })

  test('带 $ 后缀的 targetBlockId update 正确命中', () => {
    const ops: BlockOperation[] = [
      {
        type: 'updateBlock',
        baseDocumentRevision: 0,
        targetBlockId: 'block-1$',
        block: { type: 'paragraph', content: 'updated-via-suffix' },
      },
    ]
    applyOperationsToEditor(editor, ops, { mode: 'suggest' })
    applyOperationsToEditor(editor, [], { mode: 'apply' })
    const doc = editor.document
    const found = findBlockWithText(doc, 'updated-via-suffix')
    expect(found).toBeDefined()
  })

  test('applyOperationsToTransaction 抛异常时返回 precondition-failed ConflictResult', () => {
    // 用一个非法 content(触发 blockToNode / node.check 抛)验证 catch 不再静默吞
    const ops: BlockOperation[] = [
      {
        type: 'updateBlock',
        baseDocumentRevision: 0,
        targetBlockId: 'block-1$',
        // block.type 不在 schema 中 → blockToNode 抛 "node type xxx not found in schema"
        block: { type: '__nonexistent_block_type__', content: 'bad' },
      } as unknown as BlockOperation,
    ]
    const result = applyOperationsToEditor(editor, ops, { mode: 'suggest' })
    expect(result).toBeDefined()
    const conflict = result as ConflictResult
    expect(conflict.kind).toBe('conflict')
    expect(conflict.reason).toBe('precondition-failed')
    expect(conflict.message).toContain('apply operations failed')
  })

  test('流式期间手动编辑后 revert 不覆盖人工编辑', () => {
    // Step 1: AI suggest 在 block-2 上更新
    const aiOps: BlockOperation[] = [
      {
        type: 'updateBlock',
        baseDocumentRevision: 0,
        targetBlockId: 'block-2',
        block: { type: 'paragraph', content: 'ai-suggested' },
      },
    ]
    applyOperationsToEditor(editor, aiOps, { mode: 'suggest' })

    // Step 2: 用户在 block-3 上手动编辑(不带建议标记,直接经 editor.updateBlock)
    editor.updateBlock('block-3', { content: 'user-manual-edit' })

    // Step 3: revert AI 建议
    applyOperationsToEditor(editor, [], { mode: 'revert' })

    // Step 4: AI 建议回退(block-2 应恢复原内容),用户编辑保留(block-3)
    const doc = editor.document
    expect(getBlockText(doc.find((b) => b.id === 'block-2'))).toBe('second')
    expect(getBlockText(doc.find((b) => b.id === 'block-3'))).toBe('user-manual-edit')
  })
})
