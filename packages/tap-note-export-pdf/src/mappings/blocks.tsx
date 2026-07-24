/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react"
import { View, Text, Image, Link, StyleSheet } from "@react-pdf/renderer"
import type { ExportWarning, ResourceResolver, UnknownBlockPolicy } from "@tap-note/export-core"
import { EXPORT_ERROR_CODES } from "@tap-note/export-core"
import { renderInlineContent } from "./inline-content"
import { renderTable } from "../util/table"
import { resolveImageToDataUri } from "../util/image"

const BULLET_SYMBOLS = ["•", "◦", "▪"]

const HEADING_FONT_SIZES: Record<number, number> = {
  1: 24,
  2: 20,
  3: 16,
  4: 14,
  5: 12,
  6: 11,
}

const HEADING_FONT_WEIGHTS: Record<number, number> = {
  1: 900,
  2: 700,
  3: 700,
  4: 700,
  5: 700,
  6: 700,
}

const blockStyles = StyleSheet.create({
  paragraph: { marginBottom: 6, fontSize: 12, lineHeight: 1.5 },
  heading: { marginBottom: 8, lineHeight: 1.25 },
  listItem: { flexDirection: "row", marginBottom: 4, fontSize: 12, lineHeight: 1.5 },
  listMarker: { width: 16, textAlign: "right", marginRight: 6 },
  quote: {
    borderLeftWidth: 3,
    borderLeftColor: "#CCCCCC",
    paddingLeft: 12,
    marginBottom: 8,
    fontSize: 12,
    color: "#555555",
  },
  codeBlock: {
    fontFamily: "Courier",
    fontSize: 10,
    backgroundColor: "#F5F5F5",
    padding: 8,
    marginBottom: 8,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#999999",
    marginVertical: 12,
  },
  mediaLink: { marginBottom: 6, fontSize: 12, color: "#0066CC", textDecoration: "underline" },
})

interface RenderContext {
  resolver: ResourceResolver
  warnings: ExportWarning[]
  unknownBlockPolicy: UnknownBlockPolicy
}

export async function renderBlocks(
  blocks: any[],
  ctx: RenderContext,
  nestingLevel = 0,
  keyPrefix = "b"
): Promise<React.ReactElement[]> {
  const elements: React.ReactElement[] = []
  let numberedIndex = 0

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    const key = `${keyPrefix}-${i}`
    const blockType = block.type as string

    if (blockType === "numberedListItem") {
      numberedIndex++
    } else {
      numberedIndex = 0
    }

    const children = block.children?.length
      ? await renderBlocks(block.children, ctx, nestingLevel + 1, `${key}-c`)
      : []

    const element = await renderSingleBlock(block, ctx, nestingLevel, numberedIndex, children, key)
    if (element) {
      elements.push(element)
    }
  }

  return elements
}

async function renderSingleBlock(
  block: any,
  ctx: RenderContext,
  nestingLevel: number,
  numberedIndex: number,
  children: React.ReactElement[],
  key: string
): Promise<React.ReactElement | null> {
  const indent = nestingLevel * 16
  const content = block.content ?? []

  switch (block.type) {
    case "paragraph":
      return React.createElement(
        View,
        { key, style: [blockStyles.paragraph, indent ? { marginLeft: indent } : {}] },
        React.createElement(Text, { key: `${key}-t` }, ...renderInlineContent(content, `${key}-ic`))
      )

    case "heading": {
      const level = Math.min(Math.max(block.props?.level ?? 1, 1), 6)
      return React.createElement(
        View,
        { key, style: [blockStyles.heading, indent ? { marginLeft: indent } : {}] },
        React.createElement(
          Text,
          {
            key: `${key}-t`,
            style: {
              fontSize: HEADING_FONT_SIZES[level],
              fontWeight: HEADING_FONT_WEIGHTS[level],
            },
          },
          ...renderInlineContent(content, `${key}-ic`)
        )
      )
    }

    case "bulletListItem": {
      const symbol = BULLET_SYMBOLS[nestingLevel % BULLET_SYMBOLS.length]
      return React.createElement(
        View,
        { key, style: [blockStyles.listItem, { marginLeft: indent }] },
        React.createElement(Text, { key: `${key}-m`, style: blockStyles.listMarker }, symbol),
        React.createElement(
          Text,
          { key: `${key}-t`, style: { flex: 1 } },
          ...renderInlineContent(content, `${key}-ic`)
        ),
        ...children
      )
    }

    case "numberedListItem":
      return React.createElement(
        View,
        { key, style: [blockStyles.listItem, { marginLeft: indent }] },
        React.createElement(Text, { key: `${key}-m`, style: blockStyles.listMarker }, `${numberedIndex}.`),
        React.createElement(
          Text,
          { key: `${key}-t`, style: { flex: 1 } },
          ...renderInlineContent(content, `${key}-ic`)
        ),
        ...children
      )

    case "checkListItem": {
      const checked = block.props?.checked ?? false
      const symbol = checked ? "☑" : "☐"
      return React.createElement(
        View,
        { key, style: [blockStyles.listItem, { marginLeft: indent }] },
        React.createElement(Text, { key: `${key}-m`, style: blockStyles.listMarker }, symbol),
        React.createElement(
          Text,
          { key: `${key}-t`, style: { flex: 1 } },
          ...renderInlineContent(content, `${key}-ic`)
        ),
        ...children
      )
    }

    case "toggleListItem":
      return React.createElement(
        View,
        { key, style: [blockStyles.listItem, { marginLeft: indent }] },
        React.createElement(Text, { key: `${key}-m`, style: blockStyles.listMarker }, "▸"),
        React.createElement(
          Text,
          { key: `${key}-t`, style: { flex: 1 } },
          ...renderInlineContent(content, `${key}-ic`)
        ),
        ...children
      )

    case "quote":
      return React.createElement(
        View,
        { key, style: [blockStyles.quote, indent ? { marginLeft: indent } : {}] },
        React.createElement(Text, { key: `${key}-t` }, ...renderInlineContent(content, `${key}-ic`)),
        ...children
      )

    case "codeBlock": {
      const code = block.props?.code ?? ""
      const lines = (typeof code === "string" ? code : "").split("\n")
      return React.createElement(
        View,
        { key, style: blockStyles.codeBlock, wrap: false },
        ...lines.map((line: string, li: number) =>
          React.createElement(Text, { key: `${key}-l-${li}` }, line || " ")
        )
      )
    }

    case "divider":
      return React.createElement(View, { key, style: blockStyles.divider })

    case "image": {
      const url = block.props?.url
      if (!url) {
        return React.createElement(
          View,
          { key },
          React.createElement(Text, { key: `${key}-t` }, "[image: no url]")
        )
      }
      try {
        const dataUri = await resolveImageToDataUri(url, ctx.resolver)
        return React.createElement(
          View,
          { key, style: { marginBottom: 8 } },
          React.createElement(Image, {
            key: `${key}-img`,
            src: dataUri,
            style: { maxWidth: "100%", objectFit: "contain" },
          })
        )
      } catch (e) {
        ctx.warnings.push({
          code: EXPORT_ERROR_CODES.RESOURCE_FAILED,
          message: `Failed to resolve image: ${url} - ${e instanceof Error ? e.message : String(e)}`,
          blockId: block.id,
        })
        return null
      }
    }

    case "table":
      return React.createElement(React.Fragment, { key }, renderTable(block))

    case "audio":
    case "video":
    case "file": {
      const url = block.props?.url ?? ""
      const name = block.props?.name ?? url
      const icons: Record<string, string> = { audio: "🔊", video: "🎬", file: "📎" }
      return React.createElement(
        View,
        { key, style: { marginBottom: 6 } },
        React.createElement(
          Link,
          { key: `${key}-link`, src: url, style: blockStyles.mediaLink },
          `${icons[block.type] ?? "📎"} ${name}`
        )
      )
    }

    case "pageBreak":
      return React.createElement(View, { key, break: true })

    default: {
      if (ctx.unknownBlockPolicy === "error") {
        throw new Error(`Unknown block type: ${block.type}`)
      }

      ctx.warnings.push({
        code: EXPORT_ERROR_CODES.UNKNOWN_BLOCK,
        message: `Unknown block type "${block.type}" handled with policy "${ctx.unknownBlockPolicy}"`,
        blockId: block.id,
      })

      if (ctx.unknownBlockPolicy === "omit-with-warning") {
        return null
      }

      return React.createElement(
        View,
        { key, style: blockStyles.paragraph },
        React.createElement(Text, { key: `${key}-t` }, ...renderInlineContent(content, `${key}-ic`)),
        ...children
      )
    }
  }
}
