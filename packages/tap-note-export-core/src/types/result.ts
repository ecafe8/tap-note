import type { ExportWarning } from "./error"

export interface ExportResult<T = Blob | Uint8Array> {
  content: T
  fileName: string
  mimeType: string
  warnings: ExportWarning[]
}
