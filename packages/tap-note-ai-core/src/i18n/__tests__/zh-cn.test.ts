import { describe, expect, test } from 'bun:test'
import {
  aiCoreDictionaryZhCN,
  mergeDictionary,
  type AICoreDictionary,
} from '../zh-cn'

describe('aiCoreDictionaryZhCN', () => {
  test('包含所有必需字段', () => {
    const dict: AICoreDictionary = aiCoreDictionaryZhCN
    expect(typeof dict.aiBusy).toBe('string')
    expect(typeof dict.aiInlineTrigger).toBe('string')
    expect(typeof dict.aiChatTrigger).toBe('string')
    expect(typeof dict.conflict).toBe('string')
    expect(typeof dict.preconditionFailed).toBe('string')
    expect(typeof dict.retry).toBe('string')
    expect(typeof dict.acceptSuggestion).toBe('string')
    expect(typeof dict.rejectSuggestion).toBe('string')
    expect(typeof dict.selectionBlocked).toBe('string')
    expect(typeof dict.documentTruncated).toBe('string')
    expect(typeof dict.outlineMode).toBe('string')
  })

  test('默认文案为中文', () => {
    expect(aiCoreDictionaryZhCN.aiBusy).toContain('AI')
    expect(aiCoreDictionaryZhCN.conflict).toContain('文档')
    expect(aiCoreDictionaryZhCN.retry).toBe('重试')
    expect(aiCoreDictionaryZhCN.acceptSuggestion).toBe('接受')
    expect(aiCoreDictionaryZhCN.rejectSuggestion).toBe('拒绝')
  })
})

describe('mergeDictionary', () => {
  test('override 为 undefined 时返回 base', () => {
    const result = mergeDictionary(aiCoreDictionaryZhCN)
    expect(result).toBe(aiCoreDictionaryZhCN)
    expect(result.aiBusy).toBe(aiCoreDictionaryZhCN.aiBusy)
  })

  test('Partial 覆盖合并指定字段', () => {
    const result = mergeDictionary(aiCoreDictionaryZhCN, {
      aiBusy: 'Custom busy text',
      retry: 'Try again',
    })
    expect(result.aiBusy).toBe('Custom busy text')
    expect(result.retry).toBe('Try again')
  })

  test('未覆盖字段保留默认值', () => {
    const result = mergeDictionary(aiCoreDictionaryZhCN, {
      aiBusy: 'Custom',
    })
    expect(result.aiBusy).toBe('Custom')
    expect(result.retry).toBe(aiCoreDictionaryZhCN.retry)
    expect(result.conflict).toBe(aiCoreDictionaryZhCN.conflict)
  })

  test('空对象 override 返回完整 base', () => {
    const result = mergeDictionary(aiCoreDictionaryZhCN, {})
    expect(result.aiBusy).toBe(aiCoreDictionaryZhCN.aiBusy)
    expect(result.acceptSuggestion).toBe(aiCoreDictionaryZhCN.acceptSuggestion)
  })

  test('返回值类型完整(所有字段存在)', () => {
    const result = mergeDictionary(aiCoreDictionaryZhCN, {
      retry: 'Retry',
    })
    // 验证返回值是完整 AICoreDictionary(所有字段都有值)
    for (const key of Object.keys(aiCoreDictionaryZhCN) as (keyof AICoreDictionary)[]) {
      expect(result[key]).toBeDefined()
    }
  })

  test('不修改原 base 字典(浅拷贝)', () => {
    const original = { ...aiCoreDictionaryZhCN }
    mergeDictionary(aiCoreDictionaryZhCN, { retry: 'New' })
    expect(aiCoreDictionaryZhCN.retry).toBe(original.retry)
  })
})
