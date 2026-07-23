import type { ExportResult } from "./result"
import type { ValidatedExportInput } from "./input"

export interface FormatExporter {
  readonly format: string
  export(input: ValidatedExportInput): Promise<ExportResult>
}
