import { z } from 'zod'
import { blockSchema } from '@tap-note/ai-core'

/**
 * Chat client-side tools 的 input schemas(派生自 ai-core `blockSchema`,与服务端
 * `apps/server-api/src/modules/ai/types/schema.ts` 中的定义同源且形状一致)。
 *
 * 客户端 `executeClientTool` 接收的 `input` 已由服务端 streamText 的 `tools` schema 校验,
 * 这里再校验一次是防御性编程(defensive),不依赖服务端正确性。
 */
const blockIdSchema = z.string().min(1)
const positionSchema = z.enum(['before', 'after'])
const baseDocumentRevisionSchema = z.number().int().nonnegative()

export const insertBlockToolInputSchema = z.object({
  block: blockSchema,
  referenceBlockId: blockIdSchema,
  position: positionSchema.default('after'),
  /** 续写场景使用文档当前最后一个顶层块,避免模型选中上下文中的首个块。 */
  appendToDocument: z.boolean().optional(),
  baseDocumentRevision: baseDocumentRevisionSchema,
})

export const updateBlockToolInputSchema = z.object({
  targetBlockId: blockIdSchema,
  block: blockSchema,
  baseDocumentRevision: baseDocumentRevisionSchema,
})

export const deleteBlockToolInputSchema = z.object({
  targetBlockId: blockIdSchema,
  baseDocumentRevision: baseDocumentRevisionSchema,
})

export const replaceBlocksToolInputSchema = z.object({
  targetBlockIds: z.array(blockIdSchema).min(1),
  blocks: z.array(blockSchema).min(1),
  baseDocumentRevision: baseDocumentRevisionSchema,
})

export const moveBlockToolInputSchema = z.object({
  targetBlockId: blockIdSchema,
  referenceBlockId: blockIdSchema,
  position: positionSchema,
  baseDocumentRevision: baseDocumentRevisionSchema,
})

export const replaceTextToolInputSchema = z.object({
  targetBlockId: blockIdSchema,
  from: z.number().int().nonnegative(),
  to: z.number().int().positive(),
  expectedText: z.string(),
  replacement: z.string(),
  baseDocumentRevision: baseDocumentRevisionSchema,
})

export const searchDocumentToolInputSchema = z.object({
  query: z.string().min(1),
  isRegex: z.boolean().optional(),
  caseSensitive: z.boolean().optional(),
  maxResults: z.number().int().positive().optional(),
})

export const getDocumentSnapshotToolInputSchema = z.object({
  fromBlock: blockIdSchema.optional(),
  maxBlocks: z.number().int().positive().optional(),
  maxTokens: z.number().int().positive().optional(),
})

export type InsertBlockToolInput = z.infer<typeof insertBlockToolInputSchema>
export type UpdateBlockToolInput = z.infer<typeof updateBlockToolInputSchema>
export type DeleteBlockToolInput = z.infer<typeof deleteBlockToolInputSchema>
export type ReplaceBlocksToolInput = z.infer<typeof replaceBlocksToolInputSchema>
export type MoveBlockToolInput = z.infer<typeof moveBlockToolInputSchema>
export type ReplaceTextToolInput = z.infer<typeof replaceTextToolInputSchema>
export type SearchDocumentToolInput = z.infer<typeof searchDocumentToolInputSchema>
export type GetDocumentSnapshotToolInput = z.infer<typeof getDocumentSnapshotToolInputSchema>

/**
 * 工具执行成功的结果。携带操作类型、最新 revision 与目标信息,供 LLM 后续操作与 UI 展示。
 *
 * - `toolName`:回显操作类型(模型与 UI 据此判断做了什么)。
 * - `currentDocumentRevision`:执行后的最新 revision,供多工具序列的下一步使用。
 * - `targetBlockId`:目标块 ID(保留 `$` 后缀,用于 UI 展示/跳转)。
 * - `replacedText`:`replaceText` 专用,被替换的原文。
 * - `matches`/`truncated`:`searchDocument` 专用,命中列表与是否截断。
 */
export interface ToolSuccessResult {
  ok: true
  toolName: ChatToolName
  currentDocumentRevision: number
  targetBlockId?: string
  /** insertBlock 的实际参考块与位置。 */
  referenceBlockId?: string
  position?: 'before' | 'after'
  /** insertBlock 执行后的顶层块顺序,用于模型确认是否真的写在文末。 */
  documentOrder?: string[]
  /** insertBlock 实际创建的块 ID。 */
  insertedBlockIds?: string[]
  replacedText?: string
  matches?: unknown[]
  truncated?: boolean
}

/** 8 个 client-side tool 名字。 */
export type ChatToolName =
  | 'insertBlock'
  | 'updateBlock'
  | 'deleteBlock'
  | 'replaceBlocks'
  | 'moveBlock'
  | 'replaceText'
  | 'searchDocument'
  | 'getDocumentSnapshot'
