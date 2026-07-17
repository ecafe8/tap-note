import { createAlibaba } from "@ai-sdk/alibaba";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import {
	customProvider,
	defaultSettingsMiddleware,
	wrapLanguageModel,
	type Provider,
} from "ai";
import type { LLMConfig } from "../types";

/**
 * 创建统一 LLM Provider
 *
 * 根据配置创建 DashScope / Google 模型注册表。
 * 在应用启动时调用一次，返回的 Provider 实例注入到依赖方。
 *
 * @param config - LLM 配置（dashscope 必填，google 可选）
 * @returns 统一 Provider，通过 languageModel(modelName) 获取模型实例
 */
export function createLLMProvider(config: LLMConfig): Provider {
	const defaultSimpleMiddleware = defaultSettingsMiddleware({
		settings: { providerOptions: {} },
	});

	const languageModels: Record<string, ReturnType<typeof wrapLanguageModel>> = {};

	const dashscopeProvider = createAlibaba({
		apiKey: config.dashscope.apiKey,
		baseURL: config.dashscope.baseURL,
	});
	languageModels["dashscope:qwen-plus"] = wrapLanguageModel({
		model: dashscopeProvider("qwen-plus"),
		middleware: [defaultSimpleMiddleware],
	});
	languageModels["dashscope:qwen-max"] = wrapLanguageModel({
		model: dashscopeProvider("qwen-max"),
		middleware: [defaultSimpleMiddleware],
	});
	languageModels["dashscope:qwen3-vl-flash"] = wrapLanguageModel({
		model: dashscopeProvider("qwen3-vl-flash"),
		middleware: [defaultSimpleMiddleware],
	});

	if (config.google) {
		const googleProvider = createGoogleGenerativeAI({
			apiKey: config.google.apiKey,
			baseURL: config.google.baseURL,
		});
		languageModels["google:gemini-2.0-flash"] = wrapLanguageModel({
			model: googleProvider("gemini-2.0-flash") as any,
			middleware: [],
		});
		languageModels["google:gemini-3-flash-preview"] = wrapLanguageModel({
			model: googleProvider("gemini-3-flash-preview") as any,
			middleware: [],
		});
	}

	return customProvider({ languageModels });
}
