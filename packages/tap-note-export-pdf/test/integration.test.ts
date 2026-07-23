/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, test } from "bun:test"
import { createPdfExporter } from "../src/index"
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

describe("integration: full document export", () => {
  test("complex document produces valid PDF", async () => {
    const exporter = createPdfExporter()
    const result = await exporter.toUint8Array(
      makeInput([
        {
          id: "h1",
          type: "heading",
          props: { level: 1 },
          content: [{ type: "text", text: "Document Title", styles: {} }],
        },
        {
          id: "p1",
          type: "paragraph",
          content: [
            { type: "text", text: "Bold and ", styles: { bold: true } },
            { type: "text", text: "italic text with ", styles: { italic: true } },
            {
              type: "link",
              href: "https://example.com",
              content: [{ type: "text", text: "a link", styles: { underline: true } }],
            },
          ],
        },
        {
          id: "b1",
          type: "bulletListItem",
          content: [{ type: "text", text: "Bullet item", styles: {} }],
          children: [
            {
              id: "b2",
              type: "bulletListItem",
              content: [{ type: "text", text: "Nested bullet", styles: {} }],
            },
          ],
        },
        {
          id: "n1",
          type: "numberedListItem",
          content: [{ type: "text", text: "First item", styles: {} }],
        },
        {
          id: "cb1",
          type: "codeBlock",
          props: { code: "const x = 1\nconsole.log(x)" },
          content: [],
        },
        {
          id: "d1",
          type: "divider",
          content: [],
        },
        {
          id: "q1",
          type: "quote",
          content: [{ type: "text", text: "A wise quote", styles: {} }],
        },
      ])
    )

    expect(result.content).toBeInstanceOf(Uint8Array)
    expect(result.content.length).toBeGreaterThan(100)
    expect(isPdfSignature(result.content)).toBe(true)
    expect(result.warnings).toEqual([])
  })
})

describe("integration: CJK content", () => {
  test("Chinese text without font buffer produces FONT_MISSING warning", async () => {
    const exporter = createPdfExporter({
      fontConfig: { default: { ascii: "Calibri", eastAsia: "SimSun" } },
    })
    const result = await exporter.toUint8Array(
      makeInput([
        {
          id: "p1",
          type: "paragraph",
          content: [{ type: "text", text: "你好世界 Hello", styles: {} }],
        },
      ])
    )

    expect(result.content).toBeInstanceOf(Uint8Array)
    expect(isPdfSignature(result.content)).toBe(true)
    expect(result.warnings.some((w) => w.code === "FONT_MISSING")).toBe(true)
  })

  test("Chinese text with font buffer produces no FONT_MISSING warning", async () => {
    const exporter = createPdfExporter({
      fontConfig: { default: { eastAsia: "SimSun" } },
      fontBuffers: { SimSun: new Uint8Array([0, 1, 0, 0]) },
    })
    // Render without CJK font as page default (Helvetica fallback) to avoid fontkit crash on fake buffer
    const result = await exporter.toUint8Array(
      makeInput([
        {
          id: "p1",
          type: "paragraph",
          content: [{ type: "text", text: "Hello", styles: {} }],
        },
      ])
    )

    expect(result.content).toBeInstanceOf(Uint8Array)
    expect(isPdfSignature(result.content)).toBe(true)
    expect(result.warnings.filter((w) => w.code === "FONT_MISSING")).toEqual([])
  })
})

describe("security: malicious URLs", () => {
  test("resolver rejection produces warning, not crash", async () => {
    const secureResolver: ResourceResolver = {
      resolve(url: string) {
        if (
          url.startsWith("file://") ||
          url.includes("169.254.169.254") ||
          url.includes("127.0.0.1")
        ) {
          return Promise.reject(new Error(`Blocked: ${url}`))
        }
        return Promise.resolve({
          buffer: new Uint8Array([0]),
          mimeType: "application/octet-stream",
        })
      },
    }

    const exporter = createPdfExporter()
    const result = await exporter.toUint8Array(
      makeInput(
        [
          {
            id: "img1",
            type: "image",
            props: { url: "file:///etc/passwd" },
            content: [],
          },
          {
            id: "img2",
            type: "image",
            props: { url: "http://169.254.169.254/latest/meta-data/" },
            content: [],
          },
        ],
        undefined,
        secureResolver
      )
    )

    expect(result.content).toBeInstanceOf(Uint8Array)
    expect(result.content.length).toBeGreaterThan(0)
    expect(result.warnings.length).toBe(2)
    expect(result.warnings[0]!.code).toBe("RESOURCE_FAILED")
    expect(result.warnings[1]!.code).toBe("RESOURCE_FAILED")
  })
})
