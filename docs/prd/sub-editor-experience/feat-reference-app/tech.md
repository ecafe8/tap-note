# 技术方案：参考应用

## 0. 文档信息

- 功能 ID：FEAT-006；所属 Sub：SUB-002；状态：草稿；类型：UI 型；依据：总 PRD v7、SUB-002 `tech.md`。

## 1. 当前项目事实与复用点

- `apps/web` 使用 Vite 8、React 19、Tailwind 4 与 `@workspace/ui`，`App.tsx` 仍是模板占位（SUB-002 tech.md §1）。
- `apps/web` 已有 `components.json`（shadcn）、`src/components/theme-provider.tsx`、`vite.config.ts`。
- 复用 FEAT-001~005 的包；demo 只装配路由、模型选择与 transport。

## 2. 本 feat 在 sub 中的位置与职责

`apps/web` 只装配 demo 路由与配置；AI 能力由注入的 SUB-003 实例提供；编辑器不导入 server-api、导出器或字体工具（SUB-002 tech.md §2）。demo 不是 `@tap-note/editor` 的运行时依赖。

```text
apps/web -> @tap-note/editor -> BlockNote core/react/shadcn
              |                    |
              +-> optional SUB-003 assistants
apps/web -> /api proxy -> SUB-004
```

## 3. 模块职责与目录范围

```text
apps/web/
├── vite.config.ts          # 追加 dev proxy /api -> localhost:3000
├── package.json            # 追加 @tap-note/* workspace 依赖（MVP 阶段）
└── src/
    ├── App.tsx             # 路由装配 + sidemenu 布局
    ├── main.tsx
    ├── routes/
    │   ├── inline.tsx       # /inline 编辑器 + 内联助手
    │   ├── chat.tsx         # /chat 编辑器 + 对话面板
    │   └── both.tsx        # /both 编辑器 + 两类助手
    ├── components/
    │   ├── sidemenu.tsx
    │   ├── model-selector.tsx   # 拉取 /api/ai/models
    │   └── transport-toggle.tsx
    ├── hooks/
    │   └── use-models.ts     # GET /api/ai/models
    └── lib/
        └── transport.ts      # createServerTransport({ baseUrl, model })
```

## 4. 数据模型、迁移与状态

- 无数据库；无迁移。状态为 demo 页级（当前路由、所选 model、transport 模式、editor 实例、busy 状态）。
- 模型列表经 `GET /api/ai/models` 拉取；空列表时 AI 入口禁用。
- 刷新丢内容属预期（纯组件）。

## 5. 接口与组件接口

- `<Sidemenu routes={["/inline","/chat","/both"]} />`：导航。
- `<ModelSelector models={...} value={model} onChange={...} />`：模型下拉。
- 各路由页：`<TapNoteEditor initialContent={...} inlineAssistant={...} chatAssistant={...} onChange={...} />`。
- `useModels()`：`fetch('/api/ai/models')` 返回 allowlist。
- `createServerTransport({ baseUrl: "/api", model, getAuthHeaders })`：来自 FEAT-002。
- 认证头：demo 开发态可注入本地开发 JWT；生产由集成方 BFF 提供（见 FEAT-005）。

## 6. 核心流程与错误处理

```text
打开 web -> sidemenu 选路由
  -> 路由页挂载 TapNoteEditor + 助手
  -> useModels 拉取模型 -> ModelSelector 渲染
  -> 选模型 -> transport 携带 model
  -> /inline：/ai 写作 -> streamText -> 接受/拒绝
  -> /chat：上下文三态 + useChat -> 离散 tool call
  -> /both：共享 busy，任一进行中另一入口禁用
  -> 错误：模型空/认证失败/流错误 -> 路由页提示
```

错误处理：
- server-api 未启动：模型列表空，AI 入口提示「后端不可用」。
- 认证失败：提示重新认证，不暴露内部细节。
- 流错误：各路由页提示可重试/重新认证。
- `/both` 中一类 AI 进行中：另一类入口禁用并说明。

## 7. 权限、安全、输入校验与隐私

- demo 不持 LLM Key；模型列表来自服务端 allowlist。
- 生产 AI 请求使用集成方 BFF/外部身份提供方签发的短期 JWT；demo 开发态可用本地开发 JWT。
- 不实现持久化、账号、协作。
- 不涉及 Taro/小程序规范（总 PRD §9）。

## 8. 测试策略

- 组件测试：sidemenu 切换、ModelSelector、各路由页装配。
- 跨 sub 集成：模型选择、AI 互斥、刷新无持久化。
- E2E：三路由可访问、模型切换、内联写作、对话工具调用、并存互斥（§16 item 23）。
- Vite proxy 验证 `/api → localhost:3000`。

## 9. 发布、兼容与回滚

- demo 不是 `@tap-note/editor` 的运行时依赖；UI 回归可独立回滚 web 部署。
- 保持 Vite + React 19 + Tailwind 4 + shadcn 现状（SUB-002 tech.md §2）。
- 不发布 npm；作为 monorepo app 运行。

## 10. 类似产品与开源方案调研

| 来源 | 日期 | 可借鉴 | 限制 |
|---|---|---|---|
| BlockNote 官方示例 | 2026-07-17 | 多路由 demo 装配、editor + AI 装配 | 仅借鉴公开核心，不采用 GPL XL 代码 |
| Notion AI / Cursor Chat | 2026-07-17 | 内联/对话/并存 demo 信息架构 | 闭源，仅体验参考 |

## 11. 第三方依赖、版本与 Context7 记录

| 包 | 版本 | 授权 | 来源 | 备注 |
|---|---|---|---|---|
| `@tap-note/editor` | workspace | 自有 | FEAT-001 | 编辑器 |
| `@tap-note/ai-core` | workspace | 自有 | FEAT-002 | transport/busy |
| `@tap-note/ai-inline` | workspace | 自有 | FEAT-003 | /inline、/both |
| `@tap-note/ai-chat` | workspace | 自有 | FEAT-004 | /chat、/both |
| `@workspace/ui` | workspace | MIT | 代码库现状 | shadcn 组件 |
| `vite` | 8 | MIT | 代码库现状 | dev proxy |
| `react` | 19 | MIT | 代码库现状 | — |
| 路由库 | 待确认 | MIT | SUB-002 §11 | React Router vs 最小路由实现，实施时定 |

> 实施前确认 demo 路由库选择（React Router vs 最小路由实现），不改变既定 URL `/inline`、`/chat`、`/both`。

## 12. 备选方案与决策

- 路由：React Router vs 最小状态切换——实施时定，SUB-002 已授权两者皆可，不改变 URL。
- transport：默认服务端 streamText（总 PRD v1 决策）；P1 可选 `createProxyTransport`（总 PRD §17 item 7）。
- 单页混合 vs 多路由：总 PRD v3 决策多路由独立 demo，便于演示与二次开发。

## 13. 技术风险与待确认

- demo 路由库选择（React Router vs 最小实现）待实施时定（SUB-002 §11）。
- MVP 是否同时提供英文（总 PRD §17 item 6）。
- 是否需要客户端 `ClientSideTransport + 代理` 模式（总 PRD §17 item 7）。
- demo 开发态 JWT 注入方式与生产 BFF 集成方式需与部署方对齐（FEAT-005 §11）。
