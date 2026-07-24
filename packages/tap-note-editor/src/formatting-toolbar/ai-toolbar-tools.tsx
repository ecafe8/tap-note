import type { AIToolItem } from '../types'

interface AIToolbarToolsProps {
  tools: readonly AIToolItem[]
  onSelect: (tool: AIToolItem) => void
}

export function AIToolbarTools({ tools, onSelect }: AIToolbarToolsProps) {
  if (tools.length === 0) return null

  return (
    <div
      className="tn-ai-tools"
      role="listbox"
      aria-label="AI 技能"
      data-test="ai-toolbar-tools"
    >
      {tools.map((tool) => {
        const Icon = tool.icon
        return (
          <button
            key={tool.id}
            type="button"
            role="option"
            aria-selected={false}
            className="tn-ai-tool-item"
            onClick={() => onSelect(tool)}
          >
            {Icon && <Icon className="tn-ai-tool-icon size-12" />}
            <span className="text-sm">{tool.label}</span>
          </button>
        )
      })}
    </div>
  )
}
