import { describe, expect, test } from 'bun:test'
import { render, screen, fireEvent } from '@testing-library/react'
import { ToolResultBubble } from '../tool-result-bubble'
import { chatDictionaryZhCN } from '../../i18n/zh-cn'
import type { ConflictResult } from '@tap-note/ai-core'

describe('ToolResultBubble', () => {
  test('result=undefined 显示输入中状态(◔ + toolInputting)', () => {
    render(
      <ToolResultBubble
        toolCallId="tc-1"
        toolName="insertBlock"
        targetBlockId="b3"
        result={undefined}
        dictionary={chatDictionaryZhCN}
      />,
    )
    expect(screen.getByText('insertBlock')).toBeDefined()
    expect(screen.getByText(chatDictionaryZhCN.toolInputting)).toBeDefined()
    expect(screen.getByText('#b3')).toBeDefined()
  })

  test('result=ok 显示成功状态(✓ + 操作类型文案)', () => {
    render(
      <ToolResultBubble
        toolCallId="tc-1"
        toolName="insertBlock"
        targetBlockId="b3"
        result={{ ok: true, currentDocumentRevision: 5 }}
        dictionary={chatDictionaryZhCN}
        onJumpToBlock={() => {}}
      />,
    )
    expect(screen.getByText(chatDictionaryZhCN.toolInserted)).toBeDefined()
    expect(screen.getByText('#b3')).toBeDefined()
    expect(screen.getByText(chatDictionaryZhCN.jumpToBlock)).toBeDefined()
  })

  test('操作类型从 toolName 派生', () => {
    const { rerender } = render(
      <ToolResultBubble
        toolCallId="tc-1"
        toolName="updateBlock"
        targetBlockId="b3"
        result={{ ok: true, currentDocumentRevision: 5 }}
        dictionary={chatDictionaryZhCN}
      />,
    )
    expect(screen.getByText(chatDictionaryZhCN.toolUpdated)).toBeDefined()

    rerender(
      <ToolResultBubble
        toolCallId="tc-2"
        toolName="deleteBlock"
        targetBlockId="b3"
        result={{ ok: true, currentDocumentRevision: 5 }}
        dictionary={chatDictionaryZhCN}
      />,
    )
    expect(screen.getByText(chatDictionaryZhCN.toolDeleted)).toBeDefined()
  })

  test('result=conflict(revision-mismatch) 显示冲突与仅重试按钮', () => {
    const conflict: ConflictResult = {
      kind: 'conflict',
      reason: 'revision-mismatch',
      currentDocumentRevision: 7,
      operation: { type: 'updateBlock', targetBlockId: 'b3', block: {}, baseDocumentRevision: 5 },
      message: 'revision mismatch',
    } as unknown as ConflictResult
    let retriedToolCallId: string | null = null
    render(
      <ToolResultBubble
        toolCallId="tc-1"
        toolName="updateBlock"
        targetBlockId="b3"
        result={conflict}
        dictionary={chatDictionaryZhCN}
        onRetry={(id) => { retriedToolCallId = id }}
      />,
    )
    expect(screen.getByText(chatDictionaryZhCN.conflict)).toBeDefined()
    expect(screen.getByText(/revision=7/)).toBeDefined()
    const retryBtn = screen.getByText(chatDictionaryZhCN.retryToolCall)
    fireEvent.click(retryBtn)
    expect(retriedToolCallId).toBe('tc-1')
  })

  test('result=conflict(precondition-failed) 显示前置失败与重试按钮', () => {
    const conflict: ConflictResult = {
      kind: 'conflict',
      reason: 'precondition-failed',
      currentDocumentRevision: 5,
      operation: { type: 'updateBlock', targetBlockId: 'b3', block: {}, baseDocumentRevision: 5 },
      message: 'target block not found',
    } as unknown as ConflictResult
    render(
      <ToolResultBubble
        toolCallId="tc-2"
        toolName="updateBlock"
        targetBlockId="b3"
        result={conflict}
        dictionary={chatDictionaryZhCN}
        onRetry={() => {}}
      />,
    )
    expect(screen.getByText(chatDictionaryZhCN.preconditionFailed)).toBeDefined()
    // 前置失败用 retry 文案而非 retryToolCall
    expect(screen.getByText(chatDictionaryZhCN.retry)).toBeDefined()
  })

  test('result=error 显示错误状态(✗ + toolFailed)', () => {
    render(
      <ToolResultBubble
        toolCallId="tc-3"
        toolName="updateBlock"
        targetBlockId="b3"
        result={{ kind: 'error', message: 'something went wrong' }}
        dictionary={chatDictionaryZhCN}
      />,
    )
    expect(screen.getByText(chatDictionaryZhCN.toolFailed)).toBeDefined()
    expect(screen.getByText('something went wrong')).toBeDefined()
  })

  test('跳转按钮触发 onJumpToBlock', () => {
    let jumped: string | null = null
    render(
      <ToolResultBubble
        toolCallId="tc-1"
        toolName="insertBlock"
        targetBlockId="b5"
        result={{ ok: true, currentDocumentRevision: 1 }}
        dictionary={chatDictionaryZhCN}
        onJumpToBlock={(id) => { jumped = id }}
      />,
    )
    const jumpBtn = screen.getByText(chatDictionaryZhCN.jumpToBlock)
    fireEvent.click(jumpBtn)
    expect(jumped).toBe('b5')
  })

  test('操作类型不依赖颜色(文字 + 图标同时表达)', () => {
    render(
      <ToolResultBubble
        toolCallId="tc-1"
        toolName="insertBlock"
        targetBlockId="b3"
        result={{ ok: true, currentDocumentRevision: 1 }}
        dictionary={chatDictionaryZhCN}
      />,
    )
    // 文字
    expect(screen.getByText(chatDictionaryZhCN.toolInserted)).toBeDefined()
    // 图标(✓)
    expect(screen.getByText('✓')).toBeDefined()
  })
})
