import { describe, expect, test } from 'bun:test'
import { transition, type InlineState } from '../state-machine'
import type { BlockOperation, ConflictResult } from '@tap-note/ai-core'

const userInput: InlineState = { status: 'user-input' }

const sampleOps: BlockOperation[] = [
  { type: 'updateBlock', baseDocumentRevision: 0, targetBlockId: 'b-1', block: { type: 'paragraph' } },
]

const conflict: ConflictResult = {
  kind: 'conflict',
  reason: 'revision-mismatch',
  currentDocumentRevision: 5,
  operation: sampleOps[0]!,
  message: 'revision mismatch',
}

describe('transition', () => {
  describe('正常流程', () => {
    test('user-input + submit → thinking', () => {
      const next = transition(userInput, { type: 'submit' })
      expect(next.status).toBe('thinking')
    })

    test('thinking + first-tool-call → ai-writing', () => {
      const thinking: InlineState = { status: 'thinking' }
      const next = transition(thinking, { type: 'first-tool-call', operations: sampleOps })
      expect(next.status).toBe('ai-writing')
      if (next.status === 'ai-writing') {
        expect(next.operations).toEqual(sampleOps)
      }
    })

    test('ai-writing + operations-updated → ai-writing(累积更新)', () => {
      const aiWriting: InlineState = { status: 'ai-writing', operations: sampleOps }
      const updatedOps = [...sampleOps, { type: 'deleteBlock' as const, baseDocumentRevision: 0, targetBlockId: 'b-2' }]
      const next = transition(aiWriting, { type: 'operations-updated', operations: updatedOps })
      expect(next.status).toBe('ai-writing')
      if (next.status === 'ai-writing') {
        expect(next.operations).toHaveLength(2)
      }
    })

    test('ai-writing + stream-complete → user-reviewing', () => {
      const aiWriting: InlineState = { status: 'ai-writing', operations: sampleOps }
      const next = transition(aiWriting, { type: 'stream-complete', operations: sampleOps })
      expect(next.status).toBe('user-reviewing')
      if (next.status === 'user-reviewing') {
        expect(next.operations).toEqual(sampleOps)
      }
    })

    test('user-reviewing + accept → user-input', () => {
      const reviewing: InlineState = { status: 'user-reviewing', operations: sampleOps }
      const next = transition(reviewing, { type: 'accept' })
      expect(next.status).toBe('user-input')
    })

    test('user-reviewing + reject → user-input', () => {
      const reviewing: InlineState = { status: 'user-reviewing', operations: sampleOps }
      const next = transition(reviewing, { type: 'reject' })
      expect(next.status).toBe('user-input')
    })
  })

  describe('error 恢复', () => {
    test('thinking + error → error', () => {
      const thinking: InlineState = { status: 'thinking' }
      const next = transition(thinking, { type: 'error', error: 'network failed' })
      expect(next.status).toBe('error')
      if (next.status === 'error') {
        expect(next.error).toBe('network failed')
      }
    })

    test('ai-writing + error → error', () => {
      const aiWriting: InlineState = { status: 'ai-writing', operations: sampleOps }
      const next = transition(aiWriting, { type: 'error', error: 'stream failed' })
      expect(next.status).toBe('error')
      if (next.status === 'error') {
        expect(next.error).toBe('stream failed')
      }
    })

    test('error + retry → thinking', () => {
      const error: InlineState = { status: 'error', error: 'failed' }
      const next = transition(error, { type: 'retry' })
      expect(next.status).toBe('thinking')
    })

    test('error + submit → thinking(也可用 submit 重试)', () => {
      const error: InlineState = { status: 'error', error: 'failed' }
      const next = transition(error, { type: 'submit' })
      expect(next.status).toBe('thinking')
    })
  })

  describe('ConflictResult', () => {
    test('ai-writing + error with ConflictResult → error 携带 conflict', () => {
      const aiWriting: InlineState = { status: 'ai-writing', operations: sampleOps }
      const next = transition(aiWriting, { type: 'error', error: 'revision mismatch', conflict })
      expect(next.status).toBe('error')
      if (next.status === 'error') {
        expect(next.conflict).toBeDefined()
        expect(next.conflict?.reason).toBe('revision-mismatch')
      }
    })

    test('error with conflict + retry → thinking', () => {
      const error: InlineState = { status: 'error', error: 'conflict', conflict }
      const next = transition(error, { type: 'retry' })
      expect(next.status).toBe('thinking')
    })
  })

  describe('中止', () => {
    test('ai-writing + abort → user-input', () => {
      const aiWriting: InlineState = { status: 'ai-writing', operations: sampleOps }
      const next = transition(aiWriting, { type: 'abort' })
      expect(next.status).toBe('user-input')
    })

    test('thinking + abort → user-input', () => {
      const thinking: InlineState = { status: 'thinking' }
      const next = transition(thinking, { type: 'abort' })
      expect(next.status).toBe('user-input')
    })
  })

  describe('close', () => {
    test('任意状态 + close → user-input', () => {
      const states: InlineState[] = [
        { status: 'thinking' },
        { status: 'ai-writing', operations: sampleOps },
        { status: 'user-reviewing', operations: sampleOps },
        { status: 'error', error: 'x' },
      ]
      for (const s of states) {
        expect(transition(s, { type: 'close' }).status).toBe('user-input')
      }
    })
  })

  describe('非法转换(保持原状态)', () => {
    test('user-input + first-tool-call → user-input(不变)', () => {
      const next = transition(userInput, { type: 'first-tool-call', operations: sampleOps })
      expect(next.status).toBe('user-input')
    })

    test('thinking + accept → thinking(不变)', () => {
      const thinking: InlineState = { status: 'thinking' }
      const next = transition(thinking, { type: 'accept' })
      expect(next.status).toBe('thinking')
    })

    test('user-reviewing + submit → user-reviewing(不变)', () => {
      const reviewing: InlineState = { status: 'user-reviewing', operations: sampleOps }
      const next = transition(reviewing, { type: 'submit' })
      expect(next.status).toBe('user-reviewing')
    })

    test('error + first-tool-call → error(不变)', () => {
      const error: InlineState = { status: 'error', error: 'x' }
      const next = transition(error, { type: 'first-tool-call', operations: sampleOps })
      expect(next.status).toBe('error')
    })
  })
})
