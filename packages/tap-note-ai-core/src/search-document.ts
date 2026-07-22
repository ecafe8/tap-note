import type { BlockNoteEditor, Block } from '@blocknote/core'
import { getBlockContentInfo } from './block-text'

/**
 * 单个搜索命中项。
 *
 * `from`/`to` 为命中在目标块纯文本(`blockContent.textContent`)上的零基偏移
 * (含 from 不含 to),**与 `replaceText` 的偏移基准完全一致**,可直接用于
 * `replaceText` 的 `from`/`to`/`expectedText`(取 `matchedText`)。
 */
export interface DocumentSearchMatch {
  /** 命中所在块 ID(带 `$` 协议后缀,可直接用于 `replaceText.targetBlockId`)。 */
  blockId: string
  /** 块类型(如 `paragraph`/`heading`)。 */
  blockType: string
  /** 命中起始偏移(零基,含)。 */
  from: number
  /** 命中结束偏移(零基,不含)。 */
  to: number
  /** 命中的原文(可直接作为 `replaceText.expectedText`)。 */
  matchedText: string
  /** 命中上下文片段(前后各若干字符,便于模型/用户确认位置)。 */
  snippet: string
}

/**
 * `searchDocument` 选项。
 */
export interface DocumentSearchOptions {
  /** 搜索文本(子串或正则)。 */
  query: string
  /** 是否按正则解释 `query`(默认 `false`,按子串)。 */
  isRegex?: boolean
  /** 是否区分大小写(默认 `false`,不区分)。 */
  caseSensitive?: boolean
  /** 最多返回的命中数(默认 20,上限 100)。 */
  maxResults?: number
}

/**
 * `searchDocument` 结果。`matches` 为命中列表(最多 `maxResults` 条),
 * `truncated` 表示实际命中超过返回上限。
 */
export interface DocumentSearchResult {
  ok: true
  matches: DocumentSearchMatch[]
  truncated: boolean
}

const DEFAULT_MAX_RESULTS = 20
const MAX_RESULTS_CAP = 100
const SNIPPET_RADIUS = 20

type Matcher = (text: string) => Array<{ from: number; to: number; matchedText: string }>

/**
 * 构建匹配器。非法正则返回 `null`(调用方据此返回空结果)。
 * 子串/正则匹配均限制最多 `MAX_RESULTS_CAP` 个命中,防止零宽匹配死循环与过量结果。
 */
function buildMatcher(query: string, isRegex: boolean, caseSensitive: boolean): Matcher | null {
  if (isRegex) {
    let re: RegExp
    try {
      re = new RegExp(query, caseSensitive ? 'g' : 'gi')
    } catch {
      return null
    }
    return (text: string) => {
      const results: Array<{ from: number; to: number; matchedText: string }> = []
      re.lastIndex = 0
      let m: RegExpExecArray | null
      let guard = 0
      while ((m = re.exec(text)) !== null && guard < MAX_RESULTS_CAP) {
        results.push({ from: m.index, to: m.index + m[0].length, matchedText: m[0] })
        guard += 1
        // 零宽匹配(如 `^`/`$`/`(?=...)`)强制前进,避免死循环
        if (m[0].length === 0) {
          re.lastIndex += 1
        }
      }
      return results
    }
  }
  const needle = caseSensitive ? query : query.toLowerCase()
  return (text: string) => {
    const hay = caseSensitive ? text : text.toLowerCase()
    const results: Array<{ from: number; to: number; matchedText: string }> = []
    let idx = hay.indexOf(needle)
    while (idx !== -1 && results.length < MAX_RESULTS_CAP) {
      results.push({ from: idx, to: idx + query.length, matchedText: text.slice(idx, idx + query.length) })
      idx = hay.indexOf(needle, idx + Math.max(needle.length, 1))
    }
    return results
  }
}

function makeSnippet(text: string, from: number, to: number): string {
  const start = Math.max(0, from - SNIPPET_RADIUS)
  const end = Math.min(text.length, to + SNIPPET_RADIUS)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < text.length ? '…' : ''
  return `${prefix}${text.slice(start, end)}${suffix}`
}

/**
 * 在编辑器全文(含嵌套子块)中搜索文本,返回命中块的 ID、偏移与原文。
 *
 * 这是「search-then-replace」的查找端:模型先调用本工具定位目标,拿到精确的
 * `blockId`/`from`/`to`/`matchedText` 后,再调用 `replaceText` 精确替换,**无需自行
 * 推断字符偏移**。文本基准与 `replaceText` 一致(`blockContent.textContent`),偏移可直接复用。
 *
 * 只读操作,不修改文档;在所有 contextMode 下均可用(仅返回命中项,不 dump 全文)。
 * 空 query 或非法正则返回空结果(`matches: []`)。
 */
export function searchDocument(editor: BlockNoteEditor, options: DocumentSearchOptions): DocumentSearchResult {
  const query = options.query
  const maxResults = Math.min(options.maxResults ?? DEFAULT_MAX_RESULTS, MAX_RESULTS_CAP)
  if (!query) {
    return { ok: true, matches: [], truncated: false }
  }
  const matcher = buildMatcher(query, options.isRegex ?? false, options.caseSensitive ?? false)
  if (!matcher) {
    return { ok: true, matches: [], truncated: false }
  }

  const doc = editor.prosemirrorState.doc
  const matches: DocumentSearchMatch[] = []
  let truncated = false

  const visit = (blocks: Block[]): void => {
    for (const block of blocks) {
      if (matches.length >= maxResults) {
        truncated = true
        return
      }
      const id = block.id
      if (typeof id === 'string' && id.length > 0) {
        const info = getBlockContentInfo(doc, id)
        if (info && info.text.length > 0) {
          const found = matcher(info.text)
          for (const f of found) {
            if (matches.length >= maxResults) {
              truncated = true
              break
            }
            matches.push({
              blockId: `${id}$`,
              blockType: typeof block.type === 'string' ? block.type : 'paragraph',
              from: f.from,
              to: f.to,
              matchedText: f.matchedText,
              snippet: makeSnippet(info.text, f.from, f.to),
            })
          }
        }
      }
      if (truncated) {
        return
      }
      if (block.children && block.children.length > 0) {
        visit(block.children as Block[])
      }
    }
  }
  visit(editor.document as Block[])

  return { ok: true, matches, truncated }
}
