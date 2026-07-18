export {
  /**
   * 估算文本的 token 数(MVP 字符数/4 近似算法)。
   */
  estimateTokens,
} from './estimate-tokens'
export {
  /**
   * 上下文体积分层处理(选区拦截、全文完整/截断/大纲)。
   */
  layerContext,
} from './layer'
export type {
  /** 上下文体积分层结果。 */
  LayeredContext,
  /** `layerContext` 选项。 */
  LayerContextOptions,
} from './layer'
