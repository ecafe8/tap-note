import { describe, expect, test } from 'bun:test'
import { estimateTokens } from '../estimate-tokens'
import { layerContext } from '../layer'
import { DOCUMENT_STATE_FORMAT } from '../../types/schema'
import type { DocumentState } from '../../types/type'

function makeDocumentState(
  blocks: unknown[],
  selection?: { start: string; end: string },
): DocumentState {
  return {
    format: DOCUMENT_STATE_FORMAT,
    schemaVersion: '0.51.4',
    documentRevision: 0,
    blocks: blocks as DocumentState['blocks'],
    selection,
  } as DocumentState
}

describe('estimateTokens', () => {
  test('空字符串返回 0', () => {
    expect(estimateTokens('')).toBe(0)
  })

  test('4 字符约 1 token', () => {
    expect(estimateTokens('abcd')).toBe(1)
  })

  test('8 字符约 2 tokens', () => {
    expect(estimateTokens('abcdefgh')).toBe(2)
  })

  test('5 字符向上取整为 2 tokens', () => {
    expect(estimateTokens('abcde')).toBe(2)
  })

  test('3 字符向上取整为 1 token', () => {
    expect(estimateTokens('abc')).toBe(1)
  })

  test('长文本估算为非负整数', () => {
    const long = 'a'.repeat(1000)
    const result = estimateTokens(long)
    expect(Number.isInteger(result)).toBe(true)
    expect(result).toBeGreaterThanOrEqual(0)
  })
})

describe('layerContext', () => {
  describe('选区模式(selection 存在)', () => {
    test('选区在预算内返回 full', () => {
      const state = makeDocumentState(
        [{ type: 'paragraph', content: 'short' }],
        { start: 'b-1', end: 'b-1' },
      )
      const result = layerContext(state)
      expect(result.kind).toBe('full')
    })

    test('选区超软上限返回 selection-blocked', () => {
      const longText = 'a'.repeat(20000) // ~5000 tokens,超过 4K
      const state = makeDocumentState(
        [{ type: 'paragraph', content: longText }],
        { start: 'b-1', end: 'b-1' },
      )
      const result = layerContext(state)
      expect(result.kind).toBe('selection-blocked')
      if (result.kind === 'selection-blocked') {
        expect(result.estimatedTokens).toBeGreaterThan(4096)
        expect(result.selectionBudget).toBe(4096)
        expect(result.message).toContain('选区')
      }
    })

    test('选区软上限可配', () => {
      const longText = 'a'.repeat(800) // ~200 tokens
      const state = makeDocumentState(
        [{ type: 'paragraph', content: longText }],
        { start: 'b-1', end: 'b-1' },
      )
      // 默认 4K 通过,自定义为 100 拦截
      const defaultResult = layerContext(state)
      expect(defaultResult.kind).toBe('full')
      const customResult = layerContext(state, { selectionBudget: 100 })
      expect(customResult.kind).toBe('selection-blocked')
    })
  })

  describe('全文模式(selection 不存在)', () => {
    test('全文在预算内返回 full', () => {
      const state = makeDocumentState([
        { type: 'paragraph', content: 'hello world' },
      ])
      const result = layerContext(state)
      expect(result.kind).toBe('full')
      if (result.kind === 'full') {
        expect(result.documentState).toBe(state)
      }
    })

    test('全文超预算但 ≤ 2× 返回 truncated', () => {
      // 创建约 10K tokens 的文本(默认 fullBudget=8K,2×=16K,10K 在 [8K,16K] 内)
      const text = 'a'.repeat(4000) // ~1000 tokens per block
      const blocks = Array.from({ length: 10 }, (_, i) => ({
        type: 'paragraph',
        id: `b-${i}`,
        content: text,
      }))
      const state = makeDocumentState(blocks)
      const result = layerContext(state)
      expect(result.kind).toBe('truncated')
      if (result.kind === 'truncated') {
        expect(result.estimatedTokens).toBeGreaterThan(8192)
        expect(result.truncatedDocumentState.blocks.length).toBeLessThan(blocks.length)
        expect(result.message).toContain('[文档已截断')
        expect(result.message).toContain(`共 ${blocks.length} 块`)
      }
    })

    test('全文超 2× 预算返回 outline', () => {
      // 创建约 20K tokens 的文本(默认 fullBudget=8K,2×=16K,20K > 16K)
      const text = 'a'.repeat(8000) // ~2000 tokens per block
      const blocks = Array.from({ length: 10 }, (_, i) => ({
        type: i % 3 === 0 ? 'heading' : 'paragraph',
        id: `b-${i}`,
        content: text,
      }))
      const state = makeDocumentState(blocks)
      const result = layerContext(state)
      expect(result.kind).toBe('outline')
      if (result.kind === 'outline') {
        expect(result.estimatedTokens).toBeGreaterThan(16384)
        expect(result.outline).toBeDefined()
        expect(typeof result.outline).toBe('string')
      }
    })

    test('fullBudget 可配', () => {
      const text = 'a'.repeat(4000) // ~1000 tokens
      const state = makeDocumentState([
        { type: 'paragraph', content: text },
      ])
      // 默认 8K 通过,自定义为 100 拦截为 truncated
      const defaultResult = layerContext(state)
      expect(defaultResult.kind).toBe('full')
      const customResult = layerContext(state, { fullBudget: 100 })
      expect(['truncated', 'outline']).toContain(customResult.kind)
    })

    test('threshold 可配', () => {
      const text = 'a'.repeat(20000) // ~5000 tokens
      const blocks = Array.from({ length: 4 }, (_, i) => ({
        type: 'paragraph',
        id: `b-${i}`,
        content: text,
      }))
      const state = makeDocumentState(blocks)
      // 总计 20000 tokens,fullBudget=8K,默认 2×=16K → outline
      const defaultResult = layerContext(state)
      expect(defaultResult.kind).toBe('outline')
      // threshold=10,即 80K 才改大纲,20K < 80K → truncated
      const customResult = layerContext(state, { threshold: 10 })
      expect(['truncated', 'full']).toContain(customResult.kind)
    })
  })

  describe('不引用模式', () => {
    test('不引用模式由调用方决定不调用 layerContext', () => {
      // 验证:不引用模式即不调用 layerContext,也不发送 documentState
      // 此处仅验证 layerContext 不抛错,实际不引用由调用方控制
      const state = makeDocumentState([])
      expect(() => layerContext(state).kind).not.toThrow()
    })
  })

  describe('truncated 携带截断标记', () => {
    test('截断快照附 [文档已截断:共 N 块,此处含前 M 块] 标记', () => {
      const text = 'a'.repeat(4000) // ~1000 tokens per block
      const blocks = Array.from({ length: 20 }, (_, i) => ({
        type: 'paragraph',
        id: `b-${i}`,
        content: text,
      }))
      // 总计 ~20K tokens,默认 fullBudget=8192,2×=16384,20K > 16K → outline
      // 想要 truncated:fullBudget=8192,threshold=10 → 2×=81920,20K < 81920 → truncated
      const state = makeDocumentState(blocks)
      const result = layerContext(state, { threshold: 10 })
      expect(result.kind).toBe('truncated')
      if (result.kind === 'truncated') {
        expect(result.message).toMatch(/\[文档已截断:共 \d+ 块,此处含前 \d+ 块\]/)
      }
    })
  })

  describe('outline 格式', () => {
    test('大纲格式包含标题与各块首段摘要', () => {
      const blocks = [
        { type: 'heading', content: 'First Heading' },
        { type: 'paragraph', content: 'Para one text here' },
        { type: 'heading', content: 'Second Heading' },
        { type: 'paragraph', content: 'Para two text here' },
      ]
      // 创建超 2× 预算的文本
      const largeBlocks = blocks.map((b, i) => ({
        ...b,
        id: `b-${i}`,
        content: `${b.content}${'a'.repeat(20000)}`,
      }))
      const state = makeDocumentState(largeBlocks)
      const result = layerContext(state)
      expect(result.kind).toBe('outline')
      if (result.kind === 'outline') {
        expect(result.outline).toContain('First Heading')
        expect(result.outline).toContain('Second Heading')
      }
    })
  })

  describe('空文档', () => {
    test('空 blocks 返回 full(0 tokens)', () => {
      const state = makeDocumentState([])
      const result = layerContext(state)
      expect(result.kind).toBe('full')
      if (result.kind === 'full') {
        expect(result.estimatedTokens).toBe(0)
      }
    })
  })
})
