import { Hono } from 'hono'
import type { AppEnv } from '../../../types'
import { editorStreamTextController } from '../controllers/editor-stream-text'

/**
 * `POST /api/ai/editor/streamText` 路由。
 */
export const editorStreamTextRoute = new Hono<AppEnv>().post(
  '/api/ai/editor/streamText',
  editorStreamTextController,
)
