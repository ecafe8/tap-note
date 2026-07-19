import { describe, expect, test } from 'bun:test'
import { executeClientTool, type ExecuteClientToolContext } from '../client-tools'
import type { BlockNoteEditor, BlockIdentifier } from '@blocknote/core'
import type { DocumentStateBuilder } from '@tap-note/ai-core'

/** 创建一个最小 mock editor 用于 client-tools 单元测试。 */
function createMockEditor(opts: {
  blocks?: Array<{ id?: string; type?: string; content?: unknown }>
  revision?: number
}): {
  editor: BlockNoteEditor
  documentStateBuilder: DocumentStateBuilder
  calls: { method: string; args: unknown[] }[]
} {
  const blocks = opts.blocks ?? [
    { id: 'b1', type: 'paragraph', content: 'hello' },
    { id: 'b2', type: 'paragraph', content: 'world' },
    { id: 'b3', type: 'paragraph', content: 'third' },
  ]
  const calls: { method: string; args: unknown[] }[] = []
  const currentRevision = opts.revision ?? 5

  const editor = {
    document: blocks,
    getBlock(id: BlockIdentifier) {
      const targetId = typeof id === 'string' ? id : (id as { id?: string }).id
      const found = blocks.find((b) => b.id === targetId)
      calls.push({ method: 'getBlock', args: [id] })
      return found
    },
    insertBlocks(toInsert: unknown[], refId: BlockIdentifier, position: 'before' | 'after') {
      calls.push({ method: 'insertBlocks', args: [toInsert, refId, position] })
      return toInsert.map((b) => ({ ...((b as object) ?? {}), id: 'new-id' }))
    },
    updateBlock(id: BlockIdentifier, update: unknown) {
      calls.push({ method: 'updateBlock', args: [id, update] })
      const target = blocks.find((b) => b.id === (typeof id === 'string' ? id : (id as { id?: string }).id))
      if (target) Object.assign(target, update)
      return target
    },
    removeBlocks(ids: BlockIdentifier[]) {
      calls.push({ method: 'removeBlocks', args: [ids] })
      for (const id of ids) {
        const idx = blocks.findIndex((b) => b.id === (typeof id === 'string' ? id : (id as { id?: string }).id))
        if (idx !== -1) blocks.splice(idx, 1)
      }
      return []
    },
    replaceBlocks(ids: BlockIdentifier[], newBlocks: unknown[]) {
      calls.push({ method: 'replaceBlocks', args: [ids, newBlocks] })
      const firstIdx = blocks.findIndex((b) => b.id === (typeof ids[0] === 'string' ? ids[0] : (ids[0] as { id?: string }).id))
      if (firstIdx !== -1) {
        const toRemoveCount = ids.length
        blocks.splice(firstIdx, toRemoveCount, ...newBlocks.map((b) => ({ ...((b as object) ?? {}), id: 'replaced-id' })))
      }
      return { inserted: newBlocks, removed: ids }
    },
  } as unknown as BlockNoteEditor

  const documentStateBuilder: DocumentStateBuilder = {
    get documentRevision() {
      return currentRevision
    },
    build() {
      return {
        format: 'blocks-json',
        schemaVersion: '0.51.4',
        documentRevision: currentRevision,
        blocks: blocks as DocumentStateBuilder extends { build: () => infer T } ? T : never,
      } as never
    },
    dispose() {},
  }

  return { editor, documentStateBuilder, calls }
}

function makeCtx(opts: {
  blocks?: Array<{ id?: string; type?: string; content?: unknown }>
  revision?: number
  contextMode?: 'selection' | 'full' | 'none'
  allowSnapshotTool?: boolean
}): ExecuteClientToolContext & { calls: { method: string; args: unknown[] }[] } {
  const { editor, documentStateBuilder, calls } = createMockEditor({
    blocks: opts.blocks,
    revision: opts.revision,
  })
  return {
    editor,
    documentStateBuilder,
    contextMode: opts.contextMode ?? 'none',
    allowSnapshotTool: opts.allowSnapshotTool ?? true,
    calls,
  }
}

describe('executeClientTool: insertBlock', () => {
  test('成功插入', async () => {
    const ctx = makeCtx({ revision: 5 })
    const result = await executeClientTool('insertBlock', {
      block: { type: 'paragraph', content: 'new' },
      referenceBlockId: 'b2',
      position: 'after',
      baseDocumentRevision: 5,
    }, ctx)
    expect(result).toEqual({ ok: true, currentDocumentRevision: 5 })
    expect(ctx.calls.find((c) => c.method === 'insertBlocks')).toBeDefined()
  })

  test('revision 冲突返回 ConflictResult', async () => {
    const ctx = makeCtx({ revision: 7 })
    const result = await executeClientTool('insertBlock', {
      block: { type: 'paragraph' },
      referenceBlockId: 'b2',
      position: 'after',
      baseDocumentRevision: 5,
    }, ctx)
    expect(result).toMatchObject({ kind: 'conflict', reason: 'revision-mismatch' })
    expect(ctx.calls.find((c) => c.method === 'insertBlocks')).toBeUndefined()
  })

  test('前置条件冲突:referenceBlockId 不存在', async () => {
    const ctx = makeCtx({ revision: 5 })
    const result = await executeClientTool('insertBlock', {
      block: { type: 'paragraph' },
      referenceBlockId: 'not-exist',
      position: 'after',
      baseDocumentRevision: 5,
    }, ctx)
    expect(result).toMatchObject({ kind: 'conflict', reason: 'precondition-failed' })
    expect(ctx.calls.find((c) => c.method === 'insertBlocks')).toBeUndefined()
  })
})

describe('executeClientTool: updateBlock', () => {
  test('成功更新', async () => {
    const ctx = makeCtx({ revision: 3 })
    const result = await executeClientTool('updateBlock', {
      targetBlockId: 'b2',
      block: { type: 'paragraph', content: 'updated' },
      baseDocumentRevision: 3,
    }, ctx)
    expect(result).toEqual({ ok: true, currentDocumentRevision: 3 })
    expect(ctx.calls.find((c) => c.method === 'updateBlock')).toBeDefined()
  })

  test('前置条件冲突:targetBlockId 不存在', async () => {
    const ctx = makeCtx({ revision: 3 })
    const result = await executeClientTool('updateBlock', {
      targetBlockId: 'b-missing',
      block: { type: 'paragraph' },
      baseDocumentRevision: 3,
    }, ctx)
    expect(result).toMatchObject({ kind: 'conflict', reason: 'precondition-failed' })
  })
})

describe('executeClientTool: deleteBlock', () => {
  test('成功删除', async () => {
    const ctx = makeCtx({ revision: 1 })
    const result = await executeClientTool('deleteBlock', {
      targetBlockId: 'b2',
      baseDocumentRevision: 1,
    }, ctx)
    expect(result).toEqual({ ok: true, currentDocumentRevision: 1 })
    expect(ctx.calls.find((c) => c.method === 'removeBlocks')).toBeDefined()
  })
})

describe('executeClientTool: replaceBlocks', () => {
  test('成功替换', async () => {
    const ctx = makeCtx({ revision: 4 })
    const result = await executeClientTool('replaceBlocks', {
      targetBlockIds: ['b1', 'b2'],
      blocks: [{ type: 'paragraph', content: 'merged' }],
      baseDocumentRevision: 4,
    }, ctx)
    expect(result).toEqual({ ok: true, currentDocumentRevision: 4 })
    expect(ctx.calls.find((c) => c.method === 'replaceBlocks')).toBeDefined()
  })

  test('前置条件冲突:targetBlockIds 中有不存在', async () => {
    const ctx = makeCtx({ revision: 4 })
    const result = await executeClientTool('replaceBlocks', {
      targetBlockIds: ['b1', 'missing'],
      blocks: [{ type: 'paragraph' }],
      baseDocumentRevision: 4,
    }, ctx)
    expect(result).toMatchObject({ kind: 'conflict', reason: 'precondition-failed' })
  })
})

describe('executeClientTool: moveBlock', () => {
  test('成功移动(用 replaceBlocks 等价实现)', async () => {
    const ctx = makeCtx({ revision: 2 })
    const result = await executeClientTool('moveBlock', {
      targetBlockId: 'b1',
      referenceBlockId: 'b3',
      position: 'after',
      baseDocumentRevision: 2,
    }, ctx)
    expect(result).toEqual({ ok: true, currentDocumentRevision: 2 })
    // 应该调用 insertBlocks + removeBlocks
    expect(ctx.calls.find((c) => c.method === 'insertBlocks')).toBeDefined()
    expect(ctx.calls.find((c) => c.method === 'removeBlocks')).toBeDefined()
  })
})

describe('executeClientTool: getDocumentSnapshot', () => {
  test('contextMode=full + allowSnapshotTool=true 才执行', async () => {
    const ctx = makeCtx({
      revision: 1,
      contextMode: 'full',
      allowSnapshotTool: true,
      blocks: Array.from({ length: 20 }, (_, i) => ({ id: `b${i}`, type: 'paragraph', content: `block ${i}` })),
    })
    const result = await executeClientTool('getDocumentSnapshot', {
      maxBlocks: 5,
      maxTokens: 1000,
    }, ctx) as { ok: true; snapshot: { blocks: unknown[]; includedBlocks: number; truncated: boolean } }
    expect(result.ok).toBe(true)
    expect(result.snapshot.includedBlocks).toBeLessThanOrEqual(5)
    expect(result.snapshot.blocks.length).toBeLessThanOrEqual(5)
  })

  test('contextMode=none 拒绝执行', async () => {
    const ctx = makeCtx({
      revision: 1,
      contextMode: 'none',
      allowSnapshotTool: true,
    })
    const result = await executeClientTool('getDocumentSnapshot', {}, ctx)
    expect(result).toMatchObject({ kind: 'conflict', reason: 'precondition-failed' })
  })

  test('allowSnapshotTool=false 拒绝执行', async () => {
    const ctx = makeCtx({
      revision: 1,
      contextMode: 'full',
      allowSnapshotTool: false,
    })
    const result = await executeClientTool('getDocumentSnapshot', {}, ctx)
    expect(result).toMatchObject({ kind: 'conflict', reason: 'precondition-failed' })
  })

  test('超 maxBlocks 截断 truncated=true', async () => {
    const ctx = makeCtx({
      revision: 1,
      contextMode: 'full',
      blocks: Array.from({ length: 20 }, (_, i) => ({ id: `b${i}`, type: 'paragraph', content: `block ${i}` })),
    })
    const result = await executeClientTool('getDocumentSnapshot', { maxBlocks: 3 }, ctx) as { ok: true; snapshot: { truncated: boolean; includedBlocks: number } }
    expect(result.ok).toBe(true)
    expect(result.snapshot.includedBlocks).toBeLessThanOrEqual(3)
    expect(result.snapshot.truncated).toBe(true)
  })

  test('fromBlock 不存在返回冲突', async () => {
    const ctx = makeCtx({
      revision: 1,
      contextMode: 'full',
      blocks: [{ id: 'b1', type: 'paragraph', content: 'x' }],
    })
    const result = await executeClientTool('getDocumentSnapshot', { fromBlock: 'missing' }, ctx)
    expect(result).toMatchObject({ kind: 'conflict', reason: 'precondition-failed' })
  })
})

describe('executeClientTool: unknown tool', () => {
  test('未知 toolName 返回 precondition-failed', async () => {
    const ctx = makeCtx({ revision: 1 })
    // Cast to bypass type safety,模拟协议漂移
    const result = await executeClientTool('unknownTool' as never, {}, ctx)
    expect(result).toMatchObject({ kind: 'conflict', reason: 'precondition-failed' })
  })
})
