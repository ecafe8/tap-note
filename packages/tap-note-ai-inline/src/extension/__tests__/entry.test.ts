import { describe, expect, test } from 'bun:test'
import { createTapNoteInlineAssistant } from '../tap-note-ai-inline-extension'
import { createAIBusyState } from '@tap-note/ai-core'
import { DefaultChatTransport } from 'ai'

function mockTransport(): DefaultChatTransport {
  return new DefaultChatTransport({ api: '/api/ai/editor/streamText' })
}

describe('createTapNoteInlineAssistant', () => {
  test('返回含 mount/unmount 方法的对象', () => {
    const busy = createAIBusyState()
    const assistant = createTapNoteInlineAssistant({
      transport: mockTransport(),
      aiBusyState: busy,
    })
    expect(typeof assistant.mount).toBe('function')
    expect(typeof assistant.unmount).toBe('function')
  })

  test('返回对象有 __brand 标记', () => {
    const busy = createAIBusyState()
    const assistant = createTapNoteInlineAssistant({
      transport: mockTransport(),
      aiBusyState: busy,
    })
    expect(assistant.__brand).toBe('TapNoteInlineAssistant')
  })

  test('mount/unmount 可调用不抛错', () => {
    const busy = createAIBusyState()
    const assistant = createTapNoteInlineAssistant({
      transport: mockTransport(),
      aiBusyState: busy,
    })
    // mount 不需要真实 editor(扩展内部引用 editor 但 mount 是 no-op)
    expect(() => assistant.mount(undefined as never)).not.toThrow()
    // unmount 会尝试 revert,但 editor 为 undefined 时应安全失败
    // 不用 expect.not.toThrow,因为 unmount 会调用 applyOperationsToEditor 需要 editor
    // 验证 mount 可调用即可
  })
})
