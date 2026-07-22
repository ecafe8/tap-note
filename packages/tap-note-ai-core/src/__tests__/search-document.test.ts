import { BlockNoteEditor } from '@blocknote/core'
import { describe, expect, test } from 'bun:test'
import { searchDocument } from '../search-document'
import { applyReplaceTextToEditor, type ReplaceTextOperation } from '../replace-text'

function createEditor(initialContent: unknown): BlockNoteEditor {
  return BlockNoteEditor.create({ initialContent: initialContent as never })
}

describe('searchDocument', () => {
  test('子串匹配返回 blockId(带 $)、偏移与原文', () => {
    const editor = createEditor([{ type: 'paragraph', id: 'b1', content: 'hello world' }])
    const result = searchDocument(editor, { query: 'world' })
    expect(result.ok).toBe(true)
    expect(result.matches.length).toBe(1)
    expect(result.matches[0]).toMatchObject({
      blockId: 'b1$',
      blockType: 'paragraph',
      from: 6,
      to: 11,
      matchedText: 'world',
    })
  })

  test('默认不区分大小写', () => {
    const editor = createEditor([{ type: 'paragraph', id: 'b1', content: 'Hello World' }])
    const result = searchDocument(editor, { query: 'world' })
    expect(result.matches.length).toBe(1)
    expect(result.matches[0]?.matchedText).toBe('World')
  })

  test('caseSensitive=true 区分大小写', () => {
    const editor = createEditor([{ type: 'paragraph', id: 'b1', content: 'Hello World' }])
    const result = searchDocument(editor, { query: 'world', caseSensitive: true })
    expect(result.matches.length).toBe(0)
  })

  test('正则匹配', () => {
    const editor = createEditor([{ type: 'paragraph', id: 'b1', content: 'foo123bar' }])
    const result = searchDocument(editor, { query: '\\d+', isRegex: true })
    expect(result.matches.length).toBe(1)
    expect(result.matches[0]).toMatchObject({ from: 3, to: 6, matchedText: '123' })
  })

  test('非法正则返回空结果', () => {
    const editor = createEditor([{ type: 'paragraph', id: 'b1', content: 'abc' }])
    const result = searchDocument(editor, { query: '(', isRegex: true })
    expect(result.matches.length).toBe(0)
  })

  test('同一块内多处匹配', () => {
    const editor = createEditor([{ type: 'paragraph', id: 'b1', content: 'foo bar foo baz foo' }])
    const result = searchDocument(editor, { query: 'foo' })
    expect(result.matches.length).toBe(3)
    expect(result.matches.map((m) => m.from)).toEqual([0, 8, 16])
  })

  test('跨多个块匹配', () => {
    const editor = createEditor([
      { type: 'paragraph', id: 'b1', content: 'alpha' },
      { type: 'paragraph', id: 'b2', content: 'beta alpha' },
    ])
    const result = searchDocument(editor, { query: 'alpha' })
    expect(result.matches.length).toBe(2)
    expect(result.matches.map((m) => m.blockId)).toEqual(['b1$', 'b2$'])
  })

  test('无匹配返回空', () => {
    const editor = createEditor([{ type: 'paragraph', id: 'b1', content: 'hello' }])
    const result = searchDocument(editor, { query: 'xyz' })
    expect(result.matches.length).toBe(0)
    expect(result.truncated).toBe(false)
  })

  test('空 query 返回空', () => {
    const editor = createEditor([{ type: 'paragraph', id: 'b1', content: 'hello' }])
    const result = searchDocument(editor, { query: '' })
    expect(result.matches.length).toBe(0)
  })

  test('maxResults 截断并标记 truncated', () => {
    const editor = createEditor([{ type: 'paragraph', id: 'b1', content: 'a a a a a' }])
    const result = searchDocument(editor, { query: 'a', maxResults: 2 })
    expect(result.matches.length).toBe(2)
    expect(result.truncated).toBe(true)
  })

  test('搜索嵌套子块', () => {
    const editor = createEditor([
      {
        type: 'paragraph',
        id: 'b1',
        content: 'parent',
        children: [{ type: 'paragraph', id: 'child1', content: 'needle here' }],
      },
    ])
    const result = searchDocument(editor, { query: 'needle' })
    expect(result.matches.length).toBe(1)
    expect(result.matches[0]?.blockId).toBe('child1$')
  })

  test('偏移与 replaceText 一致:search → replace 闭环', () => {
    const editor = createEditor([{ type: 'paragraph', id: 'b1', content: 'use slash here' }])
    const found = searchDocument(editor, { query: 'slash' })
    expect(found.matches.length).toBe(1)
    const m = found.matches[0]!
    // 直接用搜索结果的 blockId/from/to/matchedText 调用 replaceText
    const op: ReplaceTextOperation = {
      type: 'replaceText',
      baseDocumentRevision: 0,
      targetBlockId: m.blockId,
      from: m.from,
      to: m.to,
      expectedText: m.matchedText,
      replacement: '斜线',
    }
    const result = applyReplaceTextToEditor(editor, op, 0)
    expect(result).toMatchObject({ ok: true, replacedText: 'slash' })
    const block = editor.document.find((b) => b.id === 'b1')
    const content = block?.content
    const text = typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content.map((c: unknown) => (c && typeof c === 'object' && 'text' in c ? String((c as { text: unknown }).text) : '')).join('')
        : ''
    expect(text).toBe('use 斜线 here')
  })
})
