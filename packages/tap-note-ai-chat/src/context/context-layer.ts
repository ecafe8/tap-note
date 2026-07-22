import type { BlockNoteEditor } from '@blocknote/core'
import {
  layerContext,
  type DocumentState,
  type DocumentStateBuilder,
  type LayeredContext,
  type LayerContextOptions,
  type SelectionSnapshot,
} from '@tap-note/ai-core'

/**
 * 自动检测上下文范围并构建 documentState。
 *
 * - 有选区快照(或实时选区)→ `selection` scope
 * - 无选区 → `full` scope(受 token 预算截断)
 */
export function buildDocumentState(
  _editor: BlockNoteEditor,
  documentStateBuilder: DocumentStateBuilder,
  selection?: SelectionSnapshot,
): DocumentState {
  const hasSelection = selection && selection.blocks.length > 0
  if (hasSelection) {
    return documentStateBuilder.build({ scope: 'selection', selection })
  }
  return documentStateBuilder.build({ scope: 'full' })
}

/**
 * 对 documentState 执行 token 预算分层(选区 4K / 全文 8K)。
 */
export function chatLayerContext(
  documentState: DocumentState,
  options: LayerContextOptions = {},
): LayeredContext {
  return layerContext(documentState, options)
}

/**
 * 根据 `LayeredContext.kind` 返回提示文案 key。
 *
 * - `selection-blocked` → `selectionBlocked`
 * - `truncated` → `documentTruncated`
 * - `outline` → `outlineMode`
 * - `full` → 不显示(预算内)
 */
export type ContextHintKey =
  | 'selectionBlocked'
  | 'documentTruncated'
  | 'outlineMode'
  | null

export function getContextHintKey(layered: LayeredContext): ContextHintKey {
  if (layered.kind === 'selection-blocked') return 'selectionBlocked'
  if (layered.kind === 'truncated') return 'documentTruncated'
  if (layered.kind === 'outline') return 'outlineMode'
  return null
}
