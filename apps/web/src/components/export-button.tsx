import { useState } from "react"
import type { FC } from "react"
import type { PartialBlock } from "@blocknote/core"
import { createDocxExporter } from "@tap-note/export-docx"
import { createPdfExporter } from "@tap-note/export-pdf"
import { validateExportInput, createNoopResolver } from "@tap-note/export-core"
import { Button } from "@workspace/ui/components/button"

type ExportFormat = "docx" | "pdf"

interface ExportButtonProps {
  blocks: PartialBlock[] | null
}

export const ExportButton: FC<ExportButtonProps> = ({ blocks }) => {
  const [exporting, setExporting] = useState<ExportFormat | null>(null)

  const handleExport = async (format: ExportFormat) => {
    if (!blocks) return
    setExporting(format)
    try {
      const exporter =
        format === "pdf" ? createPdfExporter() : createDocxExporter()
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
      setExporting(null)
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleExport("docx")}
        disabled={exporting !== null || !blocks}
      >
        {exporting === "docx" ? "导出中..." : "📄 DOCX"}
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => handleExport("pdf")}
        disabled={exporting !== null || !blocks}
      >
        {exporting === "pdf" ? "导出中..." : "📕 PDF"}
      </Button>
    </>
  )
}
