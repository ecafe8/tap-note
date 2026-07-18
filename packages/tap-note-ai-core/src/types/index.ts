export {
  /**
   * BlockNote 块 Zod schema(基本结构校验,具体形状由编辑器 schema 决定)。
   */
  blockSchema,
  /**
   * `BlockOperation` Zod schema,覆盖 insertBlock/updateBlock/deleteBlock/replaceBlocks/moveBlock。
   */
  blockOperationSchema,
  /**
   * `DocumentState` Zod schema。
   */
  documentStateSchema,
  /**
   * 选区范围 Zod schema。
   */
  selectionSchema,
  /**
   * 冲突原因 Zod schema。
   */
  conflictReasonSchema,
  /**
   * `ConflictResult` Zod schema。
   */
  conflictResultSchema,
  /**
   * `DocumentState.format` 字面量 `"blocks-json"`。
   */
  DOCUMENT_STATE_FORMAT,
} from './schema'

export type {
  /** `BlockOperation` 派生类型。 */
  BlockOperation,
  /** `DocumentState` 派生类型,`blocks` 字段对齐 BlockNote `PartialBlock`。 */
  DocumentState,
  /** 文档选区范围。 */
  Selection,
  /** 冲突原因。 */
  ConflictReason,
  /** `ConflictResult` 派生类型。 */
  ConflictResult,
  /** Apply 操作结果:成功或冲突。 */
  ApplyResult,
} from './type'
