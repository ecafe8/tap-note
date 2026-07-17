/**
 * Workflow 内部使用的语言模型解析器
 *
 * 'use step' 函数和 WorkflowAgent 的 model 配置不能直接跨越 workflow 边界传递
 * Provider 实例（含函数，非可序列化），因此改为按需从环境变量构建并缓存。
 */
import { createLLMProvider } from "./providers";
import type { LLMConfig } from "../types";
import type { LanguageModel, Provider } from "ai";
import { config } from "../../../config";

let cachedProvider: Provider | null = null;

function getLLMConfig(): LLMConfig {
	return {
		dashscope: config.llm.dashscope,
		google: config.llm.google,
	};
}

export function getWorkflowLanguageModel(modelName: string): LanguageModel {
	if (!cachedProvider) cachedProvider = createLLMProvider(getLLMConfig());
	return cachedProvider.languageModel(modelName);
}
