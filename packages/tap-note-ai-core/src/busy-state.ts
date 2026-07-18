/**
 * AI 助手类型。
 */
export type AIBusyType = 'inline' | 'chat'

/**
 * `AIBusyState` 接口。会话级 AI 互斥状态,支持 `acquire(type)` / `release()` /
 * `subscribe(listener)` 与 `isBusy` 快照。
 *
 * 适配 React 19 `useSyncExternalStore`:`isBusy` 作为快照值,`subscribe` 返回
 * unsubscribe 函数。
 */
export interface AIBusyState {
  /** 当前是否忙。 */
  readonly isBusy: boolean
  /** 当前忙的 AI 类型(idle 时为 `undefined`)。 */
  readonly type?: AIBusyType
  /**
   * 互斥获取。若当前 idle 则置为 in-progress 并记录 `type`,返回 `true`。
   * 若已 in-progress 则返回 `false`,不改变状态。
   */
  acquire(type: AIBusyType): boolean
  /** 释放:置为 idle,清空 `type`,通知所有订阅者。 */
  release(): void
  /**
   * 注册监听器,返回 unsubscribe 函数。状态变化时调用 listener 携带新值。
   */
  subscribe(listener: (isBusy: boolean) => void): () => void
}

/**
 * 创建一个会话级 AI 互斥 busy 状态。
 *
 * 每个编辑器会话创建一个实例并注入内联与对话助手。任一 AI 进行中时另一助手
 * 入口禁用,完成/中止/失败/卸载后释放。不同编辑器会话创建独立实例互不阻塞。
 *
 * 用法:
 * ```ts
 * const busy = createAIBusyState()
 * if (busy.acquire('inline')) {
 *   // 开始内联 AI 任务
 *   // ...完成或失败后 busy.release()
 * }
 * // React 19 useSyncExternalStore 消费:
 * // const isBusy = useSyncExternalStore(busy.subscribe, () => busy.isBusy)
 * ```
 */
export function createAIBusyState(): AIBusyState {
  const listeners = new Set<(isBusy: boolean) => void>()
  let busy = false
  let currentType: AIBusyType | undefined

  function notify(): void {
    for (const listener of listeners) {
      listener(busy)
    }
  }

  return {
    get isBusy() {
      return busy
    },
    get type() {
      return currentType
    },
    acquire(type: AIBusyType): boolean {
      if (busy) {
        return false
      }
      busy = true
      currentType = type
      notify()
      return true
    },
    release(): void {
      if (!busy) {
        return
      }
      busy = false
      currentType = undefined
      notify()
    },
    subscribe(listener: (isBusy: boolean) => void): () => void {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
