import { getAllowlistedModels } from '../providers/allowlist'
import type { ModelsResponse } from '../types'

/**
 * 返回 allowlist 模型元数据。
 */
export function listModels(): ModelsResponse {
  return { models: getAllowlistedModels() }
}
