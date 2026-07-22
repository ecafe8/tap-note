import { describe, expect, test } from 'bun:test'
import { getAllowlistedModels, isModelAllowed } from '../allowlist'

describe('allowlist', () => {
  test('getAllowlistedModels 返回 dashscope 模型(未配置 Google 时)', () => {
    const models = getAllowlistedModels()
    // setup-env 默认未设置 GOOGLE_GENERATIVE_AI_API_KEY
    const dashscopeModels = models.filter((m) => m.provider === 'dashscope')
    expect(dashscopeModels.length).toBe(3)
    expect(dashscopeModels.map((m) => m.id)).toContain('dashscope:qwen3.7-plus')
    expect(dashscopeModels.map((m) => m.id)).toContain('dashscope:qwen3.7-max')
    expect(dashscopeModels.map((m) => m.id)).toContain('dashscope:qwen3-vl-flash')
  })

  test('未配置 Google 时不返回 google:* 模型', () => {
    const models = getAllowlistedModels()
    const googleModels = models.filter((m) => m.provider === 'google')
    expect(googleModels.length).toBe(0)
  })

  test('isModelAllowed 对已列出 modelId 返回 true', () => {
    expect(isModelAllowed('dashscope:qwen3.7-plus')).toBe(true)
    expect(isModelAllowed('dashscope:qwen3.7-max')).toBe(true)
    expect(isModelAllowed('dashscope:qwen3-vl-flash')).toBe(true)
  })

  test('isModelAllowed 对未列出 modelId 返回 false', () => {
    expect(isModelAllowed('unknown:model')).toBe(false)
    expect(isModelAllowed('dashscope:unknown')).toBe(false)
    expect(isModelAllowed('')).toBe(false)
  })

  test('isModelAllowed 对未配置的 google 模型返回 false', () => {
    expect(isModelAllowed('google:gemini-2.0-flash')).toBe(false)
    expect(isModelAllowed('google:gemini-3-flash-preview')).toBe(false)
  })
})

describe('providers', () => {
  test('defaultAgentModel 正确导出', async () => {
    const mod = await import('../index')
    expect(mod.defaultAgentModel).toBeDefined()
    expect(typeof mod.defaultAgentModel).toBe('object')
  })

  test('llmProvider 正确导出', async () => {
    const mod = await import('../index')
    expect(mod.llmProvider).toBeDefined()
    expect(typeof mod.llmProvider.languageModel).toBe('function')
  })

  test('resolveModel 对 allowlist 中的 modelId 返回 LanguageModel', async () => {
    const { resolveModel } = await import('../../services/resolve-model')
    const model = resolveModel('dashscope:qwen3.7-plus')
    expect(model).toBeDefined()
  })

  test('resolveModel 对未列出 modelId 抛 ModelNotAllowedError', async () => {
    const { resolveModel } = await import('../../services/resolve-model')
    const { ModelNotAllowedError } = await import('../../../../errors/app-error')
    expect(() => resolveModel('unknown:model')).toThrow(ModelNotAllowedError)
  })
})
