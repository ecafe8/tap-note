import type { Context } from 'hono'
import type { AppEnv } from '../../../types'
import { success } from '../../../utils/response'
import { listModels } from '../services/list-models'

/**
 * `GET /api/ai/models` 控制器。
 *
 * 返回 allowlist 模型元数据信封 `{ code: "SUCCESS", data: { models: [...] } }`。
 */
export async function modelsController(c: Context<AppEnv>): Promise<Response> {
  return success(c, listModels())
}
