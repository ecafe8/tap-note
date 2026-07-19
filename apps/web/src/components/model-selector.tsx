import { useEffect, useState, type FC } from 'react'

interface ModelInfo {
  id: string
  label: string
  provider: string
}

interface ModelSelectorProps {
  /** 当前选中的模型 ID。 */
  value: string
  /** 选择变更回调。 */
  onChange: (modelId: string) => void
}

/**
 * ModelSelector:启动时 GET /api/ai/models 渲染下拉,切换后写入 transport body。
 *
 * 这是 apps/web demo example,不在 @tap-note/ai-chat 包范围内。
 */
export const ModelSelector: FC<ModelSelectorProps> = ({ value, onChange }) => {
  const [models, setModels] = useState<ModelInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/ai/models', { headers: { Accept: 'application/json' } })
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }
        const json = (await res.json()) as { code?: string; data?: { models?: ModelInfo[] }; models?: ModelInfo[] }
        const list = json.data?.models ?? json.models ?? []
        if (!cancelled) {
          setModels(list)
          setError(null)
          setLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return <span className="tn-model-selector tn-model-selector-loading">加载模型…</span>
  }
  if (error) {
    return <span className="tn-model-selector tn-model-selector-error" title={error}>模型列表失败</span>
  }
  if (models.length === 0) {
    return <span className="tn-model-selector tn-model-selector-empty">无可用模型</span>
  }
  return (
    <label className="tn-model-selector">
      <span className="tn-model-selector-label">模型:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="tn-model-selector-select"
        aria-label="选择模型"
      >
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label} ({m.provider})
          </option>
        ))}
      </select>
    </label>
  )
}
