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
export type GetDocumentSnapshotToolInput = z.infer<typeof getDocumentSnapshotToolInputSchema>

/** 工具执行成功的结果。携带最新 revision 供 LLM 后续操作使用。 */
export interface ToolSuccessResult {
  ok: true
  currentDocumentRevision: number
}

/** 6 个 client-side tool 名字。 */
export type ChatToolName =
  | 'insertBlock'
  | 'updateBlock'
  | 'deleteBlock'
  | 'replaceBlocks'
  | 'moveBlock'
  | 'getDocumentSnapshot'
