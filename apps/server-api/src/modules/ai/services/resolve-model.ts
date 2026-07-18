import type { LanguageModel } from 'ai'
import { llmProvider } from '../providers'
import { isModelAllowed } from '../providers/allowlist'
import { ModelNotAllowedError } from '../../../errors'

/**
 * 根据 modelId 解析为 LanguageModel 实例。
 *
 * - 仅返回 allowlist 且 env 已配置 provider 的模型
 * - 未列出 modelId 一律拒绝,不回退默认模型
 */
export function resolveModel(modelId: string): LanguageModel {
  if (!isModelAllowed(modelId)) {
    throw new ModelNotAllowedError(modelId)
  }
  return llmProvider.languageModel(modelId)
}
