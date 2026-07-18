import { describe, expect, test } from 'bun:test'
import { listModels } from '../list-models'
import { ContextTooLargeError, ModelNotAllowedError } from '../../../../errors/app-error'

describe('listModels', () => {
  test('返回 allowlist 模型(未配置 Google 时只有 dashscope)', () => {
    const result = listModels()
    expect(result.models.length).toBeGreaterThanOrEqual(3)
    const dashscopeModels = result.models.filter((m) => m.provider === 'dashscope')
    expect(dashscopeModels.length).toBe(3)
    const googleModels = result.models.filter((m) => m.provider === 'google')
    expect(googleModels.length).toBe(0) // setup-env 未配置 Google
  })

  test('每个模型有 id/label/provider/capabilities', () => {
    const result = listModels()
    for (const m of result.models) {
      expect(typeof m.id).toBe('string')
      expect(typeof m.label).toBe('string')
      expect(typeof m.provider).toBe('string')
      expect(m.capabilities).toBeDefined()
    }
  })
})

describe('services error types', () => {
  test('ContextTooLargeError 携带估算 token 与上限', () => {
    const err = new ContextTooLargeError(50000, 30000)
    expect(err.estimatedTokens).toBe(50000)
    expect(err.maxTokens).toBe(30000)
  })

  test('ModelNotAllowedError 携带 modelId', () => {
    const err = new ModelNotAllowedError('unknown:model')
    expect(err.modelId).toBe('unknown:model')
  })
})
