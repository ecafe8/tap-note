/**
 * Block ID 协议后缀处理。
 *
 * `DocumentStateBuilder` 在把 block 发给模型前给每个 block id 加 `$` 后缀
 * (参见 `document-state-builder.ts` 的 `suffixBlockIds`),作为「这是应用层标记过的
 * ID」的信号,并让幻觉的纯 UUID 在 lookup 时找不到块而被拦截。
 *
 * 模型回传的 `referenceBlockId`/`targetBlockId`/`targetBlockIds` 会带 `$`。
 * **剥离只发生在进入 BlockNote editor API 的边界**;回显给模型的 operation 仍保留 `$`。
 */

/** 剥掉单个 block id 的 `$` 后缀。不带 `$` 时原样返回(向后兼容直接调用路径)。 */
export function stripBlockIdSuffix(id: string): string {
  return id.endsWith('$') ? id.slice(0, -1) : id
}

/** 批量剥掉 block id 数组的 `$` 后缀。 */
export function stripBlockIdSuffixList(ids: string[]): string[] {
  return ids.map(stripBlockIdSuffix)
}
