import { describe, expect, test } from "bun:test"
import {
  validateExportInput,
  createNoopResolver,
  ExportError,
  EXPORT_ERROR_CODES,
  DEFAULT_UNKNOWN_BLOCK_POLICY,
} from "../src/index"
import type { ExportInput } from "../src/index"

describe("validateExportInput", () => {
  const resolver = createNoopResolver()

  test("valid input with non-empty blocks produces ValidatedExportInput", () => {
    const input: ExportInput = {
      blocks: [{ id: "b1", type: "paragraph", content: [] }],
      resolver,
    }
    const result = validateExportInput(input)
    expect(result.blocks).toHaveLength(1)
    expect(result.resolver).toBe(resolver)
    expect(result.unknownBlockPolicy).toBe(DEFAULT_UNKNOWN_BLOCK_POLICY)
    expect(result.fileName).toBeUndefined()
    expect(result.fontConfig).toBeUndefined()
  })

  test("valid input with empty blocks array", () => {
    const input: ExportInput = {
      blocks: [],
      resolver,
    }
    const result = validateExportInput(input)
    expect(result.blocks).toHaveLength(0)
  })

  test("options are passed through with defaults filled", () => {
    const input: ExportInput = {
      blocks: [],
      resolver,
      options: {
        fileName: "custom.docx",
        unknownBlockPolicy: "error",
        fontConfig: { default: { ascii: "Arial" } },
      },
    }
    const result = validateExportInput(input)
    expect(result.fileName).toBe("custom.docx")
    expect(result.unknownBlockPolicy).toBe("error")
    expect(result.fontConfig).toEqual({ default: { ascii: "Arial" } })
  })

  test("throws ExportError with INVALID_INPUT when blocks is null", () => {
    const input = {
      blocks: null,
      resolver,
    } as unknown as ExportInput
    expect(() => validateExportInput(input)).toThrow(ExportError)
    try {
      validateExportInput(input)
    } catch (e) {
      expect((e as ExportError).code).toBe(EXPORT_ERROR_CODES.INVALID_INPUT)
    }
  })

  test("throws ExportError with INVALID_INPUT when blocks is not an array", () => {
    const input = {
      blocks: "not-an-array",
      resolver,
    } as unknown as ExportInput
    expect(() => validateExportInput(input)).toThrow(ExportError)
  })

  test("throws ExportError with INVALID_INPUT when resolver is missing", () => {
    const input = {
      blocks: [],
    } as unknown as ExportInput
    expect(() => validateExportInput(input)).toThrow(ExportError)
    try {
      validateExportInput(input)
    } catch (e) {
      expect((e as ExportError).code).toBe(EXPORT_ERROR_CODES.INVALID_INPUT)
    }
  })
})

describe("createNoopResolver", () => {
  test("rejects all URLs", async () => {
    const resolver = createNoopResolver()
    await expect(resolver.resolve("https://example.com/img.png")).rejects.toThrow(
      "Noop resolver cannot resolve resource"
    )
  })

  test("rejection message includes the URL", async () => {
    const resolver = createNoopResolver()
    await expect(resolver.resolve("https://cdn.test/a.jpg")).rejects.toThrow(
      "https://cdn.test/a.jpg"
    )
  })
})

describe("type exports", () => {
  test("all expected symbols are exported", async () => {
    const mod = await import("../src/index")
    expect(mod.validateExportInput).toBeFunction()
    expect(mod.createNoopResolver).toBeFunction()
    expect(mod.ExportError).toBeFunction()
    expect(mod.EXPORT_ERROR_CODES).toBeDefined()
    expect(mod.DEFAULT_UNKNOWN_BLOCK_POLICY).toBe("preserve")
  })
})
