import { describe, expect, test } from 'bun:test'
import { allChatClientSideTools, getChatClientSideTools } from '../chat'
import type { ChatContextMode } from '../../types'

const EXPECTED_TOOL_NAMES = [
  'insertBlock',
  'updateBlock',
  'deleteBlock',
  'replaceBlocks',
  'moveBlock',
  'getDocumentSnapshot',
] as const

describe('allChatClientSideTools', () => {
  test('声明 6 个 client-side tools', () => {
    const toolNames = Object.keys(allChatClientSideTools)
    for (const name of EXPECTED_TOOL_NAMES) {
      expect(toolNames).toContain(name)
    }
    expect(toolNames.length).toBe(EXPECTED_TOOL_NAMES.length)
  })

  test('每个 tool 含 description 与 inputSchema,不含真正的 execute 逻辑(占位返回 ok)', async () => {
    for (const toolName of EXPECTED_TOOL_NAMES) {
      const tool = (allChatClientSideTools as Record<string, { description: string; inputSchema: unknown; execute?: (args: unknown) => Promise<unknown> }>)[toolName]
      expect(typeof tool.description).toBe('string')
      expect(tool.description.length).toBeGreaterThan(0)
      expect(tool.inputSchema).toBeDefined()
      expect(typeof tool.execute).toBe('function')
      // execute 是占位,返回 { ok: true }(实际执行在客户端 onToolCall)
      const result = await tool.execute({})
      expect(result).toEqual({ ok: true })
    }
  })
})

describe('getChatClientSideTools', () => {
  test('contextMode "none" 不声明 getDocumentSnapshot', () => {
    const tools = getChatClientSideTools('none' as ChatContextMode)
    const toolNames = Object.keys(tools)
    expect(toolNames).not.toContain('getDocumentSnapshot')
    expect(toolNames).toContain('insertBlock')
    expect(toolNames).toContain('updateBlock')
    expect(toolNames).toContain('deleteBlock')
    expect(toolNames).toContain('replaceBlocks')
    expect(toolNames).toContain('moveBlock')
    expect(toolNames.length).toBe(5)
  })

  test('contextMode "selection" 不声明 getDocumentSnapshot', () => {
    const tools = getChatClientSideTools('selection' as ChatContextMode)
    const toolNames = Object.keys(tools)
    expect(toolNames).not.toContain('getDocumentSnapshot')
    expect(toolNames.length).toBe(5)
  })

  test('contextMode "full" 声明全部 6 个 tools(含 getDocumentSnapshot)', () => {
    const tools = getChatClientSideTools('full' as ChatContextMode)
    const toolNames = Object.keys(tools)
    expect(toolNames).toContain('getDocumentSnapshot')
    expect(toolNames.length).toBe(6)
  })
})
