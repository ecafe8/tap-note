import { describe, expect, test } from 'bun:test'
import { render, screen, fireEvent } from '@testing-library/react'
import { InputArea } from '../input-area'
import { chatDictionaryZhCN } from '../../i18n/zh-cn'

describe('InputArea', () => {
  test('渲染输入框与发送按钮', () => {
    let captured = ''
    render(
      <InputArea
        value=""
        onChange={(v) => { captured = v }}
        onSubmit={() => {}}
        onAbort={() => {}}
        dictionary={chatDictionaryZhCN}
        isStreaming={false}
        isBusy={false}
        busyReason={null}
      />,
    )
    const input = screen.getByPlaceholderText(chatDictionaryZhCN.chatPlaceholder) as HTMLInputElement
    expect(input).toBeDefined()
    fireEvent.change(input, { target: { value: 'hello' } })
    expect(captured).toBe('hello')
  })

  test('空值时发送按钮禁用', () => {
    render(
      <InputArea
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        onAbort={() => {}}
        dictionary={chatDictionaryZhCN}
        isStreaming={false}
        isBusy={false}
        busyReason={null}
      />,
    )
    const sendBtn = screen.getByLabelText('发送') as HTMLButtonElement
    expect(sendBtn.disabled).toBe(true)
  })

  test('Enter 触发 onSubmit', () => {
    let submitted = ''
    render(
      <InputArea
        value="hello"
        onChange={() => {}}
        onSubmit={() => { submitted = 'hello' }}
        onAbort={() => {}}
        dictionary={chatDictionaryZhCN}
        isStreaming={false}
        isBusy={false}
        busyReason={null}
      />,
    )
    const input = screen.getByPlaceholderText(chatDictionaryZhCN.chatPlaceholder)
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false })
    expect(submitted).toBe('hello')
  })

  test('Shift+Enter 不触发 onSubmit', () => {
    let submitted = false
    render(
      <InputArea
        value="hello"
        onChange={() => {}}
        onSubmit={() => { submitted = true }}
        onAbort={() => {}}
        dictionary={chatDictionaryZhCN}
        isStreaming={false}
        isBusy={false}
        busyReason={null}
      />,
    )
    const input = screen.getByPlaceholderText(chatDictionaryZhCN.chatPlaceholder)
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })
    expect(submitted).toBe(false)
  })

  test('流式中显示中止按钮替代发送', () => {
    render(
      <InputArea
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        onAbort={() => {}}
        dictionary={chatDictionaryZhCN}
        isStreaming={true}
        isBusy={false}
        busyReason={null}
      />,
    )
    expect(screen.getByText(chatDictionaryZhCN.abort)).toBeDefined()
    expect(screen.queryByLabelText('发送')).toBeNull()
  })

  test('busy 时输入框置灰并显示 busyReason', () => {
    render(
      <InputArea
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        onAbort={() => {}}
        dictionary={chatDictionaryZhCN}
        isStreaming={false}
        isBusy={true}
        busyReason={chatDictionaryZhCN.chatBusy}
      />,
    )
    const input = screen.getByPlaceholderText(chatDictionaryZhCN.chatPlaceholder) as HTMLInputElement
    expect(input.disabled).toBe(true)
    expect(screen.getByText(`⏸ ${chatDictionaryZhCN.chatBusy}`)).toBeDefined()
  })

  test('selection 模式有选区时渲染 chip 与块数量', () => {
    render(
      <InputArea
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        onAbort={() => {}}
        dictionary={chatDictionaryZhCN}
        isStreaming={false}
        isBusy={false}
        busyReason={null}
        selectionChipBlockCount={3}
        selectionModeActive={true}
        onClearSelection={() => {}}
      />,
    )
    expect(screen.getByText('📍 已选 3 个块')).toBeDefined()
    expect(screen.queryByText(chatDictionaryZhCN.selectionEmptyHint)).toBeNull()
  })

  test('点击 chip ✕ 触发 onClearSelection', () => {
    let cleared = false
    render(
      <InputArea
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        onAbort={() => {}}
        dictionary={chatDictionaryZhCN}
        isStreaming={false}
        isBusy={false}
        busyReason={null}
        selectionChipBlockCount={2}
        selectionModeActive={true}
        onClearSelection={() => { cleared = true }}
      />,
    )
    fireEvent.click(screen.getByLabelText(chatDictionaryZhCN.clearSelection))
    expect(cleared).toBe(true)
  })

  test('selection 模式无选区时显示提示而非 chip', () => {
    render(
      <InputArea
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        onAbort={() => {}}
        dictionary={chatDictionaryZhCN}
        isStreaming={false}
        isBusy={false}
        busyReason={null}
        selectionChipBlockCount={undefined}
        selectionModeActive={true}
        onClearSelection={() => {}}
      />,
    )
    expect(screen.getByText(chatDictionaryZhCN.selectionEmptyHint)).toBeDefined()
    expect(screen.queryByLabelText(chatDictionaryZhCN.clearSelection)).toBeNull()
  })

  test('非 selection 模式不渲染 chip 与提示', () => {
    render(
      <InputArea
        value=""
        onChange={() => {}}
        onSubmit={() => {}}
        onAbort={() => {}}
        dictionary={chatDictionaryZhCN}
        isStreaming={false}
        isBusy={false}
        busyReason={null}
        selectionChipBlockCount={undefined}
        selectionModeActive={false}
        onClearSelection={() => {}}
      />,
    )
    expect(screen.queryByText(chatDictionaryZhCN.selectionEmptyHint)).toBeNull()
    expect(screen.queryByLabelText(chatDictionaryZhCN.clearSelection)).toBeNull()
  })
})
