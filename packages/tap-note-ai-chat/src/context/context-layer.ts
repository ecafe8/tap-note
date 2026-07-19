import type { BlockNoteEditor } from '@blocknote/core'
import {
  layerContext,
  type DocumentState,
  type DocumentStateBuilder,
  type LayeredContext,
  type LayerContextOptions,
} from '@tap-note/ai-core'
import type { ContextMode } from './context-mode'

/**
 * Chat 上下文分层结果。`none` 模式不发 documentState。
 */
export type ChatLayeredContext =
  | { mode: 'none'; documentState: undefined }
  | { mode: 'selection' | 'full'; layered: LayeredContext }

/**
 * Chat 版上下文分层。复用 ai-core `layerContext`,按 `ContextMode` 分发:
 *
 * - `none` — 直接返回 `{ mode: 'none', documentState: undefined }`,不调 `layerContext`
 * - `selection` — 调 `layerContext(state, { selectionBudget: 4096 })`,
 *   选区超 4K 返回 `selection-blocked`(由 UI 拦截发送)
 * - `full` — 调 `layerContext(state, { fullBudget: 8192, threshold: 2 })`,
 *   返回 `full`/`truncated`/`outline`
 *
 * 调用方应在发送前检查 `selection-blocked` 并置灰发送按钮。
 */
export function chatLayerContext(
  documentState: DocumentState | undefined,
  mode: ContextMode,
  options: LayerContextOptions = {},
): ChatLayeredContext {
  if (mode === 'none' || documentState === undefined) {
    return { mode: 'none', documentState: undefined }
  }
  const layered = layerContext(documentState, options)
  return { mode, layered }
}

/**
 * 根据 `ContextMode` 构建 documentState。
 *
 * - `selection` — 用 `documentStateBuilder.build({ scope: 'selection' })` 取当前选区
 * - `full` — 用 `documentStateBuilder.build({ scope: 'full' })` 取全文
 * - `none` — 返回 `undefined`(不发送)
 *
 * 调用方应在 `sendMessage` 前调用此函数,把结果与 `documentRevision` 一起通过
 * `sendMessage(message, { body: { documentState, documentRevision, contextMode } })` 注入。
 */
export function buildDocumentState(
  _editor: BlockNoteEditor,
  mode: ContextMode,
  documentStateBuilder: DocumentStateBuilder,
): DocumentState | undefined {
  if (mode === 'none') return undefined
  // DocumentStateBuilder 已在创建时配置 scope,这里只调 build() 复用
  return documentStateBuilder.build()
}

/**
 * 根据 `ChatLayeredContext.kind` 返回提示文案 key(对应 AICoreDictionary 字段名)。
 *
 * UI 层(ContextSelector 下方提示行)用此判断显示哪条提示:
 * - `selection-blocked` → `selectionBlocked`
 * - `truncated` → `documentTruncated`(并填入 total/included)
 * - `outline` → `outlineMode`
 * - `full` → 不显示(预算内)
 */
export type ContextHintKey =
  | 'selectionBlocked'
  | 'documentTruncated'
  | 'outlineMode'
  | null

export function getContextHintKey(layered: ChatLayeredContext): ContextHintKey {
  if (layered.mode === 'none') return null
  if (layered.layered.kind === 'selection-blocked') return 'selectionBlocked'
  if (layered.layered.kind === 'truncated') return 'documentTruncated'
  if (layered.layered.kind === 'outline') return 'outlineMode'
  return null
}
