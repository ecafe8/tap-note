/**
 * @packageDocumentation @tap-note/ai-core
 *
 * 内联助手(FEAT-003)与对话助手(FEAT-004)共享的协议、schema、执行器、transport 工厂与会话级状态。
 *
 * 主要导出:
 * - **Schema**:`blockOperationSchema`、`documentStateSchema`、`conflictResultSchema`
 * - **Builder**:`createDocumentStateBuilder` — 序列化编辑器为 `DocumentState`
 * - **Inject**:`injectDocumentStateMessages` — 适配 AI SDK v7 `UIMessage.parts`
 * - **Applier**:`applyOperationsToEditor` — 经 suggest-changes 可回退应用 `BlockOperation[]`
 * - **Transport**:`createServerTransport` / `createProxyTransport` — 封装 `DefaultChatTransport`,不持有 LLM Key
 * - **Busy**:`createAIBusyState` — 会话级 AI 互斥状态(React 19 `useSyncExternalStore` 友好)
 * - **Context Budget**:`estimateTokens` / `layerContext` — 上下文体积分层(4K/8K/2×)
 * - **i18n**:`aiCoreDictionaryZhCN` / `mergeDictionary` — 默认 zh-CN 字典
 * - **Errors**:`AICoreError` / `ConflictError` / `BudgetExceededError` / `TransportError`
 *
 * 安全边界:不提供 UI 组件、不发起 HTTP、不持有 LLM Key、不记录正文日志。
 * 依赖闭包不含 `@blocknote/xl-ai` 或任何 GPL/AGPL 依赖。
 */

/** Zod schema 与派生类型:`BlockOperation`、`DocumentState`、`ConflictResult`。 */
export * from './types'

/** 创建 `DocumentStateBuilder`,把编辑器受影响块(含选区)序列化为 `DocumentState`。 */
export {
  createDocumentStateBuilder,
} from './document-state-builder'
export type {
  /** `DocumentStateBuilder` 实例接口,提供 `build()` 与 `dispose()`。 */
  DocumentStateBuilder,
  /** `DocumentState` 序列化范围模式:`"selection" | "full" | "affected"`。 */
  DocumentStateScope,
  /** `createDocumentStateBuilder` 选项。 */
  CreateDocumentStateBuilderOptions,
  /** `build()` 调用选项(scope 覆盖 + 选区快照)。 */
  BuildOptions,
} from './document-state-builder'

/** 创建 `SelectionTracker`,持续跟踪编辑器最后非空选区,失焦后保留(避免点输入框丢选区)。 */
export {
  createSelectionTracker,
} from './selection-tracker'
export type {
  /** `SelectionTracker` 实例接口,提供 `getSnapshot()`/`clear()`/`subscribe()`/`dispose()`。 */
  SelectionTracker,
  /** 选区快照:最后非空选区的块范围与起止块 ID。 */
  SelectionSnapshot,
} from './selection-tracker'

/** 把 `documentState` 注入到 `messages` 列表,适配 AI SDK v7 `UIMessage.parts` 数组结构。 */
export {
  injectDocumentStateMessages,
} from './inject-document-state'

/** 经 `@handlewithcare/prosemirror-suggest-changes` 可回退应用 `BlockOperation[]` 到编辑器。 */
export {
  applyOperationsToEditor,
} from './apply-operations'
export type {
  /** 应用模式:`"suggest" | "apply" | "revert"`。 */
  ApplyMode,
  /** `applyOperationsToEditor` 选项。 */
  ApplyOperationsOptions,
  /** 应用结果:成功 `void` 或冲突 `ConflictResult`。 */
  ApplyOperationsResult,
} from './apply-operations'

/** 创建 transport,封装 AI SDK v7 `DefaultChatTransport`,不持有 LLM Key。 */
export {
  createServerTransport,
  createProxyTransport,
} from './transport'
export type {
  /** Transport 类型别名,对齐 AI SDK v7 `DefaultChatTransport<UIMessage>`。 */
  Transport,
  /** `createServerTransport` 选项。 */
  CreateServerTransportOptions,
  /** `createProxyTransport` 选项(MVP 占位)。 */
  CreateProxyTransportOptions,
} from './transport'

/** 创建会话级 AI 互斥 busy 状态,适配 React 19 `useSyncExternalStore`。 */
export {
  createAIBusyState,
} from './busy-state'
export type {
  /** AI 助手类型:`"inline" | "chat"`。 */
  AIBusyType,
  /** `AIBusyState` 实例接口,提供 `isBusy`、`acquire`、`release`、`subscribe`。 */
  AIBusyState,
} from './busy-state'

/** 上下文预算与体积分层:`estimateTokens` 与 `layerContext`。 */
export {
  estimateTokens,
  layerContext,
} from './context-budget'
export type {
  /** 上下文体积分层结果(四种 `kind`)。 */
  LayeredContext,
  /** `layerContext` 选项,预算阈值均有默认值。 */
  LayerContextOptions,
} from './context-budget'

/** 默认 zh-CN 字典与 Partial 合并工具。 */
export {
  aiCoreDictionaryZhCN,
  mergeDictionary,
} from './i18n/zh-cn'
export type {
  /** AI 核心 zh-CN 字典接口,允许 FEAT-003/004 覆盖部分文案。 */
  AICoreDictionary,
} from './i18n/zh-cn'

/** AI 核心错误基类与子类,不泄漏内部堆栈或路径,对外脱敏。 */
export {
  AICoreError,
  ConflictError,
  BudgetExceededError,
  TransportError,
} from './errors'
export type {
  /** `BudgetExceededError` 携带的超限预算信息。 */
  BudgetExceededInfo,
} from './errors'
