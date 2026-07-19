import { getNodeById, type BlockNoteEditor, type PartialBlock } from '@blocknote/core'
import {
  DOCUMENT_STATE_FORMAT,
  documentStateSchema,
} from './types/schema'
import type { DocumentState } from './types/type'

/**
 * 文档状态序列化范围。
 * - `"selection"`:用户显式选区(无选区时回退到 `"affected"`)
 * - `"full"`:全文
 * - `"affected"`:内联自动取受影响块(光标所在块)
 */
export type DocumentStateScope = 'selection' | 'full' | 'affected'

/**
 * `DocumentStateBuilder` 选项。
 */
export interface CreateDocumentStateBuilderOptions {
  /**
   * 文档 schema 版本,会写入 `DocumentState.schemaVersion`。
   * 默认 `"0.51.4"`(对齐 `@blocknote/core` 0.51.4)。
   */
  schemaVersion?: string
  /**
   * 序列化范围模式。
   * - `"selection"`(默认):用户显式选区,无选区时回退到 `"affected"`
   * - `"full"`:全文
   * - `"affected"`:光标所在块(内联自动)
   */
  scope?: DocumentStateScope
}

/**
 * `DocumentStateBuilder` 实例。每次调用 `build()` 返回当前编辑器受影响块或选区
 * 范围序列化的 `DocumentState`,`documentRevision` 单调递增。
 *
 * 实现说明:
 * - `documentRevision` 通过订阅 `editor.onChange` 在文档变化时自增,确保调用方在
 *   `build()` 与 `applyOperationsToEditor` 之间检测到外部编辑。
 * - 不持有 LLM Key、不发起网络请求、不记录正文日志。
 */
export interface DocumentStateBuilder {
  /** 当前文档 revision,单调递增。 */
  readonly documentRevision: number
  /**
   * 序列化当前编辑器受影响块或选区范围为 `DocumentState`。
   * 非法 editor 状态或空文档兜底返回空 `DocumentState`(空 blocks + revision 0)。
   */
  build(): DocumentState
  /** 销毁订阅,释放资源。 */
  dispose(): void
}

/**
 * 创建 `DocumentStateBuilder`。
 *
 * @param editor BlockNote editor 实例
 * @param options 配置选项
 *
 * 用法:
 * ```ts
 * const builder = createDocumentStateBuilder(editor, { scope: 'selection' })
 * const state = builder.build()
 * // ... 发送给 AI ...
 * builder.dispose()
 * ```
 */
export function createDocumentStateBuilder(
  editor: BlockNoteEditor,
  options: CreateDocumentStateBuilderOptions = {},
): DocumentStateBuilder {
  const schemaVersion = options.schemaVersion ?? '0.51.4'
  const scope: DocumentStateScope = options.scope ?? 'selection'

  let documentRevision = 0
  let disposed = false

  // 订阅 editor 内容变化,自增 revision。这样 baseDocumentRevision 与当前
  // documentRevision 不匹配时即可检测到 revision 冲突。
  const unsubscribe = editor.onChange(() => {
    documentRevision += 1
  })

  function resolveBlocks(): { blocks: PartialBlock[]; selection?: { start: string; end: string } } {
    try {
      if (scope === 'full') {
        const blocks = collectAllBlocks(editor)
        return { blocks }
      }
      if (scope === 'selection') {
        const selection = editor.getSelection()
        if (selection && selection.blocks.length > 0) {
          const blocks = selection.blocks as PartialBlock[]
          const ids = blocks.map((b) => b.id).filter((id): id is string => typeof id === 'string')
          if (ids.length >= 2) {
            return { blocks, selection: { start: ids[0]!, end: ids[ids.length - 1]! } }
          }
          if (ids.length === 1) {
            return { blocks, selection: { start: ids[0]!, end: ids[0]! } }
          }
          return { blocks }
        }
        // 无显式选区,回退到 affected
      }
      // affected:光标所在块。BlockNote 可能为尾随空段落提供虚拟光标块,
      // 该块不在 ProseMirror 文档中,不能作为 AI insertBlock 的 referenceBlockId。
      const cursor = safeGetTextCursorPosition(editor)
      if (!cursor) {
        return { blocks: [] }
      }
      const cursorBlock = cursor as PartialBlock
      const cursorBlockExistsInDocument = cursorBlock.id
        ? getNodeById(cursorBlock.id, editor.prosemirrorState.doc)
        : undefined
      if (cursorBlockExistsInDocument) {
        return { blocks: [cursorBlock] }
      }

      // 虚拟尾随空块时,用最后一个真实顶层块作为可引用锚点。
      const fallbackBlock = editor.document.at(-1)
      return fallbackBlock ? { blocks: [fallbackBlock as PartialBlock] } : { blocks: [] }
    } catch {
      // 兜底:非法 editor 状态或空文档
      return { blocks: [] }
    }
  }

  function build(): DocumentState {
    if (disposed) {
      // 销毁后返回空 DocumentState,revision 0
      return documentStateSchema.parse({
        format: DOCUMENT_STATE_FORMAT,
        schemaVersion,
        documentRevision: 0,
        blocks: [],
      }) as DocumentState
    }
    const { blocks, selection } = resolveBlocks()
    const state = documentStateSchema.parse({
      format: DOCUMENT_STATE_FORMAT,
      schemaVersion,
      documentRevision,
      blocks,
      selection,
    })
    return state as DocumentState
  }

  function dispose(): void {
    if (disposed) {
      return
    }
    disposed = true
    try {
      unsubscribe()
    } catch {
      // editor 已销毁时忽略
    }
  }

  return {
    get documentRevision() {
      return documentRevision
    },
    build,
    dispose,
  }
}

function collectAllBlocks(editor: BlockNoteEditor): PartialBlock[] {
  try {
    const doc = editor.document
    if (!doc || doc.length === 0) {
      return []
    }
    return doc as PartialBlock[]
  } catch {
    return []
  }
}

function safeGetTextCursorPosition(editor: BlockNoteEditor): PartialBlock | undefined {
  try {
    const pos = editor.getTextCursorPosition()
    return pos?.block as PartialBlock | undefined
  } catch {
    return undefined
  }
}
