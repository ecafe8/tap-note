/**
 * @packageDocumentation @tap-note/ai-inline
 *
 * 编辑器内联 AI 助手。`/ai` 唤起 AIMenu 输入指令,流式 BlockOperation 逐块写入,
 * 接受/拒绝/中止/重试。
 *
 * 复用 ai-core 的 schema/DocumentStateBuilder/applier/busy/transport/layerContext。
 * 消费 FEAT-005 `/api/ai/editor/streamText` 端点(用 transport.sendMessages)。
 * 不引入 `@blocknote/xl-ai`(GPL),仅参考思路自行重写。
 *
 * 最小接入:
 * ```tsx
 * const inlineAssistant = createTapNoteInlineAssistant({
 *   transport: createServerTransport({ baseUrl, model, getAuthHeaders }),
 *   aiBusyState: busy,
 * })
 * <TapNoteEditor inlineAssistant={inlineAssistant} aiBusyState={busy} />
 * ```
 */

import './styles.css'

// 状态机
export { transition } from './extension/state-machine'
export type { InlineState, InlineEvent } from './extension/state-machine'

// StreamToolExecutor
export {
  filterNewOrUpdatedOperations,
  processToolCallStream,
  type FilteredOperation,
  type ConflictHandler,
} from './stream-tool-executor'

// 流式会话
export { startStreamSession } from './stream-session'
export type { StreamSessionOptions } from './stream-session'

// 工具
export {
  createApplyDocumentOperationsTool,
  serverApplyDocumentOperationsTool,
} from './tools/apply-document-operations'

// i18n
export { inlineDictionaryZhCN } from './i18n/zh-cn'
export type { InlineDictionary } from './i18n/zh-cn'

// 入口函数与扩展
export { createTapNoteInlineAssistant, createAIInlineExtension } from './extension/tap-note-ai-inline-extension'
export type {
  TapNoteInlineAssistant,
  CreateTapNoteInlineAssistantOptions,
  AIInlineContext,
  AIInlineStoreState,
} from './extension/tap-note-ai-inline-extension'
