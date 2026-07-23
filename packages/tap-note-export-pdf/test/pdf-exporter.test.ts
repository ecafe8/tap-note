/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, test } from "bun:test"
import { createPdfExporter, mergeStyles, mapStyle, bufferToDataUri, registerFonts } from "../src/index"
import { validateExportInput, createNoopResolver } from "@tap-note/export-core"
import type { ExportInput, ResourceResolver } from "@tap-note/export-core"

function makeInput(blocks: any[], options?: any, resolver?: ResourceResolver) {
  const input: ExportInput = {
    blocks,
    resolver: resolver ?? createNoopResolver(),
    options,
  }
  return validateExportInput(input)
}

function isPdfSignature(bytes: Uint8Array): boolean {
  return (
    bytes.length > 5 &&
    bytes[0] === 0x25 && // %
    bytes[1] === 0x50 && // P
    bytes[2] === 0x44 && // D
    bytes[3] === 0x46 && // F
    bytes[4] === 0x2d    // -
  )
}

describe("TapNotePdfExporter", () => {
  test("exports empty document as valid PDF", async () => {
    const exporter = createPdfExporter()
    const result = await exporter.toUint8Array(makeInput([]))
    expect(result.content).toBeInstanceOf(Uint8Array)
    expect(result.content.length).toBeGreaterThan(0)
    expect(isPdfSignature(result.content)).toBe(true)
    expect(result.mimeType).toBe("application/pdf")
    expect(result.fileName).toBe("document.pdf")
    expect(result.warnings).toEqual([])
  })

  test("exports paragraph with styled text", async () => {
    const exporter = createPdfExporter()
    const result = await exporter.toUint8Array(
      makeInput([
        {
          id: "p1",
          type: "paragraph",
          content: [
            { type: "text", text: "Hello Bold", styles: { bold: true } },
            { type: "text", text: " and italic", styles: { italic: true } },
          ],
        },
      ])
    )
    expect(result.content.length).toBeGreaterThan(0)
    expect(isPdfSignature(result.content)).toBe(true)
  })

  test("exports heading blocks", async () => {
    const exporter = createPdfExporter()
    const result = await exporter.toUint8Array(
      makeInput([
        {
          id: "h1",
          type: "heading",
          props: { level: 1 },
          content: [{ type: "text", text: "Title", styles: {} }],
        },
      ])
    )
    expect(result.content.length).toBeGreaterThan(0)
    expect(isPdfSignature(result.content)).toBe(true)
  })

  test("exports nested bullet list", async () => {
    const exporter = createPdfExporter()
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
    const exporter = createPdfExporter()
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
    const exporter = createPdfExporter()
    const result = await exporter.toUint8Array(
      makeInput([], { fileName: "my-report.pdf" })
    )
    expect(result.fileName).toBe("my-report.pdf")
  })

  test("format property is pdf", () => {
    const exporter = createPdfExporter()
    expect(exporter.format).toBe("pdf")
  })

  test("toBlob produces Blob in happy-dom", async () => {
    const exporter = createPdfExporter()
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
    expect(result.mimeType).toBe("application/pdf")
  })
})

describe("mapStyle", () => {
  test("bold maps correctly", () => {
    expect(mapStyle("bold", true)).toEqual({ fontWeight: "bold" })
    expect(mapStyle("bold", false)).toEqual({})
  })

  test("italic maps correctly", () => {
    expect(mapStyle("italic", true)).toEqual({ fontStyle: "italic" })
  })

  test("textColor maps correctly", () => {
    expect(mapStyle("textColor", "#FF0000")).toEqual({ color: "#FF0000" })
  })

  test("code maps to Courier with background", () => {
    expect(mapStyle("code", true)).toEqual({ fontFamily: "Courier", backgroundColor: "#F0F0F0" })
  })
})

describe("mergeStyles", () => {
  test("merges multiple styles", () => {
    const result = mergeStyles({ bold: true, italic: true, textColor: "#0000FF" })
    expect(result).toEqual({ fontWeight: "bold", fontStyle: "italic", color: "#0000FF" })
  })
})

describe("bufferToDataUri", () => {
  test("converts buffer to data URI", () => {
    const buffer = new Uint8Array([72, 101, 108, 108, 111])
    const result = bufferToDataUri(buffer, "text/plain")
    expect(result).toBe("data:text/plain;base64,SGVsbG8=")
  })
})

describe("registerFonts", () => {
  test("returns FONT_MISSING warning when buffer not provided", () => {
    const result = registerFonts(
      { default: { ascii: "CustomFont", eastAsia: "SimSun" } },
      undefined
    )
    expect(result.warnings.length).toBe(2)
    expect(result.warnings[0]!.code).toBe("FONT_MISSING")
  })

  test("no warnings when no fontConfig", () => {
    const result = registerFonts(undefined, undefined)
    expect(result.warnings).toEqual([])
  })
})
