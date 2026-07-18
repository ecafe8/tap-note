## Why

当前工作区只有 Vite + React 占位应用，`packages/tap-note-editor` 尚未实现，后续 AI 核心、内联助手、对话助手和参考应用都缺少稳定的编辑器承载层。现在先交付一个授权干净、可独立集成的 BlockNote 风格编辑器，可以建立整个 MVP 的基础，并在进入 AI 实现前验证 React 19、BlockNote、Tailwind 4 与 shadcn 组件基线的实际兼容性。

## What Changes

- 新增 `@tap-note/editor` workspace 包，提供 `TapNoteEditor` 组件和 `useCreateTapNoteEditor` hook。
- 封装 `@blocknote/core`、`@blocknote/react` 与 `@blocknote/shadcn`，默认提供块编辑、slash 菜单、格式工具栏、拖拽重排、缩进嵌套和主题能力。
- 定义 `initialContent`、`editable`、`theme`、`onChange`、字典以及可选 AI 助手挂载点的公开 API。
- 暴露编辑器实例，使后续 `ai-core` 能够执行块插入、更新和删除操作。
- 添加默认 zh-CN 字典和可覆盖的本地化接口。
- 验证 BlockNote 组件基线与 Tailwind 4 样式接入，不默认依赖私有 `@workspace/ui`；宿主 shadcn 组件只允许经过兼容性验证后局部覆盖。
- 将编辑器临时接入 `apps/web` 进行渲染、编辑和样式冒烟验证。
- 为包建立 `bun:test` 测试基础设施，覆盖核心 props、hook、助手挂载和字典行为。
- 检查生产依赖闭包，确保不引入任何 `@blocknote/xl-*`、GPL 或 AGPL 依赖。
- 补充包 README、Tailwind 4 样式接入说明和公开 API 文档。

## Capabilities

### New Capabilities

- `editor`: 提供可编辑的 BlockNote 风格编辑器组件、编辑器实例 hook、主题/本地化和后续 AI 助手挂载接口。

### Modified Capabilities

无。当前 `openspec/specs/` 尚无既有能力规范。

## Impact

- 新增 `packages/tap-note-editor` 包及其源码、测试、配置和文档。
- 修改 `apps/web` 的 workspace 依赖、TypeScript 路径和临时冒烟页面。
- 修改 `packages/ui/src/styles/globals.css`，补充 BlockNote shadcn 的 Tailwind 4 扫描入口。
- 根 workspace 增加测试编排所需的脚本和 Turbo task。
- 新增并锁定 BlockNote 相关依赖及测试依赖，必须通过 lockfile 和许可证闭包检查。
- 不修改后端 API，不实现 AI 协议、文档持久化、导出、账号或协作能力；npm 发布构建配置仍属于后续 FEAT-007。
