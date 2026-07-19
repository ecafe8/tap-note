/**
 * 根据 toolCallId 从 messages 中查找 tool-call part 的目标块 ID。
 * 供 ToolResultBubble 渲染时获取 targetBlockId。
 */
export function findTargetBlockIdFromMessages(
  messages: Array<{ parts?: Array<{ type?: string; toolCallId?: string; input?: unknown }> }>,
  toolCallId: string,
): string | undefined {
  for (const m of messages) {
    if (!m.parts) continue
    for (const p of m.parts) {
      if (p.type === 'tool-call' && p.toolCallId === toolCallId) {
        const input = p.input as { targetBlockId?: string; referenceBlockId?: string } | undefined
        return input?.targetBlockId ?? input?.referenceBlockId
      }
    }
  }
  return undefined
}
