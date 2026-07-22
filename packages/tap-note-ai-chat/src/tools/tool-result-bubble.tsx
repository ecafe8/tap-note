import type { FC } from 'react'
import type { ChatDictionary } from '../i18n/zh-cn'
import type { ConflictResult } from '@tap-note/ai-core'

/** Tool 执行结果(成功或冲突)。 */
export type ToolResult =
  | { ok: true; currentDocumentRevision: number; snapshot?: unknown }
  | ConflictResult
  | { kind: 'error'; message: string }

export interface ToolResultBubbleProps {
  /** 工具调用 ID。 */
  toolCallId: string
  /** 工具名(`insertBlock`/`updateBlock`/...)。 */
  toolName: string
  /** 目标块 ID(用于跳转与显示)。 */
  targetBlockId?: string
  /** 执行结果。 */
  result: ToolResult | undefined
  /** 字典。 */
  dictionary: ChatDictionary
  /** 重试回调(用最新 revision 重新 execute 当前 toolCallId)。 */
  onRetry?: (toolCallId: string) => void
  /** 跳转到目标块回调。 */
  onJumpToBlock?: (targetBlockId: string) => void
}

/** 从 toolName 派生操作类型文案。 */
function getOperationLabel(toolName: string, dictionary: ChatDictionary): string {
  switch (toolName) {
    case 'insertBlock': return dictionary.toolInserted
    case 'updateBlock': return dictionary.toolUpdated
    case 'deleteBlock': return dictionary.toolDeleted
    case 'replaceBlocks': return dictionary.toolReplaced
    case 'moveBlock': return dictionary.toolMoved
    case 'replaceText': return dictionary.toolReplacedText
    case 'searchDocument': return dictionary.toolSearched
    case 'getDocumentSnapshot': return '文档快照'
    default: return toolName
  }
}

/**
 * `<ToolResultBubble>` — 独立工具结果气泡(在 AI 消息气泡下方独立渲染)。
 *
 * 4 种状态:
 * - 成功(`✓` + 操作类型 + 目标块 ID + 跳转按钮)
 * - 冲突(`⚠` + `AICoreDictionary.conflict` 文案 + 当前/期望 revision + 「仅重试该操作」按钮)
 * - 前置失败(`⚠` + `AICoreDictionary.preconditionFailed` 文案 + 失败原因 + 重试按钮)
 * - 错误(`✗` + 错误文案,不暴露服务端堆栈)
 *
 * 操作类型以文字 + 图标表达,不依赖颜色区分(满足可访问性)。
 */
export const ToolResultBubble: FC<ToolResultBubbleProps> = ({
  toolCallId,
  toolName,
  targetBlockId,
  result,
  dictionary,
  onRetry,
  onJumpToBlock,
}) => {
  if (!result) {
    // tool-call 在 input-streaming/input-available 状态:输入中
    return (
      <div
        className="tn-chat-tool-bubble tn-chat-tool-bubble-inputting"
        data-tool-call-id={toolCallId}
        role="status"
        aria-live="polite"
      >
        <span className="tn-chat-tool-icon" aria-hidden="true">◔</span>
        <span className="tn-chat-tool-name">{toolName}</span>
        <span className="tn-chat-tool-status">{dictionary.toolInputting}</span>
        {targetBlockId ? (
          <span className="tn-chat-tool-target">#{targetBlockId}</span>
        ) : null}
      </div>
    )
  }

  if ('ok' in result && result.ok) {
    // 成功
    return (
      <div
        className="tn-chat-tool-bubble tn-chat-tool-bubble-success"
        data-tool-call-id={toolCallId}
        role="status"
      >
        <span className="tn-chat-tool-icon" aria-hidden="true">✓</span>
        <span className="tn-chat-tool-name">{toolName}</span>
        <span className="tn-chat-tool-status">{getOperationLabel(toolName, dictionary)}</span>
        {targetBlockId ? (
          <span className="tn-chat-tool-target">#{targetBlockId}</span>
        ) : null}
        {targetBlockId && onJumpToBlock ? (
          <button
            type="button"
            className="tn-chat-tool-jump"
            onClick={() => onJumpToBlock(targetBlockId)}
            aria-label={dictionary.jumpToBlock}
          >
            {dictionary.jumpToBlock}
          </button>
        ) : null}
      </div>
    )
  }

  if ('kind' in result && result.kind === 'conflict') {
    // 冲突
    const isPrecondition = result.reason === 'precondition-failed'
    const retryLabel = isPrecondition ? dictionary.retry : dictionary.retryToolCall
    return (
      <div
        className={`tn-chat-tool-bubble tn-chat-tool-bubble-${isPrecondition ? 'precondition' : 'conflict'}`}
        data-tool-call-id={toolCallId}
        role="alert"
      >
        <span className="tn-chat-tool-icon" aria-hidden="true">⚠</span>
        <span className="tn-chat-tool-name">{toolName}</span>
        <span className="tn-chat-tool-status">
          {isPrecondition ? dictionary.preconditionFailed : dictionary.conflict}
        </span>
        {targetBlockId ? (
          <span className="tn-chat-tool-target">#{targetBlockId}</span>
        ) : null}
        {!isPrecondition && 'currentDocumentRevision' in result ? (
          <span className="tn-chat-tool-detail">
            当前 revision={result.currentDocumentRevision}
          </span>
        ) : null}
        {onRetry ? (
          <button
            type="button"
            className="tn-chat-tool-retry"
            onClick={() => onRetry(toolCallId)}
            aria-label={retryLabel}
          >
            {retryLabel}
          </button>
        ) : null}
      </div>
    )
  }

  // 错误
  const errorResult = result as { kind: 'error'; message: string }
  return (
    <div
      className="tn-chat-tool-bubble tn-chat-tool-bubble-error"
      data-tool-call-id={toolCallId}
      role="alert"
    >
      <span className="tn-chat-tool-icon" aria-hidden="true">✗</span>
      <span className="tn-chat-tool-name">{toolName}</span>
      <span className="tn-chat-tool-status">{dictionary.toolFailed}</span>
      <span className="tn-chat-tool-detail">{errorResult.message}</span>
    </div>
  )
}
