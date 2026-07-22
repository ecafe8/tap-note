## ADDED Requirements

### Requirement: ExportInput accepts document snapshot and options
The system SHALL accept an `ExportInput` object containing a `PartialBlock[]` document snapshot, a `ResourceResolver`, an optional BlockNote schema reference, export options (fileName, unknownBlockPolicy, fontConfig, format-specific options), and a `FontConfig`. The `ResourceResolver` SHALL be a required field of `ExportInput`.

#### Scenario: Valid input with full document
- **WHEN** caller provides `ExportInput` with a non-empty `PartialBlock[]` array, a valid `ResourceResolver`, and default options
- **THEN** system SHALL produce a `ValidatedExportInput` ready for format exporters

#### Scenario: Empty document
- **WHEN** caller provides `ExportInput` with an empty `PartialBlock[]` array
- **THEN** system SHALL produce a `ValidatedExportInput` with zero blocks and the format exporter SHALL output a valid but empty document

#### Scenario: Missing required fields
- **WHEN** caller provides `ExportInput` without `blocks` or with `null` blocks
- **THEN** system SHALL throw an `ExportError` with code `INVALID_INPUT`

### Requirement: ExportResult provides content and metadata
The system SHALL return an `ExportResult<T>` containing `content` (Blob or Uint8Array), `fileName` (string), `mimeType` (string), and `warnings` (ExportWarning[]).

#### Scenario: Successful export with no warnings
- **WHEN** format exporter completes without issues
- **THEN** `ExportResult.warnings` SHALL be an empty array

#### Scenario: Successful export with warnings
- **WHEN** format exporter encounters non-fatal issues (e.g., unknown block with preserve policy, missing font)
- **THEN** `ExportResult.warnings` SHALL contain one `ExportWarning` per issue with `code`, `message`, and optional `blockId`

#### Scenario: Default fileName
- **WHEN** caller does not specify `options.fileName`
- **THEN** `ExportResult.fileName` SHALL use the format-specific default (e.g., `document.docx`)

### Requirement: ResourceResolver provides restricted resource access
The system SHALL define a `ResourceResolver` interface with a single `resolve(url: string): Promise<ResolvedResource>` method. Format exporters SHALL use this interface for all binary resource access (images, audio, video, files). Exporters SHALL NOT directly call `fetch` or access URLs.

#### Scenario: Successful resource resolution
- **WHEN** format exporter encounters a block with a URL (e.g., image src)
- **THEN** exporter SHALL call `resolver.resolve(url)` and use the returned `{ buffer, mimeType }` for rendering

#### Scenario: Resource resolution failure
- **WHEN** `resolver.resolve(url)` throws or rejects
- **THEN** exporter SHALL catch the error, emit an `ExportWarning` with code `RESOURCE_FAILED`, and skip the resource (render placeholder or omit based on block type)

#### Scenario: Noop resolver
- **WHEN** caller provides `createNoopResolver()` as the resolver
- **THEN** all resource resolutions SHALL reject, producing warnings for each resource block

### Requirement: FontConfig provides format-agnostic font configuration
The system SHALL define a `FontConfig` interface with optional `default` (FontFamily) and `overrides` (Record<string, FontFamily>) fields. `FontFamily` SHALL contain optional `ascii`, `hAnsi`, `eastAsia`, `cs` (string, where `cs` corresponds to OOXML complexScript) and `size` (number, in points) fields. Format exporters SHALL convert `size` from points to their format-specific unit internally (e.g., DOCX: ×2 to half-points).

#### Scenario: CJK font configuration
- **WHEN** caller provides `FontConfig` with `default.eastAsia: "SimSun"`
- **THEN** format exporter SHALL apply `eastAsia` font name to CJK text runs (DOCX: `w:rFonts/@w:eastAsia`)

#### Scenario: No font configuration
- **WHEN** caller provides `FontConfig` as `undefined` or empty
- **THEN** format exporter SHALL use its built-in default font (DOCX: Calibri)

### Requirement: UnknownBlockPolicy controls handling of unrecognized blocks
The system SHALL support three `UnknownBlockPolicy` values: `"preserve"`, `"omit-with-warning"`, `"error"`. The default SHALL be `"preserve"`.

#### Scenario: Preserve unknown block
- **WHEN** exporter encounters a block type not in its mapping AND policy is `"preserve"`
- **THEN** exporter SHALL render the block's text content as a plain paragraph AND emit an `ExportWarning` with code `UNKNOWN_BLOCK`

#### Scenario: Omit unknown block with warning
- **WHEN** exporter encounters a block type not in its mapping AND policy is `"omit-with-warning"`
- **THEN** exporter SHALL skip the block AND emit an `ExportWarning` with code `UNKNOWN_BLOCK`

#### Scenario: Error on unknown block
- **WHEN** exporter encounters a block type not in its mapping AND policy is `"error"`
- **THEN** exporter SHALL throw an `ExportError` with code `UNKNOWN_BLOCK` and the block ID

### Requirement: ExportWarning and ExportError provide structured diagnostics
The system SHALL define `ExportWarning` with fields `code` (string), `message` (string), and optional `blockId` (string). The system SHALL define `ExportError` extending `Error` with fields `code` (string) and optional `blockId` (string). Error codes SHALL include: `INVALID_INPUT`, `RESOURCE_FAILED`, `FONT_MISSING`, `UNKNOWN_BLOCK`, `RENDER_FAILED`.

#### Scenario: Warning does not halt export
- **WHEN** an `ExportWarning` is emitted during export
- **THEN** export SHALL continue and the warning SHALL appear in `ExportResult.warnings`

#### Scenario: Error halts export
- **WHEN** an `ExportError` is thrown during export
- **THEN** export SHALL abort and the error SHALL propagate to the caller

### Requirement: FormatExporter interface enables pluggable format implementations
The system SHALL define a `FormatExporter` interface with a `format` (string) readonly property and an `export(input: ValidatedExportInput): Promise<ExportResult>` method. All format packages (DOCX, PDF, Markdown, HTML) SHALL implement this interface.

#### Scenario: DOCX exporter implements FormatExporter
- **WHEN** `@tap-note/export-docx` is imported
- **THEN** it SHALL export a class or factory that satisfies the `FormatExporter` interface with `format === "docx"`

#### Scenario: Future PDF exporter can implement same interface
- **WHEN** a new `@tap-note/export-pdf` package is created
- **THEN** it SHALL be able to implement `FormatExporter` with `format === "pdf"` without modifying `@tap-note/export-core`
