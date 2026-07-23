/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Paragraph,
  Table,
  TableCell,
  TableRow,
  WidthType,
  VerticalAlign,
  BorderStyle,
} from "docx"
import type { ParagraphChild } from "docx"
import type { Exporter } from "@blocknote/core"

const PX_TO_TWIP = 15

interface TableBlockContent {
  type: "table"
  content: {
    type: "tableRow"
    content: {
      type: "tableCell"
      content: Array<{ type: string; text?: string; styles?: Record<string, unknown> }>
      colspan?: number
      rowspan?: number
    }[]
  }[]
  columnWidths?: number[]
}

export function convertTableBlock(
  block: TableBlockContent,
  exporter: Exporter<any, any, any, any, any, any, any>
): Table {
  const columnWidths = block.content[0]?.content.map(
    (_, i) => block.columnWidths?.[i] ?? 200
  )

  const rows = block.content.map((row) => {
    const cells = row.content.map((cell, cellIndex) => {
      const inlineContent = exporter.transformInlineContent(
        cell.content as any
      ) as ParagraphChild[]

      return new TableCell({
        children: [
          new Paragraph({
            children: inlineContent,
          }),
        ],
        columnSpan: cell.colspan,
        rowSpan: cell.rowspan,
        width: columnWidths[cellIndex]
          ? {
              size: columnWidths[cellIndex]! * PX_TO_TWIP,
              type: WidthType.DXA,
            }
          : undefined,
        verticalAlign: VerticalAlign.CENTER,
      })
    })

    return new TableRow({ children: cells })
  })

  return new Table({
    rows,
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
      insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    },
  })
}
