import { describe, expect, test } from 'bun:test'
import type { PartialBlock } from '@blocknote/core'
import {
  DOCUMENT_STATE_FORMAT,
  blockOperationSchema,
  conflictResultSchema,
  documentStateSchema,
} from '../types/schema'
import type {
  BlockOperation,
  ConflictResult,
  DocumentState,
} from '../types/type'

describe('blockOperationSchema', () => {
  describe('insertBlock', () => {
    test('合法操作校验通过', () => {
      const input: unknown = {
        type: 'insertBlock',
        baseDocumentRevision: 3,
        referenceBlockId: 'block-1',
        position: 'after',
        block: { type: 'paragraph', content: 'hello' },
      }
      const parsed = blockOperationSchema.parse(input)
      expect(parsed.type).toBe('insertBlock')
      expect(parsed).toMatchObject({
        baseDocumentRevision: 3,
        referenceBlockId: 'block-1',
        position: 'after',
        block: { type: 'paragraph', content: 'hello' },
      })
    })

    test('缺少 baseDocumentRevision 抛 ZodError', () => {
      expect(() =>
        blockOperationSchema.parse({
          type: 'insertBlock',
          referenceBlockId: 'block-1',
          block: { type: 'paragraph' },
        }),
      ).toThrow(/baseDocumentRevision/)
    })

    test('block 字段缺失抛 ZodError', () => {
      expect(() =>
        blockOperationSchema.parse({
          type: 'insertBlock',
          baseDocumentRevision: 0,
          referenceBlockId: 'block-1',
        }),
      ).toThrow(/block/)
    })

    test('position 缺省时默认 after', () => {
      const parsed = blockOperationSchema.parse({
        type: 'insertBlock',
        baseDocumentRevision: 0,
        referenceBlockId: 'block-1',
        block: { type: 'paragraph' },
      })
      expect(parsed.position).toBe('after')
    })
  })

  describe('updateBlock', () => {
    test('合法操作校验通过', () => {
      const input: unknown = {
        type: 'updateBlock',
        baseDocumentRevision: 1,
        targetBlockId: 'block-2',
        block: { type: 'paragraph', content: 'updated' },
      }
      const parsed = blockOperationSchema.parse(input)
      expect(parsed.type).toBe('updateBlock')
      expect(parsed.targetBlockId).toBe('block-2')
    })

    test('缺少 targetBlockId 抛 ZodError', () => {
      expect(() =>
        blockOperationSchema.parse({
          type: 'updateBlock',
          baseDocumentRevision: 0,
          block: { type: 'paragraph' },
        }),
      ).toThrow(/targetBlockId/)
    })
  })

  describe('deleteBlock', () => {
    test('合法操作校验通过', () => {
      const input: unknown = {
        type: 'deleteBlock',
        baseDocumentRevision: 2,
        targetBlockId: 'block-3',
      }
      const parsed = blockOperationSchema.parse(input)
      expect(parsed.type).toBe('deleteBlock')
      expect(parsed.targetBlockId).toBe('block-3')
    })

    test('空字符串 targetBlockId 抛错', () => {
      expect(() =>
        blockOperationSchema.parse({
          type: 'deleteBlock',
          baseDocumentRevision: 0,
          targetBlockId: '',
        }),
      ).toThrow()
    })
  })

  describe('replaceBlocks', () => {
    test('合法操作校验通过', () => {
      const input: unknown = {
        type: 'replaceBlocks',
        baseDocumentRevision: 4,
        targetBlockIds: ['block-4', 'block-5'],
        blocks: [{ type: 'paragraph' }, { type: 'paragraph' }],
      }
      const parsed = blockOperationSchema.parse(input)
      expect(parsed.type).toBe('replaceBlocks')
      expect(parsed.targetBlockIds).toEqual(['block-4', 'block-5'])
      expect(parsed.blocks).toHaveLength(2)
    })

    test('空 targetBlockIds 数组抛错', () => {
      expect(() =>
        blockOperationSchema.parse({
          type: 'replaceBlocks',
          baseDocumentRevision: 0,
          targetBlockIds: [],
          blocks: [{ type: 'paragraph' }],
        }),
      ).toThrow()
    })

    test('空 blocks 数组抛错', () => {
      expect(() =>
        blockOperationSchema.parse({
          type: 'replaceBlocks',
          baseDocumentRevision: 0,
          targetBlockIds: ['block-1'],
          blocks: [],
        }),
      ).toThrow()
    })
  })

  describe('moveBlock', () => {
    test('合法操作校验通过', () => {
      const input: unknown = {
        type: 'moveBlock',
        baseDocumentRevision: 5,
        targetBlockId: 'block-6',
        referenceBlockId: 'block-7',
        position: 'before',
      }
      const parsed = blockOperationSchema.parse(input)
      expect(parsed.type).toBe('moveBlock')
      expect(parsed.position).toBe('before')
    })

    test('缺 referenceBlockId 抛错', () => {
      expect(() =>
        blockOperationSchema.parse({
          type: 'moveBlock',
          baseDocumentRevision: 0,
          targetBlockId: 'block-1',
          position: 'before',
        }),
      ).toThrow(/referenceBlockId/)
    })

    test('position 非法值抛错', () => {
      expect(() =>
        blockOperationSchema.parse({
          type: 'moveBlock',
          baseDocumentRevision: 0,
          targetBlockId: 'block-1',
          referenceBlockId: 'block-2',
          position: 'sideways',
        }),
      ).toThrow(/position/)
    })
  })

  test('未知 type 抛 ZodError', () => {
    expect(() =>
      blockOperationSchema.parse({
        type: 'unknownOp',
        baseDocumentRevision: 0,
      }),
    ).toThrow()
  })

  test('负数 baseDocumentRevision 抛错', () => {
    expect(() =>
      blockOperationSchema.parse({
        type: 'deleteBlock',
        baseDocumentRevision: -1,
        targetBlockId: 'block-1',
      }),
    ).toThrow()
  })
})

describe('documentStateSchema', () => {
  test('合法 DocumentState 通过', () => {
    const input: unknown = {
      format: DOCUMENT_STATE_FORMAT,
      schemaVersion: '0.51.4',
      documentRevision: 7,
      blocks: [{ type: 'paragraph', id: 'b-1', content: 'hello' }],
      selection: { start: 'b-1', end: 'b-1' },
    }
    const parsed = documentStateSchema.parse(input)
    expect(parsed.format).toBe(DOCUMENT_STATE_FORMAT)
    expect(parsed.documentRevision).toBe(7)
    expect(parsed.blocks).toHaveLength(1)
    expect(parsed.selection?.start).toBe('b-1')
  })

  test('非法 format 抛错', () => {
    expect(() =>
      documentStateSchema.parse({
        format: 'html',
        schemaVersion: '0.51.4',
        documentRevision: 0,
        blocks: [],
      }),
    ).toThrow(/format/)
  })

  test('缺 schemaVersion 抛错', () => {
    expect(() =>
      documentStateSchema.parse({
        format: DOCUMENT_STATE_FORMAT,
        documentRevision: 0,
        blocks: [],
      }),
    ).toThrow(/schemaVersion/)
  })

  test('负数 documentRevision 抛错', () => {
    expect(() =>
      documentStateSchema.parse({
        format: DOCUMENT_STATE_FORMAT,
        schemaVersion: '0.51.4',
        documentRevision: -1,
        blocks: [],
      }),
    ).toThrow(/documentRevision/)
  })

  test('blocks 字段缺失抛错', () => {
    expect(() =>
      documentStateSchema.parse({
        format: DOCUMENT_STATE_FORMAT,
        schemaVersion: '0.51.4',
        documentRevision: 0,
      }),
    ).toThrow(/blocks/)
  })

  test('blocks 为 PartialBlock[] 形状(含 children)通过', () => {
    const blocks: PartialBlock[] = [
      {
        type: 'paragraph',
        id: 'p-1',
        content: 'parent',
        children: [
          { type: 'paragraph', id: 'c-1', content: 'child' },
        ],
      } as PartialBlock,
    ]
    const input: DocumentState = {
      format: DOCUMENT_STATE_FORMAT,
      schemaVersion: '0.51.4',
      documentRevision: 0,
      blocks,
    }
    const parsed = documentStateSchema.parse(input)
    expect(parsed.blocks).toHaveLength(1)
  })

  test('selection 缺省时可选', () => {
    const input: unknown = {
      format: DOCUMENT_STATE_FORMAT,
      schemaVersion: '0.51.4',
      documentRevision: 0,
      blocks: [],
    }
    const parsed = documentStateSchema.parse(input)
    expect(parsed.selection).toBeUndefined()
  })
})

describe('conflictResultSchema', () => {
  test('revision 冲突结果通过', () => {
    const op: BlockOperation = {
      type: 'updateBlock',
      baseDocumentRevision: 3,
      targetBlockId: 'block-1',
      block: { type: 'paragraph' },
    }
    const input: unknown = {
      kind: 'conflict' as const,
      reason: 'revision-mismatch',
      currentDocumentRevision: 5,
      operation: op,
      message: 'document revision mismatch',
    }
    const parsed = conflictResultSchema.parse(input)
    expect(parsed.reason).toBe('revision-mismatch')
    expect(parsed.currentDocumentRevision).toBe(5)
    expect(parsed.operation.type).toBe('updateBlock')
  })

  test('前置条件冲突结果通过', () => {
    const op: BlockOperation = {
      type: 'deleteBlock',
      baseDocumentRevision: 0,
      targetBlockId: 'missing-block',
    }
    const input: ConflictResult = {
      kind: 'conflict',
      reason: 'precondition-failed',
      currentDocumentRevision: 0,
      operation: op,
      message: 'target block not found',
    }
    const parsed = conflictResultSchema.parse(input)
    expect(parsed.reason).toBe('precondition-failed')
  })

  test('非法 reason 抛错', () => {
    expect(() =>
      conflictResultSchema.parse({
        kind: 'conflict',
        reason: 'unknown',
        currentDocumentRevision: 0,
        operation: { type: 'deleteBlock', baseDocumentRevision: 0, targetBlockId: 'b' },
        message: 'msg',
      }),
    ).toThrow()
  })
})
