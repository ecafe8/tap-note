## 1. 研究闸门：`@react-pdf/renderer` API + 参考实现阅读

- [ ] 1.1 使用 Context7 查询 `@react-pdf/renderer` 的 `pdf()`/`renderToBuffer`/`renderToBlob` API，确认浏览器与 Node.js 双运行时兼容性；确认 React 19 peer dep 兼容性；确认 bun test（happy-dom）环境下 `pdf().toBuffer()` 是否正常工作，是否需要额外 polyfill
- [ ] 1.2 使用 Context7 查询 `@react-pdf/renderer` 的 `Font.register()` API，确认 TTF/OTF/WOFF 字体注册方式（buffer/dataURI/url）、`fontWeight`/`fontStyle` 变体注册
- [ ] 1.3 使用 Context7 查询 `@react-pdf/renderer` 的 `Document`/`Page`/`View`/`Text`/`Image`/`Link`/`StyleSheet` 组件 API，确认 flex 布局、分页（`break`/`wrap`）、样式属性
- [ ] 1.4 阅读 `resource/BlockNote/packages/xl-pdf-exporter/src`，理解 block→React PDF 组件的映射边界（paragraph/heading/list/quote/code/divider/image/table）；记录重写要点（不复制代码）
- [ ] 1.5 确认 `@react-pdf/renderer` 最新版本号与 license（MIT），确认无 GPL/AGPL 传递依赖
- [ ] 1.6 将 1.1-1.5 结论写入 `docs/prd/sub-document-export/tech.md`（新增 PDF 研究闸门结论小节），包括锁定版本、pdf() API、Font.register 用法、组件布局要点、参考实现重写要点
- [ ] 1.7 只有 1.1-1.6 全部有可复核结果后，才允许进入第 2 组；若研究结论改变目标方案，先更新本 change 的 design.md 与任务依赖

## 2. export-pdf 包基础设施

- [ ] 2.1 创建 `packages/tap-note-export-pdf` 目录和 `package.json`，包名 `@tap-note/export-pdf`，`private: true`
- [ ] 2.2 创建 `tsconfig.json`（ES2022/DOM/ESNext/bundler/react-jsx/strict/noEmit/verbatimModuleSyntax/erasableSyntaxOnly，路径别名 `@tap-note/export-pdf/*`）
- [ ] 2.3 创建 `eslint.config.js`（含 react-hooks/react-refresh 插件，参照 `packages/tap-note-ai-core` 配置）
- [ ] 2.4 创建 `bunfig.toml`（preload happy-dom 用于 Blob 测试）
- [ ] 2.5 创建 `src/index.ts` 空入口骨架
- [ ] 2.6 写入运行时依赖：`@blocknote/core@0.51.4`（MPL-2.0）、`@tap-note/export-core@workspace:*`、`@react-pdf/renderer`（MIT）；peerDeps：`react@^19`
- [ ] 2.7 写入 devDependencies：`eslint`、`typescript-eslint`、`eslint-plugin-react-hooks`、`eslint-plugin-react-refresh`、`typescript`、`@happy-dom/global-registrator`、`react`、`react-dom`、`@types/react`
- [ ] 2.8 执行 `bun install`，检查 lockfile 变更仅含预期依赖，确认依赖树无 `@blocknote/xl-pdf-exporter`/GPL/AGPL；验证 turbo 能发现新包
- [ ] 2.9 运行 typecheck + lint，修复基础配置问题

## 3. PDF 映射层实现

- [ ] 3.1 创建 `src/mappings/styles.ts`：实现 style→React PDF style 映射，bold→`fontWeight:"bold"`、italic→`fontStyle:"italic"`、underline→`textDecoration:"underline"`、strike→`textDecoration:"line-through"`、textColor→`color`、backgroundColor→`backgroundColor`、code→`fontFamily:"Courier"`+`backgroundColor:"#F0F0F0"`
- [ ] 3.2 创建 `src/mappings/inline-content.tsx`：实现 inline content→React PDF 组件映射，`text`→`<Text style={...}>`、`link`→`<Link src={href}><Text>...</Text></Link>`
- [ ] 3.3 创建 `src/mappings/blocks.tsx`：实现 block→React PDF 组件映射，覆盖 paragraph（`<View><Text>`）、heading（fontSize 24/20/16/14/12/11）、bulletListItem（缩进+•/◦/▪ 前缀）、numberedListItem（缩进+序号）、checkListItem（☑/☐ 前缀）、toggleListItem（▸ 前缀）、quote（左边框+缩进）、codeBlock（Courier+背景色+wrap:false）、divider（borderBottom）、image（`<Image src={dataURI}>`）、table（flex 行列布局）、audio/video/file（`<Link>`+标签）、pageBreak（`<View break/>`）
- [ ] 3.4 创建 `src/util/table.tsx`：实现 table block→flex 布局转换（行/列遍历、cell 内 inline content 递归、列宽百分比）
- [ ] 3.5 创建 `src/util/image.ts`：实现 `ResourceResolver` 结果→data URI 转换（`Uint8Array` → base64 → `data:${mime};base64,...`）
- [ ] 3.6 创建 `src/font-register.ts`：实现 `registerFonts(fontConfig, fontBuffers)` 工具函数，调用 `Font.register()` 注册 TTF/OTF 字体；未提供 buffer 时跳过并返回 warning
- [ ] 3.7 编写映射层单元测试：各 style 映射正确、inline text/link 映射正确、block 类型映射正确、未知 block 走 UnknownBlockPolicy 三策略

## 4. TapNotePdfExporter 主类

- [ ] 4.1 创建 `src/pdf-exporter.tsx`：实现 `TapNotePdfExporter` 类实现 `FormatExporter` 接口（`format = "pdf"`），constructor 接收 `PdfExporterOptions`（`{ fontConfig?: FontConfig; fontBuffers?: Record<string, Uint8Array> }`）
- [ ] 4.2 实现 `buildDocument(input: ValidatedExportInput): React.ReactElement`：遍历 blocks 生成 `<Document><Page>...</Page></Document>` 组件树
- [ ] 4.3 实现 `toBlob(input): Promise<ExportResult<Blob>>`：调用 `pdf(doc).toBlob()`，封装 `ExportResult`（fileName/mimeType/warnings）
- [ ] 4.4 实现 `toUint8Array(input): Promise<ExportResult<Uint8Array>>`：调用 `pdf(doc).toBuffer()` → `new Uint8Array(buffer)`，封装 `ExportResult`
- [ ] 4.5 实现 `export(input)` 方法：根据运行环境选择 `toBlob` 或 `toUint8Array`
- [ ] 4.6 创建 `src/index.ts`：导出 `TapNotePdfExporter`、`createPdfExporter()` 工厂函数、mapping 组件（供高级用户自定义扩展）
- [ ] 4.7 编写主类单元测试：空文档导出、段落+样式导出、嵌套列表导出、图片（mock resolver）导出、未知 block 三策略、toBlob/toUint8Array 双输出
- [ ] 4.8 运行 typecheck + lint + test，确认通过

## 5. 集成测试与 demo

- [ ] 5.1 编写集成测试：完整文档（段落+标题+列表+表格+图片+链接+代码块+分隔线）导出为 PDF，验证输出以 `%PDF` magic bytes 开头
- [ ] 5.2 编写集成测试：CJK 内容（中文段落+eastAsia 字体 buffer 注册）导出，验证无 `FONT_MISSING` warning
- [ ] 5.3 编写集成测试：CJK 内容无字体 buffer 时导出，验证产生 `FONT_MISSING` warning 但不崩溃
- [ ] 5.4 编写安全测试：恶意 URL 经 resolver 拒绝后产生 warning 而非崩溃
- [ ] 5.5 `apps/web/package.json` 新增 `@tap-note/export-pdf@workspace:*` 依赖，执行 `bun install`
- [ ] 5.6 `apps/web` 修改 `src/components/export-button.tsx`：增加格式选择（DOCX/PDF 下拉或双按钮），PDF 调用 `TapNotePdfExporter.toBlob()` 并触发下载
- [ ] 5.7 `apps/web` 验证端到端流程（编辑内容 → 选择 PDF → 下载 .pdf → 可打开）
- [ ] 5.8 运行全量 `bun run lint && bun run typecheck && bun run test`，确认所有包通过
