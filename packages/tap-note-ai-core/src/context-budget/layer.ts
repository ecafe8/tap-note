import type { DocumentState } from '../types/type'
import { estimateTokens } from './estimate-tokens'

/**
 * 上下文体积分层结果。
 * - `kind: "selection-blocked"`:选区超软上限,不发送
 * - `kind: "full"`:全文在预算内,发送完整快照
 * - `kind: "truncated"`:超预算但 ≤ 2×,发送截断快照
 * - `kind: "outline"`:超 2× 预算,发送结构化大纲
 */
export type LayeredContext =
  | {
      kind: 'selection-blocked'
      /** 估算的选区 token 数。 */
      estimatedTokens: number
      /** 选区软上限。 */
      selectionBudget: number
      /** 提示文案。 */
      message: string
    }
  | {
      kind: 'full'
      /** 估算的全文 token 数。 */
      estimatedTokens: number
      /** 完整 DocumentState。 */
      documentState: DocumentState
    }
  | {
      kind: 'truncated'
      /** 估算的全文 token 数。 */
      estimatedTokens: number
      /** 截断后的 DocumentState(blocks 已截断)。 */
      truncatedDocumentState: DocumentState
      /** 截断标记文案。 */
      message: string
    }
  | {
      kind: 'outline'
      /** 估算的全文 token 数。 */
      estimatedTokens: number
      /** 大纲文本(标题块 + 各块首段摘要)。 */
      outline: string
    }

/**
 * `layerContext` 选项。
 */
export interface LayerContextOptions {
  /** 选区软上限(默认 4096)。 */
  selectionBudget?: number
  /** 全文预算(默认 8192)。 */
  fullBudget?: number
  /** 截断阈值倍数(默认 2,即超过 2× 预算改发大纲)。 */
  threshold?: number
}

const DEFAULT_SELECTION_BUDGET = 4096
const DEFAULT_FULL_BUDGET = 8192
const DEFAULT_THRESHOLD = 2

/**
 * 上下文体积分层处理。
 *
 * - **选区模式**:`documentState.selection` 存在时,估算选区 token,超
 *   `selectionBudget`(默认 4K)返回 `selection-blocked`,不发送。
 * - **全文模式**:`documentState.selection` 不存在时:
 *   - 估算全文 token,≤ `fullBudget`(默认 8K)返回 `full`(完整快照)
 *   - 超 `fullBudget` 但 ≤ `threshold × fullBudget`(默认 2×)返回 `truncated`
 *     (截断到预算,附 `[文档已截断:共 N 块,此处含前 M 块]` 标记)
 *   - 超 `threshold × fullBudget` 返回 `outline`(标题块 + 各块首段摘要)
 *
 * 不引用模式:由调用方决定不调用 `layerContext`,也不发送 `documentState`。
 *
 * @param documentState 文档状态快照(由 DocumentStateBuilder.build() 产生)
 * @param options 预算阈值(均有默认值)
 */
export function layerContext(
  documentState: DocumentState,
  options: LayerContextOptions = {},
): LayeredContext {
  const selectionBudget = options.selectionBudget ?? DEFAULT_SELECTION_BUDGET
  const fullBudget = options.fullBudget ?? DEFAULT_FULL_BUDGET
  const threshold = options.threshold ?? DEFAULT_THRESHOLD

  if (documentState.selection) {
    const selectionText = serializeBlocks(documentState.blocks)
    const estimated = estimateTokens(selectionText)
    if (estimated > selectionBudget) {
      return {
        kind: 'selection-blocked',
        estimatedTokens: estimated,
        selectionBudget,
        message: `选区约 ${estimated} tokens,超过软上限 ${selectionBudget}。请减少选区或改用「引用全文+指令」模式。`,
      }
    }
    // 选区在预算内,作为完整快照发送
    return {
      kind: 'full',
      estimatedTokens: estimated,
      documentState,
    }
  }

  // 全文模式
  const fullText = serializeBlocks(documentState.blocks)
  const estimated = estimateTokens(fullText)

  if (estimated <= fullBudget) {
    return {
      kind: 'full',
      estimatedTokens: estimated,
      documentState,
    }
  }

  if (estimated <= fullBudget * threshold) {
    // 截断到预算
    const { truncated, includedCount } = truncateBlocksToBudget(
      documentState.blocks,
      fullBudget,
    )
    const truncatedState: DocumentState = {
      ...documentState,
      blocks: truncated,
    }
    return {
      kind: 'truncated',
      estimatedTokens: estimated,
      truncatedDocumentState: truncatedState,
      message: `[文档已截断:共 ${documentState.blocks.length} 块,此处含前 ${includedCount} 块]`,
    }
  }

  // 超过 2× 预算,改发大纲
  const outline = buildOutline(documentState.blocks)
  return {
    kind: 'outline',
    estimatedTokens: estimated,
    outline,
  }
}

/** 把 blocks 序列化为文本用于 token 估算。 */
function serializeBlocks(blocks: DocumentState['blocks']): string {
  return blocks
    .map((b) => {
      const block = b as { content?: unknown; type?: string }
      const content = block.content
      if (typeof content === 'string') {
        return content
      }
      if (Array.isArray(content)) {
        return content
          .map((c: unknown) =>
            typeof c === 'object' && c !== null && 'text' in c
              ? String((c as { text: unknown }).text)
              : '',
          )
          .join('')
      }
      return JSON.stringify(block)
    })
    .join('\n')
}

/** 把 blocks 截断到 token 预算。 */
function truncateBlocksToBudget(
  blocks: DocumentState['blocks'],
  budget: number,
): { truncated: DocumentState['blocks']; includedCount: number } {
  const truncated: DocumentState['blocks'] = []
  let tokens = 0
  for (const block of blocks) {
    const blockText = serializeBlocks([block])
    const blockTokens = estimateTokens(blockText)
    if (tokens + blockTokens > budget) {
      break
    }
    truncated.push(block)
    tokens += blockTokens
  }
  return { truncated, includedCount: truncated.length }
}

/** 构建大纲:标题块 + 各块首段摘要。 */
function buildOutline(blocks: DocumentState['blocks']): string {
  const lines: string[] = []
  for (const block of blocks) {
    const b = block as {
      type?: string
      content?: unknown
    }
    const type = b.type ?? 'paragraph'
    if (type === 'heading' || isHeadingLike(type)) {
      lines.push(`# ${extractText(b.content)}`)
    } else {
      const summary = extractText(b.content).slice(0, 50)
      lines.push(`- ${type}: ${summary}`)
    }
  }
  return lines.join('\n')
}

function isHeadingLike(type: string): boolean {
  return /^heading\d?$/.test(type)
}

function extractText(content: unknown): string {
  if (typeof content === 'string') {
    return content
  }
  if (Array.isArray(content)) {
    return content
      .map((c: unknown) =>
        typeof c === 'object' && c !== null && 'text' in c
          ? String((c as { text: unknown }).text)
          : '',
      )
      .join('')
  }
  return ''
}
