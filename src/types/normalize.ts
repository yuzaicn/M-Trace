/**
 * 规范化 / Normalization —— 原始响应 → 可计算的观测。
 *
 * 本层是"网关改写"的唯一防线。它必须**容错但对改写记账**：
 * 能从 markdown 围栏里抠出 JSON 是能力，
 * 把抠不出来的样本静默当成空样本是缺陷。
 */

/** 解析失败的原因。**必须是 `null` 而不是空数组**：空数组会伪装成"解析成功但没数字"。 */
export type ParseFailure =
  | 'no-number-block' // 找不到任何数字连续段
  | 'wrong-arity' // 数字个数不符合挑战要求
  | 'out-of-range' // 出现超出挑战取值域的数字
  | 'non-numeric' // 目标位置不是数值
  | 'rewritten'; // 结构性改写导致无法可靠定位

/** 单条响应的传输 / 内容层标记。 */
export type ResponseFlag =
  | 'empty' // 200 但无可解析内容
  | 'truncated' // SSE 在语义完整前结束
  | 'non-stream' // 服务端忽略了 stream: true
  | 'rewritten' // 检出网关改写
  | 'refused' // 模型拒答（安全对齐触发的拒绝措辞）
  | 'fenced' // 内容被包进 markdown 代码块（已被容错解析，仅记账）
  | 'prefixed'; // 内容前后有解释性文字（已被容错解析，仅记账）

/** 规范化后的单条观测。证据包的基本单元。 */
export interface NormalizedObservation {
  requestId: string;
  familyId: string;
  /**
   * 原始文本的哈希，用于把结论钉回当时的输入。
   * 报告只带哈希，**不带原文**（避免报告膨胀与二次泄露）。
   */
  contentHash: string;
  /** 解析出的值序列；失败为 `null`。 */
  values: number[] | null;
  /** 挑战声明的取值域，供可信度层与分箱使用。 */
  valueDomain: { min: number; max: number };
  parseFailure?: ParseFailure;
  flags: ResponseFlag[];
  meta: import('./probe.js').ResponseMeta;
}

/** 归一化汇总。占比类指标在此一次算清，供降级判定使用。 */
export interface NormalizationSummary {
  attempted: number;
  parsed: number;
  /** `rewritten` / `truncated` / `empty` 的合计占比，用于 E06 的降级阈值。 */
  rewrittenRatio: number;
  nonStreamRatio: number;
  refusedRatio: number;
  byFamily: Record<
    string,
    { attempted: number; parsed: number; minValues: number; maxValues: number }
  >;
}

export interface NormalizeInput {
  responses: import('./probe.js').ProbeResponse[];
  /** 每个族的取值域与期望数量，由挑战套件声明。 */
  expectations: Record<
    string,
    { min: number; max: number; expectedCount: number }
  >;
}

export interface NormalizeResult {
  observations: NormalizedObservation[];
  summary: NormalizationSummary;
}

/**
 * 纯函数：规范化一批响应。
 *
 * 契约要求：本函数**不抛异常**，所有问题通过 `parseFailure` 与 `flags` 表达。
 */
export type Normalize = (input: NormalizeInput) => NormalizeResult;
