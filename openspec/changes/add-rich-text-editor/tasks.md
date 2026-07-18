## 1. 依赖与 API 研究闸门

- [x] 1.1 阅读 `resource/BlockNote` 中与 `useCreateBlockNote`、`BlockNoteView` 和 shadcn 组件装配相关的源码,记录可直接采用的 API 形状和禁止复制的参考边界
- [x] 1.2 使用 Context7 查询当前 BlockNote 官方文档,确认 React seam、`initialContent`、`editable`、`theme` 和 `onChange` 的用法
- [x] 1.3 核对 npm registry、现有 lockfile 和 React 19 兼容性,确定 `@blocknote/core`、`@blocknote/react`、`@blocknote/shadcn` 的精确版本
- [x] 1.4 确认 `BlockNoteView` 的默认 `ShadCNDefaultComponents` 和 `Partial<ShadCNComponents>` override 类型,记录是否存在 `@workspace/ui` 局部复用机会
- [x] 1.5 确认 BlockNote shadcn 在 Tailwind 4 下所需的 `@source` 路径、CSS 变量和样式入口
- [x] 1.6 将 1.1-1.5 的结论写入 `docs/prd/sub-editor-experience/feat-rich-text-editor/tech.md`,包括最终版本、不可行方案和仍待确认风险
- [x] 1.7 运行一个最小 React 19 + BlockNote 渲染实验,确认目标版本可以创建 editor、渲染 view 并完成至少一次 blocks 变更
- [x] 1.8 只有 1.1-1.7 全部有可复核结果后,才允许进入第 2 组;若研究结论改变目标方案,先更新本 change 的 design.md 和任务依赖

## 2. 包基础设施

- [x] 2.1 参照 `packages/ui` 创建 `packages/tap-note-editor` 目录和 `package.json`,包名固定为 `@tap-note/editor`,MVP 标记为 workspace 源码消费
- [x] 2.2 为编辑器包创建严格 TypeScript 配置,启用 ES2022/DOM/ESNext/bundler/react-jsx/strict/noEmit,并配置包内路径别名
- [x] 2.3 为编辑器包创建 ESLint 配置,保持与 `packages/ui` 相同的 TypeScript、React Hooks 和 React Refresh 规则
- [x] 2.4 创建 `src/index.ts` 空入口和最小公开导出骨架,使包可以被 TypeScript 解析但不提前承诺未实现 API
- [x] 2.5 为 `apps/web` 增加 `@tap-note/editor: workspace:*` 依赖和源码路径映射,确认编辑器包可被 Vite 解析
- [x] 2.6 将确定后的 BlockNote 运行时依赖写入编辑器包,只加入已在第 1 组锁定的版本
- [x] 2.7 执行 `bun install`,检查 lockfile 变更仅包含预期依赖,并确认依赖树没有 `@blocknote/xl-*`
- [x] 2.8 分别运行编辑器包和 web 的 `typecheck`、`lint`,修复基础配置问题后再进入核心实现

## 3. 编辑器实例与公开类型

- [x] 3.1 创建 `src/types.ts`,定义 `TapNoteEditorProps` 的基础 props: `initialContent`、`editable`、`theme` 和 `onChange`
- [x] 3.2 在 `src/types.ts` 中定义 editor hook 的 options 和最小 editor 实例导出类型,确保后续 ai-core 可调用 BlockNote 块操作
- [x] 3.3 在 `src/use-create-tap-note-editor.ts` 中封装 `useCreateBlockNote({ initialContent })`
- [x] 3.4 为 hook 处理初始内容初始化异常,明确空文档回退和 `console.warn` 诊断行为
- [x] 3.5 编写 hook 的最小类型检查或测试 fixture,确认返回值可传给 `BlockNoteView` 并暴露后续块操作所需实例能力
- [x] 3.6 从 `src/index.ts` 导出 `useCreateTapNoteEditor`、相关 props 类型和 editor 类型
- [x] 3.7 运行编辑器包 typecheck,确认 `import type`、React 19 和 BlockNote 类型没有冲突

## 4. TapNoteEditor 核心组件

- [x] 4.1 创建 `src/tap-note-editor.tsx`,使用 `useCreateTapNoteEditor` 创建 editor 并使用 `@blocknote/shadcn` 的 `BlockNoteView` 渲染
- [x] 4.2 将 `initialContent` 从组件 props 传入 hook,不得把它错误地传给只负责视图渲染的 `BlockNoteView`
- [x] 4.3 将 `editable` 透传到视图,默认值设为可编辑,并验证只读状态不显示可执行编辑入口
- [x] 4.4 将 `theme` 透传到视图并验证 light/dark 两种值的类型和渲染行为
- [x] 4.5 将 BlockNote 的变更事件转换为最新 blocks 并调用 `onChange`,不引入持久化或内部服务状态
- [x] 4.6 默认使用完整 `ShadCNDefaultComponents`,不要直接导入 `@workspace/ui`
- [x] 4.7 增加可选的 `shadCNComponents` 局部 override,只覆盖传入字段并保留其余默认组件
- [x] 4.8 将组件和 `TapNoteEditorProps` 从 `src/index.ts` 导出
- [x] 4.9 运行包 typecheck 和 lint,确认组件公开 API 与 editor hook 类型一致

## 5. AI 挂载点与本地化

- [x] 5.1 在 `src/types.ts` 定义 `TapNoteInlineAssistant`、`TapNoteChatAssistant` 和 `TapNoteAIBusyState` 的最小结构接口,不引入尚不存在的 AI 包
- [x] 5.2 将 `inlineAssistant`、`chatAssistant` 和 `aiBusyState` 加入 `TapNoteEditorProps`
- [x] 5.3 实现无助手时的安全行为:不渲染 AI 入口、不发起请求、不因缺少 AI 依赖而报错
- [x] 5.4 实现助手存在性和接口兼容性检查,不兼容时发出脱敏 `console.warn` 并忽略该挂载点
- [x] 5.5 实现 busy 状态消费,使对应入口显示禁用态和文字状态提示,不在编辑器内部创建第二份 busy 状态
- [x] 5.6 创建 `src/i18n/zh-cn.ts`,定义完整的 `TapNoteDictionary` 类型和默认 zh-CN 字典
- [x] 5.7 实现 `dictionary` 的 Partial 合并逻辑,未覆盖字段保持默认值
- [x] 5.8 从 `src/index.ts` 导出助手接口、busy 类型、字典类型和默认 zh-CN 字典
- [x] 5.9 运行 typecheck 和 lint,确认编辑器包对 AI 包仍保持单向结构依赖

## 6. Tailwind 与 shadcn 样式验证

- [x] 6.1 在 `packages/ui/src/styles/globals.css` 增加经过研究确认的 BlockNote shadcn `@source` 配置
- [x] 6.2 确认 monorepo 现有 CSS 变量满足 BlockNote 默认组件基线,不为未经验证的组件盲目安装新 shadcn 组件
- [x] 6.3 如确需通过 shadcn CLI 安装组件,先用 Context7 查询当前官方命令、依赖和 Tailwind 兼容要求,再单独记录安装结果
- [x] 6.4 在编辑器包中建立样式入口或 README 样式接入说明,使独立宿主知道必须配置的 `@source`、变量和 CSS 文件
- [x] 6.5 在 `apps/web` 中启动开发服务器,验证编辑器正文、slash 菜单、格式工具栏、拖拽控件和主题样式可见且无明显 Tailwind 缺失
- [x] 6.6 创建最小外部消费验证项目或等价隔离验证,确认编辑器不依赖 monorepo 私有 CSS 才能显示基础样式
- [x] 6.7 将最终样式策略、路径稳定性和局部 override 结论写入 feat tech.md

## 7. 自动化测试基础设施

- [x] 7.1 在根 `package.json` 增加 `test` workspace 脚本,并在 `turbo.json` 增加 test task
- [x] 7.2 为编辑器包增加 `bun:test` 脚本和测试依赖,版本以 Bun 兼容性验证结果锁定
- [x] 7.3 创建 `bunfig.toml`,配置 happy-dom 全局注册 preload
- [x] 7.4 创建 Testing Library 初始化 preload,使 React 组件测试具备统一 DOM 环境
- [x] 7.5 编写 hook 测试,覆盖合法 initialContent、返回 editor 实例和初始化异常回退
- [x] 7.6 编写组件测试,覆盖默认渲染、`editable=false`、theme 和 onChange
- [x] 7.7 编写助手挂载测试,覆盖未注入时入口缺失、注入时存在和 busy 时禁用
- [x] 7.8 编写字典测试,覆盖默认 zh-CN 和 Partial 覆盖合并
- [x] 7.9 让测试不依赖网络、真实模型、后端或持久化服务,避免把集成问题伪装成组件测试
- [x] 7.10 运行编辑器包 `bun test`,修复测试环境问题并保留稳定的行为断言而非脆弱 DOM 内部断言

## 8. Web 冒烟与质量门禁

- [x] 8.1 在 `apps/web/src/App.tsx` 临时挂载 `TapNoteEditor`,提供少量合法初始 blocks 并标记 `TODO(FEAT-006)`
- [x] 8.2 人工验证回车建块、slash 菜单、拖拽重排、缩进嵌套、格式工具栏和只读状态
- [x] 8.3 人工验证 light/dark 主题、窄屏布局、键盘导航、焦点恢复和状态提示
- [x] 8.4 人工验证 `onChange` 能收到最新 blocks,且刷新页面后内容丢失符合纯组件约定
- [x] 8.5 运行根 `bun run typecheck`,确认 workspace 依赖和所有受影响包通过
- [x] 8.6 运行根 `bun run lint`,确认新增包、web 和样式相关改动通过
- [x] 8.7 运行根 `bun run test`,确认 Turbo 能发现并执行编辑器测试
- [x] 8.8 运行根 `bun run build`,确认 Vite 能编译编辑器包和 web 冒烟应用

## 9. 授权、文档与收尾

- [x] 9.1 生成 `@tap-note/editor` 的生产依赖闭包清单,确认无 `@blocknote/xl-ai`、`xl-ai-server`、`xl-pdf-exporter`、`xl-docx-exporter`、`xl-multi-column` 或其他 GPL/AGPL 依赖
- [x] 9.2 将依赖闭包和许可证检查结果写入 feat tech.md,发现禁止依赖时阻塞 change 完成
- [x] 9.3 编写 `packages/tap-note-editor/README.md`,包含最小接入示例、props 表、hook 示例和纯组件边界
- [x] 9.4 在 README 中写明 Tailwind 4 `@source`、CSS 变量、默认 shadcn 基线和局部 override 规则
- [x] 9.5 在 README 中写明默认 zh-CN、字典覆盖、助手挂载点和 busy 状态的使用边界
- [x] 9.6 为 `src/index.ts` 的公开导出补充简洁 JSDoc,确保 API 意图和类型用途清晰
- [x] 9.7 检查所有新增目录和文件遵循 kebab-case、index 入口和项目 TypeScript 命名约定
- [x] 9.8 记录 FEAT-006 接管后需要清理的临时 `apps/web` 冒烟代码和路径映射
- [x] 9.9 最终复核 editor spec 的每条 requirement 都有代码、测试或人工验收对应物
- [x] 9.10 只有 typecheck、lint、test、build、冒烟和许可证检查全部通过后,才将 change 标记为可归档
