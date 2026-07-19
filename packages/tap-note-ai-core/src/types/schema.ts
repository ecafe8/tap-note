import { z } from 'zod'

/**
 * 文档状态格式标签。所有 `DocumentState` 实例的 `format` 字段使用此值。
 */
export const DOCUMENT_STATE_FORMAT = 'blocks-json' as const

/**
 * BlockNote 块的 Zod schema。块本身是 JSON 可序列化数据,具体形状依赖编辑器
 * schema(参见 `@blocknote/core` 的 `PartialBlock`),因此这里只用 `z.record` 做基本
 * 结构校验,具体字段校验由编辑器在 `parseFromClipboard` 时完成。
 *
 * `children` 用 `z.array(z.unknown())` 而非递归引用,以避免 Zod 的 lazy 递归导致
 * TypeScript 类型推断失败。调用方拿到 `unknown[]` 后自行 cast 为 `PartialBlock[]`。
 */
export const blockSchema: z.ZodType<Record<string, unknown>> = z.object({
  id: z.string().optional(),
  type: z.string().optional(),
  props: z.record(z.string(), z.unknown()).optional(),
  content: z
    .union([z.string(), z.array(z.record(z.string(), z.unknown()))])
    .optional(),
  children: z.array(z.unknown()).optional(),
}).catchall(z.unknown())

/**
 * 块 ID 字符串。BlockNote 的块 ID 形如 `"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx$xxx"`。
 */
const blockIdSchema = z.string().min(1)

/**
 * BlockOperation 基础字段。所有操作 MUST 携带 `baseDocumentRevision`。
 */
const baseOperationFields = {
  /** 操作发起时所见编辑器 revision,用于冲突检测。 */
  baseDocumentRevision: z.number().int().nonnegative(),
} as const

/**
 * `insertBlock` 操作:在 `referenceBlockId` 之前/之后插入 `block`。
 */
const insertBlockOperationSchema = z.object({
  ...baseOperationFields,
  type: z.literal('insertBlock'),
  referenceBlockId: blockIdSchema.optional(),
  position: z.enum(['before', 'after']).default('after'),
  block: blockSchema,
})

/**
 * `updateBlock` 操作:把 `targetBlockId` 处的块更新为 `block`。
 */
const updateBlockOperationSchema = z.object({
  ...baseOperationFields,
  type: z.literal('updateBlock'),
  targetBlockId: blockIdSchema,
  block: blockSchema,
})

/**
 * `deleteBlock` 操作:删除 `targetBlockId` 处的块。
 */
const deleteBlockOperationSchema = z.object({
  ...baseOperationFields,
  type: z.literal('deleteBlock'),
  targetBlockId: blockIdSchema,
})

/**
 * `replaceBlocks` 操作:把 `targetBlockIds` 顺序的块替换为 `blocks`。
 */
const replaceBlocksOperationSchema = z.object({
  ...baseOperationFields,
  type: z.literal('replaceBlocks'),
  targetBlockIds: z.array(blockIdSchema).min(1),
  blocks: z.array(blockSchema).min(1),
})

/**
 * `moveBlock` 操作:把 `targetBlockId` 块移动到 `referenceBlockId` 之前/之后。
 */
const moveBlockOperationSchema = z.object({
  ...baseOperationFields,
  type: z.literal('moveBlock'),
  targetBlockId: blockIdSchema,
  referenceBlockId: blockIdSchema,
  position: z.enum(['before', 'after']),
})

/**
 * `BlockOperation` Zod schema,覆盖五种操作。所有操作 MUST 携带 `baseDocumentRevision`
 * 与目标块 ID 或前置条件。`.parse()` 失败抛出 `ZodError`,不静默。
 */
export const blockOperationSchema = z.discriminatedUnion('type', [
  insertBlockOperationSchema,
  updateBlockOperationSchema,
  deleteBlockOperationSchema,
  replaceBlocksOperationSchema,
  moveBlockOperationSchema,
])

/**
 * `DocumentState` 的选区范围,起止块 ID。
 */
export const selectionSchema = z.object({
  start: blockIdSchema,
  end: blockIdSchema,
})

/**
 * `DocumentState` Zod schema。把编辑器受影响块(含选区)序列化为可传输的快照,
 * `documentRevision` MUST 单调递增。
 */
export const documentStateSchema = z.object({
  format: z.literal(DOCUMENT_STATE_FORMAT),
  schemaVersion: z.string().min(1),
  documentRevision: z.number().int().nonnegative(),
  blocks: z.array(blockSchema),
  selection: selectionSchema.optional(),
})

/**
 * 冲突原因。revision 冲突指操作所见 revision 与当前编辑器不匹配;前置条件冲突指
 * 目标块不存在或状态不符。
 */
export const conflictReasonSchema = z.enum([
  'revision-mismatch',
  'precondition-failed',
])

/**
 * `ConflictResult` Zod schema。revision 冲突或前置条件冲突时返回的可重试结果。
 */
export const conflictResultSchema = z.object({
  kind: z.literal('conflict'),
  reason: conflictReasonSchema,
  /** 当前编辑器 revision,供调用方重新发起时使用。 */
  currentDocumentRevision: z.number().int().nonnegative(),
  /** 触发冲突的操作(原样回传,便于诊断)。 */
  operation: blockOperationSchema,
  /** 可读消息,对外脱敏(不含内部路径/堆栈)。 */
  message: z.string(),
})
