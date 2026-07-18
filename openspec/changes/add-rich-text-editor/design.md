## Context

当前仓库是 Bun + Turbo monorepo。`apps/web` 是 Vite + React 19 占位应用，`packages/ui` 是私有的 base-nova shadcn 组件包，`packages/tap-note-editor` 尚不存在。产品要求发布包保持授权干净、默认中文、纯组件且不内置持久化；后续 `ai-core` 需要拿到 BlockNote editor 实例执行块操作。

本 change 同时触及新包、demo 消费端、Tailwind 样式扫描和测试编排，因此需要在实现前固定依赖/API、明确包边界和验证闸门。

## Goals / Non-Goals

**Goals:**

- 创建可被 workspace 消费的 `@tap-note/editor` 源码包。
- 用 BlockNote 官方 React seam 创建和渲染编辑器，保留 `@blocknote/shadcn` 的完整默认组件基线。
- 暴露稳定的编辑器 props、editor hook、AI 挂载点、busy 状态接口和 zh-CN 字典接口。
- 在最小 demo 中验证 React 19、BlockNote 0.51.x、Tailwind 4 和 shadcn 样式组合。
- 用 `bun:test` 建立组件级回归测试，并完成依赖和许可证闭包检查。

**Non-Goals:**

- 不实现 AI operation schema、documentState、流式解析、accept/reject 或聊天面板。
- 不实现 server-api、JWT、模型路由、HTTP transport 或持久化。
- 不实现 PDF/DOCX/Markdown/HTML 导出、字体工具、账号和协作。
- 不在 MVP 阶段引入 npm 发布构建或 tsup；发布配置属于 FEAT-007。
- 不默认绑定私有 `@workspace/ui`，也不为了视觉统一而替换整个 BlockNote shadcn 组件体系。

## Decisions

### 1. 先验证依赖和 API,再创建运行时包

T-001 是硬闸门。实现者必须通过 Context7、`resource/BlockNote` 源码阅读、npm registry/lockfile 和最小运行验证，确认 `@blocknote/core`、`@blocknote/react`、`@blocknote/shadcn` 的版本与 React 19 兼容性，再执行后续依赖和实现任务。

备选方案是直接按 PRD 中的目标版本安装。放弃原因是 BlockNote React seam、shadcn 参数和 Tailwind 4 接入一旦不匹配，会让后续任务全部建立在错误 API 上。

### 2. 使用官方 React seam,编辑器采用非受控模型

`useCreateTapNoteEditor` 封装 `useCreateBlockNote({ initialContent })`，`TapNoteEditor` 用 `BlockNoteView` 渲染并透传 `editable`、`theme`、`onChange`。文档内容驻留 editor 实例内存，由 `onChange` 通知集成方。

备选方案是由 `TapNoteEditor` 自己维护 blocks 受控状态。放弃原因是会重复实现 BlockNote 的 transaction 生命周期，容易与后续 AI 建议 transaction 和 editor 实例操作产生冲突。

### 3. 默认使用 BlockNote 自带 shadcn 组件基线

`BlockNoteView` 默认使用完整 `ShadCNDefaultComponents`。仅当通过 `ShadCNComponents` 接口验证兼容时，才允许局部注入宿主组件；本 change 不直接导入 `@workspace/ui`。

备选方案是直接复用 `@workspace/ui` 全套组件。放弃原因是当前包基于 `@base-ui/react`，而 BlockNote shadcn 组件可能依赖不同组件契约，且会破坏独立发布包不依赖私有 workspace 包的边界。

### 4. 将 AI 挂载点定义为最小结构接口

编辑器只保存并转交 `inlineAssistant`、`chatAssistant` 和 `aiBusyState` 的最小接口，不实现 AI 逻辑。接口必须允许 FEAT-002/003/004 注入助手能力，同时避免编辑器包依赖尚未存在的 AI 包。

备选方案是让编辑器直接依赖 `@tap-note/ai-core`、`@tap-note/ai-inline` 和 `@tap-note/ai-chat`。放弃原因是会形成循环依赖，并把编辑器基础包与 AI 功能强耦合。

### 5. 将样式验证拆成 monorepo 和独立消费两条路径

monorepo demo 在 `packages/ui/src/styles/globals.css` 增加 BlockNote 的 Tailwind 4 `@source`；包 README 同时记录独立宿主项目所需的 `@source`、CSS 变量和样式入口。两条路径都必须有可验证结果，不能只依赖当前仓库的全局 CSS。

备选方案是只修改 monorepo 全局 CSS。放弃原因是发布包的集成开发者不会拥有本仓库的 CSS 配置，无法满足独立集成目标。

### 6. 测试基础设施与功能实现分开

先建立 `bun:test`、happy-dom preload 和 Testing Library 初始化，再编写组件测试。测试覆盖 props、回调、hook、字典、助手挂载与 busy 禁用等契约，不把浏览器人工冒烟当作唯一验证。

## Risks / Trade-offs

- [BlockNote 版本或 React 19 兼容性不成立] → T-001 必须阻塞 T-003；若目标版本不可用，先更新 feat tech.md 和本 change 设计，不带着未知 API 继续实现。
- [Tailwind 4 `@source` 在 workspace hoisting 下路径不稳定] → 分别验证 monorepo 和最小外部消费项目；必要时采用包 README 明确要求的宿主扫描路径，而不是依赖隐式 hoisting。
- [`@workspace/ui` 与 BlockNote shadcn 组件契约不兼容] → 默认保留 BlockNote 自带基线，只做经过类型和视觉验证的局部 override。
- [非法 `initialContent` 导致组件初始化失败] → 在编辑器创建边界捕获初始化异常，回退为空文档并发出脱敏 `console.warn`；测试覆盖该路径。
- [助手类型与后续 AI 包发生漂移] → 只定义最小结构接口，并在 FEAT-002/003/004 接入时通过跨包类型测试校准，不在本 change 预先实现 AI 细节。
- [测试环境无法完整模拟 BlockNote DOM] → 保留纯类型/契约测试，并将 slash、拖拽、缩进、工具栏作为 `apps/web` 浏览器冒烟验收；不要用脆弱的 DOM 内部实现断言替代行为验证。
- [新增依赖闭包意外引入 GPL/AGPL 或 XL 包] → 安装后立即执行依赖树和 lockfile 检查，任务收尾前再次复核，发现禁止依赖时阻塞完成。

## Migration Plan

这是新能力，没有现有运行时数据或公开 API 需要迁移。

1. 先完成研究闸门并锁定依赖。
2. 创建包并在 workspace 中接入 `apps/web` 临时冒烟页。
3. 通过类型检查、lint、单元测试、开发服务器人工验证和许可证检查。
4. FEAT-006 接管 demo 多路由后，删除本 change 添加的临时冒烟挂载，但保留 `@tap-note/editor` 包 API。

回滚方式是移除 web 的 workspace 依赖和临时挂载；新包为纯内存组件，不产生数据迁移或持久化兼容问题。

## Open Questions

- BlockNote 目标版本最终是否保持 `0.51.4`，由 T-001 的官方文档、registry 和最小 demo 结果决定。
- `@workspace/ui` 的 Button 是否能作为局部 `shadCNComponents` override，只有实测通过后才决定；它不是本 change 的阻塞依赖。
- `@tap-note/*` 最终 npm scope 仍由总 PRD 待确认；本 change 暂按 `@tap-note/editor` 作为 workspace 包名。
- happy-dom 与 Testing Library 的具体版本由安装时 lockfile 和 Bun 兼容性确定。
