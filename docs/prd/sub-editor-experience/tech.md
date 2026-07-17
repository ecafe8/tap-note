# 技术方案：编辑器体验

## 0. 文档信息

- Sub ID：SUB-002；状态：草稿；依据：总 PRD v7。

## 1. 当前项目事实

- `apps/web` 使用 Vite 8、React 19、Tailwind 4 和 `@workspace/ui`，`App.tsx` 仍是模板占位。
- `packages/tap-note-editor` 尚不存在；不得把规划目录写成已实现事实。

## 2. 架构与职责

`@tap-note/editor` 只封装 BlockNote 创建、默认 UI 与受控/非受控桥接；`apps/web` 只装配 demo 路由与配置；AI 能力由注入的 SUB-003 实例提供。编辑器不导入 server-api、导出器或字体工具。

```text
apps/web -> @tap-note/editor -> BlockNote core/react/shadcn
              |                    |
              +-> optional SUB-003 assistants
apps/web -> /api proxy -> SUB-004
```

```mermaid
flowchart LR
  W[apps/web] --> E[@tap-note/editor]
  E --> B[BlockNote]
  W --> A[SUB-003 assistants]
  A --> E
  W --> P[SUB-004 API]
```

## 3. 领域、接口与集成

- 文档领域边界是 `PartialBlock[]`/BlockNote editor 实例；持久化语义明确属于集成方。
- `TapNoteEditor` 应暴露初始内容、`editable`、主题和文档变更回调，不承诺后端契约。
- 共享 busy state 由 ai-core 逐编辑器会话创建；编辑器只注入和呈现禁用状态。

## 4. 安全与质量

- 客户端不读 API Key，不信任模型列表外的 ID；HTTP 鉴权属于 SUB-004。
- 使用组件/路由测试验证 editor props 与 demo 装配；跨 sub 集成覆盖模型选择、AI 互斥和刷新无持久化；E2E 覆盖三路由。
- 发布前验证样式隔离、React 19/BlockNote 组合和打包产物许可证。

## 5. 发布、兼容与回滚

- editor 为独立包，demo 不是其运行时依赖。以 semver 维护公开 props；破坏性 schema/API 变更须同 SUB-006 发布说明。
- UI 回归可回滚独立 web 部署；包回滚通过上一稳定 npm 版本，不能改变集成方文档数据。

## 6. 方案依据与依赖记录

| 来源 | 日期 | 结论 |
|---|---|---|
| Context7 `/websites/blocknotejs` | 2026-07-17 | 官方 React seam 为 `useCreateBlockNote` + `BlockNoteView`；适合作为封装边界。 |
| BlockNote 官方仓库 | 2026-07-17 | core 采用 MPL-2.0，`xl-*` 为 GPL-3.0/商业授权；禁止把 XL 包作为依赖。 |
| 总 PRD | 2026-07-17 | 选用 BlockNote 0.51.4、React 19，具体安装版本仍须最小 demo 验证。 |

备选：直接暴露 BlockNote UI 的工作量小但无法稳定 tap-note API；包装一层增加维护成本但满足产品目标，因此采用后者。

## 7. 风险与待确认

- shadcn 样式和 `tailwind-merge` 版本冲突尚未实测。
- BlockNote 精确 API 与依赖版本须在 FEAT-001 开始时再次以官方文档及 lockfile 确认。
