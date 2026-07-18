import type { ConflictResult } from '../types/type'

/**
 * AI 核心错误基类。所有子类不泄漏内部堆栈或路径,对外脱敏。
 */
export abstract class AICoreError extends Error {
  abstract readonly code: string
}

/**
 * Revision 冲突或前置条件冲突错误,携带 `ConflictResult`。
 */
export class ConflictError extends AICoreError {
  readonly code = 'AI_CORE_CONFLICT' as const
  readonly name = 'ConflictError' as const
  readonly conflict: ConflictResult
  constructor(conflict: ConflictResult) {
    super(conflict.message)
    this.conflict = conflict
  }
}

/**
 * 超限的预算信息(选区或全文)。
 */
export interface BudgetExceededInfo {
  /** 超限场景:`"selection"` 或 `"full"`。 */
  scope: 'selection' | 'full'
  /** 估算的 token 数。 */
  estimatedTokens: number
  /** 预算上限。 */
  budget: number
}

/**
 * 上下文预算超限错误。
 */
export class BudgetExceededError extends AICoreError {
  readonly code = 'AI_CORE_BUDGET_EXCEEDED' as const
  readonly name = 'BudgetExceededError' as const
  readonly budgetInfo: BudgetExceededInfo
  constructor(info: BudgetExceededInfo) {
    super(
      `${info.scope} estimated ${info.estimatedTokens} tokens exceeds budget ${info.budget}`,
    )
    this.budgetInfo = info
  }
}

/**
 * Transport 错误,用于 transport 调用失败场景(由调用方抛出,ai-core 不发起 HTTP)。
 */
export class TransportError extends AICoreError {
  readonly code = 'AI_CORE_TRANSPORT_ERROR' as const
  readonly name = 'TransportError' as const
  constructor(message: string) {
    super(message)
  }
}
