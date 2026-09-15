/**
 * 绝对可信度层 / Absolute-credibility layer（决策第一段）。
 *
 * 这一层回答的问题**不是**"这是哪个模型"，而是
 * **"这段输出是不是一次模型采样"**。它需要**零参考库**，因此对库外模型同样有效 ——
 * 这正是它能拦住"库外被硬归因"的原因。
 *
 * 机制依据（分析报告 §2.2，已实测）：
 *  - 真实模型采样的相邻值强烈互斥（重复惩罚 / 频率惩罚），
 *    故 lag-1 自相关显著为负，distinct 比远高于 iid 基线；
 *  - top-p / top-k 截断把低概率桶系统性压低，故计数分布比均匀更平坦，
 *    χ²/df 显著小于 1。
 *  - 反过来说：**伪随机数生成器、均匀重采样、以及大量文本改写策略**
 *    都会同时破坏这两条痕迹。
 *
 * 本层是"诚实归因"的地基：它先于任何库内比对运行，
 * 且它的失败结论（'implausible-as-sampling'）**不进入归因**。
 */

/** 单个统计量的观测值 + 判据区间 + 是否落在可信区间内。 */
export interface CredibilitySignal {
  /**
   * 信号名。冻结集合：
   *  - 'chi-square-over-df'   计数分布相对均匀基线的偏离度，真实采样显著 < 1
   *  - 'lag1-autocorrelation' 相邻值的自相关，真实采样显著 < 0
   *  - 'distinct-ratio'       去重后取值数 / 样本数，真实采样显著高于 iid 基线
   *  - 'repeat-rate'          重复取值占比，与 distinct-ratio 互补
   */
  name: CredibilitySignalName;
  value: number;
  /** 本信号的可信区间（闭区间）。 */
  acceptRange: readonly [number, number];
  /** 观测值是否落在 `acceptRange` 内。 */
  within: boolean;
  /** 由分析报告给出的（同一数据集上的）基线中位值，仅作展示与对照。 */
  baselineMedian: number;
  /** 该信号本身的不确定度（bootstrap 标准差）；样本过少时缺失。 */
  uncertainty?: number;
}

export type CredibilitySignalName =
  | 'chi-square-over-df'
  | 'lag1-autocorrelation'
  | 'distinct-ratio'
  | 'repeat-rate';

/**
 * 第一段的判定。
 *
 * 'implausible' 表示：从绝对统计性质看，这段输出**不像**是一次模型采样
 * （典型成因：端点返回缓存/固定文本、服务端对数字做了均匀重采样、
 * 或输出根本不是数值序列）。此时第二段**不执行**，结论直接落到
 * `AttributionVerdict.decision = 'unknown'` 且 `stage = 'credibility'`。
 */
export type CredibilityDecision = 'plausible' | 'weak' | 'implausible';

/**
 * 绝对可信度层的判据参数。
 *
 * **全部来自参考库的 `GateCalibration`，实现里不得出现这些数值的字面量。**
 * 有一条契约测试专门断言这一点（见 `docs/interface.md` §6）。
 */
export interface CredibilityPolicy {
  /** 各信号的接受区间。缺省的信号不做判断（样本不足）。 */
  ranges: Partial<Record<CredibilitySignalName, readonly [number, number]>>;
  /** 判定为 'plausible' 所需的最小"通过信号数"。 */
  minPassingSignals: number;
  /** 判定为 'implausible' 的"失败信号数"阈值。 */
  maxFailingSignals: number;
  /** 单信号 bootstrap 的迭代次数；0 表示不算不确定度。 */
  bootstrapIters: number;
}

export interface CredibilityAssessment {
  decision: CredibilityDecision;
  /** 各信号的观测；按 `CredibilitySignalName` 的固定顺序排列。 */
  signals: CredibilitySignal[];
  /** 通过 / 参与判断的信号数，用于解释为何降级。 */
  passing: number;
  evaluated: number;
  /** 参与判断的有效样本数。 */
  sampleCount: number;
  /** 降级或拒绝的原因键，进报告的"为什么拒判"区块。 */
  reasons: string[];
}

/**
 * 纯函数：给定一段数值序列与判据参数，给出绝对可信度判定。
 *
 * 契约要求：
 *  - 无 I/O、无 `Date.now()`、无 `Math.random()`（bootstrap 随机源显式注入）；
 *  - 同一输入必然得到同一输出。
 */
export type AssessCredibility = (
  values: readonly number[],
  policy: CredibilityPolicy,
  rng: () => number,
) => CredibilityAssessment;
