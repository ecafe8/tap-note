## Context

`@blocknote/core`（MPL-2.0）已提供 `Exporter<B, I, S, RB, RI, RS, TS>` 抽象基类，定义 block/inline/style 三层映射框架与 `resolveFile()` 资源获取。`resource/BlockNote/packages/xl-docx-exporter`（GPL-3.0）是完整参考实现，可阅读算法模式但不可依赖或复制。`@tap-note/ai-core` 的 `DocumentStateBuilder.build({ scope: "full" })` 已能序列化完整文档为 `PartialBlock[]`，可直接作为导出输入。

当前缺失：
- `packages/tap-note-export-core` 不存在——无格式无关的导出契约、资源 resolver 接口、字体配置、未知 block 策略。
- `packages/tap-note-export-docx` 不存在——无 DOCX 格式映射器。
- `docx` npm 库未安装。

约束：
- GPL 规避：禁止 `@blocknote/xl-docx-exporter`、`xl-pdf-exporter`、`xl-multi-column`。
- 后续 FEAT-009 PDF 导出将作为独立 change，但 export-core 契约必须格式无关，PDF exporter 可直接消费。
- 浏览器输出 Blob，Node.js/Hono 输出 Uint8Array；不依赖 server-api。

## Goals / Non-Goals

**Goals:**

- 创建 `@tap-note/export-core`：格式无关的导出契约层，定义 `ExportInput`、`ExportResult`、`ResourceResolver`、`FontConfig`、`UnknownBlockPolicy`、`ExportWarning`/`ExportError`。设计为所有格式 exporter（DOCX/PDF/Markdown/HTML）的统一入口。
- 创建 `@tap-note/export-docx`：继承 `@blocknote/core` 的 `Exporter` 基类，使用 `docx`（MIT）生成 OOXML。实现默认 schema 的 block/inline/style 三层映射。
- 浏览器 `toBlob()` + Node.js `toUint8Array()` 双输出。
- CJK 字体支持：DOCX 写入 ascii/hAnsi/eastAsia/cs 四组字体名称。
- 未知 block 按 `UnknownBlockPolicy`（preserve/omit-with-warning/error）显式处理。
- 资源 resolver 注入：集成方提供受限 fetcher，exporter 不直接访问任意 URL。
- `apps/web` demo 新增导出按钮验证端到端流程。
- **为 PDF 预留扩展**：export-core 的 `ExportInput`/`ExportResult`/`ResourceResolver`/`FontConfig` 完全格式无关；`FormatExporter` 接口抽象使 PDF exporter 只需实现映射层即可接入同一管线。

**Non-Goals:**

- 不实现 PDF 导出（FEAT-009，后续独立 change `add-pdf-export`）。
- 不实现 Markdown/HTML 导出（FEAT-012，P2）。
- 不实现字体下载/子集化/许可证管理（SUB-001 职责）。
- 不修改 `packages/tap-note-editor`、`ai-core`、`ai-inline`、`ai-chat`、`apps/server-api`。
- 不引入 GPL/AGPL 依赖。
- 不实现导出管理页面、文档持久化、异步任务队列。
- 不实现 DOCX 模板自定义 UI（API 层支持传入模板，但 UI 由集成方实现）。

## Decisions

### 1. export-core 定义 `FormatExporter` 接口，格式包只实现映射

export-core 定义格式无关的管线：

```text
ExportInput(含 resolver) → validate → FormatExporter.export() → ExportResult
                                         ↓ (内部按需调用 resolver)
```

`FormatExporter` 接口（非泛型，`ExportResult` 默认 `T = Blob | Uint8Array` 已足够）：

```typescript
interface FormatExporter {
  readonly format: string
  export(input: ValidatedExportInput): Promise<ExportResult>
}
```

DOCX exporter 实现此接口；后续 PDF exporter 同样实现此接口，export-core 无需修改。

备选：把 DOCX 逻辑直接放在 export-core 内。放弃原因是违反 PRD 的 core + 独立格式包架构，增加格式耦合，PDF 加入时需要拆分。

### 2. 继承 `@blocknote/core` 的 `Exporter` 抽象类

`@blocknote/core` 的 `Exporter<B, I, S, RB, RI, RS, TS>` 已提供：
- `mapStyles(styles)` → 遍历 style mapping 返回合并的 `RS`
- `transformInlineContent(content)` → 遍历 inline mapping 返回 `RI[]`
- `mapBlock(block, nestingLevel, numberedListIndex)` → 分发到 block mapping 返回 `RB`
- `resolveFile(url)` → 通过 `ExporterOptions.resolveFileUrl` 获取二进制资源

`@tap-note/export-docx` 的 `TapNoteDocxExporter` 继承此类，类型参数：
- `RB = Paragraph | Table | ...`（docx 库类型）
- `RI = ParagraphChild`
- `RS = IRunPropertiesOptions`
- `TS = TextRun`

Constructor 需要：
- `_schema: BlockNoteSchema`（类型推断用，传入 `getDefaultSchema()` 或集成方自定义 schema）
- `mappings`：三层 mapping 对象
- `options: ExporterOptions`：包含 **必填** `colors: typeof COLORS_DEFAULT`（从 `@blocknote/core` 导入 `COLORS_DEFAULT`，用于将命名颜色如 `"red"` 映射为 hex）和可选 `resolveFileUrl`

只需实现 `transformStyledText()`（抽象方法）+ 注入三层 mapping 对象。

备选：不继承，从零写映射遍历。放弃原因是 `Exporter` 基类是 MPL-2.0 且已在 `@blocknote/core` 依赖中，复用减少重复代码并保证与 BlockNote schema 类型对齐。

### 3. `docx` npm 库（MIT）生成 OOXML

使用 `docx@^9.6.1`：
- `Document` + `Packer.toBlob(doc)` → 浏览器 Blob
- `Packer.toBuffer(doc)` → Node.js Buffer → Uint8Array
- `TextRun`、`Paragraph`、`Table`、`TableRow`、`TableCell`、`ImageRun`、`ExternalHyperlink` 等构建 OOXML 节点
- Numbering config 支持 bullet/numbered list 多级缩进

备选 A：`officegen`。放弃原因是 API 陈旧、不支持 table/image 完整映射、维护不活跃。
备选 B：手写 OOXML XML + zip。放弃原因是工作量巨大且易出错，`docx` 库是 MIT 且 API 成熟。

### 4. 资源 resolver 注入 + 安全策略

export-core 定义 `ResourceResolver` 接口：

```typescript
interface ResourceResolver {
  resolve(url: string): Promise<ResolvedResource>
}

interface ResolvedResource {
  buffer: Uint8Array
  mimeType: string
  fileName?: string
}
```

集成方实现此接口，负责协议限制、allowlist、大小/超时/MIME 校验、私网 IP 阻断。exporter 只调用 `resolver.resolve(url)`，不直接 `fetch`。

`ResourceResolver` 作为 `ExportInput.resolver` 字段传入（非独立参数），`validateExportInput(input)` 单参数校验。

**与 `Exporter` 基类桥接**：基类 `resolveFile()` 返回 `Blob`，`ExporterOptions.resolveFileUrl` 返回 `string | Blob`。DOCX exporter 在 constructor 中将 `ResourceResolver` 适配为 `resolveFileUrl`：`async (url) => new Blob([resolved.buffer], { type: resolved.mimeType })`。

默认提供 `createNoopResolver()`（拒绝所有资源，返回 warning）供无资源场景使用。

### 5. FontConfig 格式无关，DOCX 写入四组字体名称

```typescript
interface FontConfig {
  default?: FontFamily
  overrides?: Record<string, FontFamily>
}

interface FontFamily {
  ascii?: string
  hAnsi?: string
  eastAsia?: string
  cs?: string    // OOXML w:cs (complexScript)；对应 SUB-001 TapNoteFontConfig.complexScriptFamily
  size?: number  // 单位：points（用户友好）；exporter 内部 ×2 转为 OOXML half-points (w:sz)
}
```

- DOCX：写入 `styles.xml` 的 `w:rFonts` 四组属性（ascii/hAnsi/eastAsia/cs）。
- PDF（后续）：消费同一 `FontConfig`，注册字体文件到 renderer。
- 不捆绑字体文件：由集成方或 SUB-001 提供。

### 6. UnknownBlockPolicy 三策略

```typescript
type UnknownBlockPolicy = "preserve" | "omit-with-warning" | "error"
```

- `preserve`（默认）：未知 block 的文本内容作为普通段落输出，附 warning。
- `omit-with-warning`：跳过未知 block，附 warning。
- `error`：抛出 `ExportError`，中止导出。

### 7. ExportResult 统一输出

```typescript
interface ExportResult<T = Blob | Uint8Array> {
  content: T
  fileName: string
  mimeType: string
  warnings: ExportWarning[]
}
```

DOCX 固定 `mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"`，`fileName` 默认 `document.docx`，可被 `ExportInput.options.fileName` 覆盖。

### 8. 不使用 OOXML 模板文件，由 `docx` 库从零生成 Document

参考实现使用 `template blocknote.docx` 作为 OOXML 骨架（预置 styles.xml/numbering）。本设计选择不使用模板文件，而是通过 `docx` 库的 `Document` API 在代码中定义 styles、numbering、default run properties。

备选：使用自定义 .docx 模板。放弃原因是增加二进制资产管理复杂度，`docx` 库已支持完整的 styles/numbering 编程式配置，代码生成更可控且易于测试。

### 9. 为 PDF 预留的扩展点总结

| 扩展点 | 本 change 实现 | PDF change 消费方式 |
|---|---|---|
| `FormatExporter` 接口 | DOCX 实现 | PDF 实现同一接口 |
| `ExportInput` / `ValidatedExportInput` | 格式无关 | 直接消费 |
| `ExportResult<T>` | `T = Blob \| Uint8Array` | 同 |
| `ResourceResolver` | 注入式 | PDF 获取字体文件/图片同一接口 |
| `FontConfig` | DOCX 写名称 | PDF 注册字体文件 |
| `UnknownBlockPolicy` | 三策略 | 同 |
| `ExportWarning` / `ExportError` | 统一体系 | 同 |
| `Exporter` 基类（@blocknote/core） | DOCX 继承 | PDF 同样继承（不同泛型参数） |

后续 `add-pdf-export` change 只需：新增 `@tap-note/export-pdf` 包 + 实现 `FormatExporter` + 继承 `Exporter`（`RB = ReactElement`），export-core 零修改。

## Risks / Trade-offs

- **[`docx` 库 API 变更]** → 研究闸门用 Context7 锁定 ^9.6.1 精确 API；lockfile 固定版本。
- **[CJK 字体在 Word 中显示异常]** → DOCX 只写字体名称不嵌入字体，依赖用户系统已安装对应字体；warning 提示缺失字体。
- **[复杂 block 映射不完整]** → P1 覆盖默认 schema 全部 block 类型；自定义 schema block 走 UnknownBlockPolicy。
- **[浏览器 `Packer.toBlob` 兼容性]** → 研究闸门验证 Safari/Firefox/Chrome；`buffer` polyfill 处理 Node 全局。
- **[GPL 污染风险]** → 只阅读参考实现理解算法，独立编写；CI 可加 license-checker 扫描。
- **[export-core 过度设计]** → 本 change 只实现 DOCX 所需的最小子集，接口设计面向多格式但不提前实现 PDF 逻辑。
