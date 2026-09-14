/**
 * 统计核心 / Statistical core —— 纯数学，零领域知识。
 *
 * 这些函数必须**自实现**（零运行时依赖）。代价是数学 bug 不会崩、只会让结论悄悄偏，
 * 因此对照基准（SciPy / R 生成的固定期望值，以 JSON 夹具提交）是**永久门禁**，
 * 不是一次性检查。
 *
 * 契约：全部为纯函数，输入输出均为有限实数；遇到 NaN / 无穷大的输入，
 * 返回值必须是 NaN（**不得**抛异常，也**不得**静默替换成 0）。
 */

/** 算术平均。空数组返回 NaN。 */
export type Mean = (xs: readonly number[]) => number;

/** 方差。`sample: true` 为样本方差（n-1），默认总体方差。 */
export type Variance = (
  xs: readonly number[],
  opts?: { sample?: boolean },
) => number;

/** 分位数，`q ∈ [0, 1]`，输入需已升序排列。 */
export type Quantile = (sortedXs: readonly number[], q: number) => number;

/** 直方图计数。`binEdges` 必须严格升序；返回长度为 `binEdges.length - 1`。 */
export type Histogram = (
  xs: readonly number[],
  binEdges: readonly number[],
) => number[];

/**
 * 主距离度量（Hellinger）。输入为两个**未归一化**的计数向量，
 * 内部自行归一化；输出落在 [0, 1]，0 表示同分布。
 */
export type Hellinger = (
  counts: readonly number[],
  reference: readonly number[],
) => number;

/**
 * 备选距离度量（Jensen-Shannon 散度，以 log2 为底）。
 * 作为主度量的对照实现保留，**不用于首版判定**。
 */
export type JensenShannon = (
  counts: readonly number[],
  reference: readonly number[],
) => number;

/** 卡方统计量（计数 vs 期望）。 */
export type ChiSquare = (
  observed: readonly number[],
  expected: readonly number[],
) => number;

/** 卡方分布的上尾概率。df 必须 > 0。 */
export type ChiSquareUpperTail = (statistic: number, df: number) => number;

/** 正则化不完全 Gamma 函数 P(a, x)。χ² 上尾概率的依赖项。 */
export type RegularizedGammaP = (a: number, x: number) => number;

/**
 * lag-k 自相关。`lag` 默认 1。
 * 真实模型采样在 lag=1 上显著为负（重复惩罚的物理痕迹）。
 */
export type Autocorrelation = (xs: readonly number[], lag?: number) => number;

/** 取值去重比：distinct(xs) / xs.length。iid 基线约 0.63（n ≤ 值域时）。 */
export type DistinctRatio = (xs: readonly number[]) => number;

/** 逐元素差分的经验分布，用于检验"相邻值互斥"这一痕迹。 */
export type LagDifferenceDistribution = (
  xs: readonly number[],
  lag?: number,
) => number[];

/** 置换检验的 p 值。随机源显式注入，保证可复现。 */
export type PermutationPValue = (
  a: readonly number[],
  b: readonly number[],
  iters: number,
  rng: () => number,
) => number;

/** 自助法置信区间。随机源显式注入。 */
export type BootstrapCI = (
  xs: readonly number[],
  stat: (sample: number[]) => number,
  iters: number,
  alpha: number,
  rng: () => number,
) => readonly [number, number];

/**
 * 基-2 迭代 FFT（就地或返回新数组）。
 * 长度必须是 2 的幂；否则返回 `null`（**不抛异常**）。
 * 仅在启用谱分析类特征时需要；P0 不依赖它，但契约先冻结签名。
 */
export type Fft = (
  re: readonly number[],
  im: readonly number[],
) => { re: number[]; im: number[] } | null;

/** `src/stats/` 的完整函数面。任何新增函数 = 契约 minor 版本变更。 */
export interface StatsApi {
  mean: Mean;
  variance: Variance;
  quantile: Quantile;
  histogram: Histogram;
  hellinger: Hellinger;
  jensenShannon: JensenShannon;
  chiSquare: ChiSquare;
  chiSquareUpperTail: ChiSquareUpperTail;
  regularizedGammaP: RegularizedGammaP;
  autocorrelation: Autocorrelation;
  distinctRatio: DistinctRatio;
  lagDifferenceDistribution: LagDifferenceDistribution;
  permutationPValue: PermutationPValue;
  bootstrapCI: BootstrapCI;
  fft: Fft;
}
