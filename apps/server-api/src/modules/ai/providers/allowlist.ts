import { env } from '../../../config/env'

/**
 * 模型能力标记。
 */
export interface ModelCapabilities {
  /** 是否支持流式工具调用(partial tool call streaming)。 */
  streamingTools?: boolean
  /** 是否支持多模态(图片输入)。 */
  multimodal?: boolean
  /** 是否支持思考过程(reasoning)。 */
  reasoning?: boolean
}

/**
 * allowlist 模型元数据。
 */
export interface ModelInfo {
  /** 模型 ID,形如 `<provider>:<model>`。 */
  id: string
  /** 人类可读标签。 */
  label: string
  /** Provider 名称。 */
  provider: string
  /** 模型能力。 */
  capabilities: ModelCapabilities
}

/**
 * 静态 allowlist(根据 env 配置过滤已配置的 provider)。
 * 服务端仅返回已配置且 allowlist 中的模型,拒绝未列出的 modelId,不回退默认。
 */
const STATIC_MODELS: ModelInfo[] = [
  {
    id: 'dashscope:qwen-plus',
    label: 'Qwen Plus',
    provider: 'dashscope',
    capabilities: { streamingTools: true, multimodal: false, reasoning: false },
  },
  {
    id: 'dashscope:qwen-max',
    label: 'Qwen Max',
    provider: 'dashscope',
    capabilities: { streamingTools: true, multimodal: false, reasoning: false },
  },
  {
    id: 'dashscope:qwen3-vl-flash',
    label: 'Qwen3 VL Flash',
    provider: 'dashscope',
    capabilities: { streamingTools: true, multimodal: true, reasoning: false },
  },
  {
    id: 'google:gemini-2.0-flash',
    label: 'Gemini 2.0 Flash',
    provider: 'google',
    capabilities: { streamingTools: true, multimodal: true, reasoning: false },
  },
  {
    id: 'google:gemini-3-flash-preview',
    label: 'Gemini 3 Flash Preview',
    provider: 'google',
    capabilities: { streamingTools: true, multimodal: true, reasoning: true },
  },
]

/**
 * 根据 env 配置过滤已配置且 allowlist 中的模型。
 * 未配置 `GOOGLE_GENERATIVE_AI_API_KEY` 时不返回 google:* 模型。
 */
export function getAllowlistedModels(): ModelInfo[] {
  const googleConfigured = Boolean(env.GOOGLE_GENERATIVE_AI_API_KEY)
  return STATIC_MODELS.filter((m) => {
    if (m.provider === 'google') {
      return googleConfigured
    }
    return true
  })
}

/**
 * 检查 modelId 是否在 allowlist 且对应 provider 已配置。
 */
export function isModelAllowed(modelId: string): boolean {
  return getAllowlistedModels().some((m) => m.id === modelId)
}
