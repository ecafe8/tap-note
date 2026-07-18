/**
 * 模型 ID 常量。
 */
export const MODEL_IDS = {
  DASHSCOPE_QWEN_PLUS: 'dashscope:qwen-plus',
  DASHSCOPE_QWEN_MAX: 'dashscope:qwen-max',
  DASHSCOPE_QWEN3_VL_FLASH: 'dashscope:qwen3-vl-flash',
  GOOGLE_GEMINI_2_0_FLASH: 'google:gemini-2.0-flash',
  GOOGLE_GEMINI_3_FLASH_PREVIEW: 'google:gemini-3-flash-preview',
} as const

/**
 * 端点路径常量。
 */
export const ENDPOINTS = {
  EDITOR_STREAM_TEXT: '/api/ai/editor/streamText',
  CHAT: '/api/ai/chat',
  MODELS: '/api/ai/models',
  PROXY: '/api/ai/proxy',
  AGENTS_APPROVAL: '/api/ai/agents/approval',
  HEALTH: '/health',
  READY: '/ready',
} as const
