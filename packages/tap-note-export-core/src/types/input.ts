import type { PartialBlock } from "@blocknote/core"
import type { FontConfig } from "./font"
import type { UnknownBlockPolicy } from "./policy"
import type { ResourceResolver } from "./resource"

export interface ExportOptions {
  fileName?: string
  unknownBlockPolicy?: UnknownBlockPolicy
  fontConfig?: FontConfig
}

export interface ExportInput {
  blocks: PartialBlock[]
  resolver: ResourceResolver
  options?: ExportOptions
}

export interface ValidatedExportInput {
  readonly blocks: readonly PartialBlock[]
  readonly resolver: ResourceResolver
  readonly fileName: string | undefined
  readonly unknownBlockPolicy: UnknownBlockPolicy
  readonly fontConfig: FontConfig | undefined
}
