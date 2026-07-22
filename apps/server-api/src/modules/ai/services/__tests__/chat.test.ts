import { describe, expect, test } from 'bun:test'
import { allChatClientSideTools } from '../chat'
import { CHAT_SYSTEM_PROMPT, replaceTextToolInputSchema, searchDocumentToolInputSchema } from '../../types/schema'

const EXPECTED_TOOL_NAMES = [
  'insertBlock',
  'updateBlock',
  'deleteBlock',
  'replaceBlocks',
  'moveBlock',
  'replaceText',
  'searchDocument',
  'getDocumentSnapshot',
] as const

type ToolDecl = { description: string; inputSchema: unknown; execute?: unknown }

describe('allChatClientSideTools', () => {
  test('声明 8 个 client-side tools', () => {
    const toolNames = Object.keys(allChatClientSideTools)
    for (const name of EXPECTED_TOOL_NAMES) {
      expect(toolNames).toContain(name)
    }
    expect(toolNames.length).toBe(EXPECTED_TOOL_NAMES.length)
  })

  test('每个 tool 含 description 与 inputSchema,且不提供 execute(client-side,由客户端执行)', () => {
    for (const toolName of EXPECTED_TOOL_NAMES) {
      const tool = (allChatClientSideTools as Record<string, ToolDecl>)[toolName]
      expect(typeof tool.description).toBe('string')
      expect(tool.description.length).toBeGreaterThan(0)
      expect(tool.inputSchema).toBeDefined()
      expect(tool.execute).toBeUndefined()
    }
  })

  test('replaceText inputSchema 接受合法输入', () => {
    const parsed = replaceTextToolInputSchema.parse({
      targetBlockId: 'block-1$',
      from: 6,
      to: 11,
      expectedText: 'world',
      replacement: '斜线',
      baseDocumentRevision: 0,
    })
    expect(parsed.targetBlockId).toBe('block-1$')
    expect(parsed.from).toBe(6)
    expect(parsed.to).toBe(11)
  })

  test('replaceText inputSchema 拒绝缺少 expectedText 的输入', () => {
    expect(() =>
      replaceTextToolInputSchema.parse({
        targetBlockId: 'block-1$',
        from: 6,
        to: 11,
        replacement: '斜线',
        baseDocumentRevision: 0,
      }),
    ).toThrow()
  })

  test('searchDocument inputSchema 接受合法输入', () => {
    const parsed = searchDocumentToolInputSchema.parse({
      query: 'slash',
      isRegex: false,
      maxResults: 10,
    })
    expect(parsed.query).toBe('slash')
    expect(parsed.isRegex).toBe(false)
  })

  test('searchDocument inputSchema 拒绝空 query', () => {
    expect(() => searchDocumentToolInputSchema.parse({ query: '' })).toThrow()
  })
})

describe('CHAT_SYSTEM_PROMPT', () => {
  test('已配置且约束必须调用工具才能修改文档', () => {
    expect(typeof CHAT_SYSTEM_PROMPT).toBe('string')
    expect(CHAT_SYSTEM_PROMPT.length).toBeGreaterThan(0)
    expect(CHAT_SYSTEM_PROMPT).toContain('MUST call one of the editing tools')
    expect(CHAT_SYSTEM_PROMPT).toContain('replaceText')
  })

  test('要求缺少上下文时主动用 searchDocument 读取,而非向用户索要内容', () => {
    expect(CHAT_SYSTEM_PROMPT).toContain('searchDocument')
    expect(CHAT_SYSTEM_PROMPT).toContain('NEVER ask the user to paste')
  })

  test('禁止把内部文档状态和工具协议泄露给用户', () => {
    expect(CHAT_SYSTEM_PROMPT).toContain('Treat document snapshots')
    expect(CHAT_SYSTEM_PROMPT).toContain('NEVER print, quote, dump')
    expect(CHAT_SYSTEM_PROMPT).toContain('one concise user-facing sentence')
  })
})
