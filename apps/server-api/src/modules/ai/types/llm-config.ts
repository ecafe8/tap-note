/** DashScope Provider 配置 */
export interface DashScopeLLMConfig {
  apiKey: string
  baseURL?: string
}

/** Google Provider 配置 */
export interface GoogleLLMConfig {
  apiKey: string
  baseURL?: string
}

/** LLM Provider 统一配置 */
export interface LLMConfig {
  dashscope: DashScopeLLMConfig
  google?: GoogleLLMConfig
}
