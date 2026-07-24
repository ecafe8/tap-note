import { describe, expect, test } from 'bun:test'
import type { TapNoteInlineAssistantContext, AIInlineStatus } from '../types'

describe('TapNoteInlineAssistantContext duck typing', () => {
  test('ai-inline context shape is structurally compatible', () => {
    const mockContext = {
      submit: (prompt: string) => { void prompt },
      accept: () => {},
      reject: () => {},
      abort: () => {},
      retry: () => {},
      close: () => {},
      store: {
        state: {
          state: { status: 'user-input' as const },
        },
        subscribe: (listener: () => void) => { void listener; return () => {} },
      },
      editor: {},
      dictionary: {},
    }

    const ctx: TapNoteInlineAssistantContext = mockContext
    expect(ctx.submit).toBeDefined()
    expect(ctx.accept).toBeDefined()
    expect(ctx.reject).toBeDefined()
    expect(ctx.abort).toBeDefined()
    expect(ctx.retry).toBeDefined()
    expect(ctx.close).toBeDefined()
    expect(ctx.store.state.state.status).toBe('user-input')
    expect(typeof ctx.store.subscribe).toBe('function')
  })

  test('all AIInlineStatus values are valid', () => {
    const statuses: AIInlineStatus[] = [
      'user-input',
      'thinking',
      'ai-writing',
      'user-reviewing',
      'error',
    ]
    expect(statuses.length).toBe(5)
  })

  test('store state with error is compatible', () => {
    const errorState: TapNoteInlineAssistantContext['store'] = {
      state: {
        state: { status: 'error', error: 'something failed' },
      },
      subscribe: () => () => {},
    }
    expect(errorState.state.state.status).toBe('error')
    expect(errorState.state.state.error).toBe('something failed')
  })

  test('extra fields on context do not break compatibility', () => {
    const extendedContext = {
      submit: (prompt: string) => { void prompt },
      accept: () => {},
      reject: () => {},
      abort: () => {},
      retry: () => {},
      close: () => {},
      store: {
        state: { state: { status: 'thinking' as const } },
        subscribe: (listener: () => void) => { void listener; return () => {} },
      },
      editor: { document: [] },
      dictionary: { aiBusy: 'busy' },
      extraField: 'should not break',
    }

    const ctx: TapNoteInlineAssistantContext = extendedContext
    expect(ctx.store.state.state.status).toBe('thinking')
  })
})
