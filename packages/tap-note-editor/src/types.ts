import type { ComponentType } from 'react'
import type { Block, BlockNoteEditor, PartialBlock, ExtensionFactoryInstance } from '@blocknote/core'
import type { ShadCNComponents } from '@blocknote/shadcn'
import type { TapNoteDictionary } from './i18n/zh-cn'

export type AIInlineStatus = 'user-input' | 'thinking' | 'ai-writing' | 'user-reviewing' | 'error'

export interface TapNoteInlineAssistantContext {
  submit: (prompt: string) => void
  accept: () => void
  reject: () => void
  abort: () => void
  retry: () => void
  close: () => void
  store: {
    state: { state: { status: AIInlineStatus; error?: string } }
    subscribe: (listener: () => void) => () => void
  }
}

export interface AIToolItem {
  id: string
  label: string
  prompt: string
  icon?: ComponentType<{ className?: string }>
}

export interface TapNoteInlineAssistant {
  readonly __brand?: 'TapNoteInlineAssistant'
  /** BlockNote 扩展实例(在 editor 创建时注册)。 */
  readonly extension?: ExtensionFactoryInstance
  readonly context?: TapNoteInlineAssistantContext
  mount?: (editor: BlockNoteEditor) => void
  unmount?: (editor: BlockNoteEditor) => void
}

export interface TapNoteChatAssistant {
  readonly __brand?: 'TapNoteChatAssistant'
  mount?: (editor: BlockNoteEditor) => void
  unmount?: (editor: BlockNoteEditor) => void
}

export interface TapNoteAIBusyState {
  isBusy: boolean
  subscribe: (listener: (busy: boolean) => void) => () => void
}

export interface TapNoteEditorProps {
  initialContent?: PartialBlock[]
  editable?: boolean
  theme?: 'light' | 'dark'
  onChange?: (blocks: Block[]) => void
  inlineAssistant?: TapNoteInlineAssistant
  chatAssistant?: TapNoteChatAssistant
  aiBusyState?: TapNoteAIBusyState
  aiTools?: readonly AIToolItem[]
  shadCNComponents?: Partial<ShadCNComponents>
  dictionary?: Partial<TapNoteDictionary>
}

export type TapNoteEditorInstance = BlockNoteEditor

export interface UseCreateTapNoteEditorOptions {
  /**
   * 编辑器初始文档。**只在 editor 首次创建时生效**,后续变更不会自动同步
   * (BlockNote 采用非受控模型)。如需在 initialContent 变化时重建 editor,
   * 通过 `useCreateTapNoteEditor` 的 `deps` 参数显式控制。
   */
  initialContent?: PartialBlock[]
  /** BlockNote 扩展列表(在 editor 创建时注册)。 */
  extensions?: ExtensionFactoryInstance[]
}

export type { Block, BlockNoteEditor, PartialBlock, ShadCNComponents, TapNoteDictionary, ExtensionFactoryInstance }
