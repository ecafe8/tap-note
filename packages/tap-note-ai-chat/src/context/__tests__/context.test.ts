import { describe, expect, test } from 'bun:test'
import { chatLayerContext, getContextHintKey } from '../context-layer'
import type { DocumentState } from '@tap-note/ai-core'
import type { LayeredContext } from '@tap-note/ai-core'

function makeDocumentState(opts: {
  blocks?: unknown[]
  selection?: { start: string; end: string } | null
  tokens?: number
  revision?: number
}): DocumentState {
  const blocks = opts.blocks ?? [{ type: 'paragraph', content: 'x'.repeat(opts.tokens ? opts.tokens * 4 : 100) }]
  return {
    format: 'blocks-json',
    schemaVersion: '1.0.0',
    documentRevision: opts.revision ?? 1,
    blocks: blocks as DocumentState['blocks'],
    selection: opts.selection ?? undefined,
  }
}

describe('chatLayerContext', () => {
  test('预算内返回 full', () => {
    const small = makeDocumentState({ tokens: 3000 })
    const result = chatLayerContext(small)
    expect(result.kind).toBe('full')
  })

  test('超预算但 ≤2× 返回 truncated', () => {
    const mid = makeDocumentState({ tokens: 11000 })
    const result = chatLayerContext(mid)
    expect(result.kind).toBe('truncated')
  })

  test('>2× 预算返回 outline', () => {
    const huge = makeDocumentState({ tokens: 20000 })
    const result = chatLayerContext(huge)
    expect(result.kind).toBe('outline')
  })
})

describe('getContextHintKey', () => {
  test('selection-blocked 返回 selectionBlocked', () => {
    const layered: LayeredContext = { kind: 'selection-blocked', estimatedTokens: 5000, selectionBudget: 4096, message: '超限' }
    expect(getContextHintKey(layered)).toBe('selectionBlocked')
  })

  test('truncated 返回 documentTruncated', () => {
    const layered: LayeredContext = {
      kind: 'truncated',
      estimatedTokens: 11000,
      truncatedDocumentState: {} as DocumentState,
      message: '已截断',
    }
    expect(getContextHintKey(layered)).toBe('documentTruncated')
  })

  test('outline 返回 outlineMode', () => {
    const layered: LayeredContext = { kind: 'outline', estimatedTokens: 20000, outline: '# 标题' }
    expect(getContextHintKey(layered)).toBe('outlineMode')
  })

  test('full 预算内返回 null(不显示提示)', () => {
    const layered: LayeredContext = { kind: 'full', estimatedTokens: 3000, documentState: {} as DocumentState }
    expect(getContextHintKey(layered)).toBeNull()
  })
})
