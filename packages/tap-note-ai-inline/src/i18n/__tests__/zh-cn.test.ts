import { describe, expect, test } from 'bun:test'
import { inlineDictionaryZhCN, type InlineDictionary } from '../zh-cn'
import { aiCoreDictionaryZhCN, mergeDictionary } from '@tap-note/ai-core'

describe('inlineDictionaryZhCN', () => {
  test('包含内联特有字段', () => {
    const dict: InlineDictionary = inlineDictionaryZhCN
    expect(typeof dict.aiWriting).toBe('string')
    expect(typeof dict.abort).toBe('string')
    expect(typeof dict.aiMenuPlaceholder).toBe('string')
    expect(typeof dict.aiMenuPrompt).toBe('string')
  })

  test('继承 ai-core AICoreDictionary 的字段', () => {
    expect(inlineDictionaryZhCN.aiBusy).toBe(aiCoreDictionaryZhCN.aiBusy)
    expect(inlineDictionaryZhCN.aiInlineTrigger).toBe(aiCoreDictionaryZhCN.aiInlineTrigger)
    expect(inlineDictionaryZhCN.acceptSuggestion).toBe(aiCoreDictionaryZhCN.acceptSuggestion)
    expect(inlineDictionaryZhCN.rejectSuggestion).toBe(aiCoreDictionaryZhCN.rejectSuggestion)
    expect(inlineDictionaryZhCN.retry).toBe(aiCoreDictionaryZhCN.retry)
    expect(inlineDictionaryZhCN.conflict).toBe(aiCoreDictionaryZhCN.conflict)
    expect(inlineDictionaryZhCN.selectionBlocked).toBe(aiCoreDictionaryZhCN.selectionBlocked)
  })

  test('内联特有字段有中文文案', () => {
    expect(inlineDictionaryZhCN.aiWriting).toContain('AI')
    expect(inlineDictionaryZhCN.abort).toBe('中止')
    expect(inlineDictionaryZhCN.aiMenuPrompt).toBe('改什么?')
  })
})

describe('mergeDictionary(从 ai-core 复用)', () => {
  test('override 为 undefined 时返回 base', () => {
    const result = mergeDictionary(inlineDictionaryZhCN)
    expect(result).toBe(inlineDictionaryZhCN)
  })

  test('Partial 覆盖合并指定字段', () => {
    const result = mergeDictionary(inlineDictionaryZhCN, {
      aiWriting: 'Custom writing text',
      abort: 'Cancel',
    })
    expect(result.aiWriting).toBe('Custom writing text')
    expect(result.abort).toBe('Cancel')
    // 未覆盖字段保留默认值
    expect(result.aiMenuPrompt).toBe('改什么?')
    // ai-core 继承字段也保留
    expect(result.aiBusy).toBe(inlineDictionaryZhCN.aiBusy)
  })
})
