import { describe, expect, test } from 'bun:test'
import { filterNewOrUpdatedOperations, processToolCallStream } from '../stream-tool-executor'
import type { BlockOperation } from '@tap-note/ai-core'
import type { UIMessageChunk } from 'ai'

const sampleOps: BlockOperation[] = [
  { type: 'updateBlock', baseDocumentRevision: 0, targetBlockId: 'b-1', block: { type: 'paragraph' } },
  { type: 'deleteBlock', baseDocumentRevision: 0, targetBlockId: 'b-2' },
]

describe('filterNewOrUpdatedOperations', () => {
  test('首次提交:全部为新操作', () => {
    const { newOps, numApplied } = filterNewOrUpdatedOperations(sampleOps, 0)
    expect(newOps).toHaveLength(2)
    expect(newOps[0]!.isUpdateToPreviousOperation).toBe(false)
    expect(newOps[1]!.isPossiblyPartial).toBe(true) // 最后一个标记为 partial
    expect(numApplied).toBe(1) // 排除最后一个可能 partial 的
  })

  test('后续 chunk:已应用的操作跳过', () => {
    // 第一次:2 个操作,numApplied 变为 1
    const first = filterNewOrUpdatedOperations(sampleOps, 0)
    expect(first.newOps).toHaveLength(2)
    expect(first.numApplied).toBe(1)

    // 第二次:同样的 2 个操作 + 第 3 个,只返回新的
    const thirdOp: BlockOperation = { type: 'insertBlock', baseDocumentRevision: 0, referenceBlockId: 'b-2', position: 'after', block: { type: 'paragraph' } }
    const secondChunk = [...sampleOps, thirdOp]
    const second = filterNewOrUpdatedOperations(secondChunk, first.numApplied)
    expect(second.newOps.length).toBeGreaterThanOrEqual(1)
    expect(second.newOps[0]!.isUpdateToPreviousOperation).toBe(true)
  })

  test('空操作数组', () => {
    const { newOps, numApplied } = filterNewOrUpdatedOperations([], 0)
    expect(newOps).toHaveLength(0)
    expect(numApplied).toBe(0) // Math.max(0, 0-1=-1) = 0
  })
})

describe('processToolCallStream', () => {
  function makeChunk(input: unknown): UIMessageChunk {
    return {
      type: 'tool-input-available',
      toolCallId: 'tc-1',
      toolName: 'applyDocumentOperations',
      input: typeof input === 'string' ? input : JSON.stringify(input),
    } as unknown as UIMessageChunk
  }

  function makeStream(chunks: UIMessageChunk[]): ReadableStream<UIMessageChunk> {
    return new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk)
        }
        controller.close()
      },
    })
  }

  test('完整操作提交', async () => {
    const received: BlockOperation[][] = []
    const stream = makeStream([
      makeChunk({ operations: sampleOps }),
    ])
    await processToolCallStream(stream, (ops) => received.push(ops))
    expect(received.length).toBeGreaterThanOrEqual(1)
    expect(received[0]).toEqual(sampleOps)
  })

  test('非 tool-call chunk 跳过', async () => {
    const received: BlockOperation[][] = []
    const stream = makeStream([
      { type: 'text-start', id: 't-1' } as unknown as UIMessageChunk,
      makeChunk({ operations: sampleOps }),
    ])
    await processToolCallStream(stream, (ops) => received.push(ops))
    expect(received.length).toBeGreaterThanOrEqual(1)
  })

  test('非法 input 丢弃不中断', async () => {
    const received: BlockOperation[][] = []
    const stream = makeStream([
      makeChunk('not-valid-json'),
      makeChunk({ operations: sampleOps }),
    ])
    await processToolCallStream(stream, (ops) => received.push(ops))
    expect(received.length).toBeGreaterThanOrEqual(1)
    expect(received[0]).toEqual(sampleOps)
  })

  test('空 operations 数组跳过', async () => {
    const received: BlockOperation[][] = []
    const stream = makeStream([
      makeChunk({ operations: [] }),
      makeChunk({ operations: sampleOps }),
    ])
    await processToolCallStream(stream, (ops) => received.push(ops))
    expect(received.length).toBeGreaterThanOrEqual(1)
    expect(received[0]).toEqual(sampleOps)
  })

  test('非法操作(缺字段)丢弃,合法操作保留', async () => {
    const received: BlockOperation[][] = []
    const stream = makeStream([
      makeChunk({
        operations: [
          { type: 'invalid', baseDocumentRevision: 0 }, // 缺字段
          sampleOps[0], // 合法
        ],
      }),
    ])
    await processToolCallStream(stream, (ops) => received.push(ops))
    expect(received.length).toBeGreaterThanOrEqual(1)
    expect(received[0]).toHaveLength(1)
    expect(received[0]?.[0]?.type).toBe('updateBlock')
  })

  test('空流不抛错', async () => {
    const received: BlockOperation[][] = []
    const stream = makeStream([])
    await expect(processToolCallStream(stream, (ops) => received.push(ops))).resolves.toBeUndefined()
    expect(received).toHaveLength(0)
  })
})
