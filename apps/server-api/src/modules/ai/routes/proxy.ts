import { Hono } from 'hono'
import type { AppEnv } from '../../../types'
import { proxyController } from '../controllers/proxy'

export const proxyRoute = new Hono<AppEnv>().post('/api/ai/proxy', proxyController)
