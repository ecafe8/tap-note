/**
 * @packageDocumentation @tap-note/editor
 *
 * BlockNote 风格的可编辑文档组件包。封装 `@blocknote/core` + `@blocknote/react` + `@blocknote/shadcn`(均 MPL-2.0),
 * 提供开箱即用的 Notion 风格编辑体验与可选 AI 助手挂载点。纯组件,不内置持久化。
 *
 * 最小接入:
 * ```tsx
 * import { TapNoteEditor } from "@tap-note/editor";
 * <TapNoteEditor initialContent={[{ type: "paragraph", content: "hello" }]} onChange={console.log} />
 * ```
 */

/**
 * BlockNote 风格的可编辑文档 React 组件。
 *
 * 接受 `initialContent`(BlockNote `PartialBlock[]`)、`editable`、`theme`、`onChange`,
 * 以及可选的 `inlineAssistant`/`chatAssistant`/`aiBusyState` 助手挂载点、`shadCNComponents`
 * 局部覆盖与 `dictionary` 字典覆盖。未注入助手时不显示 AI 入口。
 */
export { TapNoteEditor } from './tap-note-editor'

/**
 * 创建并返回 BlockNoteEditor 实例的 hook。实例暴露 `insertBlocks`/`updateBlock`/
 * `removeBlocks`/`replaceBlocks`/`moveBlocks*`,供 FEAT-002 ai-core 调用。
 *
 * **非受控模型**:`initialContent` 只在 editor 首次创建时生效,后续 render 传入新
 * `initialContent` 不会重建 editor。如需重建,通过 `deps` 参数显式控制:
 *
 * ```tsx
 * const editor = useCreateTapNoteEditor({ initialContent }, [initialContent])
 * ```
 *
 * 非法 `initialContent` 会回退到空文档并发出 `console.warn`,不抛错。
 */
export { useCreateTapNoteEditor } from './use-create-tap-note-editor'

/** 默认 zh-CN 字典与 Partial 合并工具。 */
export { tapNoteDictionaryZhCN, mergeDictionary } from './i18n/zh-cn'

export type {
  /** 会话级 AI 互斥状态接口,来自 FEAT-002 ai-core 的 `createAIBusyState`。 */
  TapNoteAIBusyState,
  /** 对话助手最小挂载接口,来自 FEAT-004。 */
  TapNoteChatAssistant,
  /** 字典类型,允许集成方通过 `dictionary` prop 局部覆盖。 */
  TapNoteDictionary,
  /** BlockNote editor 实例类型别名。 */
  TapNoteEditorInstance,
  /** `TapNoteEditor` 的公开 props。 */
  TapNoteEditorProps,
  /** 内联助手最小挂载接口,来自 FEAT-003。 */
  TapNoteInlineAssistant,
  /** `useCreateTapNoteEditor` 的 options。 */
  UseCreateTapNoteEditorOptions,
} from './types'

export type { Block, BlockNoteEditor, PartialBlock, ShadCNComponents } from './types'
