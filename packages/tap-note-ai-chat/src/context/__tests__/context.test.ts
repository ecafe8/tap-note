import { describe, expect, test } from 'bun:test'
import {
  DEFAULT_CONTEXT_MODE,
  CONTEXT_MODES,
  isSnapshotToolAllowed,
  type ContextMode,
} from '../context-mode'
import { chatLayerContext, getContextHintKey, type ChatLayeredContext } from '../context-layer'
import type { DocumentState } from '@tap-note/ai-core'

function makeDocumentState(opts: {
  blocks?: unknown[]
  selection?: { start: string; end: string } | null
  tokens?: number
  revision?: number
}): DocumentState {
  // 构造一个 DocumentState;token 估算基于 blocks 内容字符数 / 4
  const blocks = opts.blocks ?? [{ type: 'paragraph', content: 'x'.repeat(opts.tokens ? opts.tokens * 4 : 100) }]
  return {
    format: 'blocks-json',
    schemaVersion: '1.0.0',
    documentRevision: opts.revision ?? 1,
    blocks: blocks as DocumentState['blocks'],
    selection: opts.selection ?? undefined,
  }
}

describe('ContextMode', () => {
  test('DEFAULT_CONTEXT_MODE 为 "none"', () => {
    expect(DEFAULT_CONTEXT_MODE).toBe('none')
  })

  test('CONTEXT_MODES 包含三种模式', () => {
    expect(CONTEXT_MODES).toEqual(['selection', 'full', 'none'])
  })

  test('isSnapshotToolAllowed: none 模式不暴露 snapshot tool', () => {
    expect(isSnapshotToolAllowed('none', true)).toBe(false)
  })

  test('isSnapshotToolAllowed: selection 模式不暴露 snapshot tool', () => {
    expect(isSnapshotToolAllowed('selection', true)).toBe(false)
  })

  test('isSnapshotToolAllowed: full 模式 + allowSnapshotTool=true 才暴露', () => {
    expect(isSnapshotToolAllowed('full', true)).toBe(true)
    expect(isSnapshotToolAllowed('full', false)).toBe(false)
  })
})

describe('chatLayerContext', () => {
  test('none 模式不调 layerContext,直接返回 undefined', () => {
    const result = chatLayerContext(makeDocumentState({}), 'none')
    expect(result.mode).toBe('none')
    expect(result.documentState).toBeUndefined()
  })

  test('selection 模式:预算内返回 full', () => {
    const smallSelection = makeDocumentState({
      selection: { start: 'b1', end: 'b2' },
      tokens: 100,
    })
    const result = chatLayerContext(smallSelection, 'selection')
    expect(result.mode).toBe('selection')
    if (result.mode === 'selection') {
      expect(result.layered.kind).toBe('full')
    }
  })

  test('selection 模式:超 4K 返回 selection-blocked', () => {
    const largeSelection = makeDocumentState({
      selection: { start: 'b1', end: 'b2' },
      tokens: 5000,
    })
    const result = chatLayerContext(largeSelection, 'selection')
    expect(result.mode).toBe('selection')
    if (result.mode === 'selection') {
      expect(result.layered.kind).toBe('selection-blocked')
    }
  })

  test('full 模式:预算内(≤8K)返回 full', () => {
    const smallFull = makeDocumentState({ tokens: 3000 })
    const result = chatLayerContext(smallFull, 'full')
    expect(result.mode).toBe('full')
    if (result.mode === 'full') {
      expect(result.layered.kind).toBe('full')
    }
  })

  test('full 模式:超预算但 ≤2× 返回 truncated', () => {
    const midFull = makeDocumentState({ tokens: 11000 })
    const result = chatLayerContext(midFull, 'full')
    expect(result.mode).toBe('full')
    if (result.mode === 'full') {
      expect(result.layered.kind).toBe('truncated')
    }
  })

  test('full 模式:>2× 预算返回 outline', () => {
    const hugeFull = makeDocumentState({ tokens: 20000 })
    const result = chatLayerContext(hugeFull, 'full')
    expect(result.mode).toBe('full')
    if (result.mode === 'full') {
      expect(result.layered.kind).toBe('outline')
    }
  })

  test('none 模式不调 layerContext 即使有 documentState', () => {
    const ds = makeDocumentState({ tokens: 50000 })
    const result = chatLayerContext(ds, 'none')
    expect(result.mode).toBe('none')
  })

  test('undefined documentState 总是返回 none', () => {
    const result = chatLayerContext(undefined, 'selection' as ContextMode)
    expect(result.mode).toBe('none')
  })
})

describe('getContextHintKey', () => {
  test('none 模式返回 null', () => {
    const layered: ChatLayeredContext = { mode: 'none', documentState: undefined }
    expect(getContextHintKey(layered)).toBeNull()
  })

  test('selection-blocked 返回 selectionBlocked', () => {
    const layered: ChatLayeredContext = {
      mode: 'selection',
      layered: { kind: 'selection-blocked', estimatedTokens: 5000, selectionBudget: 4096, message: '超限' },
    }
    expect(getContextHintKey(layered)).toBe('selectionBlocked')
  })

  test('truncated 返回 documentTruncated', () => {
    const layered: ChatLayeredContext = {
      mode: 'full',
      layered: {
        kind: 'truncated',
        estimatedTokens: 11000,
        truncatedDocumentState: {} as DocumentState,
        message: '已截断',
      },
    }
    expect(getContextHintKey(layered)).toBe('documentTruncated')
  })

  test('outline 返回 outlineMode', () => {
    const layered: ChatLayeredContext = {
      mode: 'full',
      layered: { kind: 'outline', estimatedTokens: 20000, outline: '# 标题' },
    }
    expect(getContextHintKey(layered)).toBe('outlineMode')
  })

  test('full 预算内返回 null(不显示提示)', () => {
    const layered: ChatLayeredContext = {
      mode: 'full',
      layered: { kind: 'full', estimatedTokens: 3000, documentState: {} as DocumentState },
    }
    expect(getContextHintKey(layered)).toBeNull()
  })
})
