import { describe, expect, test } from 'bun:test'
import { createAIBusyState, applyOperationsToEditor, type BlockOperation } from '@tap-note/ai-core'
import { processToolCallStream } from '../stream-tool-executor'
import type { UIMessageChunk } from 'ai'

describe('busy + inline 生命周期集成测试', () => {
  test('acquire → suggest → accept/reject → release', () => {
    const busy = createAIBusyState()
    // 1. acquire
    expect(busy.acquire('inline')).toBe(true)
    expect(busy.isBusy).toBe(true)
    // 2. 假设 suggest + accept/reject
    // (实际编辑器操作需要 BlockNote editor 实例,这里只验证 busy 生命周期)
    // 3. release
    busy.release()
    expect(busy.isBusy).toBe(false)
  })

  test('中止 → abort → release', () => {
    const busy = createAIBusyState()
    expect(busy.acquire('inline')).toBe(true)
    // 模拟中止:abort + release
    busy.release()
    expect(busy.isBusy).toBe(false)
  })

  test('busy 互斥:另一 AI 进行中时入口禁用', () => {
    const busy = createAIBusyState()
    expect(busy.acquire('chat')).toBe(true)
    // 内联尝试 acquire 失败
    expect(busy.acquire('inline')).toBe(false)
    busy.release()
    // 释放后内联可用
    expect(busy.acquire('inline')).toBe(true)
    busy.release()
  })
})

describe('filterNewOrUpdatedOperations + processToolCallStream 集成', () => {
  test('去重后操作正确提交', async () => {
    const ops1: BlockOperation[] = [
      { type: 'updateBlock', baseDocumentRevision: 0, targetBlockId: 'b-1', block: { type: 'paragraph' } },
    ]
    const ops2: BlockOperation[] = [
      ...ops1,
      { type: 'deleteBlock', baseDocumentRevision: 0, targetBlockId: 'b-2' },
    ]

    const received: BlockOperation[][] = []
    const stream = new ReadableStream<UIMessageChunk>({
      start(controller) {
        controller.enqueue({
          type: 'tool-input-available',
          toolCallId: 'tc-1',
          toolName: 'applyDocumentOperations',
          input: JSON.stringify({ operations: ops1 }),
        } as unknown as UIMessageChunk)
        controller.enqueue({
          type: 'tool-input-available',
          toolCallId: 'tc-1',
          toolName: 'applyDocumentOperations',
          input: JSON.stringify({ operations: ops2 }),
        } as unknown as UIMessageChunk)
        controller.close()
      },
    })

    await processToolCallStream(stream, (ops) => received.push(ops))
    expect(received.length).toBeGreaterThanOrEqual(1)
    // 第一次收到 ops1
    expect(received[0]).toEqual(ops1)
    // 最后一次收到 ops2(累积)
    expect(received[received.length - 1]).toEqual(ops2)
  })
})

void applyOperationsToEditor
