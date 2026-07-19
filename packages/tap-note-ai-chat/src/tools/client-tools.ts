import type { BlockNoteEditor, BlockIdentifier } from '@blocknote/core'
import type { ConflictResult } from '@tap-note/ai-core'
import type { DocumentStateBuilder } from '@tap-note/ai-core'
import type { ContextMode } from '../context/context-mode'
import {
  insertBlockToolInputSchema,
  updateBlockToolInputSchema,
  deleteBlockToolInputSchema,
  replaceBlocksToolInputSchema,
  moveBlockToolInputSchema,
  getDocumentSnapshotToolInputSchema,
  type ChatToolName,
  type ToolSuccessResult,
} from '../types/tool-input'

/** 客户端 tools 执行上下文(闭包注入到 `executeClientTool`)。 */
export interface ExecuteClientToolContext {
  /** BlockNote 编辑器实例。 */
  editor: BlockNoteEditor
  /** ai-core DocumentStateBuilder(提供 `documentRevision` 与 `build()`)。 */
  documentStateBuilder: DocumentStateBuilder
  /** 当前上下文模式(`none`/`selection`/`full`),用于 `getDocumentSnapshot` 可见性冗余校验。 */
  contextMode: ContextMode
  /** 集成方是否允许 `getDocumentSnapshot` 工具(默认 `true`)。 */
  allowSnapshotTool: boolean
}

/** 工具执行结果:成功或冲突。冲突由调用方通过 `addToolOutput({ state: 'output-error' })` 报告。 */
export type ExecuteToolResult = ToolSuccessResult | ConflictResult

/** 默认 `maxBlocks` 限制(用于 `getDocumentSnapshot`)。 */
const DEFAULT_MAX_BLOCKS = 10
/** 默认 `maxTokens` 限制(用于 `getDocumentSnapshot`)。 */
const DEFAULT_MAX_TOKENS = 2048

/**
 * 执行 client-side tool。由 `useTapNoteChat` 的 `onToolCall` 回调调用。
 *
 * 1. 根据 `toolName` 分发到对应分支
 * 2. 先 Zod 校验 `input`(防御性,服务端已校验过)
 * 3. 校验 `input.baseDocumentRevision` 与当前 `documentStateBuilder.documentRevision` 一致(revision 冲突检测)
 * 4. 校验目标块前置条件(块存在性)
 * 5. 成功:调用 `editor.insertBlocks/updateBlock/removeBlocks/replaceBlocks`,返回 `{ ok: true, currentDocumentRevision }`
 * 6. 冲突:不调用 editor API,返回 `ConflictResult`
 *
 * `getDocumentSnapshot` 受 `maxBlocks`/`maxTokens` 约束,返回截断后的快照。
 */
export async function executeClientTool(
  toolName: ChatToolName,
  input: unknown,
  ctx: ExecuteClientToolContext,
): Promise<ExecuteToolResult> {
  switch (toolName) {
    case 'insertBlock':
      return executeInsertBlock(input, ctx)
    case 'updateBlock':
      return executeUpdateBlock(input, ctx)
    case 'deleteBlock':
      return executeDeleteBlock(input, ctx)
    case 'replaceBlocks':
      return executeReplaceBlocks(input, ctx)
    case 'moveBlock':
      return executeMoveBlock(input, ctx)
    case 'getDocumentSnapshot':
      return executeGetDocumentSnapshot(input, ctx)
    default: {
      // 不应该到达这里(服务端只声明 6 个 tools)
      const _exhaustive: never = toolName
      void _exhaustive
      return makeConflict('precondition-failed', `Unknown tool: ${String(toolName)}`, ctx)
    }
  }
}

function getCurrentRevision(ctx: ExecuteClientToolContext): number {
  return ctx.documentStateBuilder.documentRevision
}

function makeConflict(
  reason: 'revision-mismatch' | 'precondition-failed',
  message: string,
  ctx: ExecuteClientToolContext,
  operation?: unknown,
): ConflictResult {
  return {
    kind: 'conflict',
    reason,
    currentDocumentRevision: getCurrentRevision(ctx),
    operation: operation ?? { type: 'unknown' },
    message,
  } as unknown as ConflictResult
}

function blockExists(targetBlockId: string, ctx: ExecuteClientToolContext): boolean {
  try {
    return ctx.editor.getBlock(targetBlockId as BlockIdentifier) !== undefined
  } catch {
    return false
  }
}

async function executeInsertBlock(
  input: unknown,
  ctx: ExecuteClientToolContext,
): Promise<ExecuteToolResult> {
  const parsed = insertBlockToolInputSchema.parse(input)
  const currentRevision = getCurrentRevision(ctx)
  if (parsed.baseDocumentRevision !== currentRevision) {
    return makeConflict(
      'revision-mismatch',
      `Revision mismatch: expected ${parsed.baseDocumentRevision}, current ${currentRevision}`,
      ctx,
      { type: 'insertBlock', ...parsed },
    )
  }
  if (!blockExists(parsed.referenceBlockId, ctx)) {
    return makeConflict(
      'precondition-failed',
      `Reference block ${parsed.referenceBlockId} not found`,
      ctx,
      { type: 'insertBlock', ...parsed },
    )
  }
  ctx.editor.insertBlocks(
    [parsed.block],
    parsed.referenceBlockId as BlockIdentifier,
    parsed.position,
  )
  return { ok: true, currentDocumentRevision: getCurrentRevision(ctx) }
}

async function executeUpdateBlock(
  input: unknown,
  ctx: ExecuteClientToolContext,
): Promise<ExecuteToolResult> {
  const parsed = updateBlockToolInputSchema.parse(input)
  const currentRevision = getCurrentRevision(ctx)
  if (parsed.baseDocumentRevision !== currentRevision) {
    return makeConflict('revision-mismatch', `Revision mismatch`, ctx, { type: 'updateBlock', ...parsed })
  }
  if (!blockExists(parsed.targetBlockId, ctx)) {
    return makeConflict('precondition-failed', `Target block ${parsed.targetBlockId} not found`, ctx, { type: 'updateBlock', ...parsed })
  }
  ctx.editor.updateBlock(parsed.targetBlockId as BlockIdentifier, parsed.block)
  return { ok: true, currentDocumentRevision: getCurrentRevision(ctx) }
}

async function executeDeleteBlock(
  input: unknown,
  ctx: ExecuteClientToolContext,
): Promise<ExecuteToolResult> {
  const parsed = deleteBlockToolInputSchema.parse(input)
  const currentRevision = getCurrentRevision(ctx)
  if (parsed.baseDocumentRevision !== currentRevision) {
    return makeConflict('revision-mismatch', `Revision mismatch`, ctx, { type: 'deleteBlock', ...parsed })
  }
  if (!blockExists(parsed.targetBlockId, ctx)) {
    return makeConflict('precondition-failed', `Target block ${parsed.targetBlockId} not found`, ctx, { type: 'deleteBlock', ...parsed })
  }
  ctx.editor.removeBlocks([parsed.targetBlockId as BlockIdentifier])
  return { ok: true, currentDocumentRevision: getCurrentRevision(ctx) }
}

async function executeReplaceBlocks(
  input: unknown,
  ctx: ExecuteClientToolContext,
): Promise<ExecuteToolResult> {
  const parsed = replaceBlocksToolInputSchema.parse(input)
  const currentRevision = getCurrentRevision(ctx)
  if (parsed.baseDocumentRevision !== currentRevision) {
    return makeConflict('revision-mismatch', `Revision mismatch`, ctx, { type: 'replaceBlocks', ...parsed })
  }
  for (const id of parsed.targetBlockIds) {
    if (!blockExists(id, ctx)) {
      return makeConflict('precondition-failed', `Target block ${id} not found`, ctx, { type: 'replaceBlocks', ...parsed })
    }
  }
  ctx.editor.replaceBlocks(
    parsed.targetBlockIds as BlockIdentifier[],
    parsed.blocks,
  )
  return { ok: true, currentDocumentRevision: getCurrentRevision(ctx) }
}

async function executeMoveBlock(
  input: unknown,
  ctx: ExecuteClientToolContext,
): Promise<ExecuteToolResult> {
  const parsed = moveBlockToolInputSchema.parse(input)
  const currentRevision = getCurrentRevision(ctx)
  if (parsed.baseDocumentRevision !== currentRevision) {
    return makeConflict('revision-mismatch', `Revision mismatch`, ctx, { type: 'moveBlock', ...parsed })
  }
  if (!blockExists(parsed.targetBlockId, ctx)) {
    return makeConflict('precondition-failed', `Target block ${parsed.targetBlockId} not found`, ctx, { type: 'moveBlock', ...parsed })
  }
  if (!blockExists(parsed.referenceBlockId, ctx)) {
    return makeConflict('precondition-failed', `Reference block ${parsed.referenceBlockId} not found`, ctx, { type: 'moveBlock', ...parsed })
  }
  // BlockNote 0.51.4 不直接支持 moveBlockTo;用 replaceBlocks 等价实现:
  // 1. 取出 targetBlock 当前内容
  // 2. 在 referenceBlockId 的 position 处插入新块
  // 3. 删除原 targetBlock
  const targetBlock = ctx.editor.getBlock(parsed.targetBlockId as BlockIdentifier)
  if (!targetBlock) {
    return makeConflict('precondition-failed', `Target block ${parsed.targetBlockId} disappeared`, ctx, { type: 'moveBlock', ...parsed })
  }
  ctx.editor.insertBlocks([targetBlock], parsed.referenceBlockId as BlockIdentifier, parsed.position)
  ctx.editor.removeBlocks([parsed.targetBlockId as BlockIdentifier])
  return { ok: true, currentDocumentRevision: getCurrentRevision(ctx) }
}

async function executeGetDocumentSnapshot(
  input: unknown,
  ctx: ExecuteClientToolContext,
): Promise<ExecuteToolResult | { ok: true; currentDocumentRevision: number; snapshot: { blocks: unknown[]; fromBlock?: string; includedBlocks: number; truncated: boolean } }> {
  const parsed = getDocumentSnapshotToolInputSchema.parse(input)
  // 冗余校验:服务端按 contextMode 过滤,客户端再次确认
  if (ctx.contextMode !== 'full' || !ctx.allowSnapshotTool) {
    return makeConflict(
      'precondition-failed',
      `getDocumentSnapshot not allowed in contextMode=${ctx.contextMode}, allowSnapshotTool=${ctx.allowSnapshotTool}`,
      ctx,
    )
  }
  const maxBlocks = Math.min(parsed.maxBlocks ?? DEFAULT_MAX_BLOCKS, DEFAULT_MAX_BLOCKS)
  const maxTokens = Math.min(parsed.maxTokens ?? DEFAULT_MAX_TOKENS, DEFAULT_MAX_TOKENS)

  const allBlocks = ctx.editor.document
  let startIndex = 0
  if (parsed.fromBlock) {
    const idx = allBlocks.findIndex((b) => b.id === parsed.fromBlock)
    if (idx === -1) {
      return makeConflict('precondition-failed', `fromBlock ${parsed.fromBlock} not found`, ctx)
    }
    startIndex = idx
  }
  const included: unknown[] = []
  let tokenCount = 0
  let truncated = false
  for (let i = startIndex; i < allBlocks.length; i++) {
    if (included.length >= maxBlocks) {
      truncated = true
      break
    }
    const block = allBlocks[i]
    const blockText = JSON.stringify(block)
    const blockTokens = Math.ceil(blockText.length / 4)
    if (tokenCount + blockTokens > maxTokens) {
      truncated = true
      break
    }
    included.push(block)
    tokenCount += blockTokens
  }
  return {
    ok: true,
    currentDocumentRevision: getCurrentRevision(ctx),
    snapshot: {
      blocks: included,
      fromBlock: parsed.fromBlock,
      includedBlocks: included.length,
      truncated,
    },
  }
}
