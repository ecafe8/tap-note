import { z } from 'zod'
import { blockOperationSchema, documentStateSchema } from '@tap-note/ai-core'

/**
 * 服务端 streamTool 的 system prompt(用于 editor/streamText 端点)。
 * 提示模型基于 documentState 发起 BlockOperation 工具调用。
 */
export const EDITOR_SYSTEM_PROMPT = `You are an AI writing assistant integrated into a block-based document editor.
You receive the latest state of the document (or a selection) and issue BlockOperation tool calls to modify it.
Always issue operations against the latest document state provided. Each operation MUST include the baseDocumentRevision matching the provided state.
Do NOT issue operations against stale or previous document states.`

/**
 * `POST /api/ai/editor/streamText` 请求 body Zod schema。
 *
 * - `messages`: UIMessage 数组(由客户端 transport 发送)
 * - `documentState`: 文档状态快照(与服务端 streamTool schema 对齐的 BlockOperation 契约)
 * - `model`: 模型 ID,形如 `<provider>:<model>`,必须 allowlist
 *
 * 客户端 SHALL NOT 提交 `tools`/`toolDefinitions` 字段;服务端持有工具 schema。
 */
export const editorStreamTextRequestSchema = z.object({
  messages: z.array(z.custom<unknown>()).min(1),
  documentState: documentStateSchema,
  model: z.string().min(1),
})

/**
 * `POST /api/ai/chat` 请求 body Zod schema。
 *
 * - `messages`: UIMessage 数组
 * - `documentState`: 可选,不引用模式不提交
 * - `documentRevision`: 可选,用于冲突检测
 * - `model`: 模型 ID
 */
export const chatRequestSchema = z.object({
  messages: z.array(z.custom<unknown>()).min(1),
  documentState: documentStateSchema.optional(),
  documentRevision: z.number().int().nonnegative().optional(),
  model: z.string().min(1),
})

/**
 * 服务端 streamTool schema(editor/streamText 端点)。
 *
 * **与 `@tap-note/ai-core` 的 `blockOperationSchema` 同源**(从 ai-core 导入,不在服务端重复定义)。
 * 工具输入形状为 `{ operations: BlockOperation[] }`,服务端 `execute` 返回 `{ ok: true }`,
 * 实际编辑器操作由客户端 `applyOperationsToEditor` 应用。
 */
export const serverStreamToolInputSchema = z.object({
  operations: z.array(blockOperationSchema),
})

/**
 * `GET /api/ai/models` 响应中的模型元数据 Zod schema。
 */
export const modelInfoSchema = z.object({
  id: z.string(),
  label: z.string(),
  provider: z.string(),
  capabilities: z.object({
    streamingTools: z.boolean().optional(),
    multimodal: z.boolean().optional(),
    reasoning: z.boolean().optional(),
  }).partial(),
})

/**
 * `GET /api/ai/models` 响应 Zod schema。
 */
export const modelsResponseSchema = z.object({
  models: z.array(modelInfoSchema),
})
