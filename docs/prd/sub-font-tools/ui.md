# UI 规范：字体集成工具

## 0. 文档信息

- Sub ID：SUB-001
- 所属产品：tap-note
- 总 PRD：`docs/prd/main-prd.md`
- Sub PRD：`docs/prd/sub-font-tools/prd.md`
- 文档版本：v1
- 文档状态：草稿

## 1. UI 范围说明

本分支不涉及独立 Web 用户界面，不创建字体管理后台，也不在编辑器中增加字体市场页面。

本分支的主要用户界面是：

- CLI 命令行输出；
- 配置文件生成结果；
- 集成方在自己的构建流程中看到的错误和 warning；
- 参考应用中可选的字体配置说明和导出状态提示。

PDF/DOCX 的导出按钮、导出进度和文件下载 UI 属于 FEAT-009/010 或参考应用，不属于本 sub 的独立 UI 功能。

## 2. 信息架构

### 2.1 CLI 命令结构

```text
tap-note-fonts
├── list
├── add <preset>
├── check
├── generate-config
└── subset
```

### 2.2 配置结果结构

```text
集成方项目/
├── public/fonts/tap-note/<preset>/<version>/
│   ├── *.ttf
│   ├── LICENSE.txt
│   └── NOTICE.txt
└── tap-note-fonts.generated.ts
```

## 3. CLI 交互规范

### 3.1 成功输出

成功输出应包含:

- 字体预设名称；
- 字体版本；
- 下载来源；
- 文件写入目录；
- SHA-256 校验结果；
- 许可证文件位置；
- 下一步配置示例。

示例:

```text
Installed Noto Sans SC 2.004
Source: pinned release asset
Files: 2
SHA-256: verified
License: OFL-1.1 copied
Config: ./tap-note-fonts.generated.ts

Next:
  import { tapNoteNotoSansSc } from "./tap-note-fonts.generated"
```

### 3.2 Warning

warning 必须说明:

- 哪个文件或字符存在问题；
- 是否会影响 PDF/DOCX；
- 如何修复；
- 是否可以使用 `--strict` 转为失败。

示例:

```text
Warning: 3 requested Chinese characters are missing.
PDF export may render tofu glyphs: 龘 𠮷 𪚥
Use another font, provide a fallback font, or run with --strict.
```

### 3.3 Error

error 必须包含:

- 稳定错误码；
- 可读错误消息；
- 失败路径或 preset；
- 可执行修复建议。

建议错误码:

```text
FONT_SOURCE_NOT_FOUND
FONT_DOWNLOAD_FAILED
FONT_HASH_MISMATCH
FONT_LICENSE_MISSING
FONT_FORMAT_UNSUPPORTED
FONT_GLYPH_MISSING
FONT_CONFIG_INVALID
```

## 4. 参考应用中的字体配置体验

参考应用可以在导出 demo 页面提供轻量配置区:

- 当前字体预设名称和版本；
- PDF 字体状态：已配置/未配置/覆盖不足；
- DOCX East Asia 字体名称；
- 导出前 warning 数量；
- 「查看安装命令」按钮；
- 「复制配置示例」按钮。

不提供在线字体下载市场，不在浏览器中隐式下载字体。用户执行 CLI 安装后，demo 通过显式配置加载字体。

## 5. 空状态、错误和反馈

### 未配置字体

```text
尚未配置中文 PDF 字体
请使用 @tap-note/font-tools 安装字体，或传入集成方自己的字体文件。
```

### 中文覆盖不足

```text
当前字体缺少部分字符，PDF 可能显示方框。
建议更换字体或减少文档中的未覆盖字符。
```

### 字体加载失败

```text
字体加载失败，PDF 导出已取消。
请检查字体路径、CORS 配置或服务端字体文件权限。
```

### DOCX 字体提示

```text
DOCX 已写入 eastAsia 字体配置。
目标设备需要安装该字体，否则 Word 可能自动替换字体。
```

## 6. 国际化、可访问性与响应式

- CLI 默认使用中文可读信息，同时保留英文错误码和英文机器输出模式。
- 提供 `--json` 输出，便于 CI 和脚本消费，不依赖自然语言解析。
- 参考应用的字体状态提示使用 `role="status"` 或等价可访问性语义。
- warning/error 不仅使用颜色区分，必须包含图标或文本标签。
- 字体配置区在窄屏下允许折叠，不影响编辑器主区域。
- 路径、命令和哈希值使用等宽字体展示并支持复制。

## 7. UI 验收标准

- CLI 成功、warning、error 三类输出有明确区别。
- 失败输出包含稳定错误码和可执行修复建议。
- `--json` 输出结构稳定，能够被 CI 使用。
- 参考 demo 未配置中文字体时，用户能看懂问题和安装方式。
- 字体缺失不会表现为无提示的乱码 PDF。
- DOCX 字体未安装提示不会阻止已经成功生成的 DOCX 下载。
- 状态提示同时满足键盘操作、屏幕阅读器和非颜色辨识要求。

## 8. 交互参考与来源

| 参考 | 来源 | 可借鉴点 | 限制 |
|---|---|---|---|
| `@react-pdf/renderer` Font API | https://github.com/diegomura/react-pdf | 字体注册、变体和资源加载错误的表达方式 | 不提供中文字体资源管理产品 |
| BlockNote `xl-pdf-exporter` | `resource/BlockNote/packages/xl-pdf-exporter/src/pdf/pdfExporter.tsx` | 导出前注册字体、emoji source 和默认字体族 | GPL-3.0 OR PROPRIETARY，只参考不复制 |
| BlockNote `xl-docx-exporter` | `resource/BlockNote/packages/xl-docx-exporter/src/docx/` | DOCX 模板和字体 mapping 的组织方式 | GPL-3.0 OR PROPRIETARY，只参考不复制 |
| fontTools subset CLI | https://fonttools.readthedocs.io/en/latest/subset/index.html | 子集化命令、Unicode 输入、输出格式和错误反馈 | Python 工具，不作为浏览器 UI 依赖 |

## 9. 待确认事项

- CLI 是否需要交互式向导模式，还是只提供参数化命令。
- 参考 demo 是否在 P1 展示字体状态，还是只提供文档和命令行工具。
- 默认 CLI 输出语言是否跟随系统语言，还是固定中文并提供 `--locale`。
- 是否需要提供独立的字体配置可视化页面；当前建议不做。
