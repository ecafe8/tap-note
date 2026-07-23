## 1. 研究闸门：`docx` 库 API + 参考实现阅读

- [x] 1.1 使用 Context7 查询 `docx` ^9.6.1 的 `Document`/`Packer`/`TextRun`/`Paragraph`/`Table`/`TableRow`/`TableCell`/`ImageRun`/`ExternalHyperlink` 精确 API，确认浏览器 `Packer.toBlob()` 与 Node.js `Packer.toBuffer()` 双运行时兼容性；确认 `docx` 库在浏览器环境是否需要 `buffer` polyfill（若不需要则不引入 `buffer@^6.0.3`）
- [x] 1.2 使用 Context7 查询 `docx` 库的 numbering 配置 API（`INumberingOptions`/`ILevelsOptions`），确认多级 bullet/numbered list 的缩进与符号定义方式
- [x] 1.3 使用 Context7 查询 `docx` 库的 `ISectionOptions`/`IDocumentOptions`/`styles` 配置，确认默认字体（`w:rFonts` ascii/hAnsi/eastAsia/cs）与 `w:sz` 的设置方式
- [x] 1.4 阅读 `resource/BlockNote/packages/xl-docx-exporter/src/docx/docxExporter.ts`，理解 `transformBlocks()` 递归遍历、nesting level 处理、numbered list index 传递模式；记录重写要点（不复制代码）
- [x] 1.5 阅读 `resource/BlockNote/packages/xl-docx-exporter/src/docx/defaultSchema/blocks.ts`，理解各 block 类型到 docx 对象的映射边界（paragraph/heading/list/quote/code/divider/image/table/audio/video/file/pageBreak）；记录 table 转换的 util 逻辑
- [x] 1.6 阅读 `resource/BlockNote/packages/core/src/exporter/Exporter.ts`，确认 `Exporter` 基类的泛型参数、`transformStyledText()` 抽象方法签名、`resolveFile()` 调用时机（返回 Blob）、constructor 接收的 mapping 对象形状、`ExporterOptions.colors` 必填参数（`COLORS_DEFAULT`）
- [x] 1.7 确认 `image-meta@^0.2.2`（MIT）是否满足图片尺寸检测需求（PNG/JPEG/GIF/WebP）；若满足则优先使用，避免手写 header parser
- [x] 1.8 将 1.1-1.7 结论写入 `docs/prd/sub-document-export/tech.md`（新增研究闸门结论小节），包括锁定 `docx` 版本、Packer API、numbering/styles 配置、Exporter 基类继承要点（含 colors 参数）、buffer polyfill 结论、image-meta 结论、参考实现重写要点
- [x] 1.9 只有 1.1-1.8 全部有可复核结果后，才允许进入第 2 组；若研究结论改变目标方案，先更新本 change 的 design.md 与任务依赖

## 2. export-core 包基础设施

- [x] 2.1 创建 `packages/tap-note-export-core` 目录和 `package.json`，包名 `@tap-note/export-core`，`private: true`
- [x] 2.2 创建 `tsconfig.json`（ES2022/DOM/ESNext/bundler/strict/noEmit/verbatimModuleSyntax/erasableSyntaxOnly，路径别名 `@tap-note/export-core/*`）
- [x] 2.3 创建 `eslint.config.js`（参照 `packages/tap-note-ai-core` 配置）
- [x] 2.4 创建 `src/index.ts` 空入口骨架
- [x] 2.5 写入运行时依赖：`@blocknote/core@0.51.4`（MPL-2.0）、`zod`；peerDeps：无（纯逻辑包，不依赖 React）
- [x] 2.6 写入 devDependencies：`eslint`、`typescript-eslint`、`typescript`
- [x] 2.7 执行 `bun install`，检查 lockfile 变更仅含预期依赖，确认依赖树无 GPL/AGPL；验证 turbo 能发现新包（`bun run typecheck --filter=@tap-note/export-core` 正常执行）
- [x] 2.8 运行 `bun run typecheck --filter=@tap-note/export-core`、`bun run lint --filter=@tap-note/export-core`，修复基础配置问题

## 3. export-core 契约实现

- [x] 3.1 创建 `src/types/input.ts`：定义 `ExportInput`（blocks: PartialBlock[]、resolver: ResourceResolver、options?: ExportOptions）、`ExportOptions`（fileName?: string、unknownBlockPolicy?: UnknownBlockPolicy、fontConfig?: FontConfig）、`ValidatedExportInput`（validated 后的不可变结构，含 resolver 引用）
- [x] 3.2 创建 `src/types/result.ts`：定义 `ExportResult<T = Blob | Uint8Array>`（content: T、fileName: string、mimeType: string、warnings: ExportWarning[]）
- [x] 3.3 创建 `src/types/resource.ts`：定义 `ResourceResolver` 接口（`resolve(url: string): Promise<ResolvedResource>`）、`ResolvedResource`（buffer: Uint8Array、mimeType: string、fileName?: string）、`createNoopResolver()` 工厂函数
- [x] 3.4 创建 `src/types/font.ts`：定义 `FontConfig`（default?: FontFamily、overrides?: Record<string, FontFamily>）、`FontFamily`（ascii?/hAnsi?/eastAsia?/cs?: string、size?: number）
- [x] 3.5 创建 `src/types/error.ts`：定义 `ExportWarning`（code/message/blockId?）、`ExportError` extends Error（code/blockId?）、错误码常量 `EXPORT_ERROR_CODES`（INVALID_INPUT/RESOURCE_FAILED/FONT_MISSING/UNKNOWN_BLOCK/RENDER_FAILED）
- [x] 3.6 创建 `src/types/policy.ts`：定义 `UnknownBlockPolicy = "preserve" | "omit-with-warning" | "error"`，默认值 `"preserve"`
- [x] 3.7 创建 `src/types/exporter.ts`：定义 `FormatExporter` 接口（`readonly format: string`、`export(input: ValidatedExportInput): Promise<ExportResult>`）——格式无关，PDF exporter 后续实现同一接口
- [x] 3.8 创建 `src/validate.ts`：实现 `validateExportInput(input: ExportInput): ValidatedExportInput`（单参数，resolver 已在 ExportInput 内），校验 blocks 非 null、resolver 存在、options 默认值填充；无效输入抛 `ExportError(INVALID_INPUT)`
- [x] 3.9 创建 `src/index.ts`：导出所有类型与 `validateExportInput`、`createNoopResolver`
- [x] 3.10 编写 export-core 单元测试：`validateExportInput` 正常/空数组/缺失 blocks 三种情况；`createNoopResolver` 拒绝所有 URL；类型导出完整性
- [x] 3.11 运行 typecheck + lint + test，确认通过

## 4. export-docx 包基础设施

- [x] 4.1 创建 `packages/tap-note-export-docx` 目录和 `package.json`，包名 `@tap-note/export-docx`，`private: true`
- [x] 4.2 创建 `tsconfig.json`（同 export-core 配置，路径别名 `@tap-note/export-docx/*`）
- [x] 4.3 创建 `eslint.config.js` / `bunfig.toml`（preload happy-dom 用于 Blob 测试）
- [x] 4.4 创建 `src/index.ts` 空入口骨架
- [x] 4.5 写入运行时依赖：`@blocknote/core@0.51.4`（MPL-2.0）、`@tap-note/export-core@workspace:*`、`docx@^9.6.1`（MIT）；若研究闸门 1.1 确认需要则加 `buffer@^6.0.3`（MIT）；若 1.7 确认使用 `image-meta` 则加 `image-meta@^0.2.2`（MIT）
- [x] 4.6 写入 devDependencies：`eslint`、`typescript-eslint`、`typescript`、`@happy-dom/global-registrator`
- [x] 4.7 执行 `bun install`，检查 lockfile 变更仅含预期依赖（`docx`/`buffer`），确认依赖树无 `@blocknote/xl-docx-exporter`/GPL/AGPL
- [x] 4.8 运行 typecheck + lint，修复基础配置问题

## 5. DOCX 映射层实现

- [x] 5.1 创建 `src/mappings/styles.ts`：实现 style mapping 对象，映射 bold→`{ bold }`、italic→`{ italics }`、underline→`{ underline: {} }`、strike→`{ strike: true }`、textColor→`{ color }`（去 `#` 前缀）、backgroundColor→`{ shading: { fill, type: "clear" } }`、code→`{ font: "Consolas", shading: { fill: "F0F0F0" } }`
- [x] 5.2 创建 `src/mappings/inline-content.ts`：实现 inline content mapping，`text`→`TextRun`（合并 style mapping 结果）、`link`→`ExternalHyperlink`（包裹子 content 的 TextRun）
- [x] 5.3 创建 `src/mappings/blocks.ts`：实现 block mapping 对象，覆盖 paragraph、heading（1-6 → Heading1-6 样式）、bulletListItem、numberedListItem、checkListItem（☑/☐ 前缀）、toggleListItem（渲染为带 ▸/▾ 前缀的普通段落，DOCX 无原生折叠）、quote（缩进+左边框）、codeBlock（Consolas+保留换行）、divider（底部边框空段落）、image（ImageRun+尺寸检测）、table（Table/TableRow/TableCell）、audio/video/file（ExternalHyperlink+标签）、pageBreak（docx `PageBreak`）
- [x] 5.4 创建 `src/util/table.ts`：实现 table block 到 docx Table 的转换工具函数（处理行列遍历、cell 内 inline content 递归）
- [x] 5.5 创建 `src/util/image.ts`：实现图片尺寸检测——若研究闸门确认使用 `image-meta` 则封装其 API；否则手写 PNG/JPEG/GIF/WebP header 解析。失败时使用默认宽度 500px
- [x] 5.6 创建 `src/numbering.ts`：生成 DOCX numbering 配置（bullet 9 级：•◦▪...、numbered 9 级：decimal），供 Document 构造时注入
- [x] 5.7 创建 `src/font.ts`：实现 `applyFontConfig(docOptions, fontConfig)` 工具函数，将 FontConfig 写入 Document 的 default run properties（ascii/hAnsi/eastAsia/cs），`size`（points）内部 ×2 转为 OOXML half-points（w:sz）
- [x] 5.8 编写映射层单元测试：各 style 映射正确、inline text/link 映射正确、每种 block 类型映射正确、未知 block 走 UnknownBlockPolicy 三策略

## 6. TapNoteDocxExporter 主类

- [x] 6.1 创建 `src/docx-exporter.ts`：实现 `TapNoteDocxExporter` 类继承 `@blocknote/core` 的 `Exporter`，constructor 接收 schema（默认 `getDefaultSchema()`）、三层 mapping、`ExporterOptions`（含必填 `colors: COLORS_DEFAULT` + `resolveFileUrl` 桥接：将 `ResourceResolver.resolve()` 返回的 `Uint8Array` 转为 `new Blob([buffer], { type: mimeType })` 适配基类）
- [x] 6.2 实现 `transformStyledText()`（抽象方法）：创建 `TextRun`，合并 style mapping 结果 + FontConfig per-run 覆盖
- [x] 6.3 实现 `transformBlocks()`：递归遍历 `ValidatedExportInput.blocks`，处理 nesting level（Tab 缩进）、numbered list index 传递、children 递归
- [x] 6.4 实现 `toDocxJsDocument(input: ValidatedExportInput): Document`：组装 `docx.Document`（sections + numbering config + default styles + font config）
- [x] 6.5 实现 `toBlob(input): Promise<ExportResult<Blob>>`：调用 `Packer.toBlob(doc)`，封装 `ExportResult`（fileName/mimeType/warnings）
- [x] 6.6 实现 `toUint8Array(input): Promise<ExportResult<Uint8Array>>`：调用 `Packer.toBuffer(doc)` → `new Uint8Array(buffer)`，封装 `ExportResult`
- [x] 6.7 实现 `FormatExporter` 接口：`format = "docx"`、`export(input)` 根据运行环境选择 `toBlob` 或 `toUint8Array`
- [x] 6.8 创建 `src/index.ts`：导出 `TapNoteDocxExporter`、`createDocxExporter()` 工厂函数、mapping 对象（供高级用户自定义扩展）
- [x] 6.9 编写主类单元测试：空文档导出、段落+样式导出、嵌套列表导出、图片（mock resolver）导出、未知 block 三策略、toBlob/toUint8Array 双输出
- [x] 6.10 运行 typecheck + lint + test，确认通过

## 7. 集成测试与 demo

- [x] 7.1 编写集成测试：完整文档（段落+标题+列表+表格+图片+链接+代码块+分隔线）导出为 DOCX，验证输出为有效 zip（DOCX 是 zip 格式）且包含 `word/document.xml`
- [x] 7.2 编写集成测试：CJK 内容（中文段落+eastAsia 字体配置）导出，验证 `document.xml` 中包含 `w:eastAsia` 属性
- [x] 7.3 编写安全测试：恶意 URL（`file:///etc/passwd`、`http://169.254.169.254/`）经 resolver 拒绝后产生 warning 而非崩溃
- [x] 7.4 `apps/web` 新增 `src/components/export-button.tsx`：工具栏导出按钮，调用 `TapNoteDocxExporter.toBlob()` 并触发浏览器下载（`URL.createObjectURL` + `<a download>`）
- [x] 7.5 `apps/web` 在编辑器页面集成导出按钮，验证端到端流程（编辑内容 → 点击导出 → 下载 .docx → 可打开）
- [x] 7.6 运行全量 `bun run lint && bun run typecheck && bun run test`，确认所有包通过（`@workspace/ui` lint 为既有问题，非本 change 引入）
