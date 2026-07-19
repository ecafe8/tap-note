import { createExtension, type BlockNoteEditor } from '@blocknote/core'
import { suggestChanges } from '@handlewithcare/prosemirror-suggest-changes'
import { createStore } from '@blocknote/core'
import type { Transport, DocumentStateBuilder, AIBusyState, BlockOperation, ConflictResult } from '@tap-note/ai-core'
import { applyOperationsToEditor, layerContext, createDocumentStateBuilder } from '@tap-note/ai-core'
import type { InlineState, InlineEvent } from './state-machine'
import { transition } from './state-machine'
import { processToolCallStream } from '../stream-tool-executor'
import { startStreamSession } from '../stream-session'
import type { UIMessage } from 'ai'
import type { InlineDictionary } from '../i18n/zh-cn'
import { inlineDictionaryZhCN } from '../i18n/zh-cn'
import { mergeDictionary } from '@tap-note/ai-core'

/**
 * AI 内联扩展的 store 状态。
 */
export interface AIInlineStoreState {
  /** 状态机当前状态。 */
  state: InlineState
  /** 当前 prompt(用户输入的指令,error 态重试时复用)。 */
  prompt: string
  /** AbortController(中止流式请求)。 */
  abortController: AbortController | undefined
}

/**
 * `createTapNoteInlineAssistant` 选项。
 */
export interface CreateTapNoteInlineAssistantOptions {
  /** AI-core transport 实例(来自 `createServerTransport`)。 */
  transport: Transport
  /** AI-core busy state 实例(来自 `createAIBusyState`,与 `TapNoteEditor.aiBusyState` 共享)。 */
  aiBusyState: AIBusyState
  /** 模型 ID。 */
  model?: string
  /** 字典覆盖(扩展 ai-core `AICoreDictionary`)。 */
  dictionary?: Partial<InlineDictionary>
  /** DocumentStateBuilder(可选,默认内部创建)。 */
  documentStateBuilder?: DocumentStateBuilder
}

/**
 * TapNote 内联助手实例(与 `TapNoteEditor.inlineAssistant` 接口兼容)。
 */
export interface TapNoteInlineAssistant {
  readonly __brand?: 'TapNoteInlineAssistant'
  /** BlockNote 扩展实例(在 editor 创建时注册)。 */
  readonly extension?: ReturnType<typeof createAIInlineExtension>['extension']
  mount: (editor: BlockNoteEditor) => void
  unmount: (editor: BlockNoteEditor) => void
  /** AI 上下文(submit/accept/reject/abort/retry + store + dictionary)。 */
  readonly context?: AIInlineContext
}

/**
 * 内联 AI 扩展的上下文(传给 UI 组件)。
 */
export interface AIInlineContext {
  editor: BlockNoteEditor
  store: ReturnType<typeof createStore<AIInlineStoreState>>
  dictionary: InlineDictionary
  /** 接受建议。 */
  accept: () => void
  /** 拒绝建议(回退)。 */
  reject: () => void
  /** 中止流式。 */
  abort: () => void
  /** 重试(从 error 态回到 thinking)。 */
  retry: () => void
  /** 提交指令。 */
  submit: (prompt: string) => void
  /** 关闭 AIMenu。 */
  close: () => void
}

/**
 * 创建内联 AI 扩展的工厂函数。
 *
 * 返回 BlockNote `ExtensionFactoryInstance`,安装 `suggestChanges()` 插件并管理状态机。
 */
export function createAIInlineExtension(options: CreateTapNoteInlineAssistantOptions) {
  const dictionary = mergeDictionary(inlineDictionaryZhCN, options.dictionary) as InlineDictionary
  const modelId = options.model ?? 'dashscope:qwen-plus'

  let editorRef: BlockNoteEditor | undefined

  const store = createStore<AIInlineStoreState>({
    state: { status: 'user-input' },
    prompt: '',
    abortController: undefined,
  })

  function dispatch(event: InlineEvent) {
    const current = store.state.state
    const next = transition(current, event)
    store.setState({ ...store.state, state: next })
  }

  async function submit(prompt: string) {
    console.log('[ai-inline] submit called:', prompt, 'editorRef:', !!editorRef)
    if (!editorRef) {
      console.error('[ai-inline] editorRef is undefined, submit aborted')
      return
    }
    // busy 互斥检查
    if (!options.aiBusyState.acquire('inline')) {
      console.warn('[ai-inline] busy acquire failed, another AI in progress')
      return
    }
    console.log('[ai-inline] busy acquired, proceeding')

    store.setState({ ...store.state, prompt })

    // 创建 AbortController
    const abortController = new AbortController()
    store.setState({ ...store.state, abortController })

    dispatch({ type: 'submit' })

    try {
      // 构建 documentState
      // AIMenu 输入框会让编辑器失焦。每次提交都从当前 editor 创建 full 快照，
      // 避免复用旧的 cursor/affected builder 或 BlockNote 的虚拟尾随空块。
      const currentBuilder = createDocumentStateBuilder(editorRef, { scope: 'full' })
      const documentState = currentBuilder.build()
      // 冻结 revision:之后任何 editor.onChange 都不应影响本次操作的冲突检测
      const frozenRevision = currentBuilder.documentRevision
      console.log('[ai-inline] documentState blocks:', JSON.stringify(documentState.blocks.map((b: { id?: string }) => ({ id: b.id }))))
      console.log('[ai-inline] editor doc blocks:', JSON.stringify(editorRef.document.map((b: { id?: string }) => ({ id: b.id }))))

      // layerContext 检查
      const layer = layerContext(documentState)
      if (layer.kind === 'selection-blocked') {
        dispatch({ type: 'error', error: dictionary.selectionBlocked })
        options.aiBusyState.release()
        return
      }

      // 构建用户消息
      const messages: UIMessage[] = [
        { id: crypto.randomUUID(), role: 'user', parts: [{ type: 'text', text: prompt }] },
      ]

      // 发起流式请求(用 modelId 作为模型标识)
      void modelId
      const stream = await startStreamSession({
        transport: options.transport,
        messages,
        documentState,
        abortSignal: abortController.signal,
      })

      // 处理流式 tool call
      let firstToolCall = true
      await processToolCallStream(
        stream,
        (operations: BlockOperation[]) => {
          console.log('[ai-inline] received operations:', JSON.stringify(operations, null, 2))
          if (firstToolCall) {
            firstToolCall = false
            dispatch({ type: 'first-tool-call', operations })
          } else {
            dispatch({ type: 'operations-updated', operations })
          }

          // 应用操作到编辑器
          console.log('[ai-inline] calling applyOperationsToEditor...')
          try {
            const result = applyOperationsToEditor(editorRef!, operations, {
              mode: 'suggest',
              currentDocumentRevision: frozenRevision,
            })
            console.log('[ai-inline] applyOperationsToEditor result:', result === undefined ? 'void(success)' : JSON.stringify(result).slice(0, 100))

            // ConflictResult 处理
            if (result && typeof result === 'object' && 'kind' in result) {
              const conflict = result as ConflictResult
              const message = conflict.reason === 'revision-mismatch'
                ? dictionary.conflict
                : dictionary.preconditionFailed
              console.warn('[ai-inline] conflict:', conflict.reason)
              dispatch({ type: 'error', error: message, conflict })
              options.aiBusyState.release()
            }
          } catch (err) {
            console.error('[ai-inline] applyOperationsToEditor threw:', err)
            dispatch({ type: 'error', error: err instanceof Error ? err.message : String(err) })
            options.aiBusyState.release()
          }
        },
        (error: unknown) => {
          const message = error instanceof Error ? error.message : String(error)
          dispatch({ type: 'error', error: message })
          options.aiBusyState.release()
        },
      )

      // 流式完成
      if (store.state.state.status === 'ai-writing') {
        dispatch({ type: 'stream-complete', operations: [] })
      }
    } catch (error) {
      if (abortController.signal.aborted) {
        // 用户中止
        applyOperationsToEditor(editorRef, [], { mode: 'revert' })
        dispatch({ type: 'abort' })
        options.aiBusyState.release()
      } else {
        const message = error instanceof Error ? error.message : String(error)
        dispatch({ type: 'error', error: message })
        options.aiBusyState.release()
      }
    }
  }

  function accept() {
    if (!editorRef) return
    applyOperationsToEditor(editorRef, [], { mode: 'apply' })
    dispatch({ type: 'accept' })
    options.aiBusyState.release()
  }

  function reject() {
    if (!editorRef) return
    applyOperationsToEditor(editorRef, [], { mode: 'revert' })
    dispatch({ type: 'reject' })
    options.aiBusyState.release()
  }

  function abort() {
    const ac = store.state.abortController
    ac?.abort()
    if (editorRef) {
      applyOperationsToEditor(editorRef, [], { mode: 'revert' })
    }
    dispatch({ type: 'abort' })
    options.aiBusyState.release()
  }

  function retry() {
    const prompt = store.state.prompt
    dispatch({ type: 'retry' })
    // 重新提交(无需重输指令)
    void submit(prompt)
  }

  function close() {
    dispatch({ type: 'close' })
  }

  const context: AIInlineContext = {
    get editor() { return editorRef! },
    store,
    dictionary,
    accept,
    reject,
    abort,
    retry,
    submit,
    close,
  }
  void context // 供 UI 组件使用的上下文,后续通过 extension store 暴露

  const ext = createExtension(({ editor }) => {
    editorRef = editor

    let unsubscribe: (() => void) | undefined

    return {
      key: 'ai-inline' as const,
      store: store as never,
      prosemirrorPlugins: [suggestChanges()],
      mount: () => {
        editorRef = editor
        // 监听编辑器文本变化,检测 /ai 输入
        unsubscribe = editor.onChange(() => {
          const pos = editor.getTextCursorPosition()
          const block = pos?.block
          if (!block) return
          const text = typeof block.content === 'string'
            ? block.content
            : Array.isArray(block.content)
              ? block.content.map((c: unknown) =>
                  typeof c === 'object' && c !== null && 'text' in c
                    ? String((c as { text: string }).text)
                    : '',
                ).join('')
              : ''
          if (text.trim() === '/ai') {
            // 触发 user-input 态
          }
        })
      },
      onDestroy: () => {
        unsubscribe?.()
      },
    }
  })

  // createExtension 返回 ExtensionFactory = (options?) => ExtensionFactoryInstance
  // 需要调用 ext() 获取 ExtensionFactoryInstance,才能被 BlockNote 的 addExtension 正确处理
  return { extension: ext(), context }
}

/**
 * 创建 TapNote 内联助手实例。
 *
 * 用法:
 * ```tsx
 * const inlineAssistant = createTapNoteInlineAssistant({
 *   transport: createServerTransport({ baseUrl: '/api/ai/editor/streamText', model: 'dashscope:qwen-plus', getAuthHeaders }),
 *   aiBusyState: busy,
 * })
 * <TapNoteEditor inlineAssistant={inlineAssistant} aiBusyState={busy} />
 * ```
 */
export function createTapNoteInlineAssistant(
  options: CreateTapNoteInlineAssistantOptions,
): TapNoteInlineAssistant {
  const { extension, context } = createAIInlineExtension(options)
  let mounted = false

  return {
    __brand: 'TapNoteInlineAssistant' as const,
    extension,
    context,
    mount: (editor: BlockNoteEditor) => {
      if (mounted) return
      mounted = true
      void editor
    },
    unmount: (editor: BlockNoteEditor) => {
      if (!mounted) return
      mounted = false
      try {
        applyOperationsToEditor(editor, [], { mode: 'revert' })
      } catch {
        // editor 可能已销毁
      }
      options.aiBusyState.release()
    },
  }
}
