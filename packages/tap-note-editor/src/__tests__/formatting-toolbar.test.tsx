import { afterEach, describe, expect, mock, test } from 'bun:test'
import { cleanup, render, fireEvent } from '@testing-library/react'
import { createElement } from 'react'
import { AIToolbarTools } from '../formatting-toolbar/ai-toolbar-tools'
import { AIToolbarInput } from '../formatting-toolbar/ai-toolbar-input'
import { AIToolbarStatus } from '../formatting-toolbar/ai-toolbar-status'
import { createDefaultAITools } from '../formatting-toolbar/ai-tools'
import { tapNoteDictionaryZhCN } from '../i18n/zh-cn'
import type { TapNoteInlineAssistantContext, AIInlineStatus } from '../types'

function createMockContext(status: AIInlineStatus = 'user-input', error?: string): TapNoteInlineAssistantContext {
  let currentState: { status: AIInlineStatus; error?: string } = { status, error }
  const listeners = new Set<() => void>()

  return {
    submit: mock(() => {
      currentState = { status: 'thinking' }
      listeners.forEach((l) => l())
    }),
    accept: mock(() => {
      currentState = { status: 'user-input' }
      listeners.forEach((l) => l())
    }),
    reject: mock(() => {
      currentState = { status: 'user-input' }
      listeners.forEach((l) => l())
    }),
    abort: mock(() => {
      currentState = { status: 'user-input' }
      listeners.forEach((l) => l())
    }),
    retry: mock(() => {
      currentState = { status: 'thinking' }
      listeners.forEach((l) => l())
    }),
    close: mock(() => {
      currentState = { status: 'user-input' }
      listeners.forEach((l) => l())
    }),
    store: {
      state: {
        get state() {
          return currentState
        },
      },
      subscribe: (listener: () => void) => {
        listeners.add(listener)
        return () => { listeners.delete(listener) }
      },
    },
  }
}

describe('AIToolbarTools', () => {
  afterEach(cleanup)

  test('renders all tools', () => {
    const tools = createDefaultAITools(tapNoteDictionaryZhCN)
    const { container } = render(
      createElement(AIToolbarTools, { tools, onSelect: mock(() => {}) }),
    )
    const items = container.querySelectorAll('.tn-ai-tool-item')
    expect(items.length).toBe(4)
  })

  test('renders nothing when tools is empty', () => {
    const { container } = render(
      createElement(AIToolbarTools, { tools: [], onSelect: mock(() => {}) }),
    )
    expect(container.innerHTML).toBe('')
  })

  test('renders custom tools with labels', () => {
    const tools = [{ id: 'test', label: 'Test Tool', prompt: 'do something' }]
    const { container } = render(
      createElement(AIToolbarTools, { tools, onSelect: mock(() => {}) }),
    )
    const items = container.querySelectorAll('.tn-ai-tool-item')
    expect(items.length).toBe(1)
    expect(items[0]?.textContent).toContain('Test Tool')
  })

  test('clicking a tool calls onSelect with the tool', () => {
    const tools = [{ id: 'test', label: 'Test', prompt: 'test prompt' }]
    const onSelect = mock(() => {})
    const { container } = render(
      createElement(AIToolbarTools, { tools, onSelect }),
    )
    const item = container.querySelector('.tn-ai-tool-item')!
    fireEvent.click(item)
    expect(onSelect).toHaveBeenCalledWith(tools[0])
  })

  test('has role listbox', () => {
    const tools = createDefaultAITools(tapNoteDictionaryZhCN)
    const { container } = render(
      createElement(AIToolbarTools, { tools, onSelect: mock(() => {}) }),
    )
    const listbox = container.querySelector('[role="listbox"]')
    expect(listbox).not.toBeNull()
  })

  test('tool items have role option', () => {
    const tools = createDefaultAITools(tapNoteDictionaryZhCN)
    const { container } = render(
      createElement(AIToolbarTools, { tools, onSelect: mock(() => {}) }),
    )
    const options = container.querySelectorAll('[role="option"]')
    expect(options.length).toBe(4)
  })
})

describe('AIToolbarInput', () => {
  afterEach(cleanup)

  test('renders input with placeholder', () => {
    const { container } = render(
      createElement(AIToolbarInput, {
        dictionary: tapNoteDictionaryZhCN,
        onSubmit: mock(() => {}),
        onClose: mock(() => {}),
        onAbortAndClose: mock(() => {}),
        processing: false,
      }),
    )
    const input = container.querySelector('.tn-ai-input') as HTMLInputElement
    expect(input).not.toBeNull()
    expect(input.placeholder).toBe(tapNoteDictionaryZhCN.aiToolbarPlaceholder)
  })

  test('Enter submits non-empty input', () => {
    const onSubmit = mock(() => {})
    const { container } = render(
      createElement(AIToolbarInput, {
        dictionary: tapNoteDictionaryZhCN,
        onSubmit,
        onClose: mock(() => {}),
        onAbortAndClose: mock(() => {}),
        processing: false,
      }),
    )
    const input = container.querySelector('.tn-ai-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'hello' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledWith('hello')
  })

  test('Enter does not submit empty input', () => {
    const onSubmit = mock(() => {})
    const { container } = render(
      createElement(AIToolbarInput, {
        dictionary: tapNoteDictionaryZhCN,
        onSubmit,
        onClose: mock(() => {}),
        onAbortAndClose: mock(() => {}),
        processing: false,
      }),
    )
    const input = container.querySelector('.tn-ai-input') as HTMLInputElement
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  test('Escape calls onClose when not processing', () => {
    const onClose = mock(() => {})
    const onAbortAndClose = mock(() => {})
    const { container } = render(
      createElement(AIToolbarInput, {
        dictionary: tapNoteDictionaryZhCN,
        onSubmit: mock(() => {}),
        onClose,
        onAbortAndClose,
        processing: false,
      }),
    )
    const input = container.querySelector('.tn-ai-input') as HTMLInputElement
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
    expect(onAbortAndClose).not.toHaveBeenCalled()
  })

  test('Escape calls onAbortAndClose when processing', () => {
    const onClose = mock(() => {})
    const onAbortAndClose = mock(() => {})
    const { container } = render(
      createElement(AIToolbarInput, {
        dictionary: tapNoteDictionaryZhCN,
        onSubmit: mock(() => {}),
        onClose,
        onAbortAndClose,
        processing: true,
      }),
    )
    const input = container.querySelector('.tn-ai-input') as HTMLInputElement
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onAbortAndClose).toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  test('send button is disabled when input is empty', () => {
    const { container } = render(
      createElement(AIToolbarInput, {
        dictionary: tapNoteDictionaryZhCN,
        onSubmit: mock(() => {}),
        onClose: mock(() => {}),
        onAbortAndClose: mock(() => {}),
        processing: false,
      }),
    )
    const sendBtn = container.querySelector('.tn-ai-send-btn') as HTMLButtonElement
    expect(sendBtn.disabled).toBe(true)
  })

  test('send button is enabled when input has content', () => {
    const { container } = render(
      createElement(AIToolbarInput, {
        dictionary: tapNoteDictionaryZhCN,
        onSubmit: mock(() => {}),
        onClose: mock(() => {}),
        onAbortAndClose: mock(() => {}),
        processing: false,
      }),
    )
    const input = container.querySelector('.tn-ai-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'text' } })
    const sendBtn = container.querySelector('.tn-ai-send-btn') as HTMLButtonElement
    expect(sendBtn.disabled).toBe(false)
  })
})

describe('AIToolbarStatus', () => {
  afterEach(cleanup)

  test('shows writing status and abort button for ai-writing', () => {
    const context = createMockContext('ai-writing')
    const { container } = render(
      createElement(AIToolbarStatus, {
        status: 'ai-writing' as AIInlineStatus,
        dictionary: tapNoteDictionaryZhCN,
        context,
        onClose: mock(() => {}),
      }),
    )
    expect(container.textContent).toContain(tapNoteDictionaryZhCN.aiToolbarWriting)
    const abortBtn = container.querySelector('.tn-ai-abort-btn')
    expect(abortBtn).not.toBeNull()
  })

  test('abort button calls context.abort', () => {
    const context = createMockContext('thinking')
    const { container } = render(
      createElement(AIToolbarStatus, {
        status: 'thinking' as AIInlineStatus,
        dictionary: tapNoteDictionaryZhCN,
        context,
        onClose: mock(() => {}),
      }),
    )
    const abortBtn = container.querySelector('.tn-ai-abort-btn')!
    fireEvent.click(abortBtn)
    expect(context.abort).toHaveBeenCalled()
  })

  test('shows accept and reject buttons for user-reviewing', () => {
    const context = createMockContext('user-reviewing')
    const { container } = render(
      createElement(AIToolbarStatus, {
        status: 'user-reviewing' as AIInlineStatus,
        dictionary: tapNoteDictionaryZhCN,
        context,
        onClose: mock(() => {}),
      }),
    )
    const acceptBtn = container.querySelector('.tn-ai-accept-btn')
    const rejectBtn = container.querySelector('.tn-ai-reject-btn')
    expect(acceptBtn).not.toBeNull()
    expect(rejectBtn).not.toBeNull()
  })

  test('accept calls context.accept and onClose', () => {
    const context = createMockContext('user-reviewing')
    const onClose = mock(() => {})
    const { container } = render(
      createElement(AIToolbarStatus, {
        status: 'user-reviewing' as AIInlineStatus,
        dictionary: tapNoteDictionaryZhCN,
        context,
        onClose,
      }),
    )
    const acceptBtn = container.querySelector('.tn-ai-accept-btn')!
    fireEvent.click(acceptBtn)
    expect(context.accept).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  test('reject calls context.reject and onClose', () => {
    const context = createMockContext('user-reviewing')
    const onClose = mock(() => {})
    const { container } = render(
      createElement(AIToolbarStatus, {
        status: 'user-reviewing' as AIInlineStatus,
        dictionary: tapNoteDictionaryZhCN,
        context,
        onClose,
      }),
    )
    const rejectBtn = container.querySelector('.tn-ai-reject-btn')!
    fireEvent.click(rejectBtn)
    expect(context.reject).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  test('shows error message and retry button for error status', () => {
    const context = createMockContext('error', 'Something went wrong')
    const { container } = render(
      createElement(AIToolbarStatus, {
        status: 'error' as AIInlineStatus,
        error: 'Something went wrong',
        dictionary: tapNoteDictionaryZhCN,
        context,
        onClose: mock(() => {}),
      }),
    )
    expect(container.textContent).toContain('Something went wrong')
    const retryBtn = container.querySelector('.tn-ai-retry-btn')
    expect(retryBtn).not.toBeNull()
  })

  test('retry calls context.retry', () => {
    const context = createMockContext('error', 'err')
    const { container } = render(
      createElement(AIToolbarStatus, {
        status: 'error' as AIInlineStatus,
        error: 'err',
        dictionary: tapNoteDictionaryZhCN,
        context,
        onClose: mock(() => {}),
      }),
    )
    const retryBtn = container.querySelector('.tn-ai-retry-btn')!
    fireEvent.click(retryBtn)
    expect(context.retry).toHaveBeenCalled()
  })

  test('returns null for user-input status', () => {
    const context = createMockContext('user-input')
    const { container } = render(
      createElement(AIToolbarStatus, {
        status: 'user-input' as AIInlineStatus,
        dictionary: tapNoteDictionaryZhCN,
        context,
        onClose: mock(() => {}),
      }),
    )
    expect(container.innerHTML).toBe('')
  })
})

describe('createDefaultAITools', () => {
  test('returns 4 default tools', () => {
    const tools = createDefaultAITools(tapNoteDictionaryZhCN)
    expect(tools.length).toBe(4)
  })

  test('tools have correct ids', () => {
    const tools = createDefaultAITools(tapNoteDictionaryZhCN)
    const ids = tools.map((t) => t.id)
    expect(ids).toEqual(['expand', 'summarize', 'polish', 'shorten'])
  })

  test('tools have labels from dictionary', () => {
    const tools = createDefaultAITools(tapNoteDictionaryZhCN)
    expect(tools[0]!.label).toBe(tapNoteDictionaryZhCN.aiToolExpand)
    expect(tools[1]!.label).toBe(tapNoteDictionaryZhCN.aiToolSummarize)
    expect(tools[2]!.label).toBe(tapNoteDictionaryZhCN.aiToolPolish)
    expect(tools[3]!.label).toBe(tapNoteDictionaryZhCN.aiToolShorten)
  })

  test('tools have prompts', () => {
    const tools = createDefaultAITools(tapNoteDictionaryZhCN)
    for (const tool of tools) {
      expect(tool.prompt.length).toBeGreaterThan(0)
    }
  })

  test('tools have icons', () => {
    const tools = createDefaultAITools(tapNoteDictionaryZhCN)
    for (const tool of tools) {
      expect(tool.icon).toBeDefined()
    }
  })
})
