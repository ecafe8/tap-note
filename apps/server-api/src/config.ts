/**
 * 配置管理模块
 *
 * 从 .env 文件加载环境变量，使用 zod 进行 schema 验证。
 * 启动时调用 loadConfig() 获取类型安全的配置对象。
 */
import "dotenv/config";
import { z } from "zod";

/** LLM 统一配置 schema */
const llmSchema = z.object({
	dashscope: z.object({
		apiKey: z.string().min(1),
		baseURL: z.string().url().optional(),
	}),
	google: z
		.object({
			apiKey: z.string().min(1),
			baseURL: z.string().url().optional(),
		})
		.optional(),
});


/** 完整应用配置 schema */
const appConfigSchema = z.object({
	llm: llmSchema,
	logLevel: z
		.enum(["trace", "debug", "info", "warn", "error", "fatal"])
		.default("info"),
});

/** 应用配置类型 */
export type AppConfig = z.infer<typeof appConfigSchema>;

/**
 * 从环境变量加载并验证配置
 * @returns 经过 zod 验证的类型安全配置对象
 * @throws 环境变量缺失或格式错误时抛出 z.ZodError
 */
export function loadConfig(): AppConfig {
	const raw = {
		llm: {
			dashscope: {
				apiKey: process.env.DASHSCOPE_API_KEY,
				baseURL: process.env.DASHSCOPE_BASE_URL,
			},
			google: process.env.GOOGLE_GENERATIVE_AI_API_KEY
				? {
						apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
						baseURL: process.env.GOOGLE_GENERATIVE_BASE_URL,
					}
				: undefined,
		},
		logLevel: process.env.LOG_LEVEL,
	};

	return appConfigSchema.parse(raw);
}

export const config = loadConfig();
