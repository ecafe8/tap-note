import { tool } from 'ai'
import { z } from 'zod'
import { blockOperationSchema } from '@tap-note/ai-core'
import type { BlockNoteEditor } from '@blocknote/core'
import { applyOperationsToEditor } from '@tap-note/ai-core'
import type { ApplyOperationsResult } from '@tap-note/ai-core'

/**
 * `applyDocumentOperations` 流式工具。
 *
 * 输入 `{ operations: BlockOperation[] }`,复用 ai-core 的 `applyOperationsToEditor`。
 * 服务端 `execute` 返回 `{ ok: true }`(实际操作由客户端应用)。
 *
 * 客户端 StreamToolExecutor 增量解析 partial tool call 后调用此工具。
 */
export function createApplyDocumentOperationsTool(editor: BlockNoteEditor, currentDocumentRevision?: number) {
  return tool({
    description: 'Apply document operations to the editor (suggest mode, revertable)',
    inputSchema: z.object({
      operations: z.array(blockOperationSchema),
    }),
    execute: async ({ operations }): Promise<{ ok: true; result: ApplyOperationsResult }> => {
      const result = applyOperationsToEditor(editor, operations, {
        mode: 'suggest',
        currentDocumentRevision,
      })
      return { ok: true, result }
    },
  })
}

/**
 * 服务端工具定义(用于 FEAT-005 ai-backend 的 streamText 调用)。
 *
 * 服务端 execute 只返回 `{ ok: true }`,实际操作由客户端 StreamToolExecutor 应用。
 */
export const serverApplyDocumentOperationsTool = tool({
  description: 'Apply document operations to the editor',
  inputSchema: z.object({
    operations: z.array(blockOperationSchema),
  }),
  execute: async () => ({ ok: true as const }),
})
