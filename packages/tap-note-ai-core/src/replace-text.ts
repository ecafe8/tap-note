import { type BlockNoteEditor } from '@blocknote/core'
import type { Node as ProsemirrorNode } from 'prosemirror-model'
import type { Transaction } from 'prosemirror-state'
import type { BlockOperation, ConflictResult } from './types/type'
import { stripBlockIdSuffix } from './block-id'
import { getBlockContentInfo } from './block-text'

/**
 * `replaceText` 操作类型(从 `BlockOperation` 联合中抽取)。
 */
export type ReplaceTextOperation = Extract<BlockOperation, { type: 'replaceText' }>

/**
 * 解析后的替换位置(绝对 ProseMirror position)与被替换的原文。
 */
export interface ResolvedReplaceText {
  fromPos: number
  toPos: number
  replacedText: string
}

export type ResolveReplaceTextResult = ResolvedReplaceText | ConflictResult

/**
 * `applyReplaceTextToEditor` 成功结果。
 */
export interface ReplaceTextSuccess {
  ok: true
  replacedText: string
  currentDocumentRevision: number
}

export type ApplyReplaceTextResult = ReplaceTextSuccess | ConflictResult

function makeConflict(
  reason: 'revision-mismatch' | 'precondition-failed',
  message: string,
  op: ReplaceTextOperation,
  currentDocumentRevision: number,
): ConflictResult {
  return {
    kind: 'conflict',
    reason,
    currentDocumentRevision,
    operation: op,
    message,
  }
}

function isConflict(r: ResolveReplaceTextResult): r is ConflictResult {
  return (r as ConflictResult).kind === 'conflict'
}

/**
 * 解析 `node` 内容(起点为绝对 position `contentStart`)中第 `offset` 个文本字符的
 * 绝对 position。按文档序遍历,文本计数与 `node.textContent` 一致。
 *
 * - 文本节点:text 占据 `[childStart, childStart + len)`,`rest <= len` 时命中。
 * - 父节点(如 link):下钻到其内容(`childStart + 1`)。
 * - 非文本叶子(image/mention):计 0 文本,跳过其 position。
 */
function posForOffset(node: ProsemirrorNode, contentStart: number, offset: number): number | undefined {
  if (offset === 0) {
    return contentStart
  }
  let rest = offset
  let result: number | undefined
  node.forEach((child, childOffset) => {
    if (result !== undefined) {
      return
    }
    const childStart = contentStart + childOffset
    if (child.isText) {
      const len = child.text?.length ?? 0
      if (rest <= len) {
        result = childStart + rest
      } else {
        rest -= len
      }
    } else if (!child.isLeaf) {
      const inner = posForOffset(child, childStart + 1, rest)
      if (inner !== undefined) {
        result = inner
      } else {
        rest -= child.textContent.length
      }
    }
  })
  if (result !== undefined) {
    return result
  }
  if (rest === 0) {
    return contentStart + node.content.size
  }
  return undefined
}

/**
 * 校验并解析 `replaceText` 操作:目标块存在、range 合法、`expectedText` 与当前
 * `[from, to)` 文本一致(compare-and-swap)。任一失败返回 `ConflictResult`,不修改文档。
 *
 * 坐标协议:`from`/`to` 为目标块拼接纯文本(`blockContent.textContent`)上的零基
 * offset(含 from 不含 to)。block 的 inline 文本起点为 `posBeforeNode + 2`
 * (blockContainer 开合 + blockContent 开合各 +1,经实测验证)。
 */
export function resolveReplaceText(
  doc: ProsemirrorNode,
  op: ReplaceTextOperation,
  currentDocumentRevision: number,
): ResolveReplaceTextResult {
  const blockId = stripBlockIdSuffix(op.targetBlockId)
  const contentInfo = getBlockContentInfo(doc, blockId)
  if (!contentInfo) {
    return makeConflict('precondition-failed', `target block ${blockId} not found or has no content`, op, currentDocumentRevision)
  }
  const { blockContent, text } = contentInfo
  if (op.from < 0 || op.to > text.length || op.from >= op.to) {
    return makeConflict(
      'precondition-failed',
      `invalid range [${op.from}, ${op.to}) for text length ${text.length}`,
      op,
      currentDocumentRevision,
    )
  }
  const actual = text.slice(op.from, op.to)
  if (actual !== op.expectedText) {
    return makeConflict(
      'precondition-failed',
      `expectedText mismatch: expected "${op.expectedText}", found "${actual}"`,
      op,
      currentDocumentRevision,
    )
  }
  const contentStart = contentInfo.posBeforeNode + 2
  const fromPos = posForOffset(blockContent, contentStart, op.from)
  const toPos = posForOffset(blockContent, contentStart, op.to)
  if (fromPos === undefined || toPos === undefined) {
    return makeConflict('precondition-failed', 'could not resolve text positions', op, currentDocumentRevision)
  }
  return { fromPos, toPos, replacedText: actual }
}

function applyReplaceToTransaction(
  tr: Transaction,
  resolved: ResolvedReplaceText,
  replacement: string,
): void {
  // 从 transaction 的 doc 取 schema,避免在 editor.transact 内访问 editor.prosemirrorState
  // (transact 期间访问 prosemirrorState 会抛错)。
  const schema = tr.doc.type.schema
  if (replacement === '') {
    tr.delete(resolved.fromPos, resolved.toPos)
  } else {
    tr.replaceWith(resolved.fromPos, resolved.toPos, schema.text(replacement))
  }
}

/**
 * inline(suggest)路径:在给定的 transaction 内应用 `replaceText`。
 * 校验失败时抛 `Error`,由调用方拒绝整个操作批次(不 dispatch)。
 * revision 冲突由调用方(`applyOperationsToEditor`)在执行前统一检测。
 */
export function applyReplaceTextToTransaction(
  tr: Transaction,
  op: ReplaceTextOperation,
): void {
  const resolved = resolveReplaceText(tr.doc, op, 0)
  if (isConflict(resolved)) {
    throw new Error(resolved.message)
  }
  applyReplaceToTransaction(tr, resolved, op.replacement)
}

/**
 * chat 路径:直接对 editor 应用 `replaceText`(非 suggest),返回真实结果。
 *
 * 使用 `editor.transact`(而非 `editor.exec`):transact 会自动 dispatch 并正确刷新
 * BlockNote 的 `editor.document` 缓存,确保 UI 能读到替换后的内容;`editor.exec` 的
 * 原始 dispatch 不会刷新 `editor.document`,会导致「状态已改但 UI 不变」。
 *
 * 先做 revision 冲突检测,再 resolve + 单事务替换;任一失败返回 `ConflictResult`,
 * 不修改文档。成功返回 `{ ok: true, replacedText, currentDocumentRevision }`。
 */
export function applyReplaceTextToEditor(
  editor: BlockNoteEditor,
  op: ReplaceTextOperation,
  currentDocumentRevision: number,
): ApplyReplaceTextResult {
  if (op.baseDocumentRevision !== currentDocumentRevision) {
    return makeConflict(
      'revision-mismatch',
      `Revision mismatch: expected ${op.baseDocumentRevision}, current ${currentDocumentRevision}`,
      op,
      currentDocumentRevision,
    )
  }
  const resolved = resolveReplaceText(editor.prosemirrorState.doc, op, currentDocumentRevision)
  if (isConflict(resolved)) {
    return resolved
  }
  try {
    editor.transact((tr) => {
      applyReplaceToTransaction(tr, resolved, op.replacement)
    })
  } catch (err) {
    return makeConflict(
      'precondition-failed',
      `replace text failed: ${err instanceof Error ? err.message : String(err)}`,
      op,
      currentDocumentRevision,
    )
  }
  return { ok: true, replacedText: resolved.replacedText, currentDocumentRevision }
}
