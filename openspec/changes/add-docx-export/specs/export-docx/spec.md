## ADDED Requirements

### Requirement: DOCX exporter produces valid .docx files
The system SHALL provide a `TapNoteDocxExporter` class extending `@blocknote/core`'s `Exporter` base class that converts `PartialBlock[]` documents into valid OOXML/DOCX files using the `docx` npm library.

#### Scenario: Browser output as Blob
- **WHEN** `exporter.toBlob(input)` is called in a browser environment
- **THEN** system SHALL return a `Blob` with MIME type `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

#### Scenario: Node.js output as Uint8Array
- **WHEN** `exporter.toUint8Array(input)` is called in a Node.js environment
- **THEN** system SHALL return a `Uint8Array` containing valid DOCX binary content

#### Scenario: Output file is openable by Microsoft Word
- **WHEN** the exported DOCX binary is saved as a `.docx` file
- **THEN** Microsoft Word (or compatible reader) SHALL open it without repair prompts

### Requirement: Block mapping covers all default schema block types
The system SHALL map the following BlockNote default schema block types to DOCX equivalents: paragraph, heading (levels 1-6), bulletListItem, numberedListItem, checkListItem, toggleListItem, quote, codeBlock, divider, image, table, audio, video, file, pageBreak.

#### Scenario: Paragraph with styled text
- **WHEN** document contains a paragraph block with bold, italic, and underline styled text
- **THEN** exported DOCX SHALL contain a paragraph with corresponding `w:b`, `w:i`, `w:u` run properties

#### Scenario: Heading levels
- **WHEN** document contains heading blocks with levels 1 through 6
- **THEN** exported DOCX SHALL contain paragraphs with `Heading1` through `Heading6` styles

#### Scenario: Bullet list with nesting
- **WHEN** document contains nested bulletListItem blocks (2+ levels)
- **THEN** exported DOCX SHALL contain paragraphs with increasing indentation levels using numbering definitions

#### Scenario: Numbered list with correct indices
- **WHEN** document contains numberedListItem blocks
- **THEN** exported DOCX SHALL contain paragraphs with decimal numbering and correct sequential indices

#### Scenario: Check list item
- **WHEN** document contains a checkListItem block with `checked: true`
- **THEN** exported DOCX SHALL render a checked checkbox symbol (☑) prefix; `checked: false` SHALL render unchecked (☐)

#### Scenario: Code block
- **WHEN** document contains a codeBlock with content and optional language
- **THEN** exported DOCX SHALL contain a monospace-font paragraph preserving whitespace and line breaks

#### Scenario: Divider
- **WHEN** document contains a divider block
- **THEN** exported DOCX SHALL contain a horizontal rule (bottom border on an empty paragraph)

#### Scenario: Image block
- **WHEN** document contains an image block with a URL
- **THEN** exporter SHALL resolve the image via `ResourceResolver`, detect dimensions, and insert an `ImageRun` with correct aspect ratio

#### Scenario: Table block
- **WHEN** document contains a table block with rows and cells
- **THEN** exported DOCX SHALL contain a `Table` with `TableRow`/`TableCell` structure preserving cell content and inline styles

#### Scenario: Audio/Video/File blocks
- **WHEN** document contains audio, video, or file blocks
- **THEN** exported DOCX SHALL render a hyperlink to the resource URL with a descriptive label (file name or URL)

### Requirement: Inline content mapping handles text and links
The system SHALL map `text` inline content to `TextRun` with merged style properties, and `link` inline content to `ExternalHyperlink` wrapping styled text runs.

#### Scenario: Styled text run
- **WHEN** inline content is `{ type: "text", text: "hello", styles: { bold: true, textColor: "#ff0000" } }`
- **THEN** exported DOCX SHALL contain a `TextRun` with `bold: true` and `color: "FF0000"`

#### Scenario: Link with styled text
- **WHEN** inline content is `{ type: "link", href: "https://example.com", content: [{ type: "text", text: "click", styles: { italic: true } }] }`
- **THEN** exported DOCX SHALL contain an `ExternalHyperlink` to `https://example.com` wrapping an italic `TextRun`

#### Scenario: Text with code style
- **WHEN** inline content has `styles: { code: true }`
- **THEN** exported DOCX SHALL render the run with monospace font (Consolas) and light gray shading

### Requirement: Style mapping covers all default style types
The system SHALL map the following style types to DOCX run properties: bold, italic, underline, strike, textColor, backgroundColor, code.

#### Scenario: Combined styles
- **WHEN** text has `{ bold: true, italic: true, strike: true }`
- **THEN** exported DOCX run SHALL have `bold: true`, `italics: true`, `strike: true`

#### Scenario: Background color
- **WHEN** text has `styles: { backgroundColor: "#ffff00" }`
- **THEN** exported DOCX run SHALL have `shading: { fill: "FFFF00", type: "clear" }`

### Requirement: Font configuration writes four font name groups
The system SHALL apply `FontConfig` to the DOCX document's default style and per-run overrides, writing `ascii`, `hAnsi`, `eastAsia`, and `cs` font names.

#### Scenario: Default font with CJK
- **WHEN** `FontConfig.default` is `{ ascii: "Calibri", eastAsia: "SimSun", size: 12 }`
- **THEN** exported DOCX `styles.xml` default run properties SHALL contain `w:rFonts` with `w:ascii="Calibri"`, `w:eastAsia="SimSun"` and `w:sz` of 24 half-points (12pt × 2)

#### Scenario: Per-block font override
- **WHEN** `FontConfig.overrides["codeBlock"]` is `{ ascii: "Consolas", hAnsi: "Consolas" }`
- **THEN** code block paragraphs SHALL use Consolas font regardless of default

### Requirement: Numbering configuration supports multi-level lists
The system SHALL generate DOCX numbering definitions supporting at least 9 indentation levels for bullet and numbered lists.

#### Scenario: Nested bullet list 3 levels deep
- **WHEN** document contains bulletListItem blocks nested 3 levels
- **THEN** exported DOCX SHALL use numbering definition with level 0 (bullet •), level 1 (bullet ◦), level 2 (bullet ▪)

#### Scenario: Mixed list types at same level
- **WHEN** document contains a bulletListItem followed by a numberedListItem at the same nesting level
- **THEN** exported DOCX SHALL use separate numbering definitions for bullet and numbered lists

### Requirement: Unknown blocks handled per policy
The system SHALL apply the `UnknownBlockPolicy` from `ExportInput.options` when encountering block types not in the mapping.

#### Scenario: Custom block with preserve policy
- **WHEN** document contains a custom block `{ type: "myWidget", content: [{ type: "text", text: "widget text" }] }` and policy is `"preserve"`
- **THEN** exported DOCX SHALL contain a paragraph with "widget text" AND `ExportResult.warnings` SHALL include a warning with code `UNKNOWN_BLOCK`

### Requirement: Resource resolution for binary assets
The system SHALL use the injected `ResourceResolver` for all image, audio, video, and file block resources.

#### Scenario: Image resolution failure
- **WHEN** image block URL resolution fails (resolver throws)
- **THEN** exporter SHALL emit `ExportWarning` with code `RESOURCE_FAILED` and skip the image (no placeholder image inserted)

#### Scenario: Image with unknown dimensions
- **WHEN** resolved image buffer cannot be parsed for dimensions
- **THEN** exporter SHALL use default dimensions (width: 500px equivalent) and emit a warning
