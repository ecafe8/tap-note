import { Hono } from 'hono'
import type { AppEnv } from '../../../types'
import { editorStreamTextRoute } from './editor-stream-text'
import { chatRoute } from './chat'
import { modelsRoute } from './models'
import { proxyRoute } from './proxy'
import { approvalRoute } from './approval'

/**
 * AI 路由聚合。
 */
export const aiRoutes = new Hono<AppEnv>()
  .route('/', editorStreamTextRoute)
  .route('/', chatRoute)
  .route('/', modelsRoute)
  .route('/', proxyRoute)
  .route('/', approvalRoute)
