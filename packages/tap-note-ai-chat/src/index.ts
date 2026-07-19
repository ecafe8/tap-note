/**
 * @packageDocumentation @tap-note/ai-chat
 *
 * 位置无关的侧边对话助手(FEAT-004),基于 AI SDK v7 `useChat` + `onToolCall`/`addToolOutput` 模式。
 *
 * 主要导出:
 * - `createTapNoteChatAssistant`:入口函数,返回 `{ mount, unmount, panel }` 实现 TapNoteChatAssistant 接口
 * - `TapNoteChatPanel`:位置无关的 React 组件(最小宽 320px)
 * - `useTapNoteChat`:封装 `useChat`,管理 messages/sendMessage/abort/onToolCall
 * - `executeClientTool`:client-side tools 执行(insertBlock/updateBlock/deleteBlock/replaceBlocks/moveBlock/getDocumentSnapshot)
 * - `ChatDictionary`/`chatDictionaryZhCN`:zh-CN 字典,扩展 ai-core `AICoreDictionary`
 *
 * 安全边界:不持 LLM Key、不发起 HTTP(由集成方 transport)、不记录正文日志。
 * 依赖闭包不含 `@blocknote/xl-ai` 或任何 GPL/AGPL 依赖。
 */

// 入口函数与助手实例
export {
  createTapNoteChatAssistant,
} from './create-tap-note-chat-assistant'
export type {
  TapNoteChatAssistant,
  CreateTapNoteChatAssistantOptions,
  ChatPanelProps,
} from './create-tap-note-chat-assistant'

// ChatPanel 组件
export { TapNoteChatPanel } from './tap-note-chat-panel'
export type { TapNoteChatPanelProps } from './tap-note-chat-panel'

// UI 子组件(供集成方覆盖)
export { ContextSelector } from './ui/context-selector'
export type { ContextSelectorProps } from './ui/context-selector'
export { MessageList } from './ui/message-list'
export type { MessageListProps } from './ui/message-list'
export { MessageBubble } from './ui/message-bubble'
export type { MessageBubbleProps } from './ui/message-bubble'
export { InputArea } from './ui/input-area'
export type { InputAreaProps } from './ui/input-area'

// useTapNoteChat hook
export { useTapNoteChat } from './use-tap-note-chat'
export type {
  UseTapNoteChatOptions,
  UseTapNoteChatResult,
} from './use-tap-note-chat'

// 客户端 tools
export { executeClientTool } from './tools/client-tools'
export type {
  ExecuteClientToolContext,
  ExecuteToolResult,
} from './tools/client-tools'
export { ToolResultBubble } from './tools/tool-result-bubble'
export type { ToolResultBubbleProps, ToolResult } from './tools/tool-result-bubble'
export { findTargetBlockIdFromMessages } from './tools/tool-result-helpers'

// 上下文模式
export {
  DEFAULT_CONTEXT_MODE,
  CONTEXT_MODES,
  isSnapshotToolAllowed,
} from './context/context-mode'
export type { ContextMode } from './context/context-mode'
export {
  chatLayerContext,
  buildDocumentState,
  getContextHintKey,
} from './context/context-layer'
export type { ChatLayeredContext, ContextHintKey } from './context/context-layer'

// i18n
export { chatDictionaryZhCN, mergeChatDictionary } from './i18n/zh-cn'
export type { ChatDictionary } from './i18n/zh-cn'

// 工具 input schemas 与类型(供集成方 type-check)
export {
  insertBlockToolInputSchema,
  updateBlockToolInputSchema,
  deleteBlockToolInputSchema,
  replaceBlocksToolInputSchema,
  moveBlockToolInputSchema,
  getDocumentSnapshotToolInputSchema,
} from './types/tool-input'
export type {
  InsertBlockToolInput,
  UpdateBlockToolInput,
  DeleteBlockToolInput,
  ReplaceBlocksToolInput,
  MoveBlockToolInput,
  GetDocumentSnapshotToolInput,
  ChatToolName,
  ToolSuccessResult,
} from './types/tool-input'
