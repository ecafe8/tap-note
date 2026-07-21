## MODIFIED Requirements

### Requirement: 提供 BlockOperation Zod schema 与类型

系统 SHALL 提供 `BlockOperation` Zod schema 与派生类型,覆盖 `insertBlock`、`updateBlock`、`deleteBlock`、`replaceBlocks`、`moveBlock` 和 `replaceText` 六种操作。每个操作 MUST 携带 `baseDocumentRevision` 与目标块 ID 或前置条件。`replaceText` MUST 携带 `targetBlockId`、合法的 `from`/`to` 范围、`expectedText` 和 `replacement`。系统 SHALL 通过 Zod `.parse()` 校验非法操作,校验失败时抛出 `ZodError`,不静默忽略。

#### Scenario: 合法 block 操作校验通过

- **WHEN** 调用方传入携带 `baseDocumentRevision` 与 `targetBlockId` 的 `updateBlock` 操作
- **THEN** `.parse()` SHALL 返回类型化的操作对象,字段与输入一致

#### Scenario: 合法文本替换校验通过

- **WHEN** 调用方传入 `replaceText` 的 revision、targetBlockId、`from`、`to`、`expectedText` 和 `replacement`
- **THEN** `.parse()` SHALL 返回类型化的文本替换操作

#### Scenario: 非法操作被拒绝

- **WHEN** 调用方传入缺少 `baseDocumentRevision`、目标块 ID、文本范围或 expectedText 的操作
- **THEN** `.parse()` SHALL 抛出 `ZodError`,错误信息包含失败路径,不返回部分结果

#### Scenario: 服务端与客户端共享同一 schema

- **WHEN** FEAT-005 服务端与 FEAT-003/004 客户端引用同一 `BlockOperation` schema
- **THEN** 两端 MUST 使用相同的 Zod schema 模块,不允许各自定义等价 schema

### Requirement: 提供 applyOperationsToEditor 经 suggest-changes 可回退应用

系统 SHALL 提供 `applyOperationsToEditor(editor, operations, { mode })`,经 `@handlewithcare/prosemirror-suggest-changes` 的 `suggestChanges`/`applySuggestions`/`revertSuggestions` 实现可回退应用。`mode: "suggest"` SHALL 创建建议事务;`mode: "apply"` SHALL 合并建议到正式文档;`mode: "revert"` SHALL 回退所属建议事务。执行器 MUST 在进入 BlockNote API 前剥离 block ID 的 `$` 协议后缀,并在 revision 或前置条件不满足时不修改文档。`replaceText` SHALL 在 expectedText compare-and-swap 校验通过后以原子事务执行。

#### Scenario: 建议事务可接受

- **WHEN** 调用 `applyOperationsToEditor(editor, ops, { mode: "suggest" })` 后调用 `mode: "apply"`
- **THEN** 建议 SHALL 合并到正式文档,undo 历史正确(接受后 undo 跳回写作前)

#### Scenario: 建议事务可拒绝

- **WHEN** 调用 `mode: "suggest"` 后用户手动编辑同一块,再调用 `mode: "revert"`
- **THEN** 系统 SHALL 只回退 AI 建议事务,不覆盖用户的手动编辑

#### Scenario: 带 `$` 的 block ID 正确应用

- **WHEN** 操作携带文档状态中的 `targetBlockId` 或 `referenceBlockId`(带 `$` 后缀)
- **THEN** 执行器 SHALL 查找并修改对应的真实 block,而不是返回目标块不存在

#### Scenario: revision 冲突不执行

- **WHEN** 操作的 `baseDocumentRevision` 与当前编辑器 revision 不匹配
- **THEN** 系统 SHALL 不执行该操作,返回可重试的冲突结果,不污染文档

#### Scenario: 文本范围 compare-and-swap 失败

- **WHEN** `replaceText` 的当前目标文本不等于 `expectedText` 或 range 非法
- **THEN** 系统 SHALL 不执行替换,返回前置条件失败结果

#### Scenario: 文本范围替换成功

- **WHEN** `replaceText` 的 revision、block、range 和 expectedText 均有效
- **THEN** 系统 SHALL 在一个事务中完成替换并返回更新后的 document revision
