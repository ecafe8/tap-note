import { describe, expect, mock, test } from 'bun:test'
import { createAIBusyState } from '../busy-state'

describe('createAIBusyState', () => {
  test('初始状态 idle,isBusy 为 false', () => {
    const busy = createAIBusyState()
    expect(busy.isBusy).toBe(false)
    expect(busy.type).toBeUndefined()
  })

  test('acquire 成功返回 true 并置为 busy', () => {
    const busy = createAIBusyState()
    const result = busy.acquire('inline')
    expect(result).toBe(true)
    expect(busy.isBusy).toBe(true)
    expect(busy.type).toBe('inline')
  })

  test('acquire 在 idle 时成功,在 busy 时返回 false(互斥)', () => {
    const busy = createAIBusyState()
    expect(busy.acquire('inline')).toBe(true)
    // 已 busy,第二次 acquire 失败
    expect(busy.acquire('chat')).toBe(false)
    // 状态保持第一次 acquire 的 type
    expect(busy.type).toBe('inline')
  })

  test('release 后可重新 acquire', () => {
    const busy = createAIBusyState()
    busy.acquire('inline')
    busy.release()
    expect(busy.isBusy).toBe(false)
    expect(busy.type).toBeUndefined()
    // 释放后另一类型可获取
    expect(busy.acquire('chat')).toBe(true)
    expect(busy.type).toBe('chat')
  })

  test('release 在 idle 时是 no-op', () => {
    const busy = createAIBusyState()
    expect(() => busy.release()).not.toThrow()
    expect(busy.isBusy).toBe(false)
  })

  test('subscribe 返回 unsubscribe 函数', () => {
    const busy = createAIBusyState()
    const listener = mock(() => {})
    const unsubscribe = busy.subscribe(listener)
    expect(typeof unsubscribe).toBe('function')
    busy.acquire('inline')
    expect(listener).toHaveBeenCalledTimes(1)
    expect(listener.mock.calls[0]?.[0]).toBe(true)
    unsubscribe()
  })

  test('unsubscribe 后不再收到通知', () => {
    const busy = createAIBusyState()
    const listener = mock(() => {})
    const unsubscribe = busy.subscribe(listener)
    unsubscribe()
    busy.acquire('inline')
    expect(listener).not.toHaveBeenCalled()
  })

  test('状态变化时通知所有订阅者', () => {
    const busy = createAIBusyState()
    const l1 = mock(() => {})
    const l2 = mock(() => {})
    busy.subscribe(l1)
    busy.subscribe(l2)
    busy.acquire('inline')
    expect(l1).toHaveBeenCalledTimes(1)
    expect(l2).toHaveBeenCalledTimes(1)
    busy.release()
    expect(l1).toHaveBeenCalledTimes(2)
    expect(l2).toHaveBeenCalledTimes(2)
    expect(l1.mock.calls[1]?.[0]).toBe(false)
  })

  test('订阅者收到的值是当前 isBusy 快照', () => {
    const busy = createAIBusyState()
    const received: boolean[] = []
    busy.subscribe((isBusy) => received.push(isBusy))
    busy.acquire('inline')
    busy.release()
    expect(received).toEqual([true, false])
  })

  test('跨包共享:同一 busy 实例可被内联与对话助手共享', () => {
    const busy = createAIBusyState()
    // 内联助手获取
    expect(busy.acquire('inline')).toBe(true)
    // 对话助手尝试获取(失败)
    expect(busy.acquire('chat')).toBe(false)
    // 内联释放
    busy.release()
    // 对话助手现在可获取
    expect(busy.acquire('chat')).toBe(true)
    busy.release()
  })

  test('不同 busy 实例互不阻塞(不同编辑器会话)', () => {
    const session1 = createAIBusyState()
    const session2 = createAIBusyState()
    expect(session1.acquire('inline')).toBe(true)
    // 不同会话不互相阻塞
    expect(session2.acquire('chat')).toBe(true)
    expect(session1.isBusy).toBe(true)
    expect(session2.isBusy).toBe(true)
    session1.release()
    session2.release()
  })

  test('acquire/release 生命周期完整', () => {
    const busy = createAIBusyState()
    // acquire → do work → release 模式
    const acquired = busy.acquire('inline')
    expect(acquired).toBe(true)
    expect(busy.isBusy).toBe(true)
    // 模拟工作完成
    busy.release()
    expect(busy.isBusy).toBe(false)
  })

  test('多个 acquire/release 循环', () => {
    const busy = createAIBusyState()
    for (let i = 0; i < 5; i++) {
      expect(busy.acquire(i % 2 === 0 ? 'inline' : 'chat')).toBe(true)
      expect(busy.isBusy).toBe(true)
      busy.release()
      expect(busy.isBusy).toBe(false)
    }
  })

  test('失败 acquire 不通知订阅者(状态未变)', () => {
    const busy = createAIBusyState()
    const listener = mock(() => {})
    busy.subscribe(listener)
    busy.acquire('inline')
    expect(listener).toHaveBeenCalledTimes(1) // 第一次 acquire 通知
    // 第二次 acquire 失败,不应通知
    expect(busy.acquire('chat')).toBe(false)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
