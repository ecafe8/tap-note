/**
 * 对话上下文三态。决定 ChatPanel 是否把 documentState 与 documentRevision 随消息发送给 `/api/ai/chat`。
 *
 * - `selection` — 经 ai-core `DocumentStateBuilder` 序列化选区;超 4K tokens 前端拦截
 * - `full` — 序列化全文;≤8K tokens 完整发送,超预算截断,>2× 改发大纲
 * - `none` — 不发 documentState,也不暴露 `getDocumentSnapshot`(LLM 不可见)
 *
 * 默认值为 `"none"`(不引用)。集成方与用户切换 segmented control 时更新。
 */
export type ContextMode = 'selection' | 'full' | 'none'

export const DEFAULT_CONTEXT_MODE: ContextMode = 'none'

export const CONTEXT_MODES: readonly ContextMode[] = ['selection', 'full', 'none'] as const

/**
 * 判断是否允许在 client-side 暴露 `getDocumentSnapshot` 工具。
 *
 * 服务端按 contextMode 过滤 tools 声明(`none`/`selection` 不声明 `getDocumentSnapshot`),
 * 此函数用于客户端冗余校验与 UI 提示。
 */
export function isSnapshotToolAllowed(
  mode: ContextMode,
  allowSnapshotTool: boolean,
): boolean {
  if (mode !== 'full') return false
  return allowSnapshotTool
}
