/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react"
import { Document, Page, View, StyleSheet, pdf } from "@react-pdf/renderer"
import type {
  ExportResult,
  ExportWarning,
  FontConfig,
  FormatExporter,
  ValidatedExportInput,
} from "@tap-note/export-core"
import { renderBlocks } from "./mappings/blocks"
import { registerFonts, getFontFamily } from "./font-register"
import type { FontBufferInput } from "./font-register"

const PDF_MIME_TYPE = "application/pdf"
const DEFAULT_FILE_NAME = "document.pdf"

const pageStyles = StyleSheet.create({
  page: {
    padding: 35,
    fontSize: 12,
    lineHeight: 1.5,
  },
})

export interface PdfExporterOptions {
  fontConfig?: FontConfig
  fontBuffers?: Record<string, FontBufferInput>
}

export class TapNotePdfExporter implements FormatExporter {
  readonly format = "pdf"

  private readonly _fontConfig: FontConfig | undefined
  private readonly _fontBuffers: Record<string, FontBufferInput> | undefined
  private _fontsRegistered = false
  private _fontWarnings: ExportWarning[] = []
  private _registeredFamilies: Set<string> = new Set()
  private _renderWarnings: ExportWarning[] = []

  constructor(options?: PdfExporterOptions) {
    this._fontConfig = options?.fontConfig
    this._fontBuffers = options?.fontBuffers
  }

  private ensureFontsRegistered(): void {
    if (this._fontsRegistered) return
    const result = registerFonts(this._fontConfig, this._fontBuffers)
    this._fontWarnings = result.warnings.map((w) => ({
      code: w.code,
      message: w.message,
    }))
    this._registeredFamilies = result.registeredFamilies
    this._fontsRegistered = true
  }

  private async buildDocument(input: ValidatedExportInput): Promise<React.ReactElement<any>> {
    this.ensureFontsRegistered()

    const warnings: ExportWarning[] = []
    const fontFamily = getFontFamily(input.fontConfig ?? this._fontConfig, this._registeredFamilies)

    const blocks = await renderBlocks(
      [...input.blocks] as any[],
      {
        resolver: input.resolver,
        warnings,
        unknownBlockPolicy: input.unknownBlockPolicy,
      },
      0
    )

    this._renderWarnings = warnings

    const dynamicPageStyle = {
      ...pageStyles.page,
      fontFamily,
    }

    return React.createElement(
      Document,
      null,
      React.createElement(
        Page,
        { size: "A4", style: dynamicPageStyle },
        React.createElement(View, { key: "content" }, ...blocks)
      )
    )
  }

  private collectWarnings(): ExportWarning[] {
    return [...this._fontWarnings, ...this._renderWarnings]
  }

  async toBlob(input: ValidatedExportInput): Promise<ExportResult<Blob>> {
    const doc = await this.buildDocument(input)
    const instance = pdf(doc)
    const blob = await instance.toBlob()
    return {
      content: blob,
      fileName: input.fileName ?? DEFAULT_FILE_NAME,
      mimeType: PDF_MIME_TYPE,
      warnings: this.collectWarnings(),
    }
  }

  async toUint8Array(input: ValidatedExportInput): Promise<ExportResult<Uint8Array>> {
    const doc = await this.buildDocument(input)
    const instance = pdf(doc)
    const blob = await instance.toBlob()
    const arrayBuffer = await blob.arrayBuffer()
    return {
      content: new Uint8Array(arrayBuffer),
      fileName: input.fileName ?? DEFAULT_FILE_NAME,
      mimeType: PDF_MIME_TYPE,
      warnings: this.collectWarnings(),
    }
  }

  async export(input: ValidatedExportInput): Promise<ExportResult> {
    if (typeof Blob !== "undefined" && typeof window !== "undefined") {
      return this.toBlob(input)
    }
    return this.toUint8Array(input)
  }
}

export function createPdfExporter(options?: PdfExporterOptions) {
  return new TapNotePdfExporter(options)
}
