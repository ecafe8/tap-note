import { createAgentUIStreamResponse } from "ai";
import { Hono } from "hono";
import { describeRoute } from "hono-openapi";
import type { AppEnv } from "../../../types";
import { honoDescribeRoute } from "../../../utils/hono";
import { type ApprovalAgentMessage, createApprovalAgent } from "../agents/agent-approval/create-approval-agent";

type ApprovalRequestBody = {
  messages?: unknown;
};

export const aiRoutes = new Hono<AppEnv>().post(
  "/agents/approval",
  describeRoute(honoDescribeRoute("AI")),
  async (c) => {
    let body: ApprovalRequestBody;

    try {
      body = (await c.req.json()) as ApprovalRequestBody;
    } catch (error) {
      console.error("Failed to parse approval agent request body:", error);
      return c.json({ error: "请求参数错误" }, 400);
    }

    if (!Array.isArray(body.messages)) {
      return c.json({ error: "缺少 messages" }, 400);
    }

    const userId = c.get("userId");
    const agent = createApprovalAgent(userId);

    return createAgentUIStreamResponse({
      agent,
      uiMessages: body.messages as ApprovalAgentMessage[],
      sendReasoning: true,
    });
  },
);

export type RPCAiRoutesType = typeof aiRoutes;
