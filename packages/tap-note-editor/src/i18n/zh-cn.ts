export interface TapNoteDictionary {
  aiBusy: string
  aiInlineTrigger: string
  aiChatTrigger: string
}

export const tapNoteDictionaryZhCN: TapNoteDictionary = {
  aiBusy: 'AI 正在处理,请稍候...',
  aiInlineTrigger: '内联 AI 助手',
  aiChatTrigger: '对话 AI 助手',
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
