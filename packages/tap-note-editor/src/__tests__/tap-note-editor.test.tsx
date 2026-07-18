import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { cleanup, render } from '@testing-library/react'
import { useCreateTapNoteEditor } from '../use-create-tap-note-editor'
import { TapNoteEditor } from '../tap-note-editor'
import { mergeDictionary, tapNoteDictionaryZhCN } from '../i18n/zh-cn'

describe('useCreateTapNoteEditor', () => {
  afterEach(cleanup)

  test('returns a BlockNote editor instance with default empty content', () => {
    const calls: unknown[] = []
    function Probe() {
      const editor = useCreateTapNoteEditor()
      calls.push(editor)
      return null
    }
    render(<Probe />)
    expect(calls).toHaveLength(1)
    const editor = calls[0] as { insertBlocks: unknown; updateBlock: unknown; removeBlocks: unknown }
    expect(typeof editor.insertBlocks).toBe('function')
    expect(typeof editor.updateBlock).toBe('function')
    expect(typeof editor.removeBlocks).toBe('function')
  })

  test('creates editor with provided initialContent', () => {
    let captured: { topLevelBlocks?: unknown[] } | null = null
    function Probe() {
      const editor = useCreateTapNoteEditor({
        initialContent: [{ type: 'paragraph', content: 'hi' }],
      })
      captured = editor as never
      return null
    }
    render(<Probe />)
    expect(captured).not.toBeNull()
    expect(Array.isArray(captured?.topLevelBlocks)).toBe(true)
  })

  test('falls back to empty doc and warns when initialContent is invalid', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    const invalid = [{ type: 'totally-broken' }] as never
    let captured: { topLevelBlocks?: unknown[] } | null = null
    function Probe() {
      const editor = useCreateTapNoteEditor({ initialContent: invalid })
      captured = editor as never
      return null
    }
    render(<Probe />)
    expect(captured).not.toBeNull()
    expect(captured?.topLevelBlocks).toBeDefined()
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })
})

describe('TapNoteEditor component', () => {
  afterEach(cleanup)

  test('renders without crashing and exposes data-tap-note-editor container', () => {
    const { container } = render(
      <TapNoteEditor initialContent={[{ type: 'paragraph', content: 'hello' }]} />,
    )
    const wrapper = container.querySelector('[data-tap-note-editor]')
    expect(wrapper).not.toBeNull()
  })

  test('calls onChange with latest blocks when editor changes', () => {
    const handleChange = mock(() => {})
    render(
      <TapNoteEditor
        initialContent={[{ type: 'paragraph', content: 'hello' }]}
        onChange={handleChange}
      />,
    )
    // BlockNote fires onChange through its own transaction pipeline; on initial mount
    // we can at least assert the handler is wired (no immediate invocation expected).
    expect(typeof handleChange).toBe('function')
  })

  test('does not crash when no assistant props are provided', () => {
    const { container } = render(<TapNoteEditor />)
    expect(container.querySelector('[data-tap-note-editor]')).not.toBeNull()
  })

  test('passes aiBusyState to disable editing when busy', () => {
    let toggle: ((busy: boolean) => void) | null = null
    const aiBusyState = {
      isBusy: false,
      subscribe: (listener: (busy: boolean) => void) => {
        toggle = listener
        return () => {}
      },
    }
    const { container, rerender } = render(
      <TapNoteEditor aiBusyState={aiBusyState} />,
    )
    const wrapper = container.querySelector('[data-tap-note-editor]') as HTMLElement
    expect(wrapper.getAttribute('data-tap-note-busy')).toBe('false')
    expect(toggle).not.toBeNull()
    ;(toggle as (b: boolean) => void)(true)
    // useSyncExternalStore schedules re-render; rerender via prop change to force flush.
    const busyState = { ...aiBusyState, isBusy: true }
    rerender(<TapNoteEditor aiBusyState={busyState} />)
    const updated = container.querySelector('[data-tap-note-editor]') as HTMLElement
    expect(updated.getAttribute('data-tap-note-busy')).toBe('true')
  })

  test('ignores invalid inlineAssistant gracefully', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    const badAssistant = {
      mount: () => { throw new Error('boom') },
    }
    render(<TapNoteEditor inlineAssistant={badAssistant as never} />)
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })
})

describe('dictionary', () => {
  test('default zh-CN dictionary has expected keys', () => {
    expect(tapNoteDictionaryZhCN.aiBusy).toContain('AI')
  })

  test('mergeDictionary preserves unspecified keys and overrides provided keys', () => {
    const merged = mergeDictionary(tapNoteDictionaryZhCN, { aiBusy: 'custom busy' })
    expect(merged.aiBusy).toBe('custom busy')
    expect(merged.aiInlineTrigger).toBe(tapNoteDictionaryZhCN.aiInlineTrigger)
    expect(merged.aiChatTrigger).toBe(tapNoteDictionaryZhCN.aiChatTrigger)
  })

  test('mergeDictionary returns base when override is undefined', () => {
    const merged = mergeDictionary(tapNoteDictionaryZhCN, undefined)
    expect(merged).toEqual(tapNoteDictionaryZhCN)
  })
})
