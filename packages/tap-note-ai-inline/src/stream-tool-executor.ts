import { parsePartialJson } from 'ai'
import type { UIMessageChunk } from 'ai'
import type { BlockOperation, ConflictResult } from '@tap-note/ai-core'
import { blockOperationSchema } from '@tap-note/ai-core'

/**
 * 去重后的操作结果。
 */
export interface FilteredOperation {
  /** 操作对象。 */
  operation: BlockOperation
  /** 是否是上一个操作的更新(partial 完成)。 */
  isUpdateToPreviousOperation: boolean
  /** 是否可能是 partial(未完成)。 */
  isPossiblyPartial: boolean
}

/**
 * `filterNewOrUpdatedOperations` 去重逻辑。
 *
 * 参考 xl-ai `filterNewOrUpdatedOperations`:追踪 `numOperationsAppliedCompletely`,
 * 每次 chunk 的 operations 数组中,已完全应用的操作跳过,最后一个操作标记为可能 partial。
 *
 * @param operations 当前 chunk 的操作数组
 * @param numApplied 之前已完全应用的操作数
 * @returns 去重后的操作列表与新的 `numApplied` 值
 */
export function filterNewOrUpdatedOperations(
  operations: BlockOperation[],
  numApplied: number,
): { newOps: FilteredOperation[]; numApplied: number } {
  const newOps: FilteredOperation[] = []

  for (let i = numApplied; i < operations.length; i++) {
    const operation = operations[i]!
    newOps.push({
      operation,
      isUpdateToPreviousOperation: i === numApplied && numApplied > 0,
      isPossiblyPartial: i === operations.length - 1,
    })
  }

  // 更新已应用计数(排除最后一个可能 partial 的操作)
  const newNumApplied = Math.max(numApplied, operations.length - 1)

  return { newOps, numApplied: newNumApplied }
}

/**
 * 从 `UIMessageChunk` 流中提取并去重 `BlockOperation[]`。
 *
 * 处理 tool call streaming:
 * 1. 监听 `tool-input-available` chunk(v7 UIMessageChunk 的工具调用类型)
 * 2. 提取 `input` 字段(可能是字符串或已解析对象)
 * 3. 用 `parsePartialJson` 解析(若为字符串),`filterNewOrUpdatedOperations` 去重
 * 4. 非法 partial 丢弃,不中断流
 *
 * @param stream `ReadableStream<UIMessageChunk>`(来自 `readUIMessageStream`)
 * @param onOperations 回调,每次有新的完整操作时调用(支持 async,逐块应用时串行 await)
 * @param onError 回调,解析错误时调用(不中断流)
 */
export async function processToolCallStream(
  stream: ReadableStream<UIMessageChunk>,
  onOperations: (operations: BlockOperation[]) => void | Promise<void>,
  onError?: (error: unknown) => void,
): Promise<void> {
  const reader = stream.getReader()
  let numApplied = 0
  let accumulatedJson = ''
  let lastEmittedFingerprint = ''

  try {
    while (true) {
      const { done, value: chunk } = await reader.read()
      if (done) break
      if (!chunk) continue

      const chunkType = (chunk as { type?: string }).type

      // 累积 tool-input-delta 的 JSON 片段(增量流式)
      if (chunkType === 'tool-input-delta') {
        const delta = (chunk as { inputTextDelta?: string }).inputTextDelta
        if (typeof delta === 'string') {
          accumulatedJson += delta
          // 尝试解析累积的 partial JSON
          const parsed = await parsePartialJson(accumulatedJson)
          // repaired-parse 仍可能缺少后续字段,不能提前应用,否则会重复插入。
          if (parsed.state === 'successful-parse') {
            lastEmittedFingerprint = await tryApplyOperations(parsed.value, onOperations, numApplied, lastEmittedFingerprint, (n) => { numApplied = n })
          }
        }
        continue
      }

      // tool-input-available:完整工具输入(最终状态)
      if (chunkType === 'tool-input-available') {
        const input = (chunk as { input?: unknown }).input
        if (typeof input === 'string') {
          accumulatedJson = input
        } else if (input !== null && typeof input === 'object') {
          accumulatedJson = JSON.stringify(input)
        }
        // 用最终完整 JSON 再应用一次(确保最终状态正确)
        const parsed = await parsePartialJson(accumulatedJson)
        if (parsed.state === 'successful-parse') {
          lastEmittedFingerprint = await tryApplyOperations(parsed.value, onOperations, numApplied, lastEmittedFingerprint, (n) => { numApplied = n })
        }
        continue
      }

      // 其他 chunk 类型跳过
    }
  } catch (err) {
    onError?.(err)
  } finally {
    reader.releaseLock()
  }
}

/** 尝试从解析值中提取并去重操作,有新操作时回调 */
async function tryApplyOperations(
  parsedValue: unknown,
  onOperations: (operations: BlockOperation[]) => void | Promise<void>,
  numApplied: number,
  lastEmittedFingerprint: string,
  setNumApplied: (n: number) => void,
): Promise<string> {
  const value = parsedValue as { operations?: unknown[] } | null
  if (!value?.operations || !Array.isArray(value.operations)) return lastEmittedFingerprint

  // 校验每个操作
  const validOps: BlockOperation[] = []
  for (const op of value.operations) {
    try {
      const valid = blockOperationSchema.parse(op)
      validOps.push(valid)
    } catch {
      // partial JSON 可能产生不完整操作,丢弃不中断
    }
  }

  if (validOps.length === 0) return lastEmittedFingerprint

  const fingerprint = JSON.stringify(validOps)
  if (fingerprint === lastEmittedFingerprint) return lastEmittedFingerprint

  // 去重:只提交之前没应用过的操作
  const { newOps, numApplied: newNumApplied } = filterNewOrUpdatedOperations(validOps, numApplied)
  setNumApplied(newNumApplied)

  if (newOps.length > 0) {
    await onOperations(newOps.map(({ operation }) => operation))
  }
  return fingerprint
}

/**
 * 处理 ConflictResult。
 *
 * 当 `applyOperationsToEditor` 返回 `ConflictResult` 时,调用此回调。
 */
export type ConflictHandler = (conflict: ConflictResult) => void
