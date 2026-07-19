import type { BlockOperation, ConflictResult } from '@tap-note/ai-core'

/**
 * 内联助手状态。
 */
export type InlineState =
  | { status: 'user-input' }
  | { status: 'thinking' }
  | { status: 'ai-writing'; operations: BlockOperation[] }
  | { status: 'user-reviewing'; operations: BlockOperation[] }
  | { status: 'error'; error: string; conflict?: ConflictResult }

/**
 * 状态机事件。
 */
export type InlineEvent =
  | { type: 'submit' }
  | { type: 'first-tool-call'; operations: BlockOperation[] }
  | { type: 'operations-updated'; operations: BlockOperation[] }
  | { type: 'stream-complete'; operations: BlockOperation[] }
  | { type: 'accept' }
  | { type: 'reject' }
  | { type: 'abort' }
  | { type: 'error'; error: string; conflict?: ConflictResult }
  | { type: 'retry' }
  | { type: 'close' }

/**
 * 状态机转换函数(纯函数,不依赖 React)。
 *
 * 转换规则:
 * - `user-input` + submit → `thinking`
 * - `thinking` + first-tool-call → `ai-writing`
 * - `ai-writing` + operations-updated → `ai-writing`(更新累积)
 * - `ai-writing` + stream-complete → `user-reviewing`
 * - `thinking`/`ai-writing` + error → `error`
 * - `error` + retry → `thinking`
 * - `user-reviewing` + accept/reject → `user-input`
 * - `ai-writing` + abort → `user-input`
 * - 任意 + close → `user-input`
 */
export function transition(state: InlineState, event: InlineEvent): InlineState {
  switch (event.type) {
    case 'submit':
      if (state.status === 'user-input' || state.status === 'error') {
        return { status: 'thinking' }
      }
      return state

    case 'first-tool-call':
      if (state.status === 'thinking') {
        return { status: 'ai-writing', operations: event.operations }
      }
      return state

    case 'operations-updated':
      if (state.status === 'ai-writing') {
        return { status: 'ai-writing', operations: event.operations }
      }
      return state

    case 'stream-complete':
      if (state.status === 'ai-writing') {
        return { status: 'user-reviewing', operations: event.operations }
      }
      return state

    case 'accept':
    case 'reject':
      if (state.status === 'user-reviewing') {
        return { status: 'user-input' }
      }
      return state

    case 'abort':
      if (state.status === 'ai-writing' || state.status === 'thinking') {
        return { status: 'user-input' }
      }
      return state

    case 'error':
      if (state.status === 'thinking' || state.status === 'ai-writing') {
        return { status: 'error', error: event.error, conflict: event.conflict }
      }
      return state

    case 'retry':
      if (state.status === 'error') {
        return { status: 'thinking' }
      }
      return state

    case 'close':
      return { status: 'user-input' }

    default:
      return state
  }
}
