export interface TapNoteDictionary {
  aiBusy: string
  aiInlineTrigger: string
  aiChatTrigger: string
  aiToolbarPlaceholder: string
  aiToolbarSend: string
  aiToolbarClose: string
  aiToolbarWriting: string
  aiToolbarAbort: string
  aiToolbarAccept: string
  aiToolbarReject: string
  aiToolbarRetry: string
  aiToolExpand: string
  aiToolSummarize: string
  aiToolPolish: string
  aiToolShorten: string
}

export const tapNoteDictionaryZhCN: TapNoteDictionary = {
  aiBusy: 'AI 正在处理,请稍候...',
  aiInlineTrigger: '内联 AI 助手',
  aiChatTrigger: '对话 AI 助手',
  aiToolbarPlaceholder: '输入你的指令...',
  aiToolbarSend: '发送',
  aiToolbarClose: '关闭',
  aiToolbarWriting: 'AI 写作中...',
  aiToolbarAbort: '中止',
  aiToolbarAccept: '接受',
  aiToolbarReject: '拒绝',
  aiToolbarRetry: '重试',
  aiToolExpand: '扩写',
  aiToolSummarize: '总结',
  aiToolPolish: '润色',
  aiToolShorten: '精简',
}

export function mergeDictionary(
  base: TapNoteDictionary,
  override?: Partial<TapNoteDictionary>,
): TapNoteDictionary {
  if (!override) {
    return base
  }
  return { ...base, ...override }
}
