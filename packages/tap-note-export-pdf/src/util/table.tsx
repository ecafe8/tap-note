import React from "react"
import { View, Text, StyleSheet } from "@react-pdf/renderer"
import { renderInlineContent } from "../mappings/inline-content"

const tableStyles = StyleSheet.create({
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#CCCCCC" },
  cell: {
    padding: 4,
    borderRightWidth: 1,
    borderRightColor: "#CCCCCC",
    fontSize: 10,
  },
  headerCell: { fontWeight: "bold" },
})

interface TableCell {
  type: "tableCell"
  content: Array<{ type: string; text?: string; styles?: Record<string, unknown> }>
  colspan?: number
  rowspan?: number
}

interface TableRow {
  type: "tableRow"
  content: TableCell[]
}

interface TableBlock {
  type: "table"
  content: TableRow[]
  columnWidths?: number[]
}

export function renderTable(block: TableBlock): React.ReactElement {
  const totalWidth = block.columnWidths?.reduce((a, b) => a + b, 0) ?? 100

  const rows = block.content.map((row, ri) => {
    const cells = row.content.map((cell, ci) => {
      const widthPercent = block.columnWidths?.[ci]
        ? (block.columnWidths[ci]! / totalWidth) * 100
        : undefined
      const isHeader = ri === 0
      const inlineContent = (cell.content ?? []) as Array<{
        type: string
        text?: string
        styles?: Record<string, unknown>
      }>

      return React.createElement(
        View,
        {
          key: `cell-${ci}`,
          style: [
            tableStyles.cell,
            isHeader ? tableStyles.headerCell : {},
            widthPercent ? { width: `${widthPercent}%` } : { flex: 1 },
          ],
        },
        React.createElement(
          Text,
          { key: `ct-${ci}` },
          ...renderInlineContent(inlineContent as never[], `tc-${ri}-${ci}`)
        )
      )
    })

    return React.createElement(View, { key: `row-${ri}`, style: tableStyles.row }, ...cells)
  })

  return React.createElement(
    View,
    {
      style: { borderWidth: 1, borderColor: "#CCCCCC", marginBottom: 8 },
      wrap: false,
    },
    ...rows
  )
}
