import { Maximize2, AlignLeft, PenLine, Minimize2 } from 'lucide-react'
import type { AIToolItem } from '../types'
import type { TapNoteDictionary } from '../i18n/zh-cn'

export function createDefaultAITools(dictionary: TapNoteDictionary): readonly AIToolItem[] {
  return [
    {
      id: 'expand',
      label: dictionary.aiToolExpand,
      prompt: '请将选中内容扩写，补充更多细节和论述',
      icon: Maximize2,
    },
    {
      id: 'summarize',
      label: dictionary.aiToolSummarize,
      prompt: '请将选中内容总结为简洁要点',
      icon: AlignLeft,
    },
    {
      id: 'polish',
      label: dictionary.aiToolPolish,
      prompt: '请润色选中内容，改善表达和流畅度',
      icon: PenLine,
    },
    {
      id: 'shorten',
      label: dictionary.aiToolShorten,
      prompt: '请精简选中内容，去除冗余保留核心',
      icon: Minimize2,
    },
  ]
}
