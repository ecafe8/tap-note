import { describe, expect, test } from 'bun:test'
import { chatDictionaryZhCN, mergeChatDictionary, type ChatDictionary } from '../zh-cn'
import { aiCoreDictionaryZhCN } from '@tap-note/ai-core'

describe('chatDictionaryZhCN', () => {
  test('包含 ai-core 继承字段', () => {
    const dict: ChatDictionary = chatDictionaryZhCN
    // 继承自 AICoreDictionary
    expect(dict.aiBusy).toBeDefined()
    expect(dict.conflict).toBeDefined()
    expect(dict.preconditionFailed).toBeDefined()
    expect(dict.selectionBlocked).toBeDefined()
    expect(dict.documentTruncated).toBeDefined()
    expect(dict.outlineMode).toBeDefined()
    expect(dict.retry).toBeDefined()
    expect(dict.acceptSuggestion).toBeDefined()
    expect(dict.rejectSuggestion).toBeDefined()
    expect(dict.aiInlineTrigger).toBeDefined()
    expect(dict.aiChatTrigger).toBeDefined()
  })

  test('继承字段值与 ai-core 默认一致', () => {
    expect(chatDictionaryZhCN.aiBusy).toBe(aiCoreDictionaryZhCN.aiBusy)
    expect(chatDictionaryZhCN.conflict).toBe(aiCoreDictionaryZhCN.conflict)
    expect(chatDictionaryZhCN.selectionBlocked).toBe(aiCoreDictionaryZhCN.selectionBlocked)
  })

  test('包含 chat 特有字段', () => {
    expect(chatDictionaryZhCN.chatPlaceholder).toBeDefined()
    expect(chatDictionaryZhCN.abort).toBeDefined()
    expect(chatDictionaryZhCN.retryToolCall).toBeDefined()
    expect(chatDictionaryZhCN.toolInputting).toBeDefined()
    expect(chatDictionaryZhCN.toolUpdated).toBe('已更新块')
    expect(chatDictionaryZhCN.toolInserted).toBe('已插入块')
    expect(chatDictionaryZhCN.toolDeleted).toBe('已删除块')
    expect(chatDictionaryZhCN.toolReplaced).toBe('已替换块')
    expect(chatDictionaryZhCN.toolMoved).toBe('已移动块')
    expect(chatDictionaryZhCN.jumpToBlock).toBeDefined()
  })
})

describe('mergeChatDictionary', () => {
  test('undefined 返回 base', () => {
    expect(mergeChatDictionary(undefined)).toBe(chatDictionaryZhCN)
  })

  test('Partial 覆盖合并:只覆盖指定字段,其他保留默认', () => {
    const merged = mergeChatDictionary({ chatPlaceholder: 'Ask anything...' })
    expect(merged.chatPlaceholder).toBe('Ask anything...')
    // 未覆盖字段保留默认
    expect(merged.abort).toBe(chatDictionaryZhCN.abort)
    expect(merged.aiBusy).toBe(chatDictionaryZhCN.aiBusy)
    expect(merged.conflict).toBe(chatDictionaryZhCN.conflict)
  })

  test('同时覆盖 ai-core 字段与 chat 字段', () => {
    const merged = mergeChatDictionary({
      aiBusy: 'Custom busy message',
      chatPlaceholder: 'Custom placeholder',
    })
    expect(merged.aiBusy).toBe('Custom busy message')
    expect(merged.chatPlaceholder).toBe('Custom placeholder')
    expect(merged.conflict).toBe(chatDictionaryZhCN.conflict)
  })

  test('空对象返回完整 base 副本', () => {
    const merged = mergeChatDictionary({})
    expect(merged).toEqual(chatDictionaryZhCN)
  })
})
