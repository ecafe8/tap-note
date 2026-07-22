import { getNodeById } from '@blocknote/core'
import type { Node as ProsemirrorNode } from 'prosemirror-model'

/**
 * block 的 blockContent 信息(节点、位置与纯文本)。
 *
 * **`replaceText` 与 `searchDocument` 共用的文本基准**:两者都以 `blockContent.textContent`
 * 作为纯文本来源、以 `posBeforeNode + 2` 作为 inline 文本起点,从而保证 `searchDocument`
 * 返回的 `from`/`to` 偏移可直接用于 `replaceText`,偏移基准完全一致。
 */
export interface BlockContentInfo {
  /** blockContainer 节点。 */
  node: ProsemirrorNode
  /** blockContainer 在文档中的起始位置前一位(getNodeById 语义)。 */
  posBeforeNode: number
  /** blockContainer 的 blockContent 子节点(paragraph/heading 等),承载 inline 文本。 */
  blockContent: ProsemirrorNode
  /** blockContent 的纯文本(`textContent`)。 */
  text: string
}

/**
 * 取指定 block 的 blockContent 信息。block 不存在或无 blockContent 时返回 `undefined`。
 *
 * `blockId` 应为已剥离 `$` 后缀的真实 ID(调用方负责剥离)。
 */
export function getBlockContentInfo(doc: ProsemirrorNode, blockId: string): BlockContentInfo | undefined {
  const info = getNodeById(blockId, doc)
  if (!info) {
    return undefined
  }
  const blockContent = info.node.firstChild
  if (!blockContent) {
    return undefined
  }
  return {
    node: info.node,
    posBeforeNode: info.posBeforeNode,
    blockContent,
    text: blockContent.textContent,
  }
}
