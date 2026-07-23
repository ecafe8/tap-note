## Context

`@tap-note/export-core`（FEAT-008）已交付格式无关的导出契约：`ExportInput`（含 `ResourceResolver`）、`ExportResult`、`FontConfig`、`UnknownBlockPolicy`、`FormatExporter` 接口。`@tap-note/export-docx`（FEAT-010）已验证格式包独立实现模式。PRD SUB-005 指定 `@react-pdf/renderer` 为 PDF 候选依赖。

当前缺失：
- `packages/tap-note-export-pdf` 不存在——无 PDF 格式映射器。
- `@react-pdf/renderer` 未安装。
- 无 CJK 字体注册机制（PDF 必须嵌入字体才能正确渲染中文）。

约束：
- GPL 规避：禁止 `@blocknote/xl-pdf-exporter`。
- export-core 零修改：PDF exporter 直接实现 `FormatExporter` 接口。
- 浏览器输出 Blob，Node.js 输出 Uint8Array；不依赖 server-api。
- 基础包不捆绑 CJK 字体文件；字体由集成方通过 `FontConfig` + `ResourceResolver` 提供。

## Goals / Non-Goals

**Goals:**

- 创建 `@tap-note/export-pdf`：实现 `FormatExporter` 接口（`format = "pdf"`），使用 `@react-pdf/renderer`（MIT）将 BlockNote 文档渲染为 PDF。
- block/inline/style 三层映射到 React PDF 组件（`Document`/`Page`/`View`/`Text`/`Image`/`Link`）。
- CJK 字体支持：通过 `Font.register()` 注册集成方提供的字体 buffer（TTF/OTF），解决中文 PDF 乱码。
- 浏览器 `pdf(<Doc/>).toBlob()` + Node.js `pdf(<Doc/>).toBuffer()` 双输出。
- 未知 block 按 `UnknownBlockPolicy` 显式处理（复用 export-core 契约）。
- 资源 resolver 注入：图片通过 `ResourceResolver` 获取后转 data URI 供 `<Image>` 使用。
- `apps/web` demo 导出按钮增加 PDF 格式选项。

**Non-Goals:**

- 不修改 `packages/tap-note-export-core`、`export-docx`、`editor`、`ai-core`、`ai-chat`、`apps/server-api`。
- 不引入 GPL/AGPL 依赖。
- 不实现字体下载/子集化/许可证管理（SUB-001 职责）。
- 不实现 Markdown/HTML 导出（FEAT-012，P2）。
- 不实现导出管理页面、文档持久化、异步任务队列。
- 不实现分页控制 UI（API 层支持 pageBreak block 自动分页）。
- 不实现 PDF 模板/页眉页脚自定义（P2 候选）。

## Decisions

### 1. 使用 `@react-pdf/renderer`（MIT）作为 PDF 渲染引擎

`@react-pdf/renderer` 提供 React 组件式 PDF 生成：
- `pdf(<Document>...</Document>).toBlob()` → 浏览器 Blob
- `pdf(<Document>...</Document>).toBuffer()` → Node.js Buffer
- `Font.register({ family, src, fonts })` → 注册自定义字体（支持 TTF/OTF/WOFF）
- 组件：`Document`/`Page`/`View`/`Text`/`Image`/`Link`/`StyleSheet`

备选 A：`pdfkit`（MIT）。放弃原因是命令式 API，不适合 block→组件的声明式映射模式。
备选 B：`jspdf`（MIT）。放弃原因是低层 API，表格/列表/样式需大量手写布局逻辑。
备选 C：`@blocknote/xl-pdf-exporter`。GPL-3.0，禁止。

### 2. 实现 `FormatExporter` 接口，export-core 零修改

```typescript
class TapNotePdfExporter implements FormatExporter {
  readonly format = "pdf"
  async export(input: ValidatedExportInput): Promise<ExportResult> { ... }
}
```

与 DOCX exporter 不同，PDF exporter **不继承** `@blocknote/core` 的 `Exporter` 基类（该基类面向 docx 库的命令式对象模型），而是自行遍历 blocks 并映射为 React PDF 组件树。export-core 的 `FormatExporter` 接口已足够。

备选：继承 `Exporter` 基类。放弃原因是 `Exporter` 的泛型参数（`RB`/`RI`/`RS`/`TS`）面向命令式对象构建，React 组件是声明式 JSX，强行适配会增加复杂度且无收益。

### 3. CJK 字体通过 `Font.register()` + `PdfExporterOptions.fontBuffers` 注入

PDF 必须嵌入字体才能渲染 CJK。设计：
- `FontConfig.default` 提供字体族名称（`ascii`/`eastAsia` 等）。
- **`fontBuffers` 放在 `PdfExporterOptions`**（exporter 构造时传入，不走 `ExportInput`）。原因：字体 buffer 是 exporter 级别的配置（同一 exporter 实例导出多个文档时字体不变），不属于 per-document 的 `ExportInput`。`FormatExporter.export(input)` 接口签名不变，export-core 零修改。
- `PdfExporterOptions.fontBuffers?: Record<string, Uint8Array>`：key 为字体族名称（对应 `FontConfig` 中的 `ascii`/`eastAsia` 等），value 为 TTF/OTF 文件 buffer。
- exporter 在首次渲染前调用 `Font.register({ family, src: buffer })` 注册字体（研究闸门 1.2 确认 `src` 是否直接接受 `Uint8Array`；若不接受则转 dataURI）。
- 未提供字体 buffer 时，使用 `@react-pdf/renderer` 内置 Helvetica（仅 Latin），CJK 字符附 warning。

不捆绑字体文件（PRD 约束）。集成方负责提供字体 buffer。

### 4. 图片通过 `ResourceResolver` 获取后转 data URI

`<Image src={dataURI} />` 需要可直接访问的 URL 或 data URI。exporter 调用 `resolver.resolve(url)` 获取 `Uint8Array`，转为 `data:${mimeType};base64,...` 格式传入 `<Image>`。

解析失败时 emit `ExportWarning(RESOURCE_FAILED)` 并跳过图片。

### 5. Block 树递归遍历（children 处理）

PDF exporter 不继承 `Exporter` 基类，需自行实现 block 树遍历。`buildDocument` 内部实现 `renderBlocks(blocks, nestingLevel)` 递归函数：

- 遍历 `blocks` 数组，对每个 block 调用对应的 block mapping 组件。
- 若 block 有 `children`（如 bulletListItem 嵌套子列表、toggleListItem 包含子内容），递归调用 `renderBlocks(block.children, nestingLevel + 1)`，将结果作为子元素嵌入父组件。
- 列表类 block（bullet/numbered/check/toggle）的 children 渲染为缩进递增的子 `<View>`。
- 未知 block 的 children 在 `preserve` 策略下也递归渲染。

此模式与 DOCX exporter 的 `transformBlocks()` 递归一致，区别在于输出是 React 组件树而非命令式对象数组。

### 6. 分页策略

- 默认单页无限高度（`Page` 不设固定 height，`@react-pdf/renderer` 自动分页）。
- `pageBreak` block 映射为 `<View break />`（强制分页）。
- 表格/代码块不拆分（`wrap={false}`）。

### 7. 样式通过 `StyleSheet.create()` 预定义

样式使用 `@react-pdf/renderer` 的 `StyleSheet.create()` 预定义为静态对象，block 映射引用 stylesheet key，避免每次渲染创建新对象。动态样式（如 textColor/backgroundColor 来自 block 数据）通过内联 style 合并。

### 8. ExportResult 输出

PDF 固定 `mimeType: "application/pdf"`，`fileName` 默认 `document.pdf`，可被 `ExportInput.options.fileName` 覆盖。

## Risks / Trade-offs

- **[`@react-pdf/renderer` 包体积]** → 约 2MB gzipped；仅在实际调用导出时动态 import（`apps/web` 中 lazy load），不影响编辑器首屏。
- **[CJK 字体缺失时静默乱码]** → 未注册字体时 CJK 字符显示为空白；exporter 检测 `FontConfig` 无 eastAsia 字体 buffer 时 emit `FONT_MISSING` warning。
- **[复杂表格布局]** → `@react-pdf/renderer` 的表格支持有限（无原生 `<Table>`），用 `<View>` + flex 模拟；colspan/rowspan 可能不完美。
- **[React 版本兼容]** → `@react-pdf/renderer` 需要 React 作为 peer dep；workspace 已有 React 19，需确认兼容性（研究闸门）。
- **[GPL 污染风险]** → 只阅读 `xl-pdf-exporter` 参考实现理解映射边界，独立编写。
