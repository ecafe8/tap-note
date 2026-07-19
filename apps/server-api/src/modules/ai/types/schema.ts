import { z } from 'zod'
import { blockOperationSchema, blockSchema, documentStateSchema } from '@tap-note/ai-core'

/**
 * 服务端 streamTool 的 system prompt(用于 editor/streamText 端点)。
 * 提示模型基于 documentState 发起 BlockOperation 工具调用。
 */
export const EDITOR_SYSTEM_PROMPT = `You are an AI writing assistant integrated into a block-based document editor.
You receive the latest state of the document (or a selection) and issue BlockOperation tool calls to modify it.

CRITICAL RULES:
- Each operation MUST include \`baseDocumentRevision\` matching the revision in the provided document state.
- Block IDs in the provided document state are SUFFIXED with a \`$\` character (e.g. \`232e80f1-...$\`). When you reference a block via \`referenceBlockId\` / \`targetBlockId\` / \`targetBlockIds\`, you MUST copy the id EXACTLY as it appears in the document state, INCLUDING the trailing \`$\`. IDs without the \`$\` suffix will be rejected as hallucinated.
- For \`referenceBlockId\` / \`targetBlockId\` / \`targetBlockIds\`, use ONLY block IDs that appear in the provided document state's \`blocks\` array. Never invent, guess, or reuse placeholder/example IDs (e.g. "a1b2c3d4-...", "xxx-xxx-xxx").
- To insert a new block, pick an existing block from the document state as the anchor (\`referenceBlockId\`) and set \`position\` to "before" or "after". The new block's \`block.id\` should be omitted; the editor assigns IDs.
- The \`block.type\` field MUST be one of the supported block types: \`paragraph\`, \`heading\`, \`quote\`, \`divider\`, \`image\`, \`audio\`, \`video\`, \`file\`, \`table\`. Do NOT use \`"text"\`, \`"h1"\`, \`"list"\` or any other non-existent type. For paragraphs you may omit \`type\` entirely.
- For \`heading\` blocks, set \`props.level\` to 1-6. For paragraphs, \`content\` may be a plain string. Do NOT mix block-level types into \`content\`.
- Do NOT issue operations against stale or previous document states. Always operate on the latest state provided.`

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
 * - `contextMode`: 上下文三态(`selection`/`full`/`none`,默认 `none`),服务端据此过滤
 *   `getDocumentSnapshot` 工具声明(只在 `full` 模式声明该工具)
 */
export const chatContextModeSchema = z.enum(['selection', 'full', 'none'])
export type ChatContextMode = z.infer<typeof chatContextModeSchema>

export const chatRequestSchema = z.object({
  messages: z.array(z.custom<unknown>()).min(1),
  documentState: documentStateSchema.optional(),
  documentRevision: z.number().int().nonnegative().optional(),
  model: z.string().min(1),
  contextMode: chatContextModeSchema.optional().default('none'),
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
 * 对话端点 6 个 client-side tools 的 inputSchema(派生自 ai-core `blockSchema`/`blockOperationSchema`)。
 *
 * 服务端只声明 `description` + `inputSchema`,不提供 `execute`(由客户端 `onToolCall` 执行)。
 * 与 ai-core `blockOperationSchema` 同源(派生而非重新定义)。
 */
const baseDocumentRevisionSchema = z.number().int().nonnegative()
const blockIdSchema = z.string().min(1)
const positionSchema = z.enum(['before', 'after'])

export const insertBlockToolInputSchema = z.object({
  block: blockSchema,
  referenceBlockId: blockIdSchema,
  position: positionSchema.default('after'),
  baseDocumentRevision: baseDocumentRevisionSchema,
})

export const updateBlockToolInputSchema = z.object({
  targetBlockId: blockIdSchema,
  block: blockSchema,
  baseDocumentRevision: baseDocumentRevisionSchema,
})

export const deleteBlockToolInputSchema = z.object({
  targetBlockId: blockIdSchema,
  baseDocumentRevision: baseDocumentRevisionSchema,
})

export const replaceBlocksToolInputSchema = z.object({
  targetBlockIds: z.array(blockIdSchema).min(1),
  blocks: z.array(blockSchema).min(1),
  baseDocumentRevision: baseDocumentRevisionSchema,
})

export const moveBlockToolInputSchema = z.object({
  targetBlockId: blockIdSchema,
  referenceBlockId: blockIdSchema,
  position: positionSchema,
  baseDocumentRevision: baseDocumentRevisionSchema,
})

export const getDocumentSnapshotToolInputSchema = z.object({
  fromBlock: blockIdSchema.optional(),
  maxBlocks: z.number().int().positive().optional(),
  maxTokens: z.number().int().positive().optional(),
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
