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
 * 对话端点 system prompt(用于 /api/ai/chat 端点)。
 *
 * 约束模型:**修改文档必须调用编辑工具**,不得仅用自然语言声称完成;
 * `$` 后缀 block ID 必须精确复制;文本级编辑优先使用 `replaceText`。
 * `toolChoice` 保持 auto(对话也支持纯问答,不强制工具调用)。
 */
export const CHAT_SYSTEM_PROMPT = `You are an AI assistant integrated into a block-based document editor. The user chats with you and may ask you to read or modify the document.

CRITICAL RULES FOR MODIFYING THE DOCUMENT:
- To change the document, you MUST call one of the editing tools: \`insertBlock\`, \`updateBlock\`, \`deleteBlock\`, \`replaceBlocks\`, \`moveBlock\`, or \`replaceText\`. NEVER claim, imply, or summarize that you have modified the document unless you actually called an editing tool and received a successful result.
- You have a \`searchDocument\` tool that reads the LIVE document at any time. If no document state was provided in context, or you need to find specific text, you MUST call \`searchDocument\` to read it yourself. NEVER ask the user to paste, provide, or describe the document content — you can always read the live document directly with \`searchDocument\`. Only when a search returns no match, or the user's intent is genuinely ambiguous, reply with a clarifying question.
- To locate text before editing, call \`searchDocument\` with the target text (substring, or regex with \`isRegex: true\`). It returns matches with \`blockId\`, \`from\`, \`to\` and \`matchedText\`. It works even when no document state was provided.
- For changing text WITHIN a block (e.g. replacing a word or phrase): FIRST call \`searchDocument\` to locate the exact text (do NOT guess offsets), THEN call \`replaceText\` using a match's \`blockId\` as \`targetBlockId\`, its \`from\`/\`to\`, and its \`matchedText\` as \`expectedText\`. \`from\`/\`to\` are zero-based character offsets into the block's plain text (including \`from\`, excluding \`to\`).
- For whole-block changes, use \`updateBlock\` (rewrite a block), \`insertBlock\`, \`deleteBlock\`, \`replaceBlocks\`, or \`moveBlock\`.
- Each editing tool call MUST include \`baseDocumentRevision\` matching the revision of the document state you were given.
- Block IDs in the provided document state are SUFFIXED with a \`$\` character (e.g. \`232e80f1-...$\`). When you reference a block via \`targetBlockId\` / \`referenceBlockId\` / \`targetBlockIds\`, copy the id EXACTLY as shown, INCLUDING the trailing \`$\`. IDs without \`$\` will be rejected as hallucinated.
- Only reference block IDs that appear in the provided document state. Never invent or guess IDs.
- The \`block.type\` field MUST be a supported type: \`paragraph\`, \`heading\`, \`quote\`, \`divider\`, \`image\`, \`audio\`, \`video\`, \`file\`, \`table\`. For paragraphs you may omit \`type\`.
- If a tool call returns an error or conflict, you may retry with corrected arguments (e.g. refreshed revision or offsets) or explain the problem to the user.`

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

export const replaceTextToolInputSchema = z.object({
  targetBlockId: blockIdSchema,
  from: z.number().int().nonnegative(),
  to: z.number().int().positive(),
  expectedText: z.string(),
  replacement: z.string(),
  baseDocumentRevision: baseDocumentRevisionSchema,
})

export const searchDocumentToolInputSchema = z.object({
  query: z.string().min(1),
  isRegex: z.boolean().optional(),
  caseSensitive: z.boolean().optional(),
  maxResults: z.number().int().positive().optional(),
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
