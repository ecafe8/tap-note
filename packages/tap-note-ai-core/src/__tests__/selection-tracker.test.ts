import { BlockNoteEditor } from '@blocknote/core'
import { beforeEach, describe, expect, test } from 'bun:test'
import { createSelectionTracker } from '../selection-tracker'

function createEditor(): BlockNoteEditor {
  return BlockNoteEditor.create({
    initialContent: [
      { type: 'paragraph', id: 'block-1', content: 'first' },
      { type: 'paragraph', id: 'block-2', content: 'second' },
      { type: 'paragraph', id: 'block-3', content: 'third' },
    ],
  })
}

describe('createSelectionTracker', () => {
  let editor: BlockNoteEditor

  beforeEach(() => {
    editor = createEditor()
  })

  test('创建时立即捕获已存在的选区', () => {
    editor.setSelection('block-1', 'block-2')
    const tracker = createSelectionTracker(editor)
    const snap = tracker.getSnapshot()
    expect(snap).toBeDefined()
    expect(snap?.startBlockId).toBe('block-1')
    expect(snap?.endBlockId).toBe('block-2')
    expect(snap?.blockCount).toBe(2)
    tracker.dispose()
  })

  test('无选区时快照为 undefined', () => {
    const tracker = createSelectionTracker(editor)
    expect(tracker.getSnapshot()).toBeUndefined()
    tracker.dispose()
  })

  test('选区变化时更新快照(onSelectionChange)', () => {
    const tracker = createSelectionTracker(editor)
    editor.setSelection('block-2', 'block-3')
    const snap = tracker.getSnapshot()
    expect(snap?.startBlockId).toBe('block-2')
    expect(snap?.endBlockId).toBe('block-3')
    tracker.dispose()
  })

  test('选区折叠为光标后保留上一次快照(模拟失焦/点输入框)', () => {
    editor.setSelection('block-1', 'block-2')
    const tracker = createSelectionTracker(editor)
    // 折叠选区到单块光标,getSelection() 将返回 undefined
    editor.setTextCursorPosition('block-3')
    const snap = tracker.getSnapshot()
    expect(snap).toBeDefined()
    expect(snap?.startBlockId).toBe('block-1')
    expect(snap?.endBlockId).toBe('block-2')
    tracker.dispose()
  })

  test('clear 清除快照并通知订阅者', () => {
    editor.setSelection('block-1', 'block-2')
    const tracker = createSelectionTracker(editor)
    let notified = 0
    const unsubscribe = tracker.subscribe(() => {
      notified += 1
    })
    tracker.clear()
    expect(tracker.getSnapshot()).toBeUndefined()
    expect(notified).toBe(1)
    unsubscribe()
    tracker.dispose()
  })

  test('clear 无快照时不通知', () => {
    const tracker = createSelectionTracker(editor)
    let notified = 0
    const unsubscribe = tracker.subscribe(() => {
      notified += 1
    })
    tracker.clear()
    expect(notified).toBe(0)
    unsubscribe()
    tracker.dispose()
  })

  test('新选区出现时通知订阅者', () => {
    const tracker = createSelectionTracker(editor)
    let notified = 0
    const unsubscribe = tracker.subscribe(() => {
      notified += 1
    })
    editor.setSelection('block-1', 'block-3')
    expect(notified).toBeGreaterThanOrEqual(1)
    unsubscribe()
    tracker.dispose()
  })

  test('dispose 后不再跟踪选区变化', () => {
    const tracker = createSelectionTracker(editor)
    tracker.dispose()
    editor.setSelection('block-1', 'block-2')
    expect(tracker.getSnapshot()).toBeUndefined()
  })
})
