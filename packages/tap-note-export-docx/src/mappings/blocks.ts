/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Paragraph,
  TextRun,
  ImageRun,
  ExternalHyperlink,
  PageBreak,
  BorderStyle,
  HeadingLevel,
} from "docx"
import type { ParagraphChild } from "docx"
import type { Exporter } from "@blocknote/core"
import type { ExportWarning } from "@tap-note/export-core"
import { EXPORT_ERROR_CODES } from "@tap-note/export-core"
import { convertTableBlock } from "../util/table"
import { detectImageDimensions, scaleToFit } from "../util/image"
import { BULLET_LIST_REFERENCE, NUMBERED_LIST_REFERENCE } from "../numbering"

const MAX_IMAGE_WIDTH = 500

const HEADING_LEVELS = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
} as const

export function createBlockMapping(warnings: ExportWarning[]) {
  return {
    paragraph: (
      block: any,
      exporter: Exporter<any, any, any, any, any, any, any>
    ): Paragraph => {
      const children = exporter.transformInlineContent(
        block.content ?? []
      ) as ParagraphChild[]
      return new Paragraph({ children })
    },

    heading: (
      block: any,
      exporter: Exporter<any, any, any, any, any, any, any>
    ): Paragraph => {
      const children = exporter.transformInlineContent(
        block.content ?? []
      ) as ParagraphChild[]
      const level = Math.min(Math.max(block.props?.level ?? 1, 1), 6) as
        | 1
        | 2
        | 3
        | 4
        | 5
        | 6
      return new Paragraph({
        children,
        heading: HEADING_LEVELS[level],
      })
    },

    bulletListItem: (
      block: any,
      exporter: Exporter<any, any, any, any, any, any, any>,
      nestingLevel: number
    ): Paragraph => {
      const children = exporter.transformInlineContent(
        block.content ?? []
      ) as ParagraphChild[]
      return new Paragraph({
        children,
        numbering: {
          reference: BULLET_LIST_REFERENCE,
          level: nestingLevel,
        },
      })
    },

    numberedListItem: (
      block: any,
      exporter: Exporter<any, any, any, any, any, any, any>,
      nestingLevel: number
    ): Paragraph => {
      const children = exporter.transformInlineContent(
        block.content ?? []
      ) as ParagraphChild[]
      return new Paragraph({
        children,
        numbering: {
          reference: NUMBERED_LIST_REFERENCE,
          level: nestingLevel,
        },
      })
    },

    checkListItem: (
      block: any,
      exporter: Exporter<any, any, any, any, any, any, any>
    ): Paragraph => {
      const checked = block.props?.checked ?? false
      const prefix = checked ? "☑ " : "☐ "
      const inlineChildren = exporter.transformInlineContent(
        block.content ?? []
      ) as ParagraphChild[]
      return new Paragraph({
        children: [new TextRun(prefix), ...inlineChildren],
      })
    },

    toggleListItem: (
      block: any,
      exporter: Exporter<any, any, any, any, any, any, any>
    ): Paragraph => {
      const inlineChildren = exporter.transformInlineContent(
        block.content ?? []
      ) as ParagraphChild[]
      return new Paragraph({
        children: [new TextRun("▸ "), ...inlineChildren],
      })
    },

    quote: (
      block: any,
      exporter: Exporter<any, any, any, any, any, any, any>
    ): Paragraph => {
      const children = exporter.transformInlineContent(
        block.content ?? []
      ) as ParagraphChild[]
      return new Paragraph({
        children,
        indent: { left: 720 },
        border: {
          left: {
            style: BorderStyle.SINGLE,
            size: 6,
            color: "CCCCCC",
            space: 10,
          },
        },
      })
    },

    codeBlock: (block: any): Paragraph => {
      const code = block.props?.code ?? block.content ?? ""
      const lines = (typeof code === "string" ? code : "").split("\n")
      const children: ParagraphChild[] = []
      for (let i = 0; i < lines.length; i++) {
        if (i > 0) children.push(new TextRun({ break: 1 }))
        children.push(
          new TextRun({
            text: lines[i] ?? "",
            font: "Consolas",
            size: 20,
          })
        )
      }
      return new Paragraph({
        children,
        shading: { type: "clear", fill: "F5F5F5" },
        spacing: { before: 120, after: 120 },
      })
    },

    divider: (): Paragraph => {
      return new Paragraph({
        border: {
          bottom: {
            style: BorderStyle.SINGLE,
            size: 6,
            color: "999999",
            space: 1,
          },
        },
      })
    },

    image: async (
      block: any,
      exporter: Exporter<any, any, any, any, any, any, any>
    ): Promise<Paragraph> => {
      const url = block.props?.url
      if (!url) {
        return new Paragraph({ children: [new TextRun("[image: no url]")] })
      }

      try {
        const blob = await exporter.resolveFile(url)
        const buffer = new Uint8Array(await blob.arrayBuffer())
        const dimensions = detectImageDimensions(buffer)
        const scaled = scaleToFit(dimensions, MAX_IMAGE_WIDTH)

        return new Paragraph({
          children: [
            new ImageRun({
              data: buffer,
              transformation: {
                width: scaled.width,
                height: scaled.height,
              },
              type: "jpg",
            }),
          ],
        })
      } catch (e) {
        warnings.push({
          code: EXPORT_ERROR_CODES.RESOURCE_FAILED,
          message: `Failed to resolve image: ${url} - ${e instanceof Error ? e.message : String(e)}`,
          blockId: block.id,
        })
        return new Paragraph({ children: [] })
      }
    },

    table: (
      block: any,
      exporter: Exporter<any, any, any, any, any, any, any>
    ) => {
      return convertTableBlock(block, exporter)
    },

    audio: (block: any): Paragraph => {
      const url = block.props?.url ?? ""
      const name = block.props?.name ?? url
      return new Paragraph({
        children: [
          new ExternalHyperlink({
            link: url,
            children: [
              new TextRun({
                text: `🔊 ${name}`,
                style: "Hyperlink",
              }),
            ],
          }) as unknown as ParagraphChild,
        ],
      })
    },

    video: (block: any): Paragraph => {
      const url = block.props?.url ?? ""
      const name = block.props?.name ?? url
      return new Paragraph({
        children: [
          new ExternalHyperlink({
            link: url,
            children: [
              new TextRun({
                text: `🎬 ${name}`,
                style: "Hyperlink",
              }),
            ],
          }) as unknown as ParagraphChild,
        ],
      })
    },

    file: (block: any): Paragraph => {
      const url = block.props?.url ?? ""
      const name = block.props?.name ?? url
      return new Paragraph({
        children: [
          new ExternalHyperlink({
            link: url,
            children: [
              new TextRun({
                text: `📎 ${name}`,
                style: "Hyperlink",
              }),
            ],
          }) as unknown as ParagraphChild,
        ],
      })
    },

    pageBreak: (): Paragraph => {
      return new Paragraph({
        children: [new PageBreak()],
      })
    },
  }
}

export function createUnknownBlockHandler(
  policy: "preserve" | "omit-with-warning" | "error",
  warnings: ExportWarning[]
) {
  return (block: any, exporter: Exporter<any, any, any, any, any, any, any>) => {
    if (policy === "error") {
      throw new (class extends Error {
        code = EXPORT_ERROR_CODES.UNKNOWN_BLOCK
        blockId = block.id
      })(`Unknown block type: ${block.type}`)
    }

    warnings.push({
      code: EXPORT_ERROR_CODES.UNKNOWN_BLOCK,
      message: `Unknown block type "${block.type}" handled with policy "${policy}"`,
      blockId: block.id,
    })

    if (policy === "omit-with-warning") {
      return new Paragraph({ children: [] })
    }

    const children = block.content
      ? (exporter.transformInlineContent(block.content) as ParagraphChild[])
      : [new TextRun(block.props?.code ?? "")]
    return new Paragraph({ children })
  }
}
