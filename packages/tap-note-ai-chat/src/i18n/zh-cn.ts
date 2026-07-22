import type { AICoreDictionary } from '@tap-note/ai-core'

/**
 * 对话助手 zh-CN 字典接口。
 * **扩展** ai-core `AICoreDictionary`,不重复定义已有字段(`aiBusy`/`conflict`/
 * `preconditionFailed`/`retry`/`selectionBlocked`/`documentTruncated`/`outlineMode`/
 * `acceptSuggestion`/`rejectSuggestion`/`aiInlineTrigger`/`aiChatTrigger` 等)。
 * 只新增对话特有字段。
 */
export interface ChatDictionary extends AICoreDictionary {
  /** ChatPanel 输入框占位文案。 */
  chatPlaceholder: string
  /** 中止当前轮按钮文案。 */
  abort: string
  /** 「仅重试该操作」按钮文案(冲突气泡)。 */
  retryToolCall: string
  /** 「引用选区」segmented 项文案。 */
  contextSelection: string
  /** 「引用全文」segmented 项文案。 */
  contextFull: string
  /** 「不引用」segmented 项文案。 */
  contextNone: string
  /** chat 进行中 busy 文案(覆盖 aiBusy 时使用)。 */
  chatBusy: string
  /** 认证过期提示文案。 */
  authExpired: string
  /** tool-call 输入中状态文案。 */
  toolInputting: string
  /** tool 执行成功(已更新块)文案。 */
  toolUpdated: string
  /** tool 执行成功(已插入块)文案。 */
  toolInserted: string
  /** tool 执行成功(已删除块)文案。 */
  toolDeleted: string
  /** tool 执行成功(已替换块)文案。 */
  toolReplaced: string
  /** tool 执行成功(已移动块)文案。 */
  toolMoved: string
  /** tool 执行失败文案。 */
  toolFailed: string
  /** 「跳转到该块」按钮文案。 */
  jumpToBlock: string
  /** 工具结果气泡中的目标块标签。 */
  toolTarget: string
  /** tool 执行成功(已替换文本)文案。 */
  toolReplacedText: string
  /** tool 执行成功(已查找文档)文案。 */
  toolSearched: string
  /** 模型未调用编辑工具时,提示未真正执行编辑操作。 */
  noEditPerformed: string
  /** 选区 chip 文案(`{count}` 为块数量占位符)。 */
  selectionChip: string
  /** selection 模式但无选区时的提示文案。 */
  selectionEmptyHint: string
  /** 清除选区按钮 aria-label。 */
  clearSelection: string
}

/**
 * 默认 zh-CN 字典(扩展 ai-core `aiCoreDictionaryZhCN` 并新增 chat 字段)。
 * 通过 `mergeDictionary` 支持 Partial 覆盖。
 */
export const chatDictionaryZhCN: ChatDictionary = {
  // 继承 ai-core 已有字段(保持与 ai-core 默认值一致)
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
  // 新增 chat 特有字段
  chatPlaceholder: '输入消息,如「把第二点展开成段落」或「加一个总结小标题」...',
  abort: '中止当前轮',
  retryToolCall: '仅重试该操作',
  contextSelection: '选区',
  contextFull: '全文',
  contextNone: '无',
  chatBusy: '对话 AI 进行中,请等待完成...',
  authExpired: '认证已过期,请重新登录。',
  toolInputting: '输入中',
  toolUpdated: '已更新块',
  toolInserted: '已插入块',
  toolDeleted: '已删除块',
  toolReplaced: '已替换块',
  toolMoved: '已移动块',
  toolFailed: '操作失败',
  jumpToBlock: '跳转到该块',
  toolTarget: '目标',
  toolReplacedText: '已替换文本',
  toolSearched: '已查找文档',
  noEditPerformed: '未执行编辑操作',
  selectionChip: '已选 {count} 个块',
  selectionEmptyHint: '在编辑器中选中文字以引用选区',
  clearSelection: '清除选区',
}

/**
 * Partial 合并:本地实现(等价 ai-core `mergeDictionary` 但 cast 回 `ChatDictionary`)。
 *
 * 集成方可通过 `createTapNoteChatAssistant({ dictionary: { chatPlaceholder: 'Ask...' } })`
 * 局部覆盖,未覆盖字段保留 `chatDictionaryZhCN` 默认值。
 */
export function mergeChatDictionary(
  override?: Partial<ChatDictionary>,
): ChatDictionary {
  if (!override) return chatDictionaryZhCN
  return { ...chatDictionaryZhCN, ...override }
}
