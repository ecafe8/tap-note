# 技术方案：字体集成工具

## 0. 技术方案信息

- Sub ID：SUB-001
- 所属产品：tap-note
- 总 PRD：`docs/prd/main-prd.md`
- Sub PRD：`docs/prd/sub-font-tools/prd.md`
- 文档版本：v1
- 文档状态：草稿
- 技术结论：字体由集成方配置，tap-note 提供可选字体预设和安装/检查/配置生成工具

## 1. 当前项目事实

- 根项目使用 Bun、Turbo、TypeScript `~6`、Prettier；当前没有字体工具包。
- `packages/tap-note-editor`、`packages/tap-note-ai-*` 是计划中的组件包；当前不存在导出包和字体工具实现。
- `apps/web` 是 Vite + React demo；可作为字体配置和中文导出的示例，但不应把字体自动下载逻辑隐含在编辑器组件中。
- `apps/server-api` 是计划中的 Hono 私有 app；可以提供可选导出 HTTP 适配，但字体工具本身不依赖它。
- BlockNote submodule 中存在 `xl-pdf-exporter` 和 `xl-docx-exporter`，两者版本为 `0.51.4`，许可证均为 `GPL-3.0 OR PROPRIETARY`，仅作为参考实现。

## 2. 技术目标与非目标

### 2.1 技术目标

- 为 PDF/DOCX exporter 提供稳定、可序列化、与运行环境无关的字体配置模型。
- 支持集成方提供字体，而不是强制下载或捆绑字体。
- 让固定版本字体可以通过 CLI 安装到项目资源目录。
- 在安装阶段完成哈希、格式、许可证和基础 glyph 覆盖检查。
- 生成 PDF 和 DOCX 各自所需的配置，避免让导出包理解字体下载细节。
- 为后续字体子集化保留接口，不把 Python/fonttools 作为浏览器运行时依赖。

### 2.2 技术非目标

- 不实现 PDF 排版和分页。
- 不实现 DOCX OOXML mapping。
- 不在导出基础包中携带大型 CJK 字体。
- 不支持把系统字体名称直接当作浏览器端 PDF 字体文件。
- 不直接复用或 fork BlockNote GPL exporter。

## 3. 建议包结构

```text
packages/
├── tap-note-export-core/       # 由 FEAT-008 定义
├── tap-note-export-pdf/        # 由 FEAT-009 定义
├── tap-note-export-docx/       # 由 FEAT-010 定义
└── tap-note-font-tools/        # 本 sub 的工具包，名称待确认
```

依赖关系:

```text
tap-note-export-core
        ↑                 ↑
tap-note-export-pdf   tap-note-export-docx

tap-note-font-tools
        └── 生成 FontConfig，供 export-pdf/export-docx 消费
```

字体工具不应被 `tap-note-editor` 依赖。导出包也不应在安装时自动下载字体。

## 4. 分层架构

### 4.1 Preset Registry

维护字体预设的声明数据:

- preset id；
- family；
- upstream source；
- 固定版本；
- 下载 URL；
- SHA-256；
- 文件格式和变体；
- license URL；
- NOTICE URL；
- 可选的最小测试字符集。

Registry 应为版本化静态 JSON/TypeScript 数据，不依赖远程 `latest`。

### 4.2 Downloader

职责:

- 下载固定 URL 资源；
- 支持本地缓存；
- 支持断点或失败重试；
- 校验响应状态和内容长度；
- 校验 SHA-256；
- 写入目标目录；
- 复制许可证和 NOTICE。

默认不使用 `raw.githubusercontent.com/main`。如果使用 GitHub，优先使用固定 tag 或 Release Asset；也允许集成方覆盖镜像 URL。

### 4.3 Font Inspector

职责:

- 读取字体 family、subfamily、格式和变体；
- 检查 Regular/Bold/Italic/BoldItalic；
- 根据指定文本或字符集检查 cmap 覆盖；
- 输出缺失字符清单；
- 检查是否为 TTC/OTC，并要求明确 font index；
- 输出 warning/error，不负责修改原字体。

实现可以分阶段:

- P1：优先使用最小可靠解析能力或系统工具检查；
- P2：评估 `fontkit`、WASM 或 Python fontTools 的 glyph 解析能力。

### 4.4 Config Generator

生成两类配置:

```ts
interface PdfFontRegistrationConfig {
  family: string
  regular: FontSource
  bold?: FontSource
  italic?: FontSource
  boldItalic?: FontSource
}

interface DocxFontConfig {
  ascii?: string
  hAnsi?: string
  eastAsia?: string
  complexScript?: string
}
```

生成结果可以是 TypeScript、JSON 或 `.env` 片段，但不能覆盖已有人工配置，默认应写入新文件。

### 4.5 Subsetter Adapter

子集化不直接绑定某个 Python 环境。建议提供 adapter:

```ts
interface FontSubsetter {
  subset(input: FontSubsetInput): Promise<FontSubsetResult>
}
```

第一阶段提供外部命令适配器:

```text
font-tools subset --engine fonttools ...
```

后续可增加 WASM/Node 实现。子集化必须保留必要的 OpenType layout features，不能只按 codepoint 粗暴删除字形。

## 5. 关键技术契约

### 5.1 资源来源

支持:

- 官方字体源；
- tap-note 固定版本 Release Asset；
- 集成方自有镜像；
- 本地文件路径；
- 本地缓存。

不支持默认依赖未锁定的 `main`、`latest` 或不可校验 URL。

### 5.2 运行环境

| 环境 | PDF | DOCX |
|---|---|---|
| 浏览器 | 字体需要可被 `@react-pdf/renderer` 加载并注册；优先 TTF/OTF，格式兼容需实测 | 写入字体名称和模板配置，通常不嵌入字体 |
| Node.js | 支持本地路径、Buffer/Uint8Array；适合 server-side 导出 | 支持本地字体名称、模板和输出 Buffer |
| Hono | 通过 export adapter 返回 Response | 通过 export adapter 返回 Response |

### 5.3 字体缺失策略

```ts
type MissingGlyphPolicy = "warn" | "error"
```

- `warn`：继续导出，返回缺失字符列表；适合预览。
- `error`：阻止导出；适合生产下载。
- 默认建议 `warn`，但参考应用和 CI 验收应使用 `error` 验证中文覆盖。

## 6. 第三方依赖与调研记录

### `@react-pdf/renderer`

- 当前 npm latest 查询结果：`4.5.1`（2026-07-17 查询）。
- Context7 library：`/diegomura/react-pdf`。
- 官方能力结论：支持 `Font.register`，字体来源可为 URL、本地文件和 data URI；支持多个 weight/style 注册。
- BlockNote 参考包当前依赖：`^4.3.0`。
- 兼容性结论：不能依赖系统字体名称解决浏览器端中文 PDF；需要由集成方提供可读取的字体资源。
- 待实施确认：目标浏览器对 TTF/OTF/WOFF/WOFF2 的实际兼容性、远程字体 CORS、字体加载超时。

### `docx`

- 当前 npm latest 查询结果：`9.7.1`（2026-07-17 查询）。
- BlockNote 参考 DOCX exporter 当前依赖：`^9.6.1`。
- 兼容性结论：DOCX 可以设置 `ascii`、`hAnsi`、`eastAsia`、`cs` 字体名称，不等同于嵌入字体；目标环境仍需安装对应字体。
- 待实施确认：模板、中文字体字段、图片和表格映射 API。

### fontTools

- 官方文档：https://fonttools.readthedocs.io/en/latest/subset/index.html
- 能力结论：支持 TTF/OTF/WOFF/WOFF2，按文本或 Unicode 集合裁剪，生成 WOFF/WOFF2，并保留或裁剪 OpenType layout features。
- 适用范围：构建期/CLI 工具，不作为浏览器运行时依赖。
- 风险：需要 Python 环境；不同字体格式和 layout feature 可能产生兼容性差异，必须对输出字体进行加载和导出回归测试。

### BlockNote XL exporters

- `resource/BlockNote/packages/xl-pdf-exporter/src/pdf/pdfExporter.tsx` 展示了 `Font.register`、Inter/GeistMono 注册、emoji source、BlockNote schema 到 React PDF 的映射。
- `resource/BlockNote/packages/xl-docx-exporter/src/docx/docxExporter.ts` 及 `defaultSchema/` 展示了 DOCX schema mapping、模板和测试快照组织方式。
- 两者许可证均为 `GPL-3.0 OR PROPRIETARY`；本项目只参考行为和模块边界，不复制源码，不作为可发布包依赖。

## 7. 备选方案与决策

| 方案 | 优点 | 缺点 | 结论 |
|---|---|---|---|
| 基础包内置完整 CJK 字体 | 开箱即用 | 包体积大、许可证和版本维护复杂、所有用户承担成本 | 排除 |
| 运行时从 GitHub Raw 下载 | 不增加安装包体积 | 网络、CORS、限流、版本漂移和供应链风险 | 不作为默认方案 |
| 固定版本 Release Asset + CLI 安装 | 可版本锁定、可校验、集成方本地使用 | 需要下载步骤和字体许可证管理 | 推荐 |
| 仅依赖系统字体 | 不需要分发字体 | 浏览器 PDF 不可靠、跨环境结果不一致 | 仅作为 Node.js 可选方案 |
| 集成方完全自备字体 | 灵活、企业友好 | 上手成本高 | 作为正式扩展能力保留 |
| 文档动态字体子集 | 体积小 | 工具链复杂、处理时间增加 | P2 候选，P1 保留 adapter |

## 8. 安全、隐私与合规

- 下载源必须固定版本并校验 SHA-256。
- CLI 不执行远程下载内容，仅保存字体二进制和许可证文件。
- 不上传集成方文档内容到字体服务。
- 动态子集化只读取本地文档文本，不默认联网。
- 字体许可证和字体源必须进入生成目录，便于应用发布时审计。
- 字体工具不提供法律意见；集成方对自定义字体和最终分发负责。
- 不允许通过字体配置执行任意脚本或动态 import 未声明模块。

## 9. 测试策略

- Registry 单元测试：字段完整、版本固定、哈希格式合法、许可证字段存在。
- Downloader 测试：成功下载、404、超时、哈希不匹配、缓存命中。
- Inspector 测试：TTF/OTF、变体、中文覆盖、缺失 glyph、TTC index。
- Config Generator 测试：PDF 注册配置和 DOCX East Asia 配置输出稳定。
- Subsetter 测试：文本裁剪后目标字符存在、未声明字符缺失可报告、字体仍可加载。
- 集成测试：生成配置接入 `export-pdf`/`export-docx` 后输出中文文件。
- 许可证测试：生成目录必须包含 LICENSE/NOTICE。
- 契约测试：CLI 输出、退出码和 JSON 结果格式稳定。
- 不在本 sub 中重复 PDF/DOCX 布局测试；格式转换回归由 FEAT-009/010 负责。

## 10. 发布、兼容与回滚

- `@tap-note/font-tools` 为可选工具包，不作为 editor 或 export-core 的强制依赖。
- 字体预设清单和工具版本分别版本化；升级字体版本必须更新哈希、许可证和兼容性测试。
- 预设资源发生问题时，可通过清单回滚到上一版本，不要求重新发布 export 包。
- CLI 生成的配置应包含工具版本、字体版本和来源 URL，便于复现。
- 生成资源目录使用明确命名空间，例如 `public/fonts/tap-note/<preset>/<version>/`，避免覆盖用户字体。

## 11. 技术风险与待确认事项

- CLI 最终包名是 `@tap-note/font-tools` 还是 `@tap-note/fonts`。
- 是否维护 tap-note 自有 Release Asset，还是只维护官方源清单。
- `@react-pdf/renderer` 在浏览器目标环境中对各字体格式的兼容性需要实测。
- 字体子集化是否在 P1 直接实现，还是仅提供外部 fontTools adapter。
- 是否引入 `fontkit` 作为 Node glyph 检查依赖；当前不锁定。
- 开源字体预设的许可证、Reserved Font Name 和再分发条件需要逐字体复核。
- 远程字体 URL 的 CORS、SRI 和离线 fallback 策略需要在导出包技术方案中统一。
