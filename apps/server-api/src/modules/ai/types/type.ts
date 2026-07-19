import type { z } from 'zod'
import type { DocumentState, BlockOperation } from '@tap-note/ai-core'
import type {
  editorStreamTextRequestSchema,
  chatRequestSchema,
  modelInfoSchema,
  modelsResponseSchema,
  chatContextModeSchema,
} from './schema'

/** `POST /api/ai/editor/streamText` 请求 body 类型。 */
export type EditorStreamTextRequest = z.infer<typeof editorStreamTextRequestSchema> & {
  // documentState 类型对齐 ai-core DocumentState
  documentState: DocumentState
}

/** `POST /api/ai/chat` 请求 body 类型。 */
export type ChatRequest = z.infer<typeof chatRequestSchema> & {
  documentState?: DocumentState
}

/** 对话上下文三态,服务端据此过滤 `getDocumentSnapshot` 工具声明。 */
export type ChatContextMode = z.infer<typeof chatContextModeSchema>

/** 服务端 streamTool 输入类型(与 ai-core BlockOperation 同源)。 */
export type ServerStreamToolInput = BlockOperation

/** 模型元数据。 */
export type ModelInfo = z.infer<typeof modelInfoSchema>

/** `GET /api/ai/models` 响应类型。 */
export type ModelsResponse = z.infer<typeof modelsResponseSchema>
