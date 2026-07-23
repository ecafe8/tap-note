/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, test } from "bun:test"
import {
  createDocxExporter,
  docxStyleMapping,
  createNumberingConfig,
  buildDefaultStyles,
} from "../src/index"
import {
  validateExportInput,
  createNoopResolver,
} from "@tap-note/export-core"
import type { ExportInput } from "@tap-note/export-core"

function makeInput(blocks: any[], options?: any) {
  const input: ExportInput = {
    blocks,
    resolver: createNoopResolver(),
    options,
  }
  return validateExportInput(input)
}

describe("TapNoteDocxExporter", () => {
  test("exports empty document as valid DOCX", async () => {
    const exporter = createDocxExporter()
    const result = await exporter.toUint8Array(makeInput([]))
    expect(result.content).toBeInstanceOf(Uint8Array)
    expect(result.content.length).toBeGreaterThan(0)
    expect(result.mimeType).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    expect(result.fileName).toBe("document.docx")
    expect(result.warnings).toEqual([])
  })

  test("exports paragraph with styled text", async () => {
    const exporter = createDocxExporter()
    const result = await exporter.toUint8Array(
      makeInput([
        {
          id: "p1",
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "Hello Bold",
              styles: { bold: true },
            },
          ],
        },
      ])
    )
    expect(result.content.length).toBeGreaterThan(0)
    expect(result.warnings).toEqual([])
  })

  test("exports heading blocks", async () => {
    const exporter = createDocxExporter()
    const result = await exporter.toUint8Array(
      makeInput([
        {
          id: "h1",
          type: "heading",
          props: { level: 1 },
          content: [{ type: "text", text: "Title", styles: {} }],
        },
        {
          id: "h2",
          type: "heading",
          props: { level: 3 },
          content: [{ type: "text", text: "Subtitle", styles: {} }],
        },
      ])
    )
    expect(result.content.length).toBeGreaterThan(0)
  })

  test("exports nested bullet list", async () => {
    const exporter = createDocxExporter()
    const result = await exporter.toUint8Array(
      makeInput([
        {
          id: "b1",
          type: "bulletListItem",
          content: [{ type: "text", text: "Item 1", styles: {} }],
          children: [
            {
              id: "b2",
              type: "bulletListItem",
              content: [{ type: "text", text: "Sub item", styles: {} }],
            },
          ],
        },
      ])
    )
    expect(result.content.length).toBeGreaterThan(0)
  })

  test("unknown block with preserve policy produces warning", async () => {
    const exporter = createDocxExporter()
    const result = await exporter.toUint8Array(
      makeInput([
        {
          id: "custom1",
          type: "myCustomWidget",
          content: [{ type: "text", text: "widget text", styles: {} }],
        },
      ])
    )
    expect(result.content.length).toBeGreaterThan(0)
    expect(result.warnings.length).toBe(1)
    expect(result.warnings[0]!.code).toBe("UNKNOWN_BLOCK")
    expect(result.warnings[0]!.blockId).toBe("custom1")
  })

  test("custom fileName is respected", async () => {
    const exporter = createDocxExporter()
    const result = await exporter.toUint8Array(
      makeInput([], { fileName: "my-report.docx" })
    )
    expect(result.fileName).toBe("my-report.docx")
  })

  test("format property is docx", () => {
    const exporter = createDocxExporter()
    expect(exporter.format).toBe("docx")
  })

  test("toBlob produces Blob in happy-dom", async () => {
    const exporter = createDocxExporter()
    const result = await exporter.toBlob(
      makeInput([
        {
          id: "p1",
          type: "paragraph",
          content: [{ type: "text", text: "test", styles: {} }],
        },
      ])
    )
    expect(result.content).toBeInstanceOf(Blob)
    expect(result.mimeType).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
  })
})

describe("docxStyleMapping", () => {
  test("bold maps correctly", () => {
    expect(docxStyleMapping.bold(true)).toEqual({ bold: true })
  })

  test("italic maps correctly", () => {
    expect(docxStyleMapping.italic(true)).toEqual({ italics: true })
  })

  test("textColor strips # prefix", () => {
    expect(docxStyleMapping.textColor("#FF0000")).toEqual({ color: "FF0000" })
  })

  test("backgroundColor maps to shading", () => {
    expect(docxStyleMapping.backgroundColor("#FFFF00")).toEqual({
      shading: { type: "clear", fill: "FFFF00" },
    })
  })

  test("code maps to Consolas with shading", () => {
    const result = docxStyleMapping.code(true)
    expect(result).toEqual({
      font: "Consolas",
      shading: { type: "clear", fill: "F0F0F0" },
    })
  })
})

describe("createNumberingConfig", () => {
  test("creates bullet and numbered list configs with 9 levels", () => {
    const config = createNumberingConfig()
    expect(config.config).toHaveLength(2)
    expect(config.config![0]!.reference).toBe("tap-note-bullet-list")
    expect(config.config![0]!.levels).toHaveLength(9)
    expect(config.config![1]!.reference).toBe("tap-note-numbered-list")
    expect(config.config![1]!.levels).toHaveLength(9)
  })
})

describe("buildDefaultStyles", () => {
  test("returns undefined without fontConfig", () => {
    expect(buildDefaultStyles()).toBeUndefined()
    expect(buildDefaultStyles({})).toBeUndefined()
  })

  test("builds font config with eastAsia", () => {
    const styles = buildDefaultStyles({
      default: { ascii: "Calibri", eastAsia: "SimSun", size: 12 },
    })
    expect(styles).toEqual({
      default: {
        document: {
          run: {
            font: { ascii: "Calibri", eastAsia: "SimSun" },
            size: 24,
          },
        },
      },
    })
  })
})
