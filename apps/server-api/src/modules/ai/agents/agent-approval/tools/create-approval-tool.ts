import { tool } from "ai";
import { z } from "zod";

/**
 * 创建审批工具，包含创建和删除待办事项的工具，每个工具都需要用户审批后才能执行
 * @param userId 用户 ID
 * @returns 审批工具对象
 *
 * 注意：工具名必须以 "awaitingApproval" 开头，以便在 UI 层进行特殊处理，逐一展示等待审批的工具，避免用户混淆
 */
export function createApprovalTool(userId: string) {
  return {
    awaitingApprovalCreateTodoItem: tool({
      description: "创建一个待办事项，等待用户审批",
      inputSchema: z.object({
        title: z.string().describe("待办事项标题"),
        description: z.string().describe("待办事项详细描述"),
        dueDate: z.string().describe("截止日期，格式为 YYYY-MM-DD"),
      }),
      needsApproval: true,
      execute: async (input) => {
        // 这里可以添加实际的待办事项创建逻辑，例如调用后端 API
        // 例如 service.createTodoItem({ userId, ...input });
        console.log(`用户 ${userId} 创建待办事项:`, input);
        return { success: true, message: "待办事项已创建" };
      },
    }),
    awaitingApprovalDeleteTodoItem: tool({
      description: "删除一个待办事项，等待用户审批",
      inputSchema: z.object({
        id: z.string().describe("待办事项 ID"),
      }),
      needsApproval: true,
      execute: async (input) => {
        // 这里可以添加实际的待办事项删除逻辑，例如调用后端 API
        console.log(`用户 ${userId} 删除待办事项:`, input);
        return { success: true, message: "待办事项已删除" };
      },
    }),
  };
}
