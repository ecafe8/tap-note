/**
 * AI 核心 zh-CN 字典接口。允许 FEAT-003/004 助手包覆盖部分文案。
 */
export interface AICoreDictionary {
  /** AI 忙碌提示。 */
  aiBusy: string
  /** 内联 AI 触发文案。 */
  aiInlineTrigger: string
  /** 对话 AI 触发文案。 */
  aiChatTrigger: string
  /** revision 冲突提示。 */
  conflict: string
  /** 前置条件冲突提示。 */
  preconditionFailed: string
  /** 重试按钮文案。 */
  retry: string
  /** 接受建议按钮。 */
  acceptSuggestion: string
  /** 拒绝建议按钮。 */
  rejectSuggestion: string
  /** 选区超软上限提示。 */
  selectionBlocked: string
  /** 文档已截断标记。 */
  documentTruncated: string
  /** 改发大纲提示。 */
  outlineMode: string
}

/**
 * 默认 zh-CN 字典。FEAT-003/004 可通过 `mergeDictionary` 局部覆盖。
 */
export const aiCoreDictionaryZhCN: AICoreDictionary = {
  aiBusy: 'AI 正在处理,请稍候...',
  aiInlineTrigger: '内联 AI 助手',
  aiChatTrigger: '对话 AI 助手',
  conflict: '文档已变更,请刷新后重试。',
  preconditionFailed: '目标块不存在或状态不符,请重试。',
  retry: '重试',
  acceptSuggestion: '接受',
  rejectSuggestion: '拒绝',
  selectionBlocked: '选区过大,请减少选区或改用「引用全文+指令」模式。',
  documentTruncated: '文档已截断:共 {total} 块,此处含前 {included} 块。',
  outlineMode: '文档过长,已发送结构化大纲。',
}

/**
 * Partial 合并字典:未覆盖字段保留 base 默认值。
 *
 * @param base 基础字典(通常为 `aiCoreDictionaryZhCN`)
 * @param override 覆盖字段(可选)
 * @returns 合并后的完整字典
 */
export function mergeDictionary(
  base: AICoreDictionary,
  override?: Partial<AICoreDictionary>,
): AICoreDictionary {
  if (!override) {
    return base
  }
  return { ...base, ...override }
}
