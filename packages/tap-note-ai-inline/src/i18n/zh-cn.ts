import type { AICoreDictionary } from '@tap-note/ai-core'

/**
 * 内联助手 zh-CN 字典接口。
 * **扩展** ai-core `AICoreDictionary`,不重复定义已有字段(`aiBusy`/`aiInlineTrigger`/`acceptSuggestion`/`rejectSuggestion`/`retry`/`conflict`/`preconditionFailed`/`selectionBlocked` 等)。
 * 只新增内联特有字段。
 */
export interface InlineDictionary extends AICoreDictionary {
  /** AI 写作中文案(中止按钮提示)。 */
  aiWriting: string
  /** 中止按钮文案。 */
  abort: string
  /** AIMenu 输入框占位文案。 */
  aiMenuPlaceholder: string
  /** 选区改写时的提示文案。 */
  aiMenuPrompt: string
}

/**
 * 默认 zh-CN 字典(扩展 ai-core `aiCoreDictionaryZhCN` 并新增内联字段)。
 */
export const inlineDictionaryZhCN: InlineDictionary = {
  // 继承 ai-core 已有字段(保持与 ai-core 默认值一致)
  // 以下字段来自 AICoreDictionary,InlineDictionary extends 它,所以必须有值
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
  // 新增内联特有字段
  aiWriting: 'AI 正在写作...',
  abort: '中止',
  aiMenuPlaceholder: '输入指令,如"续写一段"或"改为要点列表"...',
  aiMenuPrompt: '改什么?',
}
