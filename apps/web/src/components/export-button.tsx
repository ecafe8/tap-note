import { useState } from "react"
import type { FC } from "react"
import type { PartialBlock } from "@blocknote/core"
import { createDocxExporter } from "@tap-note/export-docx"
import { validateExportInput, createNoopResolver } from "@tap-note/export-core"
import { Button } from "@workspace/ui/components/button"

interface ExportButtonProps {
  blocks: PartialBlock[] | null
}

export const ExportButton: FC<ExportButtonProps> = ({ blocks }) => {
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    if (!blocks) return
    setExporting(true)
    try {
      const exporter = createDocxExporter()
      const input = validateExportInput({
        blocks,
        resolver: createNoopResolver(),
      })
      const result = await exporter.toBlob(input)
      const url = URL.createObjectURL(result.content)
      const a = document.createElement("a")
      a.href = url
      a.download = result.fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={handleExport} disabled={exporting || !blocks}>
      {exporting ? "导出中..." : "📄 导出 DOCX"}
    </Button>
  )
}
