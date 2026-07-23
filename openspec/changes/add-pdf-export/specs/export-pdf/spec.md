## ADDED Requirements

### Requirement: PDF exporter produces valid PDF files
The system SHALL provide a `TapNotePdfExporter` class implementing the `FormatExporter` interface from `@tap-note/export-core` with `format === "pdf"` that converts `PartialBlock[]` documents into valid PDF files using `@react-pdf/renderer`.

#### Scenario: Browser output as Blob
- **WHEN** `exporter.toBlob(input)` is called in a browser environment
- **THEN** system SHALL return an `ExportResult<Blob>` with MIME type `application/pdf`

#### Scenario: Node.js output as Uint8Array
- **WHEN** `exporter.toUint8Array(input)` is called in a Node.js environment
- **THEN** system SHALL return an `ExportResult<Uint8Array>` containing valid PDF binary content

#### Scenario: Output file is openable by PDF readers
- **WHEN** the exported PDF binary is saved as a `.pdf` file
- **THEN** standard PDF readers (Preview, Adobe Acrobat, Chrome) SHALL open it without errors

### Requirement: Block mapping covers all default schema block types
The system SHALL map the following BlockNote default schema block types to React PDF components: paragraph, heading (levels 1-6), bulletListItem, numberedListItem, checkListItem, toggleListItem, quote, codeBlock, divider, image, table, audio, video, file, pageBreak.

#### Scenario: Paragraph with styled text
- **WHEN** document contains a paragraph block with bold, italic, and underline styled text
- **THEN** exported PDF SHALL render a `<Text>` element with corresponding font-weight, font-style, and text-decoration

#### Scenario: Heading levels
- **WHEN** document contains heading blocks with levels 1 through 6
- **THEN** exported PDF SHALL render `<Text>` elements with decreasing font sizes (24/20/16/14/12/11 pt)

#### Scenario: Bullet list with nesting
- **WHEN** document contains nested bulletListItem blocks (2+ levels)
- **THEN** exported PDF SHALL render indented `<View>` elements with bullet prefixes (•/◦/▪) AND child blocks SHALL be recursively rendered as nested sub-views with increased indentation

#### Scenario: Block with children recursion
- **WHEN** document contains a block with `children` array (e.g., toggleListItem containing paragraph children)
- **THEN** exporter SHALL recursively render all children blocks and embed them as nested elements within the parent block's component

#### Scenario: Numbered list with correct indices
- **WHEN** document contains numberedListItem blocks
- **THEN** exported PDF SHALL render sequential number prefixes (1. 2. 3.)

#### Scenario: Check list item
- **WHEN** document contains a checkListItem block with `checked: true`
- **THEN** exported PDF SHALL render a checked checkbox symbol (☑) prefix; `checked: false` SHALL render unchecked (☐)

#### Scenario: Code block
- **WHEN** document contains a codeBlock with content
- **THEN** exported PDF SHALL render a monospace-font `<View>` with background shading preserving whitespace and line breaks

#### Scenario: Divider
- **WHEN** document contains a divider block
- **THEN** exported PDF SHALL render a horizontal line (`<View>` with bottom border)

#### Scenario: Image block
- **WHEN** document contains an image block with a URL
- **THEN** exporter SHALL resolve the image via `ResourceResolver`, convert to data URI, and render an `<Image>` component with correct aspect ratio

#### Scenario: Table block
- **WHEN** document contains a table block with rows and cells
- **THEN** exported PDF SHALL render a flex-based table layout with `<View>` rows and cells preserving cell content; colspan SHALL be approximated via merged cell width percentage; rowspan MAY be approximated or flattened

#### Scenario: Audio/Video/File blocks
- **WHEN** document contains audio, video, or file blocks
- **THEN** exported PDF SHALL render a `<Link>` to the resource URL with a descriptive label

#### Scenario: PageBreak block
- **WHEN** document contains a pageBreak block
- **THEN** exported PDF SHALL insert a forced page break (`<View break />`)

### Requirement: Inline content mapping handles text and links
The system SHALL map `text` inline content to `<Text>` with merged style properties, and `link` inline content to `<Link>` wrapping styled text.

#### Scenario: Styled text
- **WHEN** inline content is `{ type: "text", text: "hello", styles: { bold: true, textColor: "#ff0000" } }`
- **THEN** exported PDF SHALL render `<Text style={{ fontWeight: "bold", color: "#ff0000" }}>hello</Text>`

#### Scenario: Link with styled text
- **WHEN** inline content is `{ type: "link", href: "https://example.com", content: [{ type: "text", text: "click", styles: { italic: true } }] }`
- **THEN** exported PDF SHALL render `<Link src="https://example.com"><Text style={{ fontStyle: "italic" }}>click</Text></Link>`

### Requirement: Style mapping covers all default style types
The system SHALL map the following style types to React PDF style properties: bold, italic, underline, strike, textColor, backgroundColor, code.

#### Scenario: Combined styles
- **WHEN** text has `{ bold: true, italic: true, strike: true }`
- **THEN** exported PDF text SHALL have `fontWeight: "bold"`, `fontStyle: "italic"`, `textDecoration: "line-through"`

#### Scenario: Background color
- **WHEN** text has `styles: { backgroundColor: "#ffff00" }`
- **THEN** exported PDF text SHALL have `backgroundColor: "#ffff00"`

### Requirement: CJK font registration via FontConfig
The system SHALL register custom fonts via `@react-pdf/renderer`'s `Font.register()` when `FontConfig` provides font buffers. Without registered CJK fonts, CJK characters SHALL produce a `FONT_MISSING` warning.

#### Scenario: CJK font registered
- **WHEN** `FontConfig` includes `eastAsia` font name AND caller provides font buffer via `pdfFontBuffers`
- **THEN** exporter SHALL call `Font.register({ family, src })` before rendering AND CJK text SHALL render correctly

#### Scenario: CJK font missing
- **WHEN** document contains CJK characters AND no eastAsia font buffer is provided
- **THEN** exporter SHALL emit `ExportWarning` with code `FONT_MISSING` AND rendering SHALL continue with fallback font

### Requirement: Unknown blocks handled per policy
The system SHALL apply the `UnknownBlockPolicy` from `ExportInput.options` when encountering block types not in the mapping.

#### Scenario: Custom block with preserve policy
- **WHEN** document contains a custom block `{ type: "myWidget", content: [{ type: "text", text: "widget text" }] }` and policy is `"preserve"`
- **THEN** exported PDF SHALL render the text content as a plain paragraph AND `ExportResult.warnings` SHALL include a warning with code `UNKNOWN_BLOCK`

### Requirement: Resource resolution for binary assets
The system SHALL use the injected `ResourceResolver` for all image block resources, converting resolved buffers to data URIs.

#### Scenario: Image resolution failure
- **WHEN** image block URL resolution fails (resolver throws)
- **THEN** exporter SHALL emit `ExportWarning` with code `RESOURCE_FAILED` and skip the image

#### Scenario: Image converted to data URI
- **WHEN** image block URL resolution succeeds with `{ buffer, mimeType: "image/png" }`
- **THEN** exporter SHALL convert to `data:image/png;base64,...` and pass to `<Image src={...} />`
