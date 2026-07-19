import type { AIInlineContext } from '../extension/tap-note-ai-inline-extension'
import type { InlineDictionary } from '../i18n/zh-cn'

/**
 * Slash 菜单项。
 */
export interface SlashMenuItem {
  name: string
  onItemClick: () => void
  aliases?: string[]
  group?: string
  icon?: string
  hint?: string
}

/**
 * 获取 `/ai` 触发的 slash 菜单项。
 *
 * 用户在空块输入 `/ai` 时,slash 菜单出现"AI 续写"项;
 * 选择后隐藏 slash 菜单,显示 AIMenu 输入框。
 *
 * busy 互斥:另一 AI 进行中时 slash 项置灰。
 */
export function getAISlashMenuItems(
  context: AIInlineContext,
  dictionary: InlineDictionary,
  isBusy?: boolean,
): SlashMenuItem[] {
  return [
    {
      name: 'AI 续写',
      onItemClick: () => {
        if (!isBusy) {
          // 唤起 AIMenu(user-input 态)
          context.close()
        }
      },
      aliases: ['ai', 'AI', '续写'],
      group: 'AI',
      icon: '✨',
      hint: isBusy ? dictionary.aiBusy : undefined,
    },
  ]
}
