## Why

PRD SUB-005 要求 tap-note 提供授权干净、可独立集成的文档导出能力。BlockNote `xl-docx-exporter` 为 GPL-3.0/商业授权，不可作为依赖；需要基于 `@blocknote/core`（MPL-2.0）的 `Exporter` 抽象基类自行实现 DOCX 导出。本 change 实现 FEAT-008（导出核心契约）+ FEAT-010（DOCX 导出），并为后续 FEAT-009（PDF 导出）预留格式无关的扩展点。

## What Changes

- 新增 `@tap-note/export-core` workspace 包（`packages/tap-note-export-core`）：定义格式无关的导出契约，包括 `ExportInput`（快照 + schema + options）、`ExportResult`（Blob/Uint8Array + 文件名 + MIME + warnings）、`ResourceResolver`（受限资源获取接口）、`FontConfig`（字体族/权重/样式配置，含 CJK eastAsia 字段）、`UnknownBlockPolicy`（preserve/omit-with-warning/error）、`ExportWarning`/`ExportError` 错误体系。设计为格式无关，后续 PDF exporter 直接消费同一契约。
- 新增 `@tap-note/export-docx` workspace 包（`packages/tap-note-export-docx`）：继承 `@blocknote/core` 的 `Exporter` 抽象类，使用 `docx` npm 库（MIT）生成 OOXML/DOCX。实现 block 映射（paragraph/heading/bulletListItem/numberedListItem/checkListItem/quote/codeBlock/divider/image/table/audio/video/file）、inline content 映射（text/link）、style 映射（bold/italic/underline/strike/textColor/backgroundColor/code）。浏览器输出 Blob，Node.js 输出 Uint8Array。
- `apps/web` demo 新增导出按钮，调用 `@tap-note/export-docx` 导出当前编辑器文档为 .docx 文件下载。
- **不修改** `packages/tap-note-editor`、`packages/tap-note-ai-core`、`packages/tap-note-ai-inline`、`packages/tap-note-ai-chat`、`apps/server-api` 的运行时代码。
- **不引入** `@blocknote/xl-docx-exporter`（GPL）、任何 GPL/AGPL 依赖。
- **不实现**：PDF 导出（FEAT-009，后续独立 change）、Markdown/HTML 导出（FEAT-012，P2）、字体下载/子集化（SUB-001 职责）、导出管理页面/持久化。

## Capabilities

### New Capabilities

- `export-core`: 格式无关的文档导出共享契约层——输入校验（PartialBlock[] 快照）、输出封装（ExportResult）、资源解析（ResourceResolver 接口 + 安全策略）、字体配置（FontConfig）、未知 block 处理策略、warning/error 体系。为 DOCX/PDF/Markdown/HTML 等所有格式 exporter 提供统一入口。
- `export-docx`: 基于 `@blocknote/core` Exporter 基类 + `docx` npm 库的 DOCX 格式导出器——block/inline/style 三层映射、numbering 配置、OOXML 模板、字体名称写入（ascii/hAnsi/eastAsia/cs）、Blob/Uint8Array 双输出。

### Modified Capabilities

无。本 change 不修改 `editor`、`ai-core`、`ai-inline`、`ai-chat` 任何 capability 的 spec-level 行为。

## Impact

- **新增代码**：`packages/tap-note-export-core/{package.json,tsconfig.json,eslint.config.js,src/{index.ts,types/{input.ts,result.ts,resource.ts,font.ts,error.ts,policy.ts,exporter.ts},validate.ts}}`、`packages/tap-note-export-docx/{package.json,tsconfig.json,eslint.config.js,bunfig.toml,src/{index.ts,docx-exporter.ts,mappings/{blocks.ts,inline-content.ts,styles.ts},numbering.ts,font.ts,util/{table.ts,image.ts}}}`、`apps/web/src/components/export-button.tsx`。
- **新增依赖**：`@blocknote/core@0.51.4`（MPL-2.0，已有）、`docx@^9.6.1`（MIT，新增）、`zod`（已有）；`buffer@^6.0.3`（MIT）视研究闸门结论决定是否引入。两个新包均无 React peerDep（纯逻辑包）。
- **不修改**：`packages/tap-note-editor`、`packages/tap-note-ai-core`、`packages/tap-note-ai-inline`、`packages/tap-note-ai-chat`、`apps/server-api`。
- **不引入**：`@blocknote/xl-docx-exporter`（GPL）、`@blocknote/xl-pdf-exporter`（GPL）、任何 GPL/AGPL 依赖。
- **研究闸门**：需 Context7 确认 `docx` ^9.6.1 的 `Document`/`Packer`/`TextRun`/`Table`/`ImageRun` 精确 API 与浏览器/Node 双运行时兼容性；需阅读 `resource/BlockNote/packages/xl-docx-exporter` 参考映射边界与测试思路（仅参考，不复制）。
