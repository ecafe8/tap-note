import { type InferAgentUIMessage, stepCountIs, ToolLoopAgent } from "ai";
import { defaultAgentModel } from "../../providers/providers";
import { createApprovalTool } from "./tools/create-approval-tool";

export function createApprovalAgent(userId: string) {
  const approvalTools = createApprovalTool(userId);

  return new ToolLoopAgent({
    model: defaultAgentModel,
    instructions: `你是一个审批代理，负责根据用户的指示创建或删除待办事项。每次执行操作前都需要等待用户的审批。当前时间是 ${new Date().toLocaleString()}。`,
    tools: {
      ...approvalTools,
    },
    stopWhen: [stepCountIs(15)],
  });
}

export type ApprovalAgentMessage = InferAgentUIMessage<ReturnType<typeof createApprovalAgent>>;
