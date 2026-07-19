import { describe, expect, test } from 'bun:test'
import { render, screen, fireEvent } from '@testing-library/react'
import { ContextSelector } from '../context-selector'
import { chatDictionaryZhCN } from '../../i18n/zh-cn'
import type { ContextMode } from '../../context/context-mode'

describe('ContextSelector', () => {
  test('渲染三种模式选项', () => {
    render(
      <ContextSelector
        mode="none"
        onModeChange={() => {}}
        dictionary={chatDictionaryZhCN}
        hintKey={null}
      />,
    )
    expect(screen.getByText('选区')).toBeDefined()
    expect(screen.getByText('全文')).toBeDefined()
    expect(screen.getByText('无')).toBeDefined()
  })

  test('点击选项触发 onModeChange', () => {
    let captured: ContextMode | null = null
    render(
      <ContextSelector
        mode="none"
        onModeChange={(m) => { captured = m }}
        dictionary={chatDictionaryZhCN}
        hintKey={null}
      />,
    )
    const selectionBtn = screen.getByText('选区')
    fireEvent.click(selectionBtn)
    expect(captured).toBe('selection')
  })

  test('hintKey=selectionBlocked 显示 selectionBlocked 提示', () => {
    render(
      <ContextSelector
        mode="selection"
        onModeChange={() => {}}
        dictionary={chatDictionaryZhCN}
        hintKey="selectionBlocked"
      />,
    )
    expect(screen.getByText(chatDictionaryZhCN.selectionBlocked)).toBeDefined()
  })

  test('hintKey=documentTruncated 显示截断提示', () => {
    render(
      <ContextSelector
        mode="full"
        onModeChange={() => {}}
        dictionary={chatDictionaryZhCN}
        hintKey="documentTruncated"
        truncatedMessage="文档已截断:共 47 块,此处含前 18 块"
      />,
    )
    expect(screen.getByText('文档已截断:共 47 块,此处含前 18 块')).toBeDefined()
  })

  test('hintKey=outlineMode 显示大纲提示', () => {
    render(
      <ContextSelector
        mode="full"
        onModeChange={() => {}}
        dictionary={chatDictionaryZhCN}
        hintKey="outlineMode"
      />,
    )
    expect(screen.getByText(chatDictionaryZhCN.outlineMode)).toBeDefined()
  })

  test('hintKey=null 不显示提示行', () => {
    render(
      <ContextSelector
        mode="none"
        onModeChange={() => {}}
        dictionary={chatDictionaryZhCN}
        hintKey={null}
      />,
    )
    expect(screen.queryByText(chatDictionaryZhCN.selectionBlocked)).toBeNull()
    expect(screen.queryByText(chatDictionaryZhCN.outlineMode)).toBeNull()
  })
})
