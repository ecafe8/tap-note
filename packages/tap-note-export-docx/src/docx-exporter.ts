/* eslint-disable @typescript-eslint/no-explicit-any */
import { Document, Packer, TextRun } from "docx"
import type { ParagraphChild } from "docx"
import {
  BlockNoteSchema,
  Exporter,
  COLORS_DEFAULT,
} from "@blocknote/core"
import type { PartialBlock, StyledText } from "@blocknote/core"
import type {
  ExportResult,
  ExportWarning,
  FontConfig,
  FormatExporter,
  ValidatedExportInput,
} from "@tap-note/export-core"
import { docxStyleMapping } from "./mappings/styles"
import { createInlineContentMapping } from "./mappings/inline-content"
import { createBlockMapping, createUnknownBlockHandler } from "./mappings/blocks"
import { createNumberingConfig } from "./numbering"
import { buildDefaultStyles } from "./font"

const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
const DEFAULT_FILE_NAME = "document.docx"

export interface DocxExporterOptions {
  fontConfig?: FontConfig
}

export class TapNoteDocxExporter
  extends Exporter<any, any, any, any, ParagraphChild, any, TextRun>
  implements FormatExporter
{
  readonly format = "docx"

  private readonly _warnings: ExportWarning[] = []
  private readonly _fontConfig: FontConfig | undefined
  private readonly _unknownBlockHandler: ReturnType<
    typeof createUnknownBlockHandler
  >
  private _currentResolver: ValidatedExportInput["resolver"] | undefined

  constructor(options?: DocxExporterOptions) {
    const schema = BlockNoteSchema.create()
    const warnings: ExportWarning[] = []

    super(
      schema,
      {
        blockMapping: createBlockMapping(warnings) as any,
        inlineContentMapping: createInlineContentMapping() as any,
        styleMapping: docxStyleMapping as any,
      },
      {
        colors: COLORS_DEFAULT,
        resolveFileUrl: async (url: string) => {
          if (!this._currentResolver) {
            throw new Error("No resolver available")
          }
          const resolved = await this._currentResolver.resolve(url)
          return new Blob([resolved.buffer as unknown as BlobPart], { type: resolved.mimeType })
        },
      }
    )

    this._warnings = warnings
    this._fontConfig = options?.fontConfig
    this._unknownBlockHandler = createUnknownBlockHandler("preserve", warnings)
  }

  transformStyledText(styledText: StyledText<any>): TextRun {
    const styleResults = this.mapStyles(styledText.styles)
    const merged: Record<string, unknown> = {}
    for (const result of styleResults) {
      Object.assign(merged, result)
    }

    const fontOverride = this._fontConfig?.default
    if (fontOverride) {
      const font: Record<string, string> = {}
      if (fontOverride.ascii) font.ascii = fontOverride.ascii
      if (fontOverride.hAnsi) font.hAnsi = fontOverride.hAnsi
      if (fontOverride.eastAsia) font.eastAsia = fontOverride.eastAsia
      if (fontOverride.cs) font.cs = fontOverride.cs
      if (Object.keys(font).length > 0) {
        merged.font = font
      }
      if (fontOverride.size != null) {
        merged.size = fontOverride.size * 2
      }
    }

    return new TextRun({
      text: styledText.text,
      ...merged,
    } as any)
  }

  async transformBlocks(
    blocks: readonly PartialBlock[],
    nestingLevel = 0
  ): Promise<any[]> {
    const result: any[] = []

    for (const block of blocks) {
      const blockAny = block as any
      const mapping = (this.mappings.blockMapping as any)[blockAny.type]

      let mapped: any
      if (mapping) {
        const children = blockAny.children?.length
          ? await this.transformBlocks(blockAny.children, nestingLevel + 1)
          : undefined
        mapped = await mapping(blockAny, this, nestingLevel, 0, children)
      } else {
        mapped = this._unknownBlockHandler(blockAny, this)
      }

      result.push(mapped)

      if (blockAny.children?.length && mapping) {
        const childResults = await this.transformBlocks(
          blockAny.children,
          nestingLevel + 1
        )
        result.push(...childResults)
      }
    }

    return result
  }

  async toDocxJsDocument(input: ValidatedExportInput): Promise<Document> {
    this._currentResolver = input.resolver
    const children = await this.transformBlocks(input.blocks)
    const styles = buildDefaultStyles(input.fontConfig ?? this._fontConfig)

    return new Document({
      numbering: createNumberingConfig(),
      ...(styles ? { styles } : {}),
      sections: [
        {
          children,
        },
      ],
    })
  }

  async toBlob(input: ValidatedExportInput): Promise<ExportResult<Blob>> {
    const doc = await this.toDocxJsDocument(input)
    const blob = await Packer.toBlob(doc)
    return {
      content: blob,
      fileName: input.fileName ?? DEFAULT_FILE_NAME,
      mimeType: DOCX_MIME_TYPE,
      warnings: [...this._warnings],
    }
  }

  async toUint8Array(
    input: ValidatedExportInput
  ): Promise<ExportResult<Uint8Array>> {
    const doc = await this.toDocxJsDocument(input)
    const buffer = await Packer.toBuffer(doc)
    return {
      content: new Uint8Array(buffer),
      fileName: input.fileName ?? DEFAULT_FILE_NAME,
      mimeType: DOCX_MIME_TYPE,
      warnings: [...this._warnings],
    }
  }

  async export(input: ValidatedExportInput): Promise<ExportResult> {
    if (typeof Blob !== "undefined" && typeof window !== "undefined") {
      return this.toBlob(input)
    }
    return this.toUint8Array(input)
  }

  get warnings(): readonly ExportWarning[] {
    return this._warnings
  }
}

export function createDocxExporter(options?: DocxExporterOptions) {
  return new TapNoteDocxExporter(options)
}
