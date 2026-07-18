## Purpose

定义 `editor` 能力:为 TapNote 提供可编辑的 BlockNote 风格编辑器组件、编辑器实例 hook、主题与本地化能力,以及后续 AI 助手挂载接口。该能力保持纯组件与授权边界,不承载文档持久化、账号、协作或导出职责。

## Requirements

### Requirement: 提供可编辑的 TapNoteEditor 组件

系统 SHALL 提供 `TapNoteEditor` React 组件,接收 BlockNote blocks JSON 作为初始内容,并默认渲染可编辑的块状文档体验。

#### Scenario: 使用合法初始内容渲染

- **WHEN** 集成方传入合法的 `initialContent`
- **THEN** 组件 SHALL 渲染对应文档,并允许回车建块、slash 菜单、拖拽重排、缩进嵌套和格式工具栏操作

#### Scenario: 初始内容非法

- **WHEN** `initialContent` 无法被 BlockNote editor 接受
- **THEN** 组件 SHALL 回退到空文档,通过 `console.warn` 提供诊断,且不得阻断应用渲染

### Requirement: 支持编辑状态、主题和变更回调

`TapNoteEditor` SHALL 支持 `editable`、`theme` 和 `onChange` props。`editable=false` 时 SHALL 禁止文档编辑入口,主题变化 SHALL 作用于编辑器视图,文档发生变化时 SHALL 通过 `onChange` 提供最新 blocks。

#### Scenario: 只读编辑器

- **WHEN** 集成方传入 `editable={false}`
- **THEN** 编辑器 SHALL 呈现文档但禁止输入、slash、格式化、拖拽和缩进操作

#### Scenario: 文档变更通知

- **WHEN** 用户完成一次文档变更
- **THEN** 组件 SHALL 调用 `onChange` 并传递最新的 BlockNote blocks

### Requirement: 暴露编辑器实例创建 hook

系统 SHALL 提供 `useCreateTapNoteEditor` hook,其返回的 editor 实例 SHALL 可供后续功能读取文档并执行 BlockNote 支持的块插入、更新和删除操作。

#### Scenario: 创建编辑器实例

- **WHEN** 集成方调用 `useCreateTapNoteEditor` 并传入初始内容
- **THEN** hook SHALL 返回与 `TapNoteEditor` 兼容的 editor 实例,且实例初始化使用该初始内容

### Requirement: 提供兼容的 shadcn 组件基线和样式接入

系统 SHALL 默认使用 `@blocknote/shadcn` 提供的完整组件基线,不得要求独立发布包依赖私有 `@workspace/ui`。系统 SHALL 文档化宿主 Tailwind 4 的 `@source`、CSS 变量和样式接入要求。

#### Scenario: 默认组件基线

- **WHEN** 集成方未传入宿主组件覆盖
- **THEN** 编辑器 SHALL 使用 BlockNote 自带的兼容 shadcn 组件,并显示菜单、工具栏等默认 UI

#### Scenario: 局部组件覆盖

- **WHEN** 集成方传入通过 `ShadCNComponents` 契约验证的局部组件
- **THEN** 系统 SHALL 只覆盖指定组件,未覆盖组件继续使用默认基线

### Requirement: 提供 AI 助手挂载和会话忙状态接口

编辑器 SHALL 接受可选的 `inlineAssistant`、`chatAssistant` 和 `aiBusyState` 挂载接口,但不得在本能力中实现 AI 协议或网络调用。未注入助手时 SHALL 不显示 AI 入口。

#### Scenario: 未注入助手

- **WHEN** 集成方未提供 AI 助手实例
- **THEN** 编辑器 SHALL 正常工作,且不显示 AI 入口或发起 AI 请求

#### Scenario: AI 忙状态

- **WHEN** 注入的会话级 busy state 表示某个 AI 任务正在执行
- **THEN** 对应的 AI 入口 SHALL 呈现禁用状态和可理解的状态提示,编辑器本身不得创建第二个独立 busy 状态

### Requirement: 支持默认 zh-CN 字典和局部覆盖

系统 SHALL 提供默认 zh-CN 字典以及 `TapNoteDictionary` 类型,并允许集成方通过 `dictionary` prop 覆盖部分文案。

#### Scenario: 默认中文文案

- **WHEN** 集成方不传入 `dictionary`
- **THEN** 编辑器相关文案 SHALL 使用默认 zh-CN 字典

#### Scenario: 覆盖部分文案

- **WHEN** 集成方传入部分字典
- **THEN** 系统 SHALL 合并覆盖指定字段,未指定字段 SHALL 保留默认值

### Requirement: 保持纯组件和授权边界

编辑器包 SHALL 不提供文档持久化、账号、协作或导出 API,且生产依赖闭包 SHALL 不包含 `@blocknote/xl-*`、GPL 或 AGPL 依赖。

#### Scenario: 纯组件行为

- **WHEN** 页面刷新或组件卸载
- **THEN** 编辑器包 SHALL 不声称保存或恢复文档,文档持久化责任 SHALL 由集成方承担

#### Scenario: 依赖许可证检查

- **WHEN** 检查编辑器包的依赖树和 lockfile
- **THEN** 结果 SHALL 不包含禁止的 BlockNote XL 包、GPL 依赖或 AGPL 依赖

### Requirement: 提供基础可访问性和验证覆盖

系统 SHALL 保持编辑器、slash 菜单和格式工具栏的键盘操作与焦点恢复能力,并为公开 props、hook、助手挂载和字典行为提供自动化测试。

#### Scenario: 键盘和焦点交互

- **WHEN** 用户通过键盘打开菜单、选择命令或完成操作
- **THEN** 焦点 SHALL 按组件语义恢复或移动,状态提示不得只依赖颜色表达

#### Scenario: 自动化质量门禁

- **WHEN** 执行项目约定的 typecheck、lint 和 bun test
- **THEN** 编辑器包的契约测试 SHALL 全部通过,且测试不得依赖真实 LLM、网络或持久化服务
