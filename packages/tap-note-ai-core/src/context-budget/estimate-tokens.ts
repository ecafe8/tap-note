/**
 * 估算文本的 token 数。
 *
 * MVP 采用近似算法(字符数 / 4),偏差由 `layerContext` 的预算阈值容错。
 * 总 PRD §17 item 13 仍待确认是否需精确 tiktoken。
 *
 * @param text 输入文本
 * @returns 估算的 token 数(非负整数)
 */
export function estimateTokens(text: string): number {
  if (!text) {
    return 0
  }
  return Math.ceil(text.length / 4)
}
