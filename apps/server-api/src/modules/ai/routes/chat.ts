import { Hono } from 'hono'
import type { AppEnv } from '../../../types'
import { chatController } from '../controllers/chat'

export const chatRoute = new Hono<AppEnv>().post('/api/ai/chat', chatController)
