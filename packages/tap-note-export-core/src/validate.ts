import { ExportError, EXPORT_ERROR_CODES } from "./types/error"
import type { ExportInput, ValidatedExportInput } from "./types/input"
import { DEFAULT_UNKNOWN_BLOCK_POLICY } from "./types/policy"

export function validateExportInput(input: ExportInput): ValidatedExportInput {
  if (!input.blocks) {
    throw new ExportError(
      EXPORT_ERROR_CODES.INVALID_INPUT,
      "ExportInput.blocks is required and must not be null or undefined"
    )
  }

  if (!Array.isArray(input.blocks)) {
    throw new ExportError(
      EXPORT_ERROR_CODES.INVALID_INPUT,
      "ExportInput.blocks must be an array"
    )
  }

  if (!input.resolver) {
    throw new ExportError(
      EXPORT_ERROR_CODES.INVALID_INPUT,
      "ExportInput.resolver is required"
    )
  }

  return {
    blocks: input.blocks,
    resolver: input.resolver,
    fileName: input.options?.fileName,
    unknownBlockPolicy:
      input.options?.unknownBlockPolicy ?? DEFAULT_UNKNOWN_BLOCK_POLICY,
    fontConfig: input.options?.fontConfig,
  }
}
