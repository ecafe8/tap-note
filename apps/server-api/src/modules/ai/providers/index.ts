import { createAlibaba } from '@ai-sdk/alibaba'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import {
  customProvider,
  defaultSettingsMiddleware,
  wrapLanguageModel,
  type LanguageModel,
  type Provider,
} from 'ai'
import { env } from '../../../config/env'
import type { LLMConfig } from '../types'

/**
 * 创建统一 LLM Provider。
 *
 * 根据配置创建 DashScope / Google 模型注册表。
 * 在应用启动时调用一次,返回的 Provider 实例注入到依赖方。
 */
export function createLLMProvider(config: LLMConfig): Provider {
  const defaultSimpleMiddleware = defaultSettingsMiddleware({
    settings: { providerOptions: {} },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const languageModels: Record<string, any> = {}

  const dashscopeProvider = createAlibaba({
    apiKey: config.dashscope.apiKey,
    baseURL: config.dashscope.baseURL,
  })
  languageModels['dashscope:qwen3.7-plus'] = wrapLanguageModel({
    model: dashscopeProvider('qwen3.7-plus'),
    middleware: [defaultSimpleMiddleware],
  })
  languageModels['dashscope:qwen3.7-max'] = wrapLanguageModel({
    model: dashscopeProvider('qwen3.7-max'),
    middleware: [defaultSimpleMiddleware],
  })
  languageModels['dashscope:qwen3-vl-flash'] = wrapLanguageModel({
    model: dashscopeProvider('qwen3-vl-flash'),
    middleware: [defaultSimpleMiddleware],
  })

  if (config.google) {
    const googleProvider = createGoogleGenerativeAI({
      apiKey: config.google.apiKey,
      baseURL: config.google.baseURL,
    })
    // Google provider 类型与 ai@7 LanguageModel union 有出入,沿用 `as any` 规避
    languageModels['google:gemini-2.0-flash'] = wrapLanguageModel({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      model: googleProvider('gemini-2.0-flash') as any,
      middleware: [],
    })
    languageModels['google:gemini-3-flash-preview'] = wrapLanguageModel({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      model: googleProvider('gemini-3-flash-preview') as any,
      middleware: [],
    })
  }

  return customProvider({ languageModels })
}

/**
 * 从 env 构建 LLMConfig。
 */
export function createLLMConfigFromEnv(): LLMConfig {
  return {
    dashscope: {
      apiKey: env.DASHSCOPE_API_KEY,
      baseURL: env.DASHSCOPE_BASE_URL,
    },
    google: env.GOOGLE_GENERATIVE_AI_API_KEY
      ? {
          apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
          baseURL: env.GOOGLE_GENERATIVE_BASE_URL,
        }
      : undefined,
  }
}

/**
 * 应用启动时创建的 Provider 单例。
 */
export const llmProvider: Provider = createLLMProvider(createLLMConfigFromEnv())

/**
 * 默认 agent 模型(用于审批代理等独立示例)。
 * 修复自原脚手架 `defaultAgentModel` 导出缺失的问题。
 */
export const defaultAgentModel: LanguageModel = llmProvider.languageModel(
  'dashscope:qwen3.7-plus',
)
