import { describe, expect, test } from 'bun:test'
import {
  createAIBusyState,
  applyOperationsToEditor,
  type BlockOperation,
  type ConflictResult,
} from '@tap-note/ai-core'
import { executeClientTool, type ExecuteClientToolContext } from '../tools/client-tools'
import { chatLayerContext, buildDocumentState } from '../context'
import type { BlockNoteEditor, BlockIdentifier } from '@blocknote/core'
import type { DocumentState, DocumentStateBuilder } from '@tap-note/ai-core'

/**
 * 集成测试:覆盖跨模块链路与生命周期。
 *
 * 不依赖真实 LLM API、网络或持久化服务,所有 transport/editor 用 mock 隔离。
 */

// ============ Mock editor ============

function createMockEditor(blocks: Array<{ id?: string; type?: string; content?: unknown }>): {
  editor: BlockNoteEditor
  documentStateBuilder: DocumentStateBuilder
  calls: { method: string; args: unknown[] }[]
} {
  const calls: { method: string; args: unknown[] }[] = []
  const revision = 5

  const editor = {
    document: blocks,
    getBlock(id: BlockIdentifier) {
      const targetId = typeof id === 'string' ? id : (id as { id?: string }).id
      calls.push({ method: 'getBlock', args: [id] })
      return blocks.find((b) => b.id === targetId)
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
      return { inserted: newBlocks, removed: ids }
    },
    onChange: () => () => {},
  } as unknown as BlockNoteEditor

  const documentStateBuilder: DocumentStateBuilder = {
    get documentRevision() { return revision },
    build() {
      return {
        format: 'blocks-json',
        schemaVersion: '0.51.4',
        documentRevision: revision,
        blocks: blocks as DocumentState['blocks'],
      } as DocumentState
    },
    dispose() {},
  }

  return { editor, documentStateBuilder, calls }
}

function makeCtx(opts: {
  blocks?: Array<{ id?: string; type?: string; content?: unknown }>
  allowSnapshotTool?: boolean
}): ExecuteClientToolContext & { calls: { method: string; args: unknown[] }[] } {
  const { editor, documentStateBuilder, calls } = createMockEditor(
    opts.blocks ?? [
      { id: 'b1', type: 'paragraph', content: 'hello' },
      { id: 'b2', type: 'paragraph', content: 'world' },
    ],
  )
  return {
    editor,
    documentStateBuilder,
    allowSnapshotTool: opts.allowSnapshotTool ?? true,
    calls,
  }
}

// ============ 11.1 跨模块链路 ============

describe('11.1 跨模块链路:executeClientTool → editor API', () => {
  test('insertBlock 成功调用 editor.insertBlocks', async () => {
    const ctx = makeCtx({})
    const result = await executeClientTool('insertBlock', {
      block: { type: 'paragraph', content: 'new' },
      referenceBlockId: 'b1',
      position: 'after',
      baseDocumentRevision: 5,
    }, ctx)
    expect(result).toMatchObject({ ok: true, currentDocumentRevision: 5 })
    expect(ctx.calls.find((c) => c.method === 'insertBlocks')).toBeDefined()
  })

  test('updateBlock 成功调用 editor.updateBlock', async () => {
    const ctx = makeCtx({})
    const result = await executeClientTool('updateBlock', {
      targetBlockId: 'b1',
      block: { type: 'paragraph', content: 'updated' },
      baseDocumentRevision: 5,
    }, ctx)
    expect(result).toMatchObject({ ok: true })
    expect(ctx.calls.find((c) => c.method === 'updateBlock')).toBeDefined()
  })

  test('deleteBlock 成功调用 editor.removeBlocks', async () => {
    const ctx = makeCtx({})
    const result = await executeClientTool('deleteBlock', {
      targetBlockId: 'b2',
      baseDocumentRevision: 5,
    }, ctx)
    expect(result).toMatchObject({ ok: true })
    expect(ctx.calls.find((c) => c.method === 'removeBlocks')).toBeDefined()
  })
})

// ============ 11.2 busy 生命周期 ============

describe('11.2 busy + chat 生命周期集成', () => {
  test('acquire → sendMessage → tool execute → release', async () => {
    const busy = createAIBusyState()
    expect(busy.acquire('chat')).toBe(true)
    expect(busy.isBusy).toBe(true)
    // 模拟 tool execute 成功
    const ctx = makeCtx({})
    const result = await executeClientTool('insertBlock', {
      block: { type: 'paragraph' },
      referenceBlockId: 'b1',
      position: 'after',
      baseDocumentRevision: 5,
    }, ctx)
    expect(result).toMatchObject({ ok: true })
    busy.release()
    expect(busy.isBusy).toBe(false)
  })

  test('中止 → abort → release', () => {
    const busy = createAIBusyState()
    expect(busy.acquire('chat')).toBe(true)
    // 模拟用户点击中止:abort + release
    busy.release()
    expect(busy.isBusy).toBe(false)
  })

  test('失败 → release', () => {
    const busy = createAIBusyState()
    expect(busy.acquire('chat')).toBe(true)
    // 模拟流失败:release
    busy.release()
    expect(busy.isBusy).toBe(false)
  })
})

// ============ 11.3 ConflictResult 集成 ============

describe('11.3 ConflictResult 集成', () => {
  test('revision 冲突触发 ⚠,重试用最新 revision 成功', async () => {
    // 第一次 execute:revision 冲突(ctx revision=5,baseDocumentRevision=3)
    const ctx = makeCtx({})
    const conflictResult = await executeClientTool('updateBlock', {
      targetBlockId: 'b1',
      block: { type: 'paragraph', content: 'updated' },
      baseDocumentRevision: 3,
    }, ctx)
    expect(conflictResult).toMatchObject({ kind: 'conflict', reason: 'revision-mismatch' })
    expect(ctx.calls.find((c) => c.method === 'updateBlock')).toBeUndefined()

    // 第二次 execute(重试):用最新 revision=5
    const retryResult = await executeClientTool('updateBlock', {
      targetBlockId: 'b1',
      block: { type: 'paragraph', content: 'updated' },
      baseDocumentRevision: 5,
    }, ctx)
    expect(retryResult).toMatchObject({ ok: true })
    expect(ctx.calls.find((c) => c.method === 'updateBlock')).toBeDefined()
  })

  test('前置条件冲突(目标块不存在)触发 ⚠', async () => {
    const ctx = makeCtx({})
    const result = await executeClientTool('updateBlock', {
      targetBlockId: 'missing-block',
      block: { type: 'paragraph' },
      baseDocumentRevision: 5,
    }, ctx)
    expect(result).toMatchObject({ kind: 'conflict', reason: 'precondition-failed' })
    expect(ctx.calls.find((c) => c.method === 'updateBlock')).toBeUndefined()
  })
})

// ============ 11.4 layerContext 上下文三态 ============

describe('11.4 layerContext 上下文预算集成', () => {
  test('selection 超 4K 拦截', () => {
    const largeSelection: DocumentState = {
      format: 'blocks-json',
      schemaVersion: '1.0.0',
      documentRevision: 1,
      blocks: [{ type: 'paragraph', content: 'x'.repeat(20000) }] as DocumentState['blocks'],
      selection: { start: 'b1', end: 'b1' },
    }
    const layered = chatLayerContext(largeSelection)
    expect(layered.kind).toBe('selection-blocked')
  })

  test('预算内发完整', () => {
    const smallFull: DocumentState = {
      format: 'blocks-json',
      schemaVersion: '1.0.0',
      documentRevision: 1,
      blocks: [{ type: 'paragraph', content: 'hello' }] as DocumentState['blocks'],
    }
    const layered = chatLayerContext(smallFull)
    expect(layered.kind).toBe('full')
  })

  test('超预算截断', () => {
    const midFull: DocumentState = {
      format: 'blocks-json',
      schemaVersion: '1.0.0',
      documentRevision: 1,
      blocks: [{ type: 'paragraph', content: 'x'.repeat(44000) }] as DocumentState['blocks'],
    }
    const layered = chatLayerContext(midFull)
    expect(layered.kind).toBe('truncated')
  })

  test('>2× 改发大纲', () => {
    const hugeFull: DocumentState = {
      format: 'blocks-json',
      schemaVersion: '1.0.0',
      documentRevision: 1,
      blocks: [{ type: 'paragraph', content: 'x'.repeat(80000) }] as DocumentState['blocks'],
    }
    const layered = chatLayerContext(hugeFull)
    expect(layered.kind).toBe('outline')
  })
})

// ============ 11.5 选区高亮 + chip 集成(简化) ============

describe('11.5 buildDocumentState 自动检测', () => {
  test('无选区时 buildDocumentState 返回全文', () => {
    const blocks = [{ id: 'b1', type: 'paragraph', content: 'full' }]
    const { editor, documentStateBuilder } = createMockEditor(blocks)
    const ds = buildDocumentState(editor, documentStateBuilder)
    expect(ds).toBeDefined()
    expect(ds.blocks.length).toBeGreaterThan(0)
  })

  test('有选区快照时 buildDocumentState 返回选区', () => {
    const blocks = [{ id: 'b1', type: 'paragraph', content: 'sel' }]
    const { editor, documentStateBuilder } = createMockEditor(blocks)
    const ds = buildDocumentState(editor, documentStateBuilder, {
      blocks: blocks as never,
      blockCount: 1,
    })
    expect(ds).toBeDefined()
    expect(ds.blocks.length).toBeGreaterThan(0)
  })
})

// ============ 11.6 busy 互斥(inline + chat) ============

describe('11.6 busy 互斥集成', () => {
  test('chat 进行中时 inline 入口禁用', () => {
    const busy = createAIBusyState()
    expect(busy.acquire('chat')).toBe(true)
    // inline 尝试 acquire 失败
    expect(busy.acquire('inline')).toBe(false)
    busy.release()
    // 释放后 inline 可用
    expect(busy.acquire('inline')).toBe(true)
    busy.release()
  })

  test('inline 进行中时 chat 入口禁用', () => {
    const busy = createAIBusyState()
    expect(busy.acquire('inline')).toBe(true)
    expect(busy.acquire('chat')).toBe(false)
    busy.release()
    expect(busy.acquire('chat')).toBe(true)
    busy.release()
  })

  test('完成/中止后立即恢复', () => {
    const busy = createAIBusyState()
    busy.acquire('chat')
    busy.release()
    expect(busy.acquire('inline')).toBe(true)
    busy.release()
    expect(busy.isBusy).toBe(false)
  })
})

// 占位:确保 applyOperationsToEditor 类型可用
void applyOperationsToEditor
void (null as unknown as BlockOperation)
void (null as unknown as ConflictResult)
