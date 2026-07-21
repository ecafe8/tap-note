import type { BlockNoteEditor, PartialBlock } from '@blocknote/core'

/**
 * 选区快照:用户在编辑器中最后一次显式选中的块范围。
 *
 * 编辑器失焦(如点击外置 AI 输入框)后,浏览器原生选区会折叠,实时
 * `editor.getSelection()` 可能拿不到选区。`SelectionTracker` 在选区变化时
 * 主动捕获非空选区并保留,供 AI 发送时复用,避免「点输入框即丢选区」。
 */
export interface SelectionSnapshot {
  /** 选区覆盖的块(原始 BlockNote 块,id 未加 `$` 后缀)。 */
  blocks: PartialBlock[]
  /** 选区起始块 ID。 */
  startBlockId: string
  /** 选区结束块 ID。 */
  endBlockId: string
  /** 选区覆盖的块数量。 */
  blockCount: number
}

/**
 * `SelectionTracker` 实例。持续跟踪编辑器最后一次非空选区,失焦后保留,
 * 适配 React 19 `useSyncExternalStore`(用 `subscribe` + `getSnapshot`)。
 */
export interface SelectionTracker {
  /** 当前选区快照(无显式选区或已清除时为 `undefined`)。 */
  getSnapshot(): SelectionSnapshot | undefined
  /** 用户主动清除选区快照(如点击 chip 的 ✕)。 */
  clear(): void
  /** 注册监听器,返回 unsubscribe 函数。快照变化时触发。 */
  subscribe(listener: () => void): () => void
  /** 销毁选区订阅,释放资源。 */
  dispose(): void
}

/**
 * 创建 `SelectionTracker`。
 *
 * 订阅 `editor.onSelectionChange`,每次选区变为非空时更新快照;选区折叠或
 * 编辑器失焦时**保留**最后一次非空快照(不清空),确保用户点击外置 AI 输入框
 * 后选区仍可用。仅 `clear()` 显式清除。
 *
 * 用法:
 * ```ts
 * const tracker = createSelectionTracker(editor)
 * // React: const snap = useSyncExternalStore(tracker.subscribe, tracker.getSnapshot)
 * const snap = tracker.getSnapshot()
 * tracker.dispose()
 * ```
 */
export function createSelectionTracker(editor: BlockNoteEditor): SelectionTracker {
  let snapshot: SelectionSnapshot | undefined
  const listeners = new Set<() => void>()
  let disposed = false

  function notify(): void {
    for (const listener of listeners) {
      listener()
    }
  }

  function captureFromEditor(): SelectionSnapshot | undefined {
    try {
      const selection = editor.getSelection()
      if (!selection || selection.blocks.length === 0) {
        return undefined
      }
      const blocks = selection.blocks as PartialBlock[]
      const ids = blocks
        .map((b) => b.id)
        .filter((id): id is string => typeof id === 'string')
      if (ids.length === 0) {
        return undefined
      }
      return {
        blocks,
        startBlockId: ids[0]!,
        endBlockId: ids[ids.length - 1]!,
        blockCount: blocks.length,
      }
    } catch {
      return undefined
    }
  }

  const unsubscribe = typeof editor.onSelectionChange === 'function'
    ? editor.onSelectionChange(() => {
        if (disposed) return
        const next = captureFromEditor()
        // 只在出现非空选区时更新;折叠/失焦保留上一次快照,避免点击外置输入框即丢选区。
        if (next) {
          snapshot = next
          notify()
        }
      })
    : () => {}

  // 创建时立即捕获当前选区(用户可能先选中文字,再打开 AI 面板挂载 tracker)。
  snapshot = captureFromEditor()

  return {
    getSnapshot(): SelectionSnapshot | undefined {
      return snapshot
    },
    clear(): void {
      if (disposed || !snapshot) return
      snapshot = undefined
      notify()
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    dispose(): void {
      if (disposed) return
      disposed = true
      try {
        unsubscribe()
      } catch {
        // editor 已销毁时忽略
      }
      listeners.clear()
    },
  }
}
