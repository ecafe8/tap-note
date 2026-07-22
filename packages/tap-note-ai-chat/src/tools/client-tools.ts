import type { BlockNoteEditor, BlockIdentifier } from '@blocknote/core'
import type { ConflictResult } from '@tap-note/ai-core'
import type { DocumentStateBuilder } from '@tap-note/ai-core'
import { stripBlockIdSuffix, applyReplaceTextToEditor, searchDocument } from '@tap-note/ai-core'
import {
  insertBlockToolInputSchema,
  updateBlockToolInputSchema,
  deleteBlockToolInputSchema,
  replaceBlocksToolInputSchema,
  moveBlockToolInputSchema,
  replaceTextToolInputSchema,
  searchDocumentToolInputSchema,
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
 * 5. 成功:调用 editor API(进入 BlockNote API 前统一剥离 `$` 后缀),返回携带操作类型与最新
 *    revision 的 `ToolSuccessResult`(targetBlockId 保留 `$`,供回显模型与 UI 展示)
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
    case 'replaceText':
      return executeReplaceText(input, ctx)
    case 'searchDocument':
      return executeSearchDocument(input, ctx)
    case 'getDocumentSnapshot':
      return executeGetDocumentSnapshot(input, ctx)
    default: {
      // 不应该到达这里(服务端只声明 8 个 tools)
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

/** 校验目标块存在(进入 BlockNote API 前剥离 `$` 后缀)。 */
function blockExists(targetBlockId: string, ctx: ExecuteClientToolContext): boolean {
  try {
    return ctx.editor.getBlock(stripBlockIdSuffix(targetBlockId) as BlockIdentifier) !== undefined
  } catch {
    return false
  }
}

function getTopLevelDocumentOrder(ctx: ExecuteClientToolContext): string[] {
  return ctx.editor.document
    .map((block) => block.id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
    .map(toProtocolBlockId)
}

function toProtocolBlockId(id: string): string {
  return id.endsWith('$') ? id : `${id}$`
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
  const documentOrderBeforeInsert = getTopLevelDocumentOrder(ctx)
  const resolvedReferenceBlockId = parsed.appendToDocument
    ? documentOrderBeforeInsert.at(-1)
    : parsed.referenceBlockId
  if (!resolvedReferenceBlockId) {
    return makeConflict('precondition-failed', 'Cannot append to an empty document', ctx, { type: 'insertBlock', ...parsed })
  }
  if (!blockExists(resolvedReferenceBlockId, ctx)) {
    return makeConflict(
      'precondition-failed',
      `Reference block ${resolvedReferenceBlockId} not found`,
      ctx,
      { type: 'insertBlock', ...parsed, referenceBlockId: resolvedReferenceBlockId },
    )
  }
  const insertedBlocks = ctx.editor.insertBlocks(
    [parsed.block],
    stripBlockIdSuffix(resolvedReferenceBlockId) as BlockIdentifier,
    parsed.position,
  ) as unknown as Array<{ id?: string }>
  return {
    ok: true,
    toolName: 'insertBlock',
    currentDocumentRevision: getCurrentRevision(ctx),
    targetBlockId: parsed.appendToDocument ? toProtocolBlockId(resolvedReferenceBlockId) : resolvedReferenceBlockId,
    referenceBlockId: parsed.appendToDocument ? toProtocolBlockId(resolvedReferenceBlockId) : resolvedReferenceBlockId,
    position: parsed.position,
    documentOrder: getTopLevelDocumentOrder(ctx),
    insertedBlockIds: insertedBlocks
      .map((block) => block?.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
      .map(toProtocolBlockId),
  }
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
  ctx.editor.updateBlock(stripBlockIdSuffix(parsed.targetBlockId) as BlockIdentifier, parsed.block)
  return {
    ok: true,
    toolName: 'updateBlock',
    currentDocumentRevision: getCurrentRevision(ctx),
    targetBlockId: parsed.targetBlockId,
  }
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
  ctx.editor.removeBlocks([stripBlockIdSuffix(parsed.targetBlockId) as BlockIdentifier])
  return {
    ok: true,
    toolName: 'deleteBlock',
    currentDocumentRevision: getCurrentRevision(ctx),
    targetBlockId: parsed.targetBlockId,
  }
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
    parsed.targetBlockIds.map((id) => stripBlockIdSuffix(id) as BlockIdentifier),
    parsed.blocks,
  )
  return {
    ok: true,
    toolName: 'replaceBlocks',
    currentDocumentRevision: getCurrentRevision(ctx),
    targetBlockId: parsed.targetBlockIds[0],
  }
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
  // BlockNote 0.51.4 不直接支持 moveBlockTo;用 insert + remove 等价实现:
  // 1. 取出 targetBlock 当前内容
  // 2. 在 referenceBlockId 的 position 处插入新块
  // 3. 删除原 targetBlock
  const strippedTargetId = stripBlockIdSuffix(parsed.targetBlockId)
  const targetBlock = ctx.editor.getBlock(strippedTargetId as BlockIdentifier)
  if (!targetBlock) {
    return makeConflict('precondition-failed', `Target block ${parsed.targetBlockId} disappeared`, ctx, { type: 'moveBlock', ...parsed })
  }
  ctx.editor.insertBlocks([targetBlock], stripBlockIdSuffix(parsed.referenceBlockId) as BlockIdentifier, parsed.position)
  ctx.editor.removeBlocks([strippedTargetId as BlockIdentifier])
  return {
    ok: true,
    toolName: 'moveBlock',
    currentDocumentRevision: getCurrentRevision(ctx),
    targetBlockId: parsed.targetBlockId,
  }
}

async function executeReplaceText(
  input: unknown,
  ctx: ExecuteClientToolContext,
): Promise<ExecuteToolResult> {
  const parsed = replaceTextToolInputSchema.parse(input)
  const currentRevision = getCurrentRevision(ctx)
  // 复用 ai-core 单一执行器:内部完成 revision/目标块/range/expectedText 校验与单事务替换。
  const result = applyReplaceTextToEditor(
    ctx.editor,
    {
      type: 'replaceText',
      baseDocumentRevision: parsed.baseDocumentRevision,
      targetBlockId: parsed.targetBlockId,
      from: parsed.from,
      to: parsed.to,
      expectedText: parsed.expectedText,
      replacement: parsed.replacement,
    },
    currentRevision,
  )
  if ('ok' in result) {
    return {
      ok: true,
      toolName: 'replaceText',
      currentDocumentRevision: getCurrentRevision(ctx),
      targetBlockId: parsed.targetBlockId,
      replacedText: result.replacedText,
    }
  }
  return result
}

async function executeSearchDocument(
  input: unknown,
  ctx: ExecuteClientToolContext,
): Promise<ExecuteToolResult> {
  const parsed = searchDocumentToolInputSchema.parse(input)
  // 复用 ai-core 搜索执行器:只读,文本基准与 replaceText 一致,偏移可直接用于后续替换。
  const result = searchDocument(ctx.editor, {
    query: parsed.query,
    isRegex: parsed.isRegex,
    caseSensitive: parsed.caseSensitive,
    maxResults: parsed.maxResults,
  })
  return {
    ok: true,
    toolName: 'searchDocument',
    currentDocumentRevision: getCurrentRevision(ctx),
    matches: result.matches,
    truncated: result.truncated,
  }
}

async function executeGetDocumentSnapshot(
  input: unknown,
  ctx: ExecuteClientToolContext,
): Promise<ExecuteToolResult | { ok: true; toolName: ChatToolName; currentDocumentRevision: number; snapshot: { blocks: unknown[]; fromBlock?: string; includedBlocks: number; truncated: boolean } }> {
  const parsed = getDocumentSnapshotToolInputSchema.parse(input)
  // 冗余校验:集成方可通过 allowSnapshotTool 禁用此工具
  if (!ctx.allowSnapshotTool) {
    return makeConflict(
      'precondition-failed',
      `getDocumentSnapshot not allowed (allowSnapshotTool=false)`,
      ctx,
    )
  }
  const maxBlocks = Math.min(parsed.maxBlocks ?? DEFAULT_MAX_BLOCKS, DEFAULT_MAX_BLOCKS)
  const maxTokens = Math.min(parsed.maxTokens ?? DEFAULT_MAX_TOKENS, DEFAULT_MAX_TOKENS)

  const allBlocks = ctx.editor.document
  let startIndex = 0
  if (parsed.fromBlock) {
    // fromBlock 可能带 `$` 后缀,剥离后与真实 block id 比较
    const fromId = stripBlockIdSuffix(parsed.fromBlock)
    const idx = allBlocks.findIndex((b) => b.id === fromId)
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
    toolName: 'getDocumentSnapshot',
    currentDocumentRevision: getCurrentRevision(ctx),
    snapshot: {
      blocks: included,
      fromBlock: parsed.fromBlock,
      includedBlocks: included.length,
      truncated,
    },
  }
}
