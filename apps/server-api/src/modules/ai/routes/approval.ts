import { Hono } from 'hono'
import type { AppEnv } from '../../../types'
import { approvalController } from '../controllers/approval'

export const approvalRoute = new Hono<AppEnv>().post(
  '/api/ai/agents/approval',
  approvalController,
)
