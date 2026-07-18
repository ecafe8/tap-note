import { describe, expect, test } from 'bun:test'
import {
  AICoreError,
  BudgetExceededError,
  ConflictError,
  TransportError,
} from '../index'
import type { BlockOperation, ConflictResult } from '../../types/type'

function makeConflict(
  reason: 'revision-mismatch' | 'precondition-failed' = 'revision-mismatch',
): ConflictResult {
  const op: BlockOperation = {
    type: 'updateBlock',
    baseDocumentRevision: 3,
    targetBlockId: 'block-1',
    block: { type: 'paragraph', content: 'updated' },
  }
  return {
    kind: 'conflict',
    reason,
    currentDocumentRevision: 5,
    operation: op,
    message: 'document revision mismatch',
  }
}

describe('ConflictError', () => {
  test('携带 ConflictResult(revision-mismatch)', () => {
    const conflict = makeConflict('revision-mismatch')
    const err = new ConflictError(conflict)
    expect(err).toBeInstanceOf(AICoreError)
    expect(err).toBeInstanceOf(ConflictError)
    expect(err.code).toBe('AI_CORE_CONFLICT')
    expect(err.name).toBe('ConflictError')
    expect(err.conflict).toBe(conflict)
    expect(err.conflict.reason).toBe('revision-mismatch')
    expect(err.conflict.currentDocumentRevision).toBe(5)
    expect(err.message).toBe('document revision mismatch')
  })

  test('携带 ConflictResult(precondition-failed)', () => {
    const conflict = makeConflict('precondition-failed')
    const err = new ConflictError(conflict)
    expect(err.conflict.reason).toBe('precondition-failed')
    expect(err.message).toContain('document revision mismatch') // 使用 conflict.message
  })

  test('不泄漏内部堆栈或路径(对外脱敏)', () => {
    const err = new ConflictError(makeConflict())
    // 错误消息不包含内部路径或堆栈
    expect(err.message).not.toMatch(/\/Volumes|\/Users|node_modules/)
  })
})

describe('BudgetExceededError', () => {
  test('携带选区预算超限信息', () => {
    const err = new BudgetExceededError({
      scope: 'selection',
      estimatedTokens: 5000,
      budget: 4096,
    })
    expect(err).toBeInstanceOf(AICoreError)
    expect(err).toBeInstanceOf(BudgetExceededError)
    expect(err.code).toBe('AI_CORE_BUDGET_EXCEEDED')
    expect(err.budgetInfo.scope).toBe('selection')
    expect(err.budgetInfo.estimatedTokens).toBe(5000)
    expect(err.budgetInfo.budget).toBe(4096)
  })

  test('携带全文预算超限信息', () => {
    const err = new BudgetExceededError({
      scope: 'full',
      estimatedTokens: 10000,
      budget: 8192,
    })
    expect(err.budgetInfo.scope).toBe('full')
    expect(err.budgetInfo.estimatedTokens).toBe(10000)
    expect(err.budgetInfo.budget).toBe(8192)
    expect(err.message).toContain('10000')
    expect(err.message).toContain('8192')
  })

  test('不泄漏内部路径', () => {
    const err = new BudgetExceededError({
      scope: 'selection',
      estimatedTokens: 0,
      budget: 0,
    })
    expect(err.message).not.toMatch(/\/Volumes|\/Users|node_modules/)
  })
})

describe('TransportError', () => {
  test('携带对外消息', () => {
    const err = new TransportError('network timeout')
    expect(err).toBeInstanceOf(AICoreError)
    expect(err).toBeInstanceOf(TransportError)
    expect(err.code).toBe('AI_CORE_TRANSPORT_ERROR')
    expect(err.message).toBe('network timeout')
  })

  test('不泄漏内部路径', () => {
    const err = new TransportError('connection failed')
    expect(err.message).not.toMatch(/\/Volumes|\/Users|node_modules/)
  })
})

describe('AICoreError 基类', () => {
  test('子类都继承 AICoreError', () => {
    expect(new ConflictError(makeConflict())).toBeInstanceOf(AICoreError)
    expect(
      new BudgetExceededError({
        scope: 'selection',
        estimatedTokens: 0,
        budget: 0,
      }),
    ).toBeInstanceOf(AICoreError)
    expect(new TransportError('msg')).toBeInstanceOf(AICoreError)
  })

  test('每个子类有独立 code', () => {
    expect(new ConflictError(makeConflict()).code).toBe('AI_CORE_CONFLICT')
    expect(
      new BudgetExceededError({
        scope: 'selection',
        estimatedTokens: 0,
        budget: 0,
      }).code,
    ).toBe('AI_CORE_BUDGET_EXCEEDED')
    expect(new TransportError('').code).toBe('AI_CORE_TRANSPORT_ERROR')
  })
})
