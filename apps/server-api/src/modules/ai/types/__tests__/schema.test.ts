import { describe, expect, test } from 'bun:test'
import {
  chatRequestSchema,
  editorStreamTextRequestSchema,
  modelsResponseSchema,
} from '../schema'
import { DOCUMENT_STATE_FORMAT } from '@tap-note/ai-core'
import type { DocumentState } from '@tap-note/ai-core'

function makeDocumentState(): DocumentState {
  return {
    format: DOCUMENT_STATE_FORMAT,
    schemaVersion: '0.51.4',
    documentRevision: 0,
    blocks: [{ type: 'paragraph', id: 'b-1', content: 'hello' }],
  } as DocumentState
}

describe('editorStreamTextRequestSchema', () => {
  test('合法请求通过', () => {
    const result = editorStreamTextRequestSchema.safeParse({
      messages: [{ id: 'u-1', role: 'user', parts: [{ type: 'text', text: 'hi' }] }],
      documentState: makeDocumentState(),
      model: 'dashscope:qwen3.7-plus',
    })
    expect(result.success).toBe(true)
  })

  test('缺 messages 抛 ZodError', () => {
    const result = editorStreamTextRequestSchema.safeParse({
      documentState: makeDocumentState(),
      model: 'dashscope:qwen3.7-plus',
    })
    expect(result.success).toBe(false)
  })

  test('缺 model 抛 ZodError', () => {
    const result = editorStreamTextRequestSchema.safeParse({
      messages: [{ id: 'u-1', role: 'user', parts: [] }],
      documentState: makeDocumentState(),
    })
    expect(result.success).toBe(false)
  })

  test('客户端提交 tools 字段被忽略(不再 strict)', () => {
    const result = editorStreamTextRequestSchema.safeParse({
      messages: [{ id: 'u-1', role: 'user', parts: [] }],
      documentState: makeDocumentState(),
      model: 'dashscope:qwen3.7-plus',
      tools: { someTool: {} },
    })
    expect(result.success).toBe(true)
  })

  test('客户端提交 toolDefinitions 字段被忽略(不再 strict)', () => {
    const result = editorStreamTextRequestSchema.safeParse({
      messages: [{ id: 'u-1', role: 'user', parts: [] }],
      documentState: makeDocumentState(),
      model: 'dashscope:qwen3.7-plus',
      toolDefinitions: {},
    })
    expect(result.success).toBe(true)
  })

  test('非法 documentState 抛 ZodError', () => {
    const result = editorStreamTextRequestSchema.safeParse({
      messages: [{ id: 'u-1', role: 'user', parts: [] }],
      documentState: { format: 'wrong' },
      model: 'dashscope:qwen3.7-plus',
    })
    expect(result.success).toBe(false)
  })

  test('extra 字段被忽略(不再 strict)', () => {
    const result = editorStreamTextRequestSchema.safeParse({
      messages: [{ id: 'u-1', role: 'user', parts: [] }],
      documentState: makeDocumentState(),
      model: 'dashscope:qwen3.7-plus',
      extraField: 'bad',
    })
    expect(result.success).toBe(true)
  })
})

describe('chatRequestSchema', () => {
  test('合法请求(含 documentState)通过', () => {
    const result = chatRequestSchema.safeParse({
      messages: [{ id: 'u-1', role: 'user', parts: [{ type: 'text', text: 'hi' }] }],
      documentState: makeDocumentState(),
      documentRevision: 0,
      model: 'dashscope:qwen3.7-plus',
    })
    expect(result.success).toBe(true)
  })

  test('documentState 缺省通过(不引用模式)', () => {
    const result = chatRequestSchema.safeParse({
      messages: [{ id: 'u-1', role: 'user', parts: [] }],
      model: 'dashscope:qwen3.7-plus',
    })
    expect(result.success).toBe(true)
  })

  test('documentRevision 缺省通过', () => {
    const result = chatRequestSchema.safeParse({
      messages: [{ id: 'u-1', role: 'user', parts: [] }],
      model: 'dashscope:qwen3.7-plus',
    })
    expect(result.success).toBe(true)
  })
})

describe('modelsResponseSchema', () => {
  test('合法响应通过', () => {
    const result = modelsResponseSchema.safeParse({
      models: [
        { id: 'dashscope:qwen3.7-plus', label: 'Qwen Plus', provider: 'dashscope', capabilities: {} },
      ],
    })
    expect(result.success).toBe(true)
  })
})
