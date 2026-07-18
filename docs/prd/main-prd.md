# 产品需求文档：tap-note

## 0. 文档信息

- 产品名称：tap-note
- 文档版本：v8
- 文档状态：草稿
- 创建日期：2026-07-17
- 最后更新：2026-07-17
- 输出路径：`docs/prd/main-prd.md`
- 需求来源：用户初始构想（基于 BlockNote 开发支持 AI 助手的在线文档编辑器）+ 技术方案讨论结论（v2：AI 助手拆分为内联/对话两类 + 共享核心；v3：并发互斥、上下文体积策略、纯组件定位、demo 多路由；v4：导出提级 P1、体积阈值确认、client-side tools 不限危险操作；v5：导出包定义、集成方字体配置与字体脚本工具方向；v6：正式 Sub 分组与 FEAT 唯一归属；v7：安全鉴权、操作一致性、导出边界与授权合规订正；v8：参考代码规则与 shadcn 组件复用策略）

## 1. 产品背景

当前市面上的块状富文本编辑器（如 Notion）普遍内置 AI 写作能力，但开源、可自托管、可二次开发的同类方案稀缺。BlockNote 是一个基于 Prosemirror/Tiptap 的块状富文本编辑器，提供了 Notion 风格的编辑体验与可扩展的插件体系，并且官方提供了 `@blocknote/xl-ai` AI 集成层。但 `xl-ai` 与 `xl-ai-server` 采用 **GPL-3.0 OR 专有** 双授权：直接 fork 其源码会强制衍生作品以 GPL 开源，或需购买商业授权，难以满足独立发布、商用友好的诉求。

tap-note 要解决的问题：

1. 提供一个**授权干净、可独立发布**的 BlockNote 风格富文本编辑器与两类 AI 助手（编辑器内联写作 + 侧边对话）组件包，让开发者无需承担 GPL 合规成本即可集成到自有产品；
2. 提供**多模型、可自托管**的 AI 后端，API Key 不暴露到客户端，支持国产大模型（DashScope/Qwen）与 Google Gemini；
3. 提供一个**端到端参考应用**，演示编辑器 + AI 助手 + 后端的完整链路，可直接作为产品 demo 或二次开发起点；
4. 在 AI 写作体验上对标 Notion 式的**逐块流式写入 + 接受/拒绝**工作流（内联助手），并额外提供 Cursor/Copilot Chat 式**侧边对话助手**，可引用当前选区/文档作为上下文，通过离散工具调用修改文档。

### 项目现状（AI 推断 + 代码核查结论）

- 当前工作区为 Bun + Turbo monorepo（React 19 + Tailwind 4 + shadcn base-nova + `@workspace/ui`）。
- `apps/web` 已是 Vite + React 模板，`App.tsx` 仍是占位内容。
- `apps/server-api` 仅有 `src/` 目录且**缺少 `package.json`**，存在半成品脚手架：`config.ts`（zod 校验 DashScope/Google 环境变量）、`modules/ai/providers/providers.ts`（统一 Provider，含 qwen-plus/max/qwen3-vl-flash、gemini）、`modules/ai/agents/agent-approval`（基于 AI SDK v6 `ToolLoopAgent` + `createAgentUIStreamResponse` 的审批代理示例）、`utils/response.ts`（`success`/`fail` 统一响应）、`types/`（`AppEnv`、`ApiResponse`）。其中 `create-approval-agent.ts` 引用的 `defaultAgentModel` **未从 providers 导出**（脚手架未完成）。
- `packages/tap-note-editor` 为空目录；`packages/tap-note-ai-core`、`tap-note-ai-inline`、`tap-note-ai-chat` 尚不存在。
- `packages/ui` 为 shadcn 组件包（`@workspace/ui`，base-ui + tailwind-merge@3）。
- `resource/BlockNote` 为 git submodule（仅作参考，不参与构建），`sync:resource` 脚本已就绪。BlockNote 当前版本 `0.51.4`，其 `xl-ai` 基于 AI SDK v6。

## 2. 产品目标

| 维度 | 目标 | 成功标准 |
|---|---|---|
| 编辑器 | 提供开箱即用的 BlockNote 风格块状编辑器组件 | `packages/tap-note-editor` 可作为独立 npm 包被任意 React 19 应用引入，5 分钟内渲染可编辑文档 |
| AI 内联助手 | 提供授权干净的 Notion 式编辑器内联 AI 写作能力（逐块流式写入 + 接受/拒绝） | `packages/tap-note-ai-inline` 不依赖 `@blocknote/xl-ai` 源码；AI 可在文档中流式插入/修改/删除块，用户可一键接受或回退 |
| AI 对话助手 | 提供 Cursor/Copilot Chat 式侧边对话助手，可引用选区/文档上下文，通过离散工具调用改文档 | `packages/tap-note-ai-chat` 提供侧边聊天面板，AI 每次工具调用对应单个 BlockOperation，可在聊天气泡展示并作用于编辑器 |
| AI 后端 | 提供可自托管、Key 不外泄、多模型可切换的 AI 网关 | `apps/server-api` 暴露内联 streamText、对话 chat、模型列表 API；前端从未持有任何 LLM API Key |
| 文档导出 | P1 提供可独立集成的 PDF/DOCX 导出能力，P2 规划 Markdown/HTML 导出，支持中文字体由集成方配置 | `@tap-note/export-pdf`、`@tap-note/export-docx` 在浏览器返回 Blob、在 Node.js/Hono 返回 Uint8Array/Response；PDF 中文在配置字体后可稳定生成，DOCX 正确设置东亚字体 |
| 参考应用 | 提供端到端可运行 demo | `bun dev` 同时启动 web 与 server-api，浏览器内可完成内联写作 + 侧边对话 + 模型切换全流程 |
| 授权合规 | 发布包不触发 GPL 义务 | `tap-note-editor`、`tap-note-ai-core`、`tap-note-ai-inline`、`tap-note-ai-chat` 的 `dependencies` 中不含任何 GPL/专有 BlockNote 包，仅依赖 MPL-2.0 与宽松授权组件 |
| 现代化 | 使用经官方文档和最小端到端示例验证的稳定依赖组合 | 锁文件记录已验证的 AI SDK、BlockNote、Hono、React、Tailwind 版本；升级前验证流式工具调用与客户端执行链路 |

## 3. 目标用户与角色

| 角色 | 描述 | 核心诉求 |
|---|---|---|
| 集成开发者 | 在自有 React 应用中嵌入文档编辑与 AI 能力的前端/全栈工程师 | 拿到 npm 包即可用，授权干净可商用，文档与示例完整，可自定义模型与后端地址 |
| 终端创作者 | 使用参考应用（或基于其二次开发的产品）撰写文档的人 | Notion 式流畅编辑；内联 AI 帮我续写/改写/翻译/总结（可接受/拒绝）；侧边对话助手可引用我选中的内容或整篇文档，边聊边改 |
| 自托管运维者 | 在私有环境部署 server-api 的运维/后端工程师 | 配置环境变量即可启动，多模型可切换，日志可观测，Key 安全 |

> 说明：tap-note 同时面向「开发者（SDK 集成）」与「终端创作者（参考应用）」两类用户，前者通过发布包触达，后者通过参考应用触达。终端创作者不直接消费 npm 包，而是使用基于包构建的应用。此双角色定位为 AI 基于需求来源推断，记录于「假设与待确认事项」。

## 4. 核心业务流程

### 4.1 编辑流程（无 AI）

```
创作者打开参考应用
  → <TapNoteEditor> 渲染初始内容
  → 块状编辑（回车新建块、/ 唤起 slash 菜单、拖拽重排、缩进嵌套、格式工具栏）
  → 内容驻留编辑器内存（tap-note 为纯组件产品，不内置持久化，由集成方自行实现）
```

### 4.2 内联 AI 写作流程（FEAT-003）

```
创作者在空块输入 /ai 或选中已有文本点击 AI 按钮
  → AIMenu 浮现，输入指令（如「续写一段关于开源软件的段落」）
  → tap-note-ai-inline 经 ai-core 构建请求：documentState（受影响块快照）+ 用户消息 + documentRevision
  → DefaultChatTransport POST /api/ai/editor/streamText
  → server-api 注入 documentState 到消息、调用 streamText、模型流式返回 BlockOperation 工具调用
  → 以经验证版本的 AI SDK UIMessageStream helper 返回流式响应
  → client StreamToolExecutor 增量解析 partial 工具调用、校验、去重
  → 经 @handlewithcare/prosemirror-suggest-changes 以可回退 transaction 应用到文档
  → 文档逐块实时变化（AI 正在写作态）
  → 创作者点击「接受」或「拒绝」/ Esc 取消
  → 接受：合并建议到正式文档；拒绝：回退到 AI 写作前状态
```

### 4.3 对话 AI 流程（FEAT-004，含上下文引用）

```
创作者打开侧边 TapNoteChatPanel
  → 可选「引用上下文」：当前选区 / 当前文档全文（ai-core 序列化为 documentState）
  → 输入消息（如「把引用的这段改成要点列表」或「帮我给全文加一个小标题」）
  → useChat(transport=指向 /api/ai/chat) 发送 messages + documentState + documentRevision
  → server-api 使用版本化、服务端持有的 ChatToolSet 调用 streamText（只声明工具，不 execute），返回 UIMessageStream
  → LLM 返回离散 tool call（每次单个 BlockOperation：insertBlock/updateBlock/deleteBlock/...）
  → client-side tool 的 execute 在浏览器内调用 editor.insertBlocks/updateBlock/removeBlocks 作用于编辑器
  → 客户端校验工具输入与 documentRevision，执行后以 toolCallId 回传 tool result；聊天面板展示「已插入块」「已更新块」等气泡，支持多轮
  → 前期不设审批开关：工具直接执行；P2 候选加 needsApproval 审批
```

> 内联（4.2）与对话（4.3）的差异：内联是单轮指令→流式写入文档（用户接受/拒绝）；对话是多轮对话→离散工具调用（每条 tool call 单操作，在聊天里展示）。两者共享 `@tap-note/ai-core` 的 BlockOperation schema 与 DocumentStateBuilder，但写入机制不同。

### 4.4 上下文体积分层处理

```
引用选区（用户显式选择）：
  → ai-core 估算选区 token
  → ≤ 软上限（默认 4K）→ 原样发送
  → > 软上限 → 前端拦截，提示「选区过大（约 N 字），建议减少选区或改用『引用全文+指令』」，不发请求

引用全文（引用全文意图，不绕过预算）：
  → ai-core 估算全文 token
  → ≤ 预算（默认 8K）→ 发送完整文档快照
  → > 预算 且 ≤ 2× 预算 → 截断到预算，附 `[文档已截断：共 N 块，此处含前 M 块]`
  → > 2× 预算 → 改发结构化大纲（标题块 + 各块首段摘要）
  → LLM 如需更多 → 仅当用户已选择「引用全文」并允许按需读取时，调用受块数与 token 上限约束的 client-side tool getDocumentSnapshot

不引用：
  → 不发送 documentState，也不向模型暴露 getDocumentSnapshot
```

### 4.5 模型切换流程

```
前端启动 → GET /api/ai/models → 渲染模型下拉
  → transport 通过集成方提供的 `getAuthHeaders` 或同站会话附带短期 JWT，不在 SDK 中保存凭据
  → 创作者选择模型
  → transport body 携带所选 model
  → server-api resolveModel(modelId) 路由到对应 Provider
```

### 4.6 AI 并发互斥流程

```
任意助手（内联 FEAT-003 或对话 FEAT-004）进入「进行中」态
  → 同一编辑器会话注入的 ai-core AI busy 状态进入进行中（共享单一状态）
  → 另一助手尝试触发 → 前端禁用其入口（按钮/slash 项/chat 输入框置灰）
  → 进行中的助手完成/中止/拒绝 → 释放 busy → 另一助手可触发
  → 状态由 ai-core 统一管理；每个编辑器会话创建一个实例并传给 editor 与两个助手，完成/中止/异常/组件卸载均释放
```

### 4.7 自托管部署流程

```
运维克隆仓库 → 配置 .env（DASHSCOPE_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY / JWT_ISSUER / JWT_AUDIENCE / JWT_VERIFY_KEY / PORT / CORS_ORIGIN）
  → bun install → bun dev（或 bun run build + start）
  → server-api 监听端口，生产环境校验由集成方 BFF 或外部身份提供方签发的短期 JWT
  → 前端指向自托管 baseUrl
```

### 4.8 文档导出流程（FEAT-008~010、FEAT-012）

```
集成方或创作者触发导出 PDF/DOCX/Markdown/HTML
  → 获取 BlockNote 文档快照（不要求传入编辑器实例）
  → export-core 校验 schema、资源和导出选项
  → 读取集成方提供的字体配置、模板和受限资源解析器（协议、来源、大小和超时受控）
  → 对应格式 exporter 转换文档
  → 浏览器返回 Blob 并触发下载，或 Node.js/Hono 返回 Uint8Array/Response
  → 未知 block、字体加载失败、图片失败按配置返回 error 或 warning
```

### 4.9 导出字体配置流程

```
集成方选择中文字体来源
  → 使用本地文件、静态资源 URL、ArrayBuffer 或服务端系统字体
  → 运行字体检查/转换/裁剪脚本（后续工具）生成可注册资源
  → 在 export-pdf 注册 CJK 字体，在 export-docx 设置 eastAsia 字体名称
  → 导出前校验字体是否存在；缺失时提示，不静默生成不完整文件
```

## 5. 产品范围

### 5.1 产品包含

- 块状富文本编辑器组件包（`packages/tap-note-editor`，`@tap-note/editor`），封装 BlockNote shadcn 皮肤，提供开箱即用编辑体验。
- AI 共享核心包（`packages/tap-note-ai-core`，`@tap-note/ai-core`）：BlockOperation schema、DocumentStateBuilder、applyOperationsToEditor、transport 工厂、zh-CN 字典基础，供内联与对话助手复用。
- AI 内联助手包（`packages/tap-note-ai-inline`，`@tap-note/ai-inline`）：编辑器内联 AI，参考 `@blocknote/xl-ai` 思路**自行重写**（不引入其源码），实现逐块流式写入 + 接受/拒绝工作流。
- AI 对话助手包（`packages/tap-note-ai-chat`，`@tap-note/ai-chat`）：侧边 Cursor/Copilot Chat 式对话面板，支持引用当前选区/文档作为上下文，通过经验证版本的 AI SDK client-side tools 以离散工具调用修改编辑器文档。
- AI 后端服务（`apps/server-api`，`@workspace/server-api`）：基于 Hono + 经验证的 AI SDK，提供内联 streamText、对话 chat、模型列表、可选透明代理，并保留现有审批代理作为独立示例。
- 端到端参考应用（`apps/web`）：带侧边菜单（sidemenu）的多路由 demo，含「内联助手 demo」「对话助手 demo」「并存 demo」等独立路由，演示编辑器 + 助手 + 后端完整链路与模型切换。
- 文档导出组件包：P1 提供导出核心、PDF、DOCX 能力；P2 规划 Markdown、HTML 能力。PDF/DOCX 与 Markdown/HTML 的功能归属分别由 FEAT-009/010/012 定义；字体由集成方配置，不在基础包中强制捆绑 CJK 字体。
- 中文本地化（zh-CN）作为默认语言。
- 开发者集成文档与发布配置（P1）。

### 5.2 产品不包含

- **不包含**对 `@blocknote/xl-ai` / `@blocknote/xl-ai-server` 源码的 fork 或复制（授权规避）；ai-inline 仅参考其实现思路自行重写。
- **不包含**协作编辑（Yjs 实时协同）——列入 P2 候选，MVP 不交付。
- **不包含**文档持久化（存储/历史版本/草稿）——tap-note 定位为**纯组件产品**，不内置任何持久化能力，持久化由集成方自行实现；demo 应用刷新即丢内容属预期行为。
- **不包含**导出为 ODT/Email 等 XL 格式——列入 P2 候选；PDF/DOCX 属 P1，Markdown/HTML 由 FEAT-012 作为 P2 后续规划（见 §15）。
- **不包含**用户账号体系与多租户——server-api 不签发或管理终端用户账号；生产身份由集成方 BFF 或外部身份提供方负责。
- **不包含**移动端/小程序适配——仅面向现代桌面浏览器；本项目不涉及 Taro/小程序规范。
- **不包含**对话助手的工具执行审批开关——前期工具直接执行；`needsApproval` 审批开关列入 P2 候选。
- **不包含**同一编辑器会话内内联与对话助手的并行执行——采用会话级 AI 互斥（见 §4.6），任意 AI 进行中时另一助手不可触发。
- **不包含**审批代理（agent-approval）与编辑器 AI 的集成——审批代理作为独立 agentic 示例保留，不进入内联/对话主流程。

## 6. 需求分支地图

| Sub ID | 分支名称 | 目录 | 说明 | 优先级 |
|---|---|---|---|---|
| SUB-001 | 字体集成工具 | `sub-font-tools` | 字体预设、安装、校验、配置生成和子集化工具；不负责文件格式转换 | P1 |
| SUB-002 | 编辑器体验 | `sub-editor-experience` | BlockNote 编辑器组件与可路由 demo 体验 | P0 |
| SUB-003 | AI 助手 | `sub-ai-assistant` | AI 共享核心、内联写作和侧边对话助手 | P0 |
| SUB-004 | AI 服务平台 | `sub-ai-platform` | Hono AI 网关、模型路由、鉴权和流式 API | P0 |
| SUB-005 | 文档导出 | `sub-document-export` | 文档快照、PDF/DOCX/Markdown/HTML 导出能力 | P1 |
| SUB-006 | 开发者生态 | `sub-developer-ecosystem` | 包发布、集成指南、API 契约和开发者文档 | P1 |

### Sub 边界

- **SUB-001 字体集成工具**只生成和校验字体资源/配置，供 SUB-005 使用；不生成 PDF/DOCX。
- **SUB-002 编辑器体验**拥有编辑器和 demo UI，不拥有 AI 协议、AI 后端或导出格式转换。
- **SUB-003 AI 助手**拥有客户端 AI 交互与文档操作协议，调用 SUB-004 服务。
- **SUB-004 AI 服务平台**拥有模型、认证和 API 运行时，不包含客户端编辑器 UI。
- **SUB-005 文档导出**拥有格式转换和文件输出；字体由 SUB-001 提供，编辑器内容由 SUB-002 提供。
- **SUB-006 开发者生态**只组织发布与文档，不拥有运行时业务能力。

## 7. 功能模块地图

| 功能 ID | 功能名称 | 所属 Sub | 目录 | 说明 | 优先级 | 依赖 |
|---|---|---|---|---|---|---|
| FEAT-001 | 富文本编辑器 | SUB-002 | `sub-editor-experience/feat-rich-text-editor` | BlockNote shadcn 封装的可发布编辑器组件包 | P0 | - |
| FEAT-002 | AI 共享核心 | SUB-003 | `sub-ai-assistant/feat-ai-core` | BlockOperation、DocumentStateBuilder、applier 和 transport 工厂 | P0 | FEAT-001 |
| FEAT-003 | AI 内联助手 | SUB-003 | `sub-ai-assistant/feat-ai-inline` | 编辑器内联 AI，逐块流式写入与接受/拒绝 | P0 | FEAT-001, FEAT-002, FEAT-005 |
| FEAT-004 | AI 对话助手 | SUB-003 | `sub-ai-assistant/feat-ai-chat` | 侧边对话、上下文引用和离散 client-side tools | P0 | FEAT-001, FEAT-002, FEAT-005 |
| FEAT-005 | AI 后端服务 | SUB-004 | `sub-ai-platform/feat-ai-backend` | Hono + ai-sdk，editor/chat/模型 API | P0 | - |
| FEAT-006 | 参考应用 | SUB-002 | `sub-editor-experience/feat-reference-app` | 带 sidemenu 的多路由 demo（内联/对话/并存） | P0 | FEAT-001~005 |
| FEAT-007 | 开发者 SDK 与文档 | SUB-006 | `sub-developer-ecosystem/feat-developer-sdk` | 发布包配置、集成指南、API 契约与 P1 导出集成 | P1 | FEAT-001~006, FEAT-008~011 |
| FEAT-008 | 文档导出核心 | SUB-005 | `sub-document-export/feat-document-export-core` | 文档快照、导出结果、字体配置、资源解析和错误契约 | P1 | FEAT-001 |
| FEAT-009 | PDF 导出 | SUB-005 | `sub-document-export/feat-document-export-pdf` | 自有 PDF exporter，中文字体由集成方注入 | P1 | FEAT-001, FEAT-008, FEAT-011 |
| FEAT-010 | DOCX 导出 | SUB-005 | `sub-document-export/feat-document-export-docx` | 自有 DOCX exporter，东亚字体配置与模板 | P1 | FEAT-001, FEAT-008, FEAT-011 |
| FEAT-011 | 字体集成工具 | SUB-001 | `sub-font-tools/feat-font-integration-tools` | 字体预设、固定版本下载、校验、配置生成与子集化脚本 | P1 | FEAT-008 |
| FEAT-012 | Markdown 与 HTML 导出 | SUB-005 | `sub-document-export/feat-markdown-html-export` | 独立的 Markdown/HTML 映射、净化与输出能力 | P2 | FEAT-001, FEAT-008 |

> v6 分组说明：新增 6 个正式 Sub 和 FEAT-011。原 FEAT-001~010 的 ID 和功能名称保持不变，仅补充唯一所属 Sub 与嵌套目录路径；字体工具已由用户确认作为独立分支，因此新增 FEAT-011。`feat-*` 目录尚未创建，后续由 `/oc-prd-feat` 负责。

## 8. 功能模块说明

### FEAT-001：富文本编辑器

- 所属 Sub：SUB-002 编辑器体验
- 功能目标：将 `@blocknote/core` + `@blocknote/react` + `@blocknote/shadcn`（均 MPL-2.0）封装为开箱即用的 `@tap-note/editor` 包，提供 `TapNoteEditor` 组件与 `useCreateTapNoteEditor` hook，统一处理初始内容、主题、slash 菜单、格式工具栏默认装配。
- 核心场景：集成开发者 `<TapNoteEditor initialContent={...} />` 即可获得 Notion 风格编辑体验；终端创作者在参考应用中直接使用。
- 输入与输出：输入 `initialContent`（BlockNote blocks JSON）、可选 `inlineAssistant`（来自 FEAT-003）、可选 `chatAssistant`（来自 FEAT-004，用于侧边面板挂载）、可选 `editable`、`theme`；输出受控/非受控编辑器实例与文档变更回调。
- 依赖：`@blocknote/core@0.51.4`、`@blocknote/react@0.51.4`、`@blocknote/shadcn@0.51.4`；peerDep `react@^19`、`tailwindcss@^4`。
- 工程边界：包名 `@tap-note/editor`，位于 `packages/tap-note-editor`，可独立发布；样式需与 `@workspace/ui`（base-ui + tailwind-merge@3）的作用域隔离（BlockNote shadcn 自带 radix + tailwind-merge@2），记录为待确认项。

### FEAT-002：AI 共享核心

- 所属 Sub：SUB-003 AI 助手
- 功能目标：提供 `@tap-note/ai-core` 包，集中两类助手共享的协议、schema、执行器与 transport 工厂，避免内联与对话包重复实现，保证两者写入文档的语义一致。
- 核心场景：FEAT-003 内联助手与 FEAT-004 对话助手都通过 ai-core 序列化文档状态、定义 BlockOperation、并把操作应用到编辑器；集成开发者也可直接用 ai-core 自定义助手。
- 输入与输出：
  - `BlockOperation` Zod schema + 类型：`insertBlock | updateBlock | deleteBlock | replaceBlocks | moveBlock`
  - `DocumentStateBuilder`：把编辑器受影响块（含选区）序列化为 `{ format: "blocks-json", schemaVersion, documentRevision, blocks, selection? }`
  - `injectDocumentStateMessages(messages, documentState)`：把文档状态注入 AI 消息
  - `applyOperationsToEditor(editor, operations)`：经 `@handlewithcare/prosemirror-suggest-changes` 的 `suggestChanges`/`applySuggestions`/`revertSuggestions` 实现可回退应用
  - `createServerTransport({ baseUrl, model })` / `createProxyTransport(...)`：transport 工厂
  - `createAIBusyState()`：编辑器会话级 AI 互斥状态；由集成方或 `TapNoteEditor` 每个会话创建一个实例并注入内联与对话助手，任一 AI 进行中时另一助手入口禁用（见 §4.6）
  - `estimateTokens(text)` / 上下文体积分层处理（选区软上限、全文截断/大纲，见 §4.4）
  - zh-CN 字典基础、共享类型
- 依赖：`@blocknote/core@0.51.4`（MPL）、`@handlewithcare/prosemirror-suggest-changes@0.1.8`（独立第三方）、`prosemirror-{state,view,model,transform}`、经验证并锁定的 AI SDK。
- 工程边界：包名 `@tap-note/ai-core`，位于 `packages/tap-note-ai-core`；`dependencies` 不含 `@blocknote/xl-ai`。

### FEAT-003：AI 内联助手

- 所属 Sub：SUB-003 AI 助手
- 功能目标：提供 `@tap-note/ai-inline` 包，参考 `@blocknote/xl-ai` 的实现思路**自行重写**（不引入其源码，规避 GPL），实现编辑器内联 Notion 式逐块流式写入 + 接受/拒绝工作流。
- 核心场景：创作者 `/ai` 唤起 AIMenu 输入指令，或选中文本点 AI 按钮；AI 流式将 BlockOperation（来自 FEAT-002）应用到文档（可回退）；用户接受/拒绝/中止/重试。
- 输入与输出：输入 `transport`（来自 ai-core）、可选 `streamToolsProvider`、`documentStateBuilder`、`model`；输出 BlockNote `AIExtension` 等价扩展 `TapNoteAIInlineExtension`、`AIMenuController`、`AIToolbarButton`、`getAISlashMenuItems`、zh-CN 字典。
- 关键实现（参考 xl-ai 思路重写）：
  - `TapNoteAIInlineExtension`：基于 `@blocknote/core` 的 `createExtension`，状态机 `user-input → thinking → ai-writing → user-reviewing`（含 `error`）
  - `StreamToolExecutor`：增量解析经验证 AI SDK 的 partial 工具调用、校验、去重（filterNewOrUpdatedOperations）
  - 单个流式工具 `applyDocumentOperations`，输入 `{ operations: BlockOperation[] }`，复用 ai-core 的 applier
- 依赖：`@tap-note/ai-core`、`@blocknote/core@0.51.4`、`@blocknote/react@0.51.4`、经验证并锁定的 AI SDK React/UI 包；peerDep `react@^19`。
- 工程边界：包名 `@tap-note/ai-inline`，位于 `packages/tap-note-ai-inline`；`dependencies` 不含 `@blocknote/xl-ai`（仅阅读 `resource/BlockNote` submodule 作思路参考）。触发前查询当前编辑器会话的 ai-core busy 状态，进行中则禁用入口。

### FEAT-004：AI 对话助手

- 所属 Sub：SUB-003 AI 助手
- 功能目标：提供 `@tap-note/ai-chat` 包，实现 Cursor/Copilot Chat 式侧边对话面板，支持引用当前选区/文档作为上下文，通过经验证版本的 AI SDK client-side tools 以离散工具调用修改编辑器文档。
- 核心场景：创作者打开侧边 `TapNoteChatPanel`，选择「引用选区」或「引用全文」或不引用，输入消息；AI 在多轮对话中每次返回单个 BlockOperation 工具调用，客户端执行后作用于编辑器，聊天气泡展示操作结果。
- 输入与输出：
  - `TapNoteChatPanel` 组件：消息列表、输入框、上下文引用开关（选区/全文/无）、工具调用气泡
  - 基于经验证的 AI SDK React/UI `useChat`，transport 指向 `/api/ai/chat`
  - 服务端持有版本化 `ChatToolSet` schema；客户端只实现同名 tools 的 `execute`（调用 `editor.insertBlocks/updateBlock/removeBlocks`）：`insertBlock` / `updateBlock` / `deleteBlock` / `replaceBlocks` / `moveBlock` / `getDocumentSnapshot`
  - 上下文：选区或全文经 ai-core `DocumentStateBuilder` 序列化为 documentState 随消息发送；体积超限按 §4.4 分层处理（选区软上限提示、全文截断/大纲）
- `getDocumentSnapshot` 工具用途：当用户选择「引用全文」且初始全文被截断时，LLM 可在块数、token 数、允许范围受限的前提下按需拉取更多文档内容；「不引用」模式不暴露此工具
- 写入粒度：**离散 tool call，单次单操作**（每次工具调用对应一个 BlockOperation），在聊天里逐条展示，区别于内联的流式数组。每个操作必须带 `baseDocumentRevision` 与目标块前置条件；校验失败时不执行并返回可重试的冲突结果。
- 审批：前期工具直接执行，不设审批开关；P2 候选加 `needsApproval`。
- 并发：触发前查询当前编辑器会话的 ai-core busy 状态，内联进行中则 chat 输入框置灰；chat 进行中则内联入口禁用。
- 依赖：`@tap-note/ai-core`（复用 schema/类型/DocumentStateBuilder/busy 状态）、经验证并锁定的 AI SDK React/UI 包、`@workspace/ui`（shadcn 聊天组件）；peerDep `react@^19`。
- 工程边界：包名 `@tap-note/ai-chat`，位于 `packages/tap-note-ai-chat`；`dependencies` 不含 `@blocknote/xl-ai`。

### FEAT-012：Markdown 与 HTML 导出

- 所属 Sub：SUB-005 文档导出
- 功能目标：作为 P2 后续能力，提供 `@tap-note/export-markdown` 与 `@tap-note/export-html`，基于 FEAT-008 的快照和错误契约，完成可独立安装的 Markdown/HTML 输出能力。
- 输入与输出：输入统一文档快照、资源解析器与格式选项；输出 `text/markdown` 或 `text/html` 的 Blob/Uint8Array、文件名和 MIME type。
- 映射与降级：P1 支持 paragraph、heading、列表、基础 inline styles、link、table、image；未知/custom block 必须由 `preserve`、`omit-with-warning`、`error` 策略之一处理。
- 安全边界：HTML 输出必须净化危险元素、事件属性与非允许 URL 协议；图片、链接和原始 HTML 均经过显式策略处理，不默认信任文档中的 URL 或 HTML。
- 工程边界：两个包均不得依赖 BlockNote XL exporter；纯文本导出不依赖 `apps/server-api`。

### FEAT-008：文档导出核心

- 所属 Sub：SUB-005 文档导出
- 功能目标：提供 `@tap-note/export-core`，定义 PDF、DOCX、Markdown、HTML 共用的导出输入、输出、字体、资源和错误契约；不依赖具体编辑器 UI，也不强制依赖任何格式 exporter。
- 核心场景：集成方将 BlockNote 文档快照传入导出包，在浏览器得到 `Blob`/`Uint8Array`，或在服务端转换为 HTTP Response；导出包不要求集成方使用 `apps/server-api`。
- 输入与输出：
  - 输入：`PartialBlock[]` 或完整 BlockNote 文档快照、schema、导出选项、字体配置和资源解析器；不要求传入 React 编辑器实例。
  - 输出：统一的 `ExportResult`，至少支持 `Blob`、`Uint8Array`、文件名和 MIME type；提供浏览器下载与 Hono Response 适配。
  - 错误：未知 block、资源加载失败、字体加载失败和输出生成失败必须返回稳定错误类型；支持 warning 与 error 两种策略。
- 字体规则：基础包不捆绑 CJK 字体；提供 `FontSource`/`FontConfig` 接口，允许集成方传入本地路径、URL、ArrayBuffer 或服务端字体；后续提供脚本工具帮助集成方下载、裁剪、转换和注册字体。
- 依赖与授权：包名 `@tap-note/export-core`，目录 `packages/tap-note-export-core`；不得依赖 `@blocknote/xl-pdf-exporter`、`@blocknote/xl-docx-exporter` 或 `@blocknote/xl-multi-column`。

### FEAT-009：PDF 导出

- 所属 Sub：SUB-005 文档导出
- 功能目标：提供 `@tap-note/export-pdf`，参考 BlockNote `xl-pdf-exporter` 的 schema mapping、字体注册、图片/emoji 和页面渲染思路，自行实现授权干净的 PDF 导出能力。
- 核心场景：集成方配置 CJK 字体后，在浏览器或 Node.js 中将文档导出为稳定可打开的 PDF；没有 CJK 字体时必须给出明确 warning/error，不得静默生成乱码。
- 输入与输出：输入 FEAT-008 的统一文档快照、PDF 页面配置、字体配置、图片/emoji 资源解析器、header/footer；输出 PDF Blob/Uint8Array。
- P1 基础能力：paragraph、heading、列表、基础 inline styles、link、table、image；code block、未知 block、multi-column 的降级或支持策略必须显式配置。
- 字体策略：优先使用集成方提供的 CJK 字体，其次使用集成方配置的服务端系统字体；不默认打包 Inter 之外的完整 CJK 字体。提供字体检查与注册脚本，但脚本只生成集成方资源，不把字体写入基础包。
- 工程边界：包名 `@tap-note/export-pdf`，目录 `packages/tap-note-export-pdf`；不得导入 `@blocknote/xl-pdf-exporter`。

### FEAT-010：DOCX 导出

- 所属 Sub：SUB-005 文档导出
- 功能目标：提供 `@tap-note/export-docx`，参考 BlockNote `xl-docx-exporter` 的 OOXML 模板、schema mapping、图片和多列处理思路，自行实现授权干净的 DOCX 导出能力。
- 核心场景：集成方在浏览器或 Node.js 中生成可被 Microsoft Word、LibreOffice 等工具打开的 DOCX；通过配置 `ascii`、`eastAsia`、`hAnsi`、`cs` 字体名称控制中文字体映射。
- 输入与输出：输入 FEAT-008 的统一文档快照、DOCX 字体配置、可选模板、图片资源解析器和文档元数据；输出 DOCX Blob/Uint8Array。
- P1 基础能力：paragraph、heading、列表、基础 inline styles、link、table、image；未支持 block 必须有明确降级或错误策略。
- 字体策略：默认不在 DOCX 中嵌入字体，由集成方保证目标环境存在指定字体；支持集成方提供模板或自定义东亚字体名称；字体配置缺失时给出 warning。
- 工程边界：包名 `@tap-note/export-docx`，目录 `packages/tap-note-export-docx`；不得导入 `@blocknote/xl-docx-exporter` 或 `@blocknote/xl-multi-column`。

### FEAT-011：字体集成工具

- 所属 Sub：SUB-001 字体集成工具
- 功能目标：提供可选 `@tap-note/font-tools`，帮助集成方安装、校验、配置和优化 CJK 字体，降低 PDF/DOCX 中文导出的接入成本；不在基础包中捆绑完整中文字体。
- 核心场景：集成方执行 CLI 安装固定版本字体预设，工具校验 SHA-256、许可证、基础中文覆盖和变体，并生成 `@tap-note/export-pdf`/`@tap-note/export-docx` 可消费的配置。
- 输入与输出：输入字体预设或集成方自有字体、目标目录、字符集和可选字体镜像；输出字体资源、LICENSE/NOTICE、PDF 注册配置、DOCX `eastAsia` 配置、检查报告和可选子集字体。
- 依赖：FEAT-008 的 `FontConfig`/`FontSource` 契约；可选使用 fontTools 作为构建期子集化 adapter；不得作为编辑器、AI 或导出核心的强制运行时依赖。
- 工程边界：包名暂定 `@tap-note/font-tools`，目录 `packages/tap-note-font-tools`；只参考字体工具和 BlockNote exporter 的设计，不复制 GPL 源码；字体许可证由集成方负责。

### FEAT-005：AI 后端服务

- 所属 Sub：SUB-004 AI 服务平台
- 功能目标：基于 Hono + 经验证 AI SDK 的可自托管 AI 网关 `apps/server-api`，提供内联写作 streamText、对话 chat、模型列表、可选透明代理，并保留现有审批代理作为独立示例。
- 核心场景：内联助手 `DefaultChatTransport` 请求 `/api/ai/editor/streamText`；对话助手 `useChat` 请求 `/api/ai/chat`；前端启动时拉 `/api/ai/models` 渲染模型下拉。
- 输入与输出：
  - `POST /api/ai/editor/streamText`：入参 `{ messages, documentState, model }` → 按 schema 校验消息、上下文与大小限制 → 注入 documentState → `streamText`（带服务端持有的自研 streamTool schema） → UIMessageStream。客户端不得提交或覆盖工具定义。
  - `POST /api/ai/chat`：入参 `{ messages, documentState?, documentRevision?, model }` → 按 schema 校验并将 UIMessage 转换为模型消息 → 注入 documentState → `streamText`（服务端仅声明版本化 client-side tools，不 execute） → UIMessageStream；工具结果用 `toolCallId` 回传进入后续消息。
  - `GET /api/ai/models`：返回 `{ models: [{ id, label, provider, capabilities }] }`，仅返回环境变量已配置且服务端 allowlist 中的模型；任何未列出的 modelId 必须拒绝，不得回退到默认模型
  - `POST /api/ai/proxy`（可选）：透明代理，按 provider 注入 Key
  - `POST /api/ai/agents/approval`：保留现有审批代理作独立示例（不进主流程）
- 依赖：Hono、AI SDK、Provider、Zod、pino 的具体版本须在实现前由官方文档与最小 editor/chat 流式工具调用示例共同验证，并锁定在 workspace lockfile 中。
- 工程边界：私有 app（不分发），按 hono 规范补齐 `config/`、`middleware/`、`modules/`、`utils/`、`types/`、`errors/`、`index.ts`；修复 `defaultAgentModel` 导出缺失；所有非流式 endpoint 以 OpenAPI 描述请求、响应、鉴权和错误码，统一响应信封 `{ code, message, data }`（流式端点除外，直接返回 UIMessageStream）。生产端点校验短期 JWT 的签名算法、issuer、audience、exp 与最小权限声明；server-api 不签发终端用户凭据。

### FEAT-006：参考应用

- 所属 Sub：SUB-002 编辑器体验
- 功能目标：端到端可运行 web demo `apps/web`，作为带侧边菜单（sidemenu）的多路由演示站，分别展示内联助手、对话助手、并存等场景，串联编辑器、助手、后端与模型切换，作为产品演示与二次开发起点。
- 核心场景：`bun dev` 启动 web + server-api；通过 sidemenu 在不同路由间切换：
  - `/inline`：仅内联助手 demo（`/ai` 写作 + 接受/拒绝）
  - `/chat`：仅对话助手 demo（侧边面板 + 上下文引用 + 离散工具调用）
  - `/both`：内联 + 对话并存 demo（验证会话级 AI 互斥）
  - 每个路由页可切换模型、transport 模式
- 输入与输出：无外部输入；输出多路由可访问的 demo 站点。
- 依赖：`@tap-note/editor`、`@tap-note/ai-core`、`@tap-note/ai-inline`、`@tap-note/ai-chat`、`@workspace/ui`；Vite dev proxy `/api → http://localhost:3000`。
- 工程边界：保持 Vite + React 19 + Tailwind 4 + shadcn 现状；sidemenu + 路由（React Router 或简单状态切换）；各路由页独立组件；纯组件产品，demo 不实现持久化（刷新丢内容属预期）。

### FEAT-007：开发者 SDK 与文档

- 所属 Sub：SUB-006 开发者生态
- 功能目标：让集成开发者能在自有应用中使用 tap-note，提供发布配置、集成指南、API 参考。
- 核心场景：开发者阅读文档 → `npm install @tap-note/editor @tap-note/ai-core @tap-note/ai-inline @tap-note/ai-chat` → 配置 transport → 渲染编辑器与助手。
- 输入与输出：发布包的 `package.json` exports、README、API 参考。
- 依赖：FEAT-001~006、FEAT-008~011；FEAT-012 实施时补充 Markdown/HTML 集成文档。
- 工程边界：P1 交付；tsup/vite 构建配置、`exports` 字段、类型声明、集成示例。

## 9. 用户故事

- **US-001**（集成开发者）：我希望 `npm install @tap-note/editor` 后，用 3 行代码在 React 应用中渲染一个可编辑文档，且不必担心 GPL 传染。
- **US-002**（集成开发者）：我希望通过 `createTapNoteInlineAssistant({ transport: createServerTransport({ baseUrl }) })` 一行接入内联 AI，AI 写入是逐块流式的，用户可接受/拒绝。
- **US-003**（终端创作者）：我在空块输入 `/ai 续写一段`，AI 流式把内容写进文档，我能看到它逐块生成，完成后点接受保留、点拒绝回退。
- **US-004**（终端创作者）：我选中一段文字，点 AI 按钮，让它「改为要点列表」，AI 流式替换该段为列表，我可以接受或拒绝。
- **US-005**（终端创作者）：我能在下拉里切换 Qwen Plus / Qwen Max / Gemini，切换后下一次 AI 调用使用新模型。
- **US-006**（自托管运维者）：我配置 `DASHSCOPE_API_KEY` 与 JWT 验证配置即可启动 server-api；浏览器永远拿不到 API Key 或长期共享网关 Token。
- **US-007**（自托管运维者）：我希望服务端日志带 requestId，便于排查某次 AI 调用的全链路。
- **US-008**（集成开发者）：当 AI 调用失败时，我希望能在 AIMenu 里点重试，而不必重新输入指令。
- **US-009**（终端创作者）：我打开侧边对话面板，点「引用选区」后输入「把这段翻译成英文」，AI 在聊天里调用工具直接把选区替换为英文，我能看到每条操作的结果气泡。
- **US-010**（终端创作者）：我在对话面板选「引用全文」输入「帮我加一个总结小标题」，AI 调用工具在文档开头插入一个标题块，文档实时更新。
- **US-011**（终端创作者）：我和对话助手多轮交流，先让它「列三个要点」，再让它「把第二点展开成段落」，它能基于上下文连续操作编辑器。
- **US-012**（集成开发者）：我希望对话助手与内联助手能并存于同一编辑器；同一时刻只运行一个 AI 任务，完成、中止或失败后另一助手立即可用。
- **US-013**（集成开发者）：我希望通过字体工具一键安装固定版本的中文字体并生成导出配置，而不是手工处理字体、许可证和 PDF/DOCX 字体映射。

## 10. 全局业务规则

- **授权规则**：所有对外发布的 `@tap-note/*` 包（含 `font-tools`、Markdown/HTML exporter）及其生产依赖闭包、可选依赖、打包产物、vendored/生成代码均不得包含 GPL-3.0、AGPL 或未经授权的专有 BlockNote 代码与依赖；禁止 `@blocknote/xl-ai`、`@blocknote/xl-ai-server`、`@blocknote/xl-pdf-exporter`、`@blocknote/xl-docx-exporter`、`@blocknote/xl-multi-column`。发布前必须生成 SBOM、扫描许可证、审查最终 npm tarball，并随包发布 `LICENSE`、`NOTICE` 与第三方清单。参考 `resource/BlockNote` 时保留独立设计和实现来源记录，不复制受保护表达。`apps/server-api` 作为不分发的私有 app 仍不得把未经授权的 XL exporter 作为发布包的隐式依赖。
- **API 契约规则**：所有业务路由以 `/api/` 前缀开头；非流式响应统一 `{ code: string, message: string, data: unknown }`，成功 `code="SUCCESS"`；流式 AI 端点（`/api/ai/editor/streamText`、`/api/ai/chat`）直接返回 UIMessageStream（AI SDK 协议），不套业务信封。
- **模型规则**：模型 ID 形如 `<provider>:<model>`（如 `dashscope:qwen-plus`）；服务端仅返回环境变量已配置且在 allowlist 中的模型，并拒绝未列出的 modelId，不得回退到默认模型；前端不得持有任何 LLM API Key。
- **工具执行规则**：内联助手（FEAT-003）的 BlockOperation 流式应用在客户端完成；对话助手（FEAT-004）的服务端持有版本化工具 schema，客户端只执行同名 tools，服务端不执行。前期两类助手工具均直接执行，不设审批开关；`needsApproval` 列入 P2 候选。
- **上下文规则**：对话助手支持「引用选区 / 引用全文 / 不引用」三态；引用内容经 ai-core 序列化为带 `schemaVersion` 和 `documentRevision` 的 documentState 随消息发送；内联助手自动取受影响块作上下文。不引用模式不发送文档内容，也不暴露读取文档的工具。
- **上下文体积分层规则**：引用选区设软上限（默认 4K tokens，可配），超限前端拦截并提示减少选区或改用「引用全文+指令」，不静默截断用户显式选择；引用全文在预算内（默认 8K tokens，可配）发送完整快照，超过预算时截断并带 `[文档已截断：共 N 块，此处含前 M 块]` 标记，超大文档（>2× 预算）改发结构化大纲（标题块+首段摘要）。仅在用户选择引用全文且显式允许按需读取时，LLM 才可调用受块数和 token 预算限制的 `getDocumentSnapshot`。token 估算算法由实现阶段确定。
- **导出字体规则**：PDF/DOCX 导出基础包不捆绑完整 CJK 字体，由集成方提供字体来源、字体名称或服务端系统字体；导出包提供字体注册/校验接口，后续提供下载、裁剪、转换和注册脚本，脚本产物由集成方自行托管并承担字体许可证责任。
- **导出运行环境规则**：导出包核心能力不依赖 `apps/server-api`；浏览器端返回 Blob/下载，Node.js/Hono 端提供 Uint8Array/Response 适配。server-api 可作为可选导出网关，不是导出包的必要依赖。
- **并发规则**：编辑器会话级 AI 互斥——每个 `TapNoteEditor` 会话创建一个共享 AI busy 状态并注入内联与对话助手；任意 AI 进行中时，另一助手入口禁用（按钮/slash 项/chat 输入框置灰），完成、中止、失败或卸载后释放。不同编辑器会话互不阻塞；不支持同一会话内两者同时执行。
- **操作一致性规则**：每个 AI 任务绑定起始 `documentRevision` 和建议 transaction；BlockOperation 必须携带目标块 ID 与前置条件。内联拒绝只回退该 AI transaction，不覆盖用户后续编辑；对话操作遇到 revision 或前置条件冲突时不执行，向模型和用户返回可重试冲突结果。
- **安全规则**：生产环境中 `POST /api/ai/*` 必须校验由集成方 BFF 或外部身份提供方签发的短期 JWT，校验签名算法、issuer、audience、exp、sub 与最小权限声明；浏览器不得持有长期共享网关 Token。`GET /api/ai/models` 默认同样受 JWT 保护，只有部署方显式开启时才可公开且只能返回 allowlist 元数据。健康检查可匿名；CORS 受 `CORS_ORIGIN` 控制；网关清理客户端身份头。
- **资源安全规则**：导出资源与字体解析器默认不请求任意 URL 或本地路径；集成方提供 resolver 时必须限制协议、允许主机、重定向、超时、文件/像素大小和 MIME 类型，并阻止私网地址、路径遍历与不可信原始 HTML。
- **成本与滥用控制规则**：服务端对每个认证主体限制请求速率、并发、消息数、输入/输出 token、工具调用轮数和流持续时间；日志记录 requestId、主体、模型、用量、耗时和状态，不默认记录文档正文、prompt 或工具结果。
- **本地化规则**：默认 zh-CN；保留 i18n 扩展点以便后续增补 en 等。
- **版本规则**：依赖版本由官方文档、lockfile 与最小端到端验证共同确定；升级 AI SDK、Provider、BlockNote 或 React 前，必须验证 editor/chat 流式工具调用、客户端执行与类型检查。TypeScript 保持 `~6`（最新 6.x），不升级到 7.x（等生态适配）。
- **规范适用规则**：本项目为 Hono + Vite + React 的纯 Web 项目，仅遵循 hono 与 JS/TS 通用编码规范；**不涉及 Taro/小程序规范**，相关规则对本项目不生效。
- **参考代码规则**：本地仓库 `resource/BlockNote` 为 git submodule（仅参考，不参与构建），是各 `@tap-note/*` 包实现 BlockNote 集成、AI 助手状态机、流式工具解析、suggest-changes 集成、PDF/DOCX schema mapping 等内容时的**首要参考来源**；实现时优先阅读其源码理解 API、算法与交互模式，再独立编写代码，保留独立设计与实现来源记录，不复制受保护表达。`@blocknote/xl-*` 仅作实现**思路**参考（不复制源码、不引入依赖）；`@blocknote/core`/`react`/`shadcn`（MPL-2.0）可作为生产依赖。**shadcn 组件复用策略**：编辑器与导出等需要 shadcn 组件的场景按优先级处理——① 优先复用 `@workspace/ui` 已有 shadcn 官方组件；② API 不兼容时降级为 `@blocknote/shadcn` 自带组件；③ 仍不满足或需深度定制时，参考 `resource/BlockNote` 源码自定义组件（便于后续修改与规避版权）。具体策略由对应 feat 在 `tech.md` 记录。

## 11. 全局非功能需求

| 类别 | 要求 |
|---|---|
| 性能 | AI 流式首块出现延迟 < 2s（受模型 provider 影响）；大文档（500 块）编辑无明显卡顿；流式 partial 工具调用解析不阻塞主线程 |
| 安全 | LLM API Key 仅存在于 server-api 环境变量；生产 AI 端点校验短期 JWT，浏览器不持有长期共享网关 Token；资源 resolver 防 SSRF/路径遍历；错误响应不泄露堆栈/内部路径 |
| 授权合规 | 发布前扫描生产依赖闭包、可选依赖与 npm tarball，生成 SBOM；`LICENSE`、`NOTICE` 与第三方清单随包发布 |
| 兼容性 | 现代 Chromium/Firefox/Safari 最新两个大版本；React 19；Node >= 20；Bun 1.3+ |
| 可观测性 | server-api 用 pino 结构化日志，所有请求带 requestId；AI 调用记录认证主体、provider/model、用量、耗时/状态；默认不记录 prompt、文档正文或工具结果 |
| 可维护性 | 遵循 monorepo 现有 ESLint/Prettier 与 hono 编码规范；包职责单一、kebab-case 目录、index 入口（本项目不涉及 Taro/小程序规范） |
| 国际化 | 默认 zh-CN，字典可扩展 |
| 可靠性 | AI 调用失败可重试、可中止；拒绝只回退所属 AI transaction；revision/前置条件冲突不执行操作并可重试 |
| 可访问性 | AI 菜单、对话面板、接受/拒绝操作支持键盘导航、焦点恢复和屏幕阅读器状态提示；建议状态不只依赖颜色表达 |

## 12. 外部系统与数据依赖

| 依赖 | 角色 | 授权 | 备注 |
|---|---|---|---|
| BlockNote `@blocknote/core` `react` `shadcn` | 编辑器内核与皮肤 | MPL-2.0 | 商用友好，可安全依赖；版本 `0.51.4` |
| `@blocknote/xl-ai` / `xl-ai-server` | 仅作参考 | GPL-3.0 OR 专有 | **不依赖其源码**；仅阅读 `resource/BlockNote` submodule 学习实现思路 |
| `@blocknote/xl-pdf-exporter` / `@blocknote/xl-docx-exporter` | PDF/DOCX exporter 参考实现 | GPL-3.0 OR 专有 | 仅参考源码组织、schema mapping、字体/模板和资源处理；发布包不得依赖或复制源码 |
| `@handlewithcare/prosemirror-suggest-changes` | accept/reject/revert | 独立第三方（非 BlockNote/GPL） | 关键发现：xl-ai 的可回退写作基于此包，可直接使用以规避 GPL；版本 `0.1.8` |
| Vercel AI SDK | AI 调用、流式协议、`useChat`、client-side tools | Apache-2.0 | 具体稳定版本在实施前以官方文档和最小 editor/chat 流式工具调用示例验证后锁定；服务端声明工具 schema，客户端执行并回传结果 |
| `@ai-sdk/alibaba` | DashScope/Qwen provider | Apache-2.0 | 国产模型主路径 |
| `@ai-sdk/google` | Gemini provider | Apache-2.0 | 可选 |
| `@react-pdf/renderer` | PDF 渲染引擎 | MIT | 仅由 `@tap-note/export-pdf` 依赖；字体必须通过导出配置提供 |
| `docx` | DOCX/OOXML 生成 | MIT | 仅由 `@tap-note/export-docx` 依赖；默认设置东亚字体名称，不强制嵌入字体 |
| CJK 字体（如 Noto Sans CJK / Source Han Sans） | 中文 PDF 字形 | 依字体许可证 | 不由基础包默认捆绑；由集成方配置或通过后续脚本工具生成资源 |
| Hono `4.12` + `@hono/node-server` `2.0.10` | 后端框架 | ISC | |
| DashScope（阿里云百炼） | LLM 服务 | 商业 API | 需 `DASHSCOPE_API_KEY` |
| Google Gemini | LLM 服务 | 商业 API | 可选，需 `GOOGLE_GENERATIVE_AI_API_KEY` |
| React 19 / Tailwind 4 / shadcn | 前端基础 | MIT/Apache | 已就绪 |
| Bun + Turbo | 构建与编排 | MIT | 已就绪 |

## 13. 类似产品与开源方案调研

| 方案 | 来源 | 可借鉴点 | 限制或排除原因 |
|---|---|---|---|
| BlockNote `xl-ai` | https://github.com/TypeCellOS/BlockNote | AIExtension 状态机、StreamTool 增量解析/校验/去重、suggest-changes 集成、AIMenu/AIToolbarButton/Slash 项的交互范式 | GPL-3.0 OR 专有；fork 源码会强制衍生作品 GPL 开源或需商业授权 → **不 fork 源码**，仅参考实现思路 |
| BlockNote `xl-ai-server` `regular.ts` | 同上 | 服务端 `streamText` + `injectDocumentStateMessages` + `toolDefinitionsToToolSet` + `toUIMessageStreamResponse` 的规范模式 | 同 GPL；server-api 不分发可用，但为保持协议自有，**自研匹配路由**而非直接引用 |
| BlockNote `xl-pdf-exporter` / `xl-docx-exporter` | https://github.com/TypeCellOS/BlockNote/tree/main/packages/xl-pdf-exporter / https://github.com/TypeCellOS/BlockNote/tree/main/packages/xl-docx-exporter | PDF/DOCX schema mapping、字体注册、图片/表格/多列处理、OOXML 模板与测试组织 | 两者均为 `GPL-3.0 OR PROPRIETARY`；`xl-docx-exporter` 还依赖 `xl-multi-column` → 仅参考思路，自有 exporter 不复制源码或依赖 |
| `@handlewithcare/prosemirror-suggest-changes` | https://www.npmjs.com/package/@handlewithcare/prosemirror-suggest-changes | suggest/apply/revert changes 的 prosemirror 集成 | 独立授权、非 BlockNote 产物 → **采纳**，规避 GPL 的关键 |
| Notion AI | https://www.notion.so/product/ai | 逐块流式写入、接受/拒绝、`/ai` 指令唤起的交互体验 | 闭源商业产品 → 仅作体验对标，不复制代码 |
| Cursor Chat / GitHub Copilot Chat | https://cursor.com / https://github.com/features/copilot | 侧边对话面板、引用选区/文件作上下文、离散工具调用作用于编辑器、多轮上下文 | 闭源 → 仅作对话助手体验与交互对标 |
| Vercel AI SDK | https://ai-sdk.dev | UIMessage stream helpers、DefaultChatTransport、partial tool call streaming、client-side tools（execute 在浏览器，作用于本地资源） | Apache-2.0 → **采纳**；对话助手用 client-side tools 模式，具体版本与 API 在实施前验证 |
| Tiptap AI | https://tiptap.dev | 编辑器 AI 集成思路 | 闭源/商业 → 仅参考 |

> 调研日期：2026-07-17（v2 追加 Cursor Chat / Copilot Chat 与 client-side tools；v5 追加 BlockNote PDF/DOCX exporter 与 React PDF 字体机制调研）。调研方式：Context7 文档查询 + npm registry 版本核查 + BlockNote submodule 源码阅读。未能联网验证的部分已标注为「AI 推断」。

## 14. 关键决策记录

| 决策 | 备选方案 | 选择理由 | 影响 |
|---|---|---|---|
| tap-note AI 助手（原 `tap-note-assistant`，v2 已拆分）薄层重写，不用 xl-ai 源码 | (A) 依赖 xl-ai 作 peerDep (B) 薄层重写 (C) fork 源码标 GPL | 用户选 B；规避 GPL 传染，发布包授权干净 | 工作量大，需自研流式协议；可用 `@handlewithcare/prosemirror-suggest-changes` 降低难度 |
| AI 写作体验一步到位完整流式操作（内联） | (A) MVP 简化替换后迭代 (B) 完整流式 (C) server 用 xl-ai 协议 client 兼容 | 用户选 B；体验对标 Notion，不做半成品 | 协议自研、内联助手工作量最大 |
| tap-note-editor 用 shadcn 皮肤 | (A) shadcn (B) mantine (C) 两者 | 用户选 A；与 monorepo `@workspace/ui` 风格统一，MPL-2.0 | 需处理与 base-ui/tailwind-merge@3 的样式作用域隔离 |
| 默认 transport 为服务端 streamText | (A) 服务端 streamText (B) 客户端 ClientSideTransport+代理 (C) 两者 | 用户选 A；Key 不暴露，规范模式 | server-api 必须实现 streamText/chat 端点 |
| server-api 保留现有脚手架 + 新增 editor 路由 | (A) 保留+新增 (B) 按 hono 规范彻底重构 (C) 删除 approval 只做 editor | 用户选 A；保留已有工作，增量推进 | 需修复 `defaultAgentModel` 导出；补 package.json 与 index.ts |
| 模型前端可切换，列表由服务端 API 提供 | (A) 固定 qwen-plus (B) 前端可切 (C) 前端可切且列表来自服务端 | 用户选 C；灵活且可控 | 需 `GET /api/ai/models` + 前端下拉 + transport body 传 model |
| TypeScript 保持 ~6 最新 6.x | (A) 升 TS 7.0.2 (B) 保持 ~6 | 用户选 B；避免工具链断裂 | 不享受 TS 7 新特性；等生态适配再升 |
| 所有依赖用已验证稳定版 | — | 避免仅按版本号假设 API 兼容 | 由官方文档、最小端到端示例与 lockfile 共同锁定；升级需复验流式工具调用 |
| **[v2]** AI 助手拆分为内联 + 对话 + 共享核心三包 | (A) 单 assistant 包 (B) 两包无 core (C) 三包含 core | 用户选 C；内联与对话交互差异大但共享协议，拆 core 避免重复 | 包数增至 4（editor+core+inline+chat）；FEAT 模块由 5→7 |
| **[v2]** 命名 `ai-inline` / `ai-chat` | (A) inside/side (B) inline/chat (C) 带 assistant 后缀 | 用户选 B；inline/chat 为业界标准术语 | 包名 `@tap-note/ai-inline`、`@tap-note/ai-chat` |
| **[v2]** ai-inline 参考 xl-ai 思路自己重写 | (A) 参考思路重写 (B) fork xl-ai 源码 (C) peerDep xl-ai | 用户选 A；与「薄层重写」决策一致，GPL 干净 | 仅阅读 submodule 作思路参考，不复制源码 |
| **[v2]** ai-chat 后端新建独立 `/api/ai/chat` 路由 | (A) 复用升级 agent-approval (B) 新建独立 chat 路由 (C) 两者并存 | 用户选 B；与内联路由解耦，协议清晰 | agent-approval 保留为独立示例，不进主流程 |
| **[v2]** ai-chat 离散 tool call，单次单操作 | (A) 离散单操作 (B) 流式数组复用 StreamToolExecutor (C) 混合 | 用户选 A；对话场景天然逐条展示、可解释 | 与内联流式数组不同；复用 ai-core 的 schema 但不复用 executor |
| **[v2]** ai-chat 支持引用选区/全文作上下文 | (A) 不支持 (B) 支持 | 用户选 B；对标 Cursor/Copilot 上下文引用 | 需上下文三态开关 + ai-core DocumentStateBuilder 复用 |
| **[v2]** ai-chat 前期不加审批开关 | (A) 直接执行 (B) 加 needsApproval | 用户选 A；前期求简，工具直接执行 | 审批开关列入 P2 候选 |
| **[v3]** 内联与对话全局 AI 互斥（共享单一 busy 状态） | (A) 共享 busy 态互斥 (B) 各自独立可并行 (C) 乐观锁冲突检测 | 用户选 A；任一 AI 进行中时另一助手入口禁用，简单可靠 | 需 ai-core 提供 `createAIBusyState`；不支持两者同时执行；FEAT-003/004 共用 |
| **[v3]** 上下文体积分层策略 | (A) 选区超限提示减少 (B) 全文永不直发，截断/大纲 | 用户选 A 用于选区（不静默截断用户显式选择）；AI 提案 B 用于全文（无法「减少全文」），分场景分层 | 选区软上限默认 4K、全文预算默认 8K（可配，阈值待确认）；LLM 可用 getDocumentSnapshot 按需拉更多 |
| **[v3]** tap-note 为纯组件产品，不内置持久化 | (A) 纯组件不持久化 (B) MVP 内存 + P2 数据库 (C) demo 加 localStorage | 用户选 A；持久化由集成方实现 | 移除原 P2「文档持久化」；demo 刷新丢内容属预期；§4.1/§5.2/§16 同步 |
| **[v3]** demo 为带 sidemenu 多路由（inline/chat/both） | (A) 单页混合 (B) 多路由独立 demo | 用户选 B；各场景独立路由便于演示与二次开发 | FEAT-006 重定义为多路由 demo 站 |
| **[v3]** 本项目不涉及 Taro/小程序规范 | (A) 仅 hono+JS/TS 通用规范 (B) 含 taro 规范 | 用户选 A；tap-note 为纯 Web 项目 | §10 可维护性订正 Biome→ESLint、删 taro |
| **[v4]** 导出 PDF/DOCX 由 P2 提级到 P1 | (A) 维持 P2 (B) 提级 P1 | 用户选 B；导出属核心可用诉求，应尽早上线 | 需处理 BlockNote XL exporter GPL 问题：导出走 server-api（私有不分发）或自研；MD/HTML 用 core 内置转换 |
| **[v4]** 上下文体积阈值采用推荐默认值 | (A) 待定 (B) 采用 4K/8K/2× | 用户选 B；选区软上限 4K tokens、全文预算 8K、全文改发大纲阈值 2× 预算 | 阈值可配，仍待确认 token 估算算法（近似字符数/4 vs 精确 tiktoken） |
| **[v4]** client-side tools 前期不限制 deleteAll 类危险操作 | (A) 限制 (B) 不限制 | 用户选 B；前期求简，接受 prompt injection 风险 | 风险已知并接受；如后续需要再加输入校验/数量上限 |
| **[v5]** 导出能力拆分为 export-core/PDF/DOCX 三个可选包 | (A) 只放 server-api (B) 单一 export 包 (C) core + format packages | 用户要求补充包开发定义；可独立发布、按需安装并隔离格式依赖 | 新增 FEAT-008~010；发布包自研，不依赖 GPL XL exporter；server-api 仅提供可选适配 |
| **[v5]** 字体由集成方配置，基础包不捆绑 CJK 字体 | (A) 基础包内置完整字体 (B) 集成方配置 (C) 仅依赖系统字体 | 用户选 B；避免仓库和包体积膨胀，同时支持企业字体 | export-core 提供字体配置契约；后续提供字体检查/下载/裁剪/转换/注册脚本 |
| **[v5]** PDF/DOCX 参考 XL exporter 思路但不复制源码 | (A) 直接依赖 XL exporter (B) 自研兼容实现 | 用户要求参考源码实现；发布包需保持授权干净 | 需自研 schema mapping、字体、图片、表格和未支持 block 策略 |
| **[v6]** 按 6 个 Sub 重组产品需求 | (A) 单层 FEAT (B) 5 个 Sub（字体并入导出）(C) 6 个 Sub（字体独立） | 用户选 C；字体资源、许可证与安装工具具有独立边界，且已创建独立 sub 文档 | 新增 SUB-001~006；所有 FEAT 归属唯一 Sub；新增 FEAT-011 字体集成工具 |
| **[v7]** 安全与可实现性订正 | (A) 延续共享 Bearer Token/全局 busy/客户端工具声明 (B) JWT、会话级状态、服务端工具 schema | 审查发现前者会暴露网关凭据、阻塞无关编辑器实例并造成 API 契约歧义 | 明确 JWT 边界、revision 冲突策略、受限上下文读取；新增 FEAT-012、资源安全和许可证门禁 |

## 15. 版本规划

### MVP

目标：端到端可运行的「编辑 + 内联流式写作 + 侧边对话改文档 + 模型切换」。

- FEAT-001：`@tap-note/editor` 封装 shadcn，`TapNoteEditor` + `useCreateTapNoteEditor`，初始内容/主题/slash/格式工具栏。
- FEAT-005（基础）：`POST /api/ai/editor/streamText`（内联，自研 streamText + 服务端工具 schema + documentState 注入）、`POST /api/ai/chat`（服务端声明 client-side tools）、`GET /api/ai/models`、JWT/CORS/requestId/logger/errorHandler/限流中间件、修复 `defaultAgentModel`。
- FEAT-002：`@tap-note/ai-core` 共享 `BlockOperation` schema + 带 schema/revision 的 `DocumentStateBuilder` + `applyOperationsToEditor`（suggest-changes 集成）+ `injectDocumentStateMessages` + `createServerTransport` + 会话级 busy state + zh-CN 字典基础。
- FEAT-003（完整流式）：`@tap-note/ai-inline` `TapNoteAIInlineExtension`（createExtension）+ `StreamToolExecutor`（增量解析/校验/去重）+ AIMenu/AIToolbarButton/Slash 项 + 接受/拒绝/中止/重试状态机。
- FEAT-004：`@tap-note/ai-chat` `TapNoteChatPanel` + `useChat` + client-side tools（insert/update/delete/replace/move/getSnapshot）+ 上下文三态引用（选区/全文/无）+ 多轮对话 + revision 冲突处理。
- FEAT-006：`apps/web` 多路由 demo 站，sidemenu + 路由 `/inline`、`/chat`、`/both`，模型下拉、Vite proxy、transport 切换；纯组件，不实现持久化。

### P1

- FEAT-007：`@tap-note/editor`、`ai-core`、`ai-inline`、`ai-chat`、`export-*`、`font-tools` 的 npm 发布配置（exports、类型声明、tsup/vite 构建）、集成指南、API 参考文档。
- `/api/ai/proxy` 透明代理 + `createProxyTransport`（ClientSideTransport 等价能力，供内联可选）。
- 更多 BlockNote 块类型适配（表格、代码块等在 BlockOperation schema 中的覆盖验证）。
- 主题与样式作用域隔离方案落地（`@blocknote/shadcn` vs `@workspace/ui`）。
- 对话助手工具调用结果展示增强（diff 预览、跳转到被修改块）。
- **FEAT-008~011 文档导出与字体集成**：发布 `@tap-note/export-core`、`@tap-note/export-pdf`、`@tap-note/export-docx`、`@tap-note/font-tools`。导出核心不依赖 `apps/server-api`；浏览器返回 Blob，Node.js/Hono 提供 Uint8Array/Response 适配。
- PDF/DOCX 参考 BlockNote `xl-pdf-exporter`/`xl-docx-exporter` 的转换思路，但发布包不得直接依赖 GPL XL exporter。PDF 中文字体由集成方提供，DOCX 通过 `eastAsia` 字体配置或模板指定；后续提供字体检查、下载、裁剪、转换和注册脚本工具。

### P2（候选）

- 协作编辑（Yjs 实时协同 + ForkYDoc 式 AI 写作隔离合并）。
- 对话助手 `needsApproval` 工具执行审批开关；agent-approval 与编辑器 AI 的场景化集成。
- 用户账号体系与多租户。
- FEAT-012：`@tap-note/export-markdown` 与 `@tap-note/export-html`，包含 block 映射、未知块策略与 HTML 净化。

## 16. 全局验收标准

1. **编辑器可用性**：`<TapNoteEditor initialContent={...} />` 在 React 19 应用中渲染，支持回车建块、`/` slash 菜单、拖拽重排、缩进嵌套、格式工具栏，操作流畅无报错。
2. **内联 AI 流式写作**：`/ai 续写一段...` 后，AI 内容逐块流式写入文档，可见实时变化；写作中可点「中止」立即停止并回退。
3. **内联接受/拒绝**：AI 完成后，点「接受」保留修改、点「拒绝」完全回退到写作前状态，undo 历史正确（接受后 undo 跳回写作前，拒绝后不污染历史）。
4. **内联选区改写**：选中文字点 AI 按钮改写，AI 流式替换选区，可接受/拒绝。
5. **失败可恢复**：AI 调用失败时 AIMenu 显示错误，点「重试」可重新发起，无需重输指令。
6. **对话助手上下文引用**：在 chat 面板选「引用选区」后发消息，AI 收到的 documentState 包含选区内容；选「引用全文」时，预算内发送完整快照，超预算时发送符合 §4.4 的截断快照或结构化大纲；选「不引用」时请求不含 documentState，且模型不可调用读取文档工具。日志仅验证元数据，不记录正文。
7. **对话离散工具调用**：AI 每次工具调用对应单个 BlockOperation，在聊天气泡展示「已插入/已更新/已删除块」，编辑器文档实时变化，支持多轮。
8. **内联与对话互斥**：内联进行中时，对话助手 chat 输入框置灰不可发送；反之亦然；一者完成/中止/拒绝后，另一者立即可用。
9. **上下文体积分层**：选区超 4K tokens 时前端拦截并提示减少选区（不发请求）；引用全文不超过 8K tokens 时发送完整快照，超过时发送内容含 `[文档已截断]` 标记且体积 ≤ 预算，超过 2 倍预算时改发结构化大纲。
10. **文档操作一致性**：AI 流式期间人工修改同一块后，内联拒绝不得覆盖该人工修改；对话工具携带过期 `documentRevision` 或不满足块前置条件时不得执行，并在气泡中展示可重试冲突结果。
11. **模型切换**：下拉切换模型后，下一次 AI 调用（内联或对话）服务端日志显示使用新模型，前端无 Key 暴露；提交未在 allowlist 的 modelId 时服务端明确拒绝且不回退。
12. **模型列表**：仅配置了 DashScope 未配 Gemini 时，`/api/ai/models` 只返回 dashscope 模型；配齐后两者都返回，并携带工具调用等 capability 元数据。
13. **网关鉴权与 Key 安全**：生产 AI 请求使用由 BFF 或外部身份提供方签发的短期 JWT；浏览器 DevTools Network 面板中不含 LLM API Key 或长期共享网关 Token；服务端校验 JWT 声明后注入 Key 再转发。
14. **授权合规**：发布前对所有 `@tap-note/*` 包生成 SBOM，扫描生产/可选依赖和最终 npm tarball；扫描结果不得包含禁止的 `@blocknote/xl-*`、GPL/AGPL 或未经授权的专有依赖，并发布 `LICENSE`、`NOTICE` 与第三方清单。
15. **可观测性**：任意一次 AI 调用（内联 `/api/ai/editor/streamText` 或对话 `/api/ai/chat`）在 server-api 日志中可用同一 requestId 串联请求全链路，并记录模型、用量、耗时和结果状态，不记录正文。
16. **demo 多路由**：sidemenu 可在 `/inline`、`/chat`、`/both` 三路由切换，各路由独立可用；`/both` 路由验证同一编辑器会话中的内联与对话互斥，不阻塞第二个编辑器实例。
17. **纯组件无持久化**：demo 刷新后内容丢失属预期；`@tap-note/*` 包不导出任何存储 API。
18. **PDF 导出**：使用集成方提供的 CJK 字体后，中文标题、段落、列表、表格、图片和基础 inline styles 可生成并打开 PDF；缺失字体时返回明确 warning/error，不生成静默乱码。
19. **DOCX 导出**：生成的 DOCX 可被 Microsoft Word 或 LibreOffice 打开；中文内容使用配置的 `eastAsia` 字体名称；标题、段落、列表、表格、图片和基础 inline styles 可正常转换。
20. **[P2] Markdown 与 HTML 导出**：`@tap-note/export-markdown` 与 `@tap-note/export-html` 可分别输出正确 MIME type；未知块按所配策略处理；HTML 输出不含脚本、事件属性或非允许 URL 协议。
21. **导出运行环境与资源安全**：`@tap-note/export-*` 可在浏览器返回 Blob/下载，也可在 Node.js/Hono 返回 Uint8Array/Response；不要求部署 `apps/server-api`。服务端 resolver 拒绝私网 URL、超时、超大资源和路径遍历。
22. **字体集成工具**：字体脚本能够检查字体格式和基本中文字符覆盖，并生成可被导出包注册的资源或配置示例；字体许可证和资源由集成方负责。
23. **可访问性与测试**：AI 菜单、对话面板和接受/拒绝支持键盘导航、焦点恢复和屏幕阅读器状态提示；`bun run typecheck`、`bun run lint`、流式工具 fixture、Hono 路由集成测试及 demo E2E 全绿。

## 17. 假设与待确认事项

1. **【假设】** tap-note 同时面向「集成开发者（SDK）」与「终端创作者（参考应用）」两类用户。需求来源未明确区分，此处基于「发布独立包」+「demo 应用」的双重诉求推断。**待用户确认**是否以终端创作者（SaaS 产品）为唯一目标，或确认双角色定位。
2. **【已决策】** tap-note 为纯组件产品，不内置任何持久化能力（用户确认）；持久化由集成方实现；demo 刷新丢内容属预期。原 P2「文档持久化」已移除。
3. **【待确认】** `@blocknote/shadcn`（自带 radix + tailwind-merge@2）与 `@workspace/ui`（base-ui + tailwind-merge@3）的样式作用域是否冲突，是否需要构建期样式隔离方案。需在 P0 实施时验证。
4. **【待确认】** server-api 的 `defaultAgentModel` 导出缺失是否为预期保留的脚手架占位；审批代理（agent-approval）保留为独立示例（本 PRD 假设保留且不进入内联/对话主流程）。
5. **【待确认】** AI SDK 的具体稳定版本及 partial tool call streaming（内联用）、client-side tools `execute`/tool result 回传（对话用）的精确 API，需在 FEAT-003/FEAT-004 开始前以 Context7 文档与最小端到端示例确认并锁定。
6. **【假设】** 默认本地化为 zh-CN。**待确认**是否需要 MVP 即支持 en。
7. **【待确认】** 是否需要客户端 `ClientSideTransport + 代理` 模式（P1 候选，供内联可选），还是仅服务端 streamText 即可满足所有场景。
8. **【假设】** 发布包名前缀为 `@tap-note/*`（如 `@tap-note/editor`、`@tap-note/ai-core` 等）。需求来源说「方便后续发布独立包」但未指定 scope，此处采用合理默认。**待确认** npm scope 归属。
9. **【已决策】** 对话助手支持引用选区/全文作上下文（用户确认）。
10. **【已决策】** 对话助手前期不加审批开关，工具直接执行（用户确认）；审批列入 P2 候选。
11. **【待确认】** 对话助手的 client-side tools 是否需要支持「批量操作」（如一次调用插入多个块），还是严格单次单操作（当前 PRD 假设严格单操作，多操作走多轮或多 tool call）。
12. **【已决策】** 内联与对话采用编辑器会话级 AI 互斥：同一会话共享一个 busy 状态，任一进行中时另一助手入口禁用；不同编辑器会话互不阻塞。
13. **【已决策】** 上下文体积分层阈值采用推荐默认值（用户确认）：选区软上限 4K tokens、全文预算 8K tokens、全文改发大纲阈值 2× 预算；均可配置。**仍待确认** token 估算算法（近似字符数/4 vs 精确 tiktoken）。
14. **【已决策】** client-side tools 前期不限制 `deleteAll` 类危险操作（用户确认，接受 prompt injection 风险）；如后续需要再加输入校验/数量上限，列入 P2 候选。
15. **【已决策】** PDF/DOCX 导出属于 P1；Markdown/HTML 拆分为 `@tap-note/export-markdown`、`@tap-note/export-html` 并列入 P2 后续规划，均依赖 `@tap-note/export-core`。
16. **【已决策】** 字体由集成方配置，基础导出包不捆绑完整 CJK 字体；后续提供字体检查、下载、裁剪、转换和注册脚本工具，字体许可证由集成方负责。
17. **【已决策】** PDF/DOCX 仅参考 `xl-pdf-exporter`、`xl-docx-exporter` 源码设计，不复制源码或引入 `xl-*` exporter 依赖。
18. **【已决策】** 产品按 6 个 Sub 划分：字体集成工具、编辑器体验、AI 助手、AI 服务平台、文档导出、开发者生态；所有 FEAT 必须唯一归属其中之一。
19. **【已决策】** 字体集成工具登记为 FEAT-011，归属 SUB-001；`docs/prd/sub-font-tools/` 已有 Sub 文档，其他 Sub 的目录与文档后续由 `/oc-prd-sub` 生成。
20. **【已决策】** server-api 不管理终端用户账号，也不向浏览器分发长期共享 Token；生产调用由集成方 BFF 或外部身份提供方签发短期 JWT，server-api 校验标准声明后提供 AI 服务。
21. **【已决策】** 对话工具 schema 由服务端版本化维护，客户端只执行同名工具并回传结果；不引用模式不允许模型按需读取全文。
22. **【已决策】** 本地仓库 `resource/BlockNote` submodule 为各 `@tap-note/*` 包实现 BlockNote 集成、AI 助手、流式工具、suggest-changes、导出 schema mapping 等内容时的首要参考来源；实现优先阅读源码再独立编写，不复制受保护表达，保留独立设计来源记录。
23. **【已决策】** shadcn 组件复用三段优先级策略：① 优先复用 `@workspace/ui` 已有 shadcn 官方组件；② API 不兼容时降级为 `@blocknote/shadcn` 自带组件；③ 需深度定制或规避版权时参考 `resource/BlockNote` 源码自定义组件。
24. **【已决策】** 测试框架采用 `bun:test`（与 Bun 工具链统一，不额外引入 Vitest）。

## 18. 变更记录

| 版本 | 日期 | 变更内容 |
|---|---|---|
| v1 | 2026-07-17 | 初始版本。基于用户「基于 BlockNote 开发支持 AI 助手的在线文档编辑器」构想与技术方案讨论结论（薄层重写 + 完整流式 + shadcn + 服务端 streamText + 模型服务端列表 + 依赖最新版 + TS 保持 6.x）生成。定义 5 个功能模块（FEAT-001~005）、MVP/P1/P2 版本规划、11 项验收标准、8 项待确认事项。 |
| v2 | 2026-07-17 | AI 助手拆分：原 FEAT-002「AI 写作助手」拆为 FEAT-002「AI 共享核心」(`@tap-note/ai-core`) 与 FEAT-003「AI 内联助手」(`@tap-note/ai-inline`)；新增 FEAT-004「AI 对话助手」(`@tap-note/ai-chat`)，对标 Cursor/Copilot Chat，支持引用选区/全文上下文、离散 client-side tools、前期无审批开关；原 FEAT-003/004/005 顺移为 FEAT-005/006/007。新增 §4.3 对话流程、§8 US-009~012、§9 工具执行/上下文规则、§13 七项 v2 决策、§12 对话/client-side tools 调研。功能模块 5→7，验收标准 11→14，待确认 8→11。server-api 新增 `/api/ai/chat` 路由。 |
| v3 | 2026-07-17 | 应用审查反馈与用户新决策：① 全局 AI 互斥（共享 busy 状态，任一进行中时另一助手入口禁用，新增 §4.6、§9 并发规则、ai-core `createAIBusyState`）；② 上下文体积分层策略（选区软上限 4K 提示减少、全文永不直发按 8K 预算截断/2× 预算改发大纲，新增 §4.4、§9 体积规则、FEAT-002/004 补充）；③ 纯组件定位，不内置持久化（§4.1/§5.2/§14 P2/§16 同步，移除 P2 文档持久化）；④ demo 改为带 sidemenu 多路由（`/inline`、`/chat`、`/both`，FEAT-006 重定义）；⑤ 订正：§10 Biome→ESLint、删 taro（本项目不涉 Taro/小程序，新增 §9 规范适用规则）、§9 packages/ 前缀统一、§5.1 ChatGPT 式→Cursor/Copilot Chat 式、§13 首行包名加注、§6 FEAT-007 依赖补 FEAT-005、§7 FEAT-003 依赖写法订正、§7 FEAT-004 补 getDocumentSnapshot 用途。新增 §15 验收 8/9/15/16，验收标准 14→17，待确认 11→14（新增体积阈值、client-side tools 安全边界）。 |
| v4 | 2026-07-17 | 三项用户确认：① 导出 PDF/DOCX/Markdown/HTML 由 P2 提级到 P1（§14 P1 增列、P2 移除；附 BlockNote XL exporter GPL 处理说明：导出走 server-api 私有 app 或自研，MD/HTML 用 core 内置转换）；② 上下文体积阈值采用推荐默认（4K/8K/2×，§16 item 13 待确认→已决策，仍留 token 估算算法待定）；③ client-side tools 前期不限制 deleteAll 类危险操作（§16 item 14 待确认→已决策，接受 prompt injection 风险）。§13 新增三项 v4 决策。 |
| v5 | 2026-07-17 | 根据导出专项审查补充：新增 FEAT-008「文档导出核心」、FEAT-009「PDF 导出」、FEAT-010「DOCX 导出」及 `@tap-note/export-core`、`@tap-note/export-pdf`、`@tap-note/export-docx` 包定义；补充导出流程、字体配置流程、统一输入输出与错误契约、PDF/DOCX 功能边界、授权隔离、外部 exporter 调研和 6 项导出验收标准。明确字体由集成方配置，基础包不捆绑 CJK 字体，后续提供字体检查/下载/裁剪/转换/注册脚本；明确只参考 BlockNote XL exporter 思路，不复制源码或依赖。FEAT-007 依赖同步包含导出模块。 |
| v6 | 2026-07-17 | 按用户确认的 6 个需求分支重组总 PRD：新增 §6 需求分支地图（SUB-001 字体集成工具、SUB-002 编辑器体验、SUB-003 AI 助手、SUB-004 AI 服务平台、SUB-005 文档导出、SUB-006 开发者生态），原功能模块地图调整为 §7 并增加唯一所属 Sub 与嵌套 `sub-*/feat-*` 目录路径；原功能模块说明调整为 §8 并为全部 FEAT 补 Sub 归属。新增 FEAT-011「字体集成工具」归属 SUB-001；更新 P1、用户故事、授权规则、验收标准和待确认事项。后续由 `/oc-prd-sub` 为尚未建文档的 Sub 生成分支文档，由 `/oc-prd-feat` 创建 feat 文档。 |
| v7 | 2026-07-17 | 按 PRD 审查结论订正安全性、可实现性和交付边界：① 生产 AI 网关改为验证集成方 BFF/外部身份提供方签发的短期 JWT，不向浏览器分发长期共享 Token；② AI busy 状态改为编辑器会话级，新增 documentRevision、操作前置条件与冲突/回退规则；③ 聊天工具改为服务端持有版本化 schema、客户端执行并按 toolCallId 回传；④ 明确全文引用的预算分层与不引用模式边界；⑤ 新增 FEAT-012 及 `@tap-note/export-markdown`/`@tap-note/export-html`，并在后续调整为 P2；⑥ 增加导出资源安全、成本限流、隐私日志、可访问性、SBOM/tarball 许可证扫描和 E2E 验收；⑦ 移除未经验证的 AI SDK 精确版本承诺，要求在实施前用 Context7 与最小示例锁定。 |
| v8 | 2026-07-17 | 根据用户实施前确认补充：① 新增 §9「参考代码规则」——`resource/BlockNote` submodule 为各 `@tap-note/*` 包首要参考来源，实现优先阅读源码再独立编写，不复制受保护表达；② 新增 §9「shadcn 组件复用策略」三段优先级（`@workspace/ui` → `@blocknote/shadcn` 自带 → 参考源码自定义）；③ §17 新增 item 22/23/24 已决策（参考代码规则、shadcn 复用策略、测试框架采用 `bun:test`）。 |
