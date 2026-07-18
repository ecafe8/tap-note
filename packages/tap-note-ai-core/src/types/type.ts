import type { PartialBlock } from '@blocknote/core'
import type { z } from 'zod'
import type {
  blockOperationSchema,
  conflictResultSchema,
  conflictReasonSchema,
  documentStateSchema,
  selectionSchema,
} from './schema'

/**
 * `BlockOperation` 派生类型,覆盖 `insertBlock` / `updateBlock` / `deleteBlock` /
 * `replaceBlocks` / `moveBlock` 五种操作。
 */
export type BlockOperation = z.infer<typeof blockOperationSchema>

/**
 * `DocumentState` 派生类型。`blocks` 字段类型对齐 BlockNote `PartialBlock`,
 * 便于调用方直接传入编辑器 API。
 */
export type DocumentState = Omit<z.infer<typeof documentStateSchema>, 'blocks'> & {
  blocks: PartialBlock[]
}

/**
 * 文档选区范围,起止块 ID。
 */
export type Selection = z.infer<typeof selectionSchema>

/**
 * 冲突原因枚举。
 */
export type ConflictReason = z.infer<typeof conflictReasonSchema>

/**
 * `ConflictResult` 派生类型。revision 冲突或前置条件冲突时返回,允许调用方重新
 * 发起操作(对话场景)或回退建议事务(内联场景)。
 */
export type ConflictResult = z.infer<typeof conflictResultSchema>

/**
 * Apply 结果:成功为 `void`,冲突为 `ConflictResult`。
 */
export type ApplyResult = void | ConflictResult
