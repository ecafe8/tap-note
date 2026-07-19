import type { BlockNoteEditor, PartialBlock } from '@blocknote/core'
import {
  insertBlocks,
  getNodeById,
  nodeToBlock,
  removeAndInsertBlocks,
  updateBlock,
} from '@blocknote/core'
import {
  applySuggestions,
  revertSuggestions,
  transformToSuggestionTransaction,
} from '@handlewithcare/prosemirror-suggest-changes'
import type { Transaction } from 'prosemirror-state'
import type { BlockOperation, ConflictResult } from './types/type'
import { blockOperationSchema } from './types/schema'

/**
 * 应用模式。
 * - `"suggest"`:创建建议事务(可后续接受/拒绝)
 * - `"apply"`:接受全部建议事务,合并到正式文档
 * - `"revert"`:回退全部建议事务
 */
export type ApplyMode = 'suggest' | 'apply' | 'revert'

/**
 * `applyOperationsToEditor` 选项。
 */
export interface ApplyOperationsOptions {
  /** 应用模式。 */
  mode: ApplyMode
  /**
   * 当前编辑器 revision,用于 revision 冲突检测。
   * 通常由 `DocumentStateBuilder.documentRevision` 提供。
   * 若不提供则跳过 revision 冲突检测。
   */
  currentDocumentRevision?: number
}

/**
 * 应用结果。成功返回 `void`,冲突返回 `ConflictResult`。
 */
export type ApplyOperationsResult = void | ConflictResult

/**
 * 经 `@handlewithcare/prosemirror-suggest-changes` 可回退应用 `BlockOperation[]` 到编辑器。
 *
 * - `mode: "suggest"`:把 operations 转换为 Prosemirror transaction,再经
 *   `transformToSuggestionTransaction` 转为建议事务并 dispatch。用户后续编辑走正常
 *   事务,不带建议标记,因此 `revertSuggestions` 只回退 AI 建议,不覆盖人工编辑。
 * - `mode: "apply"`:调用 `applySuggestions(state, dispatch)` 合并建议到正式文档。
 * - `mode: "revert"`:调用 `revertSuggestions(state, dispatch)` 回退建议事务。
 *
 * revision 冲突:若 `options.currentDocumentRevision` 提供且任一操作的
 * `baseDocumentRevision` 不匹配,返回 `ConflictResult`,不执行任何操作,不污染文档。
 *
 * 前置条件检查:目标块 ID 不存在时返回 `ConflictResult`,不执行。
 *
 * 假设:suggest-changes 插件(`suggestChanges()`)已由调用方(FEAT-003/004)通过
 * BlockNote 扩展系统安装到编辑器。
 */
export function applyOperationsToEditor(
  editor: BlockNoteEditor,
  operations: BlockOperation[],
  options: ApplyOperationsOptions,
): ApplyOperationsResult {
  // 用 Zod 校验 operations 形状,非法抛 ZodError
  for (const op of operations) {
    blockOperationSchema.parse(op)
  }

  if (options.mode === 'apply') {
    applySuggestionsToEditor(editor)
    return
  }
  if (options.mode === 'revert') {
    revertSuggestionsFromEditor(editor)
    return
  }
  // mode: "suggest"
  return suggestOperationsToEditor(editor, operations, options.currentDocumentRevision)
}

function applySuggestionsToEditor(editor: BlockNoteEditor): void {
  editor.exec((state, dispatch) => applySuggestions(state, dispatch))
}

function revertSuggestionsFromEditor(editor: BlockNoteEditor): void {
  editor.exec((state, dispatch) => revertSuggestions(state, dispatch))
}

function suggestOperationsToEditor(
  editor: BlockNoteEditor,
  operations: BlockOperation[],
  currentDocumentRevision?: number,
): ApplyOperationsResult {
  // revision 冲突检测:比对每个操作的 baseDocumentRevision 与当前 revision
  if (currentDocumentRevision !== undefined) {
    for (const op of operations) {
      if (op.baseDocumentRevision !== currentDocumentRevision) {
        const conflict: ConflictResult = {
          kind: 'conflict',
          reason: 'revision-mismatch',
          currentDocumentRevision,
          operation: op,
          message: 'document revision mismatch, please refresh and retry',
        }
        return conflict
      }
    }
  }

  // 前置条件检查:目标块 ID 存在
  const preconditionConflict = checkPreconditions(editor, operations)
  if (preconditionConflict) {
    console.warn('[ai-core] precondition conflict', preconditionConflict)
    return preconditionConflict
  }

  // 构建事务,转换为建议事务,dispatch
  let dispatched = false
  editor.exec((state, dispatch) => {
    if (!dispatch) {
      console.warn('[ai-core] editor.exec has no dispatch')
      return false
    }
    const tr = state.tr
    try {
      applyOperationsToTransaction(tr, editor, operations)
    } catch {
      // 步骤应用失败(如目标块不存在),不 dispatch
      return false
    }
    const suggestionTr = transformToSuggestionTransaction(tr, state)
    dispatch(suggestionTr)
    dispatched = true
    console.log('[ai-core] suggestion transaction dispatched', {
      operations: operations.length,
      steps: suggestionTr.steps.length,
    })
    return true
  })
  if (!dispatched) {
    console.warn('[ai-core] no suggestion transaction dispatched')
  }
  return
}

function checkPreconditions(
  editor: BlockNoteEditor,
  operations: BlockOperation[],
): ConflictResult | undefined {
  for (const op of operations) {
    const missing = collectTargetIds(op).filter(
      (id) => !getNodeById(id, editor.prosemirrorState.doc),
    )
    if (missing.length > 0) {
      return {
        kind: 'conflict',
        reason: 'precondition-failed',
        currentDocumentRevision: 0,
        operation: op,
        message: `target block(s) not found: ${missing.join(', ')}`,
      }
    }
  }
  return undefined
}

function collectTargetIds(op: BlockOperation): string[] {
  switch (op.type) {
    case 'insertBlock':
      return op.referenceBlockId ? [op.referenceBlockId] : []
    case 'updateBlock':
      return [op.targetBlockId]
    case 'deleteBlock':
      return [op.targetBlockId]
    case 'replaceBlocks':
      return op.targetBlockIds
    case 'moveBlock':
      return [op.targetBlockId, op.referenceBlockId]
  }
}

function applyOperationsToTransaction(
  tr: Transaction,
  editor: BlockNoteEditor,
  operations: BlockOperation[],
): void {
  for (const op of operations) {
    applyOperationToTransaction(tr, editor, op)
  }
}

function applyOperationToTransaction(
  tr: Transaction,
  editor: BlockNoteEditor,
  op: BlockOperation,
): void {
  switch (op.type) {
    case 'insertBlock':
      insertBlocks(
        tr,
        [op.block] as PartialBlock[],
        op.referenceBlockId ?? getFirstBlockId(editor),
        op.position,
      )
      return
    case 'updateBlock':
      updateBlock(tr, op.targetBlockId, op.block as PartialBlock)
      return
    case 'deleteBlock':
      removeAndInsertBlocks(tr, [op.targetBlockId], [])
      return
    case 'replaceBlocks':
      removeAndInsertBlocks(
        tr,
        op.targetBlockIds,
        op.blocks as PartialBlock[],
      )
      return
    case 'moveBlock': {
      // BlockNote 没有直接 moveBlockTo(reference, position) API,
      // 用 getNodeById + nodeToBlock 复制块内容,然后 remove + insert 到新位置
      const targetInfo = getNodeById(op.targetBlockId, tr.doc)
      if (!targetInfo) {
        throw new Error(`moveBlock: target block ${op.targetBlockId} not found`)
      }
      const pmSchema = editor.prosemirrorState.schema
      const movedBlock = nodeToBlock(targetInfo.node, pmSchema) as PartialBlock
      // 删除原位置
      removeAndInsertBlocks(tr, [op.targetBlockId], [])
      // 在新位置插入(保留原 ID)
      insertBlocks(tr, [movedBlock], op.referenceBlockId, op.position)
      return
    }
  }
}

function getFirstBlockId(editor: BlockNoteEditor): string {
  const firstBlock = editor.document[0]
  if (!firstBlock?.id) {
    throw new Error('editor document is empty, cannot insert without referenceBlockId')
  }
  return firstBlock.id
}
