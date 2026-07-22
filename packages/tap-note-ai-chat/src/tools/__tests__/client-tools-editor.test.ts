import { BlockNoteEditor, type Block } from '@blocknote/core'
import { describe, expect, test } from 'bun:test'
import { createDocumentStateBuilder, type DocumentStateBuilder } from '@tap-note/ai-core'
import { executeClientTool, type ExecuteClientToolContext } from '../client-tools'

function createEditor(initialContent: unknown): BlockNoteEditor {
  return BlockNoteEditor.create({ initialContent: initialContent as never })
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

function makeCtx(editor: BlockNoteEditor): ExecuteClientToolContext & { dsb: DocumentStateBuilder } {
  const dsb = createDocumentStateBuilder(editor, { scope: 'selection' })
  return {
    editor,
    documentStateBuilder: dsb,
    contextMode: 'none',
    allowSnapshotTool: true,
    dsb,
  }
}

describe('executeClientTool: replaceText(真实 editor)', () => {
  test('成功替换块内文本并返回 enriched 结果', async () => {
    const editor = createEditor([{ type: 'paragraph', id: 'b1', content: 'hello world' }])
    const ctx = makeCtx(editor)
    const result = await executeClientTool(
      'replaceText',
      { type: 'replaceText', targetBlockId: 'b1', from: 6, to: 11, expectedText: 'world', replacement: '斜线', baseDocumentRevision: 0 },
      ctx,
    )
    expect(result).toMatchObject({ ok: true, toolName: 'replaceText', targetBlockId: 'b1', replacedText: 'world' })
    expect(textOf(editor, 'b1')).toBe('hello 斜线')
  })

  test('带 $ 后缀的 targetBlockId 正确命中', async () => {
    const editor = createEditor([{ type: 'paragraph', id: 'b1', content: 'hello world' }])
    const ctx = makeCtx(editor)
    const result = await executeClientTool(
      'replaceText',
      { type: 'replaceText', targetBlockId: 'b1$', from: 6, to: 11, expectedText: 'world', replacement: 'there', baseDocumentRevision: 0 },
      ctx,
    )
    expect(result).toMatchObject({ ok: true })
    expect(textOf(editor, 'b1')).toBe('hello there')
  })

  test('expectedText 不匹配返回 precondition 冲突且不修改文档', async () => {
    const editor = createEditor([{ type: 'paragraph', id: 'b1', content: 'hello world' }])
    const ctx = makeCtx(editor)
    const result = await executeClientTool(
      'replaceText',
      { type: 'replaceText', targetBlockId: 'b1', from: 6, to: 11, expectedText: 'wrong', replacement: 'x', baseDocumentRevision: 0 },
      ctx,
    )
    expect(result).toMatchObject({ kind: 'conflict', reason: 'precondition-failed' })
    expect(textOf(editor, 'b1')).toBe('hello world')
  })

  test('revision 冲突返回 revision-mismatch 且不修改文档', async () => {
    const editor = createEditor([{ type: 'paragraph', id: 'b1', content: 'hello world' }])
    const ctx = makeCtx(editor)
    const result = await executeClientTool(
      'replaceText',
      { type: 'replaceText', targetBlockId: 'b1', from: 6, to: 11, expectedText: 'world', replacement: 'x', baseDocumentRevision: 99 },
      ctx,
    )
    expect(result).toMatchObject({ kind: 'conflict', reason: 'revision-mismatch' })
    expect(textOf(editor, 'b1')).toBe('hello world')
  })
})

describe('executeClientTool: block 操作带 $ ID(真实 editor)', () => {
  test('updateBlock 带 $ ID 命中真实块', async () => {
    const editor = createEditor([{ type: 'paragraph', id: 'b1', content: 'first' }])
    const ctx = makeCtx(editor)
    const result = await executeClientTool(
      'updateBlock',
      { type: 'updateBlock', targetBlockId: 'b1$', block: { type: 'paragraph', content: 'changed' }, baseDocumentRevision: 0 },
      ctx,
    )
    expect(result).toMatchObject({ ok: true, toolName: 'updateBlock', targetBlockId: 'b1$' })
    expect(textOf(editor, 'b1')).toBe('changed')
  })

  test('appendToDocument 将新块插入真实文档末尾', async () => {
    const editor = createEditor([
      { type: 'paragraph', id: 'b1', content: 'first' },
      { type: 'paragraph', id: 'b2', content: 'last' },
    ])
    const ctx = makeCtx(editor)
    const result = await executeClientTool(
      'insertBlock',
      {
        block: { type: 'paragraph', content: 'appended' },
        referenceBlockId: 'b1$',
        position: 'after',
        appendToDocument: true,
        baseDocumentRevision: 0,
      },
      ctx,
    )
    expect(result).toMatchObject({ ok: true, targetBlockId: 'b2$', position: 'after' })
    expect(editor.document.map((block) => block.id)).toEqual([
      'b1',
      'b2',
      result.ok ? result.insertedBlockIds?.[0]?.replace(/\$$/, '') : undefined,
    ])
  })
})

describe('executeClientTool: slash → 斜线 端到端', () => {
  test('选中 slash 替换为斜线:文档内容与 revision 均变化', async () => {
    const editor = createEditor([{ type: 'paragraph', id: 'b1', content: 'use slash here' }])
    const ctx = makeCtx(editor)
    const revisionBefore = ctx.dsb.documentRevision
    // "slash" 在 "use slash here" 中位于 [4, 9)
    const result = await executeClientTool(
      'replaceText',
      { type: 'replaceText', targetBlockId: 'b1', from: 4, to: 9, expectedText: 'slash', replacement: '斜线', baseDocumentRevision: revisionBefore },
      ctx,
    )
    expect(result).toMatchObject({ ok: true, toolName: 'replaceText', replacedText: 'slash' })
    // 文档内容真实改变
    expect(textOf(editor, 'b1')).toBe('use 斜线 here')
    // documentRevision 因 editor 变化而递增
    expect(ctx.dsb.documentRevision).toBeGreaterThan(revisionBefore)
  })
})

describe('executeClientTool: searchDocument(真实 editor)', () => {
  test('搜索返回 blockId(带 $)、偏移与原文', async () => {
    const editor = createEditor([{ type: 'paragraph', id: 'b1', content: 'hello world' }])
    const ctx = makeCtx(editor)
    const result = (await executeClientTool('searchDocument', { query: 'world' }, ctx)) as {
      ok: true
      matches: Array<{ blockId: string; from: number; to: number; matchedText: string }>
    }
    expect(result.ok).toBe(true)
    expect(result.matches.length).toBe(1)
    expect(result.matches[0]).toMatchObject({ blockId: 'b1$', from: 6, to: 11, matchedText: 'world' })
  })

  test('无命中返回空 matches', async () => {
    const editor = createEditor([{ type: 'paragraph', id: 'b1', content: 'hello' }])
    const ctx = makeCtx(editor)
    const result = (await executeClientTool('searchDocument', { query: 'xyz' }, ctx)) as {
      ok: true
      matches: unknown[]
    }
    expect(result.ok).toBe(true)
    expect(result.matches.length).toBe(0)
  })
})

describe('executeClientTool: search → replace 闭环(真实 editor)', () => {
  test('search 定位 slash,replace 用返回偏移替换为斜线', async () => {
    const editor = createEditor([{ type: 'paragraph', id: 'b1', content: 'use slash here' }])
    const ctx = makeCtx(editor)
    // 1. 搜索定位
    const searchResult = (await executeClientTool('searchDocument', { query: 'slash' }, ctx)) as {
      ok: true
      matches: Array<{ blockId: string; from: number; to: number; matchedText: string }>
    }
    expect(searchResult.matches.length).toBe(1)
    const m = searchResult.matches[0]
    // 2. 用搜索结果的 blockId/from/to/matchedText 调用 replaceText
    const replaceResult = await executeClientTool(
      'replaceText',
      {
        type: 'replaceText',
        targetBlockId: m.blockId,
        from: m.from,
        to: m.to,
        expectedText: m.matchedText,
        replacement: '斜线',
        baseDocumentRevision: ctx.dsb.documentRevision,
      },
      ctx,
    )
    expect(replaceResult).toMatchObject({ ok: true, replacedText: 'slash' })
    expect(textOf(editor, 'b1')).toBe('use 斜线 here')
  })
})
