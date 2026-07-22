import { describe, expect, test } from 'bun:test'
import { stripBlockIdSuffix, stripBlockIdSuffixList } from '../block-id'

describe('stripBlockIdSuffix', () => {
  test('剥掉带 $ 后缀的 block ID', () => {
    expect(stripBlockIdSuffix('block-1$')).toBe('block-1')
  })

  test('不带 $ 的 block ID 原样返回', () => {
    expect(stripBlockIdSuffix('block-1')).toBe('block-1')
  })

  test('空字符串原样返回', () => {
    expect(stripBlockIdSuffix('')).toBe('')
  })

  test('仅含 $ 时剥成空字符串', () => {
    expect(stripBlockIdSuffix('$')).toBe('')
  })

  test('只剥末尾单个 $,中间的 $ 保留', () => {
    expect(stripBlockIdSuffix('a$b$')).toBe('a$b')
  })
})

describe('stripBlockIdSuffixList', () => {
  test('批量剥离混合带/不带 $ 的 ID 数组', () => {
    expect(stripBlockIdSuffixList(['a$', 'b', 'c$'])).toEqual(['a', 'b', 'c'])
  })

  test('空数组返回空数组', () => {
    expect(stripBlockIdSuffixList([])).toEqual([])
  })
})
