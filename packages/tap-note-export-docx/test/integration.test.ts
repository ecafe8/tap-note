/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, test } from "bun:test"
import { createDocxExporter } from "../src/index"
import {
  validateExportInput,
  createNoopResolver,
} from "@tap-note/export-core"
import type { ExportInput, ResourceResolver } from "@tap-note/export-core"

function makeInput(blocks: any[], options?: any, resolver?: ResourceResolver) {
  const input: ExportInput = {
    blocks,
    resolver: resolver ?? createNoopResolver(),
    options,
  }
  return validateExportInput(input)
}

function isZipSignature(bytes: Uint8Array): boolean {
  return (
    bytes.length > 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  )
}

describe("integration: full document export", () => {
  test("complex document produces valid DOCX zip with word/document.xml", async () => {
    const exporter = createDocxExporter()
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
            {
              type: "text",
              text: "Bold and ",
              styles: { bold: true },
            },
            {
              type: "text",
              text: "italic text with ",
              styles: { italic: true },
            },
            {
              type: "link",
              href: "https://example.com",
              content: [
                { type: "text", text: "a link", styles: { underline: true } },
              ],
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
    expect(isZipSignature(result.content)).toBe(true)
    expect(result.warnings).toEqual([])
  })
})

describe("integration: CJK content with font config", () => {
  test("Chinese text with eastAsia font produces valid output", async () => {
    const exporter = createDocxExporter({
      fontConfig: {
        default: { ascii: "Calibri", eastAsia: "SimSun", size: 12 },
      },
    })
    const result = await exporter.toUint8Array(
      makeInput(
        [
          {
            id: "p1",
            type: "paragraph",
            content: [
              { type: "text", text: "你好世界", styles: {} },
              { type: "text", text: "Hello World", styles: { bold: true } },
            ],
          },
        ],
        { fontConfig: { default: { ascii: "Calibri", eastAsia: "SimSun", size: 12 } } }
      )
    )

    expect(result.content).toBeInstanceOf(Uint8Array)
    expect(result.content.length).toBeGreaterThan(0)
    expect(isZipSignature(result.content)).toBe(true)
  })
})

describe("security: malicious URLs", () => {
  test("resolver rejection produces warning, not crash", async () => {
    const secureResolver: ResourceResolver = {
      resolve(url: string) {
        if (
          url.startsWith("file://") ||
          url.includes("169.254.169.254") ||
          url.includes("127.0.0.1") ||
          url.includes("localhost")
        ) {
          return Promise.reject(new Error(`Blocked: ${url}`))
        }
        return Promise.resolve({
          buffer: new Uint8Array([0]),
          mimeType: "application/octet-stream",
        })
      },
    }

    const exporter = createDocxExporter()
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

  test("noop resolver produces warnings for image blocks", async () => {
    const exporter = createDocxExporter()
    const result = await exporter.toUint8Array(
      makeInput([
        {
          id: "img1",
          type: "image",
          props: { url: "https://example.com/photo.png" },
          content: [],
        },
      ])
    )

    expect(result.content.length).toBeGreaterThan(0)
    expect(result.warnings.length).toBe(1)
    expect(result.warnings[0]!.code).toBe("RESOURCE_FAILED")
  })
})
