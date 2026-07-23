## Why

PRD SUB-005 FEAT-009 要求 tap-note 提供自有 PDF 导出能力。`@tap-note/export-core`（FEAT-008）已交付格式无关的导出契约（`ExportInput`/`ExportResult`/`ResourceResolver`/`FontConfig`/`UnknownBlockPolicy`/`FormatExporter` 接口），`@tap-note/export-docx`（FEAT-010）已验证了格式包独立实现的模式。本 change 实现 FEAT-009，新增 `@tap-note/export-pdf` 包，消费 export-core 契约生成 PDF，export-core 零修改。

## What Changes

- 新增 `@tap-note/export-pdf` workspace 包（`packages/tap-note-export-pdf`）：实现 `FormatExporter` 接口（`format = "pdf"`），使用 `@react-pdf/renderer`（MIT）将 BlockNote 文档渲染为 PDF。实现 block 映射（paragraph/heading/bulletListItem/numberedListItem/checkListItem/toggleListItem/quote/codeBlock/divider/image/table/audio/video/file/pageBreak）、inline content 映射（text/link）、style 映射（bold/italic/underline/strike/textColor/backgroundColor/code）。浏览器输出 Blob，Node.js 输出 Uint8Array。
- CJK 字体支持：通过 `FontConfig` 注册字体文件（集成方提供 TTF/OTF buffer），解决中文 PDF 乱码问题。
- `apps/web` demo 导出按钮增加 PDF 格式选项。
- **不修改** `packages/tap-note-export-core`、`packages/tap-note-export-docx`、`packages/tap-note-editor`、`packages/tap-note-ai-core`、`apps/server-api` 的运行时代码。
- **不引入** `@blocknote/xl-pdf-exporter`（GPL）、任何 GPL/AGPL 依赖。
- **不实现**：字体下载/子集化（SUB-001 职责）、Markdown/HTML 导出（FEAT-012，P2）、导出管理页面/持久化。

## Capabilities

### New Capabilities

- `export-pdf`: 基于 `@react-pdf/renderer` 的 PDF 格式导出器——实现 `FormatExporter` 接口，block/inline/style 三层映射到 React PDF 组件（Document/Page/View/Text/Image/Link），CJK 字体注册，Blob/Uint8Array 双输出。

### Modified Capabilities

无。本 change 不修改 `export-core`、`export-docx`、`editor`、`ai-core`、`ai-chat` 任何 capability 的 spec-level 行为。`export-core` 的 `FormatExporter` 接口在 FEAT-008 已设计为格式无关，PDF exporter 直接实现。

## Impact

- **新增代码**：`packages/tap-note-export-pdf/{package.json,tsconfig.json,eslint.config.js,bunfig.toml,src/{index.ts,pdf-exporter.tsx,mappings/{blocks.tsx,inline-content.tsx,styles.ts},font-register.ts,util/{table.tsx,image.ts}}}`、`apps/web/src/components/export-button.tsx`（增加 PDF 选项）。
- **新增依赖**：`@react-pdf/renderer`（MIT，新增，license 待研究闸门 1.5 最终确认）、`@tap-note/export-core@workspace:*`（已有）、`@blocknote/core@0.51.4`（MPL-2.0，已有）。
- **不修改**：`packages/tap-note-export-core`、`packages/tap-note-export-docx`、`packages/tap-note-editor`、`packages/tap-note-ai-core`、`packages/tap-note-ai-inline`、`packages/tap-note-ai-chat`、`apps/server-api`。
- **不引入**：`@blocknote/xl-pdf-exporter`（GPL）、任何 GPL/AGPL 依赖。
- **研究闸门**：需 Context7 确认 `@react-pdf/renderer` 精确 API（`pdf()`/`renderToBuffer`/`renderToBlob`、`Font.register`、`Document`/`Page`/`View`/`Text`/`Image`/`Link` 组件）与浏览器/Node 双运行时兼容性；需阅读 `resource/BlockNote/packages/xl-pdf-exporter` 参考映射边界（仅参考，不复制）。
