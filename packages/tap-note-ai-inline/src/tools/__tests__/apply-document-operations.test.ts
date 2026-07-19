import { describe, expect, test } from 'bun:test'
import { serverApplyDocumentOperationsTool } from '../apply-document-operations'

describe('serverApplyDocumentOperationsTool', () => {
  test('工具描述存在', () => {
    expect(serverApplyDocumentOperationsTool.description).toBeDefined()
    expect(typeof serverApplyDocumentOperationsTool.description).toBe('string')
  })

  test('工具 inputSchema 存在', () => {
    expect(serverApplyDocumentOperationsTool.inputSchema).toBeDefined()
  })
})
