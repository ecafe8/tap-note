import type { UIMessage } from 'ai'
import { describe, expect, test } from 'bun:test'
import { injectDocumentStateMessages } from '../inject-document-state'
import { DOCUMENT_STATE_FORMAT } from '../types/schema'
import type { DocumentState } from '../types/type'

function makeUserMessage(id: string, text: string): UIMessage {
  return {
    id,
    role: 'user',
    parts: [{ type: 'text', text }],
  }
}

function makeAssistantMessage(id: string, text: string): UIMessage {
  return {
    id,
    role: 'assistant',
    parts: [{ type: 'text', text }],
  }
}

function makeDocumentState(withSelection = false): DocumentState {
  const base = {
    format: DOCUMENT_STATE_FORMAT,
    schemaVersion: '0.51.4',
    documentRevision: 3,
    blocks: [{ type: 'paragraph', id: 'b-1', content: 'hello' }],
  } as const
  if (withSelection) {
    return {
      ...base,
      selection: { start: 'b-1', end: 'b-1' },
    } as DocumentState
  }
  return base as DocumentState
}

describe('injectDocumentStateMessages', () => {
  test('documentState 为 undefined 时原样返回 messages', () => {
    const messages = [makeUserMessage('u-1', 'hi')]
    const result = injectDocumentStateMessages(messages, undefined)
    expect(result).toBe(messages)
    expect(result).toHaveLength(1)
  })

  test('documentState 为 null 时原样返回 messages', () => {
    const messages = [makeUserMessage('u-1', 'hi')]
    const result = injectDocumentStateMessages(messages, null)
    expect(result).toBe(messages)
    expect(result).toHaveLength(1)
  })

  test('注入后 messages 在 user 消息前插入 assistant 消息', () => {
    const messages = [makeUserMessage('u-1', 'hi')]
    const result = injectDocumentStateMessages(messages, makeDocumentState())
    expect(result).toHaveLength(2)
    expect(result[0]!.role).toBe('assistant')
    expect(result[0]!.id).toBe('assistant-document-state-u-1')
    expect(result[1]!.role).toBe('user')
    expect(result[1]).toBe(messages[0])
  })

  test('注入消息的 parts 为数组(符合 v7 UIMessage.parts)', () => {
    const messages = [makeUserMessage('u-1', 'hi')]
    const result = injectDocumentStateMessages(messages, makeDocumentState())
    const injected = result[0]!
    expect(Array.isArray(injected.parts)).toBe(true)
    expect(injected.parts.length).toBeGreaterThanOrEqual(2)
    for (const part of injected.parts) {
      expect(part.type).toBe('text')
      expect(typeof (part as { text: string }).text).toBe('string')
    }
  })

  test('无选区 documentState 的 parts 文案提示无选区', () => {
    const messages = [makeUserMessage('u-1', 'hi')]
    const result = injectDocumentStateMessages(messages, makeDocumentState(false))
    const injected = result[0]!
    const firstTextPart = injected.parts[0] as { type: 'text'; text: string }
    expect(firstTextPart.text).toContain('no active selection')
  })

  test('有选区 documentState 的 parts 包含 selection 信息', () => {
    const messages = [makeUserMessage('u-1', 'hi')]
    const result = injectDocumentStateMessages(messages, makeDocumentState(true))
    const injected = result[0]!
    const firstTextPart = injected.parts[0] as { type: 'text'; text: string }
    expect(firstTextPart.text).toContain('selection')
    // 验证 selection JSON 序列化在 parts 中
    const combinedText = injected.parts
      .map((p) => (p as { text?: string }).text ?? '')
      .join('')
    expect(combinedText).toContain('"start"')
    expect(combinedText).toContain('"end"')
    expect(combinedText).toContain('b-1')
  })

  test('注入提醒禁止向用户暴露内部文档状态', () => {
    const messages = [makeUserMessage('u-1', 'hi')]
    const result = injectDocumentStateMessages(messages, makeDocumentState())
    const text = result
      .flatMap((message) => message.parts)
      .map((part) => ('text' in part ? part.text : ''))
      .join('\n')
    expect(text).toContain('PRIVATE INTERNAL CONTEXT')
    expect(text).toContain('Never include its JSON')
  })

  test('多个 user 消息时,每个 user 消息前都注入', () => {
    const messages = [
      makeAssistantMessage('a-1', 'hello'),
      makeUserMessage('u-1', 'first'),
      makeAssistantMessage('a-2', 'reply'),
      makeUserMessage('u-2', 'second'),
    ]
    const result = injectDocumentStateMessages(messages, makeDocumentState())
    expect(result).toHaveLength(6) // 2 个 user 各注入一条 assistant
    // 验证注入位置
    expect(result[1]!.role).toBe('assistant') // 注入在 u-1 之前
    expect(result[2]!.id).toBe('u-1')
    expect(result[4]!.role).toBe('assistant') // 注入在 u-2 之前
    expect(result[5]!.id).toBe('u-2')
  })

  test('assistant 消息不注入', () => {
    const messages = [makeAssistantMessage('a-1', 'hello')]
    const result = injectDocumentStateMessages(messages, makeDocumentState())
    expect(result).toHaveLength(1)
    expect(result[0]).toBe(messages[0])
  })

  test('不修改原 messages 数组(浅拷贝)', () => {
    const messages = [makeUserMessage('u-1', 'hi')]
    const originalLength = messages.length
    injectDocumentStateMessages(messages, makeDocumentState())
    expect(messages).toHaveLength(originalLength)
  })

  test('非法 documentState 抛 ZodError', () => {
    const messages = [makeUserMessage('u-1', 'hi')]
    const bad = { format: 'wrong', schemaVersion: '0.51.4' } as unknown as DocumentState
    expect(() => injectDocumentStateMessages(messages, bad)).toThrow(/format/)
  })

  test('非法 documentState(缺 documentRevision)抛 ZodError', () => {
    const messages = [makeUserMessage('u-1', 'hi')]
    const bad = {
      format: DOCUMENT_STATE_FORMAT,
      schemaVersion: '0.51.4',
      blocks: [],
    } as unknown as DocumentState
    expect(() => injectDocumentStateMessages(messages, bad)).toThrow(/documentRevision/)
  })

  test('空 messages 数组返回空数组', () => {
    const result = injectDocumentStateMessages([], makeDocumentState())
    expect(result).toEqual([])
  })

  test('注入的 assistant 消息 parts 都有 text 字段', () => {
    const messages = [makeUserMessage('u-1', 'hi')]
    const result = injectDocumentStateMessages(messages, makeDocumentState())
    const injected = result[0]!
    for (const part of injected.parts) {
      expect((part as { text?: string }).text).toBeDefined()
      expect(typeof (part as { text: string }).text).toBe('string')
      expect((part as { text: string }).text.length).toBeGreaterThan(0)
    }
  })
})
