export const EXPORT_ERROR_CODES = {
  INVALID_INPUT: "INVALID_INPUT",
  RESOURCE_FAILED: "RESOURCE_FAILED",
  FONT_MISSING: "FONT_MISSING",
  UNKNOWN_BLOCK: "UNKNOWN_BLOCK",
  RENDER_FAILED: "RENDER_FAILED",
} as const

export type ExportErrorCode =
  (typeof EXPORT_ERROR_CODES)[keyof typeof EXPORT_ERROR_CODES]

export interface ExportWarning {
  code: string
  message: string
  blockId?: string
}

export class ExportError extends Error {
  readonly code: string
  readonly blockId?: string

  constructor(code: string, message: string, blockId?: string) {
    super(message)
    this.name = "ExportError"
    this.code = code
    this.blockId = blockId
  }
}
