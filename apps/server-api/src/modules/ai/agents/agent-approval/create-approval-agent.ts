import { ToolLoopAgent, tool, isStepCount } from 'ai'
import { z } from 'zod'
import { defaultAgentModel } from '../../providers'

/**
 * 创建审批工具。
 *
 * 演示 v7 `toolApproval` 审批流程:每个待办操作都需用户审批后才执行。
 */
export function createApprovalTool(userId: string) {
  void userId
  const todos: Array<{ id: string; text: string; completed: boolean }> = []

  return {
    createTodo: tool({
      description: 'Create a new todo item',
      inputSchema: z.object({
        text: z.string().describe('The todo text'),
      }),
      execute: async ({ text }) => {
        const id = `todo-${todos.length + 1}`
        todos.push({ id, text, completed: false })
        return { id, text, completed: false }
      },
    }),
    deleteTodo: tool({
      description: 'Delete a todo item by id',
      inputSchema: z.object({
        id: z.string().describe('The todo id to delete'),
      }),
      execute: async ({ id }) => {
        const idx = todos.findIndex((t) => t.id === id)
        if (idx === -1) {
          return { ok: false, error: 'todo not found' }
        }
        todos.splice(idx, 1)
        return { ok: true }
      },
    }),
  }
}

/**
 * 创建审批代理(v7 重写)。
 *
 * 用 `ToolLoopAgent` + `toolApproval: { ...: 'user-approval' }` 替代 v6 的 `needsApproval: true`。
 * 保留为独立示例,不进内联/对话主流程。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createApprovalAgent(userId: string): ToolLoopAgent<any, any, any> {
  const approvalTools = createApprovalTool(userId)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new ToolLoopAgent<any, any, any>({
    model: defaultAgentModel,
    instructions: `你是一个审批代理,负责根据用户的指示创建或删除待办事项。每次执行操作前都需要等待用户的审批。当前时间是 ${new Date().toLocaleString()}。`,
    tools: {
      createTodo: approvalTools.createTodo,
      deleteTodo: approvalTools.deleteTodo,
    },
    toolApproval: {
      createTodo: 'user-approval',
      deleteTodo: 'user-approval',
    },
    stopWhen: [isStepCount(15)],
  })
}

