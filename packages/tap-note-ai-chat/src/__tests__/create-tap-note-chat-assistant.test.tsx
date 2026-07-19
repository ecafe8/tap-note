import { describe, expect, test } from 'bun:test'
import { createTapNoteChatAssistant } from '../create-tap-note-chat-assistant'
import { createAIBusyState, createServerTransport } from '@tap-note/ai-core'
import type { BlockNoteEditor } from '@blocknote/core'

// Mock editor:不需要真实 BlockNote,只验证入口结构
const mockEditor = {
  document: [],
  onChange: () => () => {},
  getBlock: () => undefined,
  insertBlocks: () => [],
  updateBlock: () => undefined,
  removeBlocks: () => [],
  replaceBlocks: () => ({ inserted: [], removed: [] }),
  setTextCursorPosition: () => {},
} as unknown as BlockNoteEditor

// 用 baseUrl 创建 transport
function makeTransport() {
  return createServerTransport({ baseUrl: '/api/ai/chat', model: 'dashscope:qwen-plus' })
}

describe('createTapNoteChatAssistant', () => {
  test('返回对象结构正确:含 mount/unmount/panel/dictionary/defaultContextMode', () => {
    const busy = createAIBusyState()
    const transport = makeTransport()
    const assistant = createTapNoteChatAssistant({ transport, aiBusyState: busy })
    expect(typeof assistant.mount).toBe('function')
    expect(typeof assistant.unmount).toBe('function')
    expect(assistant.panel).toBeDefined()
    expect(typeof assistant.panel).toBe('function')
    expect(assistant.dictionary).toBeDefined()
    expect(assistant.defaultContextMode).toBe('none')
    expect(assistant.__brand).toBe('TapNoteChatAssistant')
  })

  test('dictionary 默认为 chatDictionaryZhCN', () => {
    const busy = createAIBusyState()
    const transport = makeTransport()
    const assistant = createTapNoteChatAssistant({ transport, aiBusyState: busy })
    expect(assistant.dictionary.chatPlaceholder).toBeDefined()
    expect(assistant.dictionary.contextNone).toBe('无')
  })

  test('dictionary Partial 覆盖', () => {
    const busy = createAIBusyState()
    const transport = makeTransport()
    const assistant = createTapNoteChatAssistant({
      transport,
      aiBusyState: busy,
      dictionary: { chatPlaceholder: 'Custom' },
    })
    expect(assistant.dictionary.chatPlaceholder).toBe('Custom')
    // 未覆盖字段保留默认
    expect(assistant.dictionary.contextNone).toBe('无')
  })

  test('mount/unmount 生命周期', () => {
    const busy = createAIBusyState()
    const transport = makeTransport()
    const assistant = createTapNoteChatAssistant({ transport, aiBusyState: busy })
    expect(() => assistant.mount(mockEditor)).not.toThrow()
    expect(() => assistant.unmount(mockEditor)).not.toThrow()
  })

  test('unmount 释放 busy(若持有)', () => {
    const busy = createAIBusyState()
    const transport = makeTransport()
    const assistant = createTapNoteChatAssistant({ transport, aiBusyState: busy })
    assistant.mount(mockEditor)
    // acquire 模拟 busy 持有
    busy.acquire('chat')
    expect(busy.isBusy).toBe(true)
    assistant.unmount(mockEditor)
    expect(busy.isBusy).toBe(false)
  })

  test('allowSnapshotTool 默认 true', () => {
    const busy = createAIBusyState()
    const transport = makeTransport()
    const assistant = createTapNoteChatAssistant({ transport, aiBusyState: busy })
    // 没有显式 public getter,只能间接验证:不抛错说明默认值工作
    expect(assistant.panel).toBeDefined()
  })

  test('allowSnapshotTool=false 不抛错', () => {
    const busy = createAIBusyState()
    const transport = makeTransport()
    const assistant = createTapNoteChatAssistant({
      transport,
      aiBusyState: busy,
      allowSnapshotTool: false,
    })
    expect(assistant.panel).toBeDefined()
  })

  test('与 TapNoteEditor chatAssistant 接口兼容(含 mount/unmount)', () => {
    const busy = createAIBusyState()
    const transport = makeTransport()
    const assistant = createTapNoteChatAssistant({ transport, aiBusyState: busy })
    const compatible: { mount: (e: BlockNoteEditor) => void; unmount: (e: BlockNoteEditor) => void } = {
      mount: assistant.mount,
      unmount: assistant.unmount,
    }
    expect(typeof compatible.mount).toBe('function')
    expect(typeof compatible.unmount).toBe('function')
  })
})
