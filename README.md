# tap-note

基于 BlockNote 的富文本编辑器，支持两种 AI 助手模式（内联写作 + 侧边对话），类似 Notion AI / Cursor Chat 体验。

Bun + Turbo monorepo，React 19 + Tailwind 4 + AI SDK v7 + Hono。

## 环境要求

- [Bun](https://bun.sh/) >= 1.3.14（`packageManager: bun@1.3.14`）
- Node >= 20

## 安装依赖

```bash
bun install
```

如需初始化 `resource/BlockNote` 参考子模块（仅用于阅读源码，不参与构建）：

```bash
bun run submodule:init
```

## 配置环境变量

复制 server-api 的环境变量模板并填写：

```bash
cp apps/server-api/.env.example apps/server-api/.env
```

编辑 `apps/server-api/.env`：

| 变量 | 必填 | 说明 |
|---|---|---|
| `DASHSCOPE_API_KEY` | ✅ | 阿里云百炼（DashScope）API Key |
| `DASHSCOPE_BASE_URL` | | DashScope 自定义 Base URL |
| `GOOGLE_GENERATIVE_AI_API_KEY` | | Google Gemini API Key（配置后启用 google 模型） |
| `GOOGLE_GENERATIVE_BASE_URL` | | Google 自定义 Base URL |
| `JWT_ISSUER` / `JWT_AUDIENCE` / `JWT_VERIFY_KEY` | | JWT 认证配置（未配置时跳过校验，仅开发模式） |
| `PORT` | | 服务端口，默认 `4100` |
| `CORS_ORIGIN` | | 允许跨域来源，默认 `http://localhost:5173` |
| `MODELS_PUBLIC` | | `true` 时 `/api/ai/models` 允许匿名访问，默认 `false` |

限流和上下文预算变量详见 `.env.example` 注释。

## 启动开发

```bash
bun run dev
```

同时启动两个服务：

- **web**（Vite）：http://localhost:5173
- **server-api**（Hono）：http://localhost:4100

Vite 已配置代理，`/api` 请求自动转发到 `http://localhost:4100`。

## 使用流程

访问 http://localhost:5173，默认重定向到 `/inline`。左侧导航提供三个 Demo 路由：

| 路由 | 说明 |
|---|---|
| `/inline` | 内联 AI 助手 — 在编辑器中直接流式写入，支持接受/拒绝 |
| `/chat` | 对话 AI 助手 — 侧边面板对话，离散工具调用，上下文引用 |
| `/both` | 并存模式 — 两种助手同时可用，但同一时刻只能运行一个 AI 任务（互斥） |

### 内联 AI 助手

1. 点击编辑器上方「✨ AI 助手」按钮打开指令面板
2. 输入指令（如「续写一段」），回车发送
3. AI 流式写入内容，完成后点击「接受」或「拒绝」
4. 可随时点击「中止」停止生成

### 对话 AI 助手

1. 点击「💬 对话」按钮打开侧边面板
2. 在面板中输入问题或指令，AI 通过工具调用操作文档
3. 支持引用编辑器中的选区或全文作为上下文

### 模型切换

顶部工具栏提供模型选择器，可切换当前 AI 使用的模型。默认模型为 `dashscope:qwen3.7-plus`。

### 导出

编辑器工具栏提供 DOCX 和 PDF 导出按钮（纯组件产品，刷新后内容丢失属预期行为）。

## AI 模型配置

模型 ID 格式为 `<provider>:<model>`，服务端使用 allowlist 机制，仅允许已列出且对应 provider 已配置的模型，未列出的模型直接拒绝，不回退默认。

当前 allowlist：

| 模型 ID | 标签 | Provider | 多模态 | 备注 |
|---|---|---|---|---|
| `dashscope:qwen3.7-plus` | Qwen 3.7 Plus | DashScope | | 默认模型 |
| `dashscope:qwen3.7-max` | Qwen 3.7 Max | DashScope | | |
| `dashscope:qwen3-vl-flash` | Qwen3 VL Flash | DashScope | ✅ | |
| `google:gemini-2.0-flash` | Gemini 2.0 Flash | Google | ✅ | 需配置 `GOOGLE_GENERATIVE_AI_API_KEY` |
| `google:gemini-3-flash-preview` | Gemini 3 Flash Preview | Google | ✅ | 需配置 `GOOGLE_GENERATIVE_AI_API_KEY` |

添加新模型：

1. 在 `apps/server-api/src/modules/ai/providers/allowlist.ts` 的 `STATIC_MODELS` 中添加模型元数据
2. 在 `apps/server-api/src/modules/ai/providers/index.ts` 的 `createLLMProvider` 中注册模型实例
3. 如需新 provider，在 `.env.example` 中补充对应 API Key 变量

## 字体配置

### 编辑器 UI 字体

编辑器界面使用 Inter Variable 字体（`@fontsource-variable/inter`），在 `packages/ui/src/styles/globals.css` 中配置：

```css
@import "@fontsource-variable/inter";

@theme inline {
  --font-sans: 'Inter Variable', sans-serif;
}
```

替换字体：修改 `--font-sans` 变量值，并替换对应的 `@import` 字体包。

### PDF 导出字体

PDF 导出使用 Noto Sans SC 字体文件，位于 `apps/web/public/fonts/`：

- `NotoSansSC-Regular.woff`（weight 400）
- `NotoSansSC-Bold.woff`（weight 700）
- `NotoSansSC-Black.woff`（weight 900）

在 `apps/web/src/components/export-button.tsx` 中通过 `fontConfig` 和 `fontBuffers` 注入。替换字体时修改 `FONT_FAMILY`、`FONT_URLS` 和 `fontConfig` 配置。

## 常用命令

```bash
bun run dev              # 启动开发（web :5173 + server-api :4100）
bun run build            # 构建所有包
bun run lint             # ESLint 检查
bun run typecheck        # TypeScript 类型检查
bun run test             # 运行测试（bun test）
bun run format           # Prettier 格式化
bun run docs             # 启动文档服务（:8881）
```

单包操作：`bun run typecheck --filter=@tap-note/ai-core`
单测试文件：`bun test path/to/file.test.ts`（在包目录下运行）

## Monorepo 结构

| 路径 | 包名 | 职责 |
|---|---|---|
| `apps/web` | `web` | Vite + React 19 参考 Demo |
| `apps/server-api` | `@workspace/server-api` | Hono AI 网关 |
| `packages/tap-note-editor` | `@tap-note/editor` | BlockNote shadcn 封装 |
| `packages/tap-note-ai-core` | `@tap-note/ai-core` | 共享层：BlockOperation、DocumentStateBuilder、transport、busy 状态 |
| `packages/tap-note-ai-inline` | `@tap-note/ai-inline` | 内联 AI：流式写入 + 接受/拒绝 |
| `packages/tap-note-ai-chat` | `@tap-note/ai-chat` | 对话 AI：侧边面板、工具调用、上下文引用 |
| `packages/tap-note-export-core` | `@tap-note/export-core` | 导出核心逻辑 |
| `packages/tap-note-export-docx` | `@tap-note/export-docx` | DOCX 导出 |
| `packages/tap-note-export-pdf` | `@tap-note/export-pdf` | PDF 导出 |
| `packages/ui` | `@workspace/ui` | shadcn 组件（base-ui + tailwind-merge） |
| `resource/BlockNote` | git submodule | 参考源码，不参与构建 |
