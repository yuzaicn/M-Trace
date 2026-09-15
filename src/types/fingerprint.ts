/**
 * 指纹 / Fingerprint —— 观测 → 可比较的特征向量。
 *
 * 两条契约要求：
 *  1. 族是**可缺席**的。`families` 是数组而非固定结构，缺族即整族缺席，
 *     不得用 NaN / 0 填充。这保证"部分探针失效"只降低维度，不污染结论。
 *  2. 无原语上界的字段名由数据侧注册表声明（`FeatureRegistry`），
 *     指纹本身只带数值，因此新增特征不改本类型。
 */

/** 特征注册表里的一条声明。名字与语义都在这里，指纹只带数值。 */
export interface FeatureDeclaration {
  key: string;
  familyId: string;
  /** 该特征的方向：越大越怎样。仅用于报告的可读表达，不参与判定。 */
  direction: 'higher' | 'lower' | 'nonmonotonic';
  /** 是否随环境（提示词包装 / 时间）漂移的已知敏感特征。 */
  envSensitive: boolean;
  priority: 'P0' | 'P1' | 'P2';
}

/** 一个族在本次观测中提取到的全部特征。 */
export interface FamilyFeatures {
  familyId: string;
  /** 该族参与提取的有效样本数。 */
  validSamples: number;
  attemptedSamples: number;
  /** 特征值。键必须存在于注册表；**缺席的键表示该特征不可计算**，不是 0。 */
  features: Record<string, number>;
  /** 逐特征的不确定度（bootstrap 标准差）。键集是 `features` 的子集。 */
  uncertainty: Record<string, number>;
  /** 该族被降级的原因（如 'all-non-stream'、'rewritten-ratio-exceeded'）。 */
  degradedReasons: string[];
}

/** 质量等级。判定短路条件之一。 */
export type QualityGrade = 'good' | 'fair' | 'poor';

export interface FingerprintQuality {
  grade: QualityGrade;
  /** 有效样本 / 尝试样本。 */
  validRatio: number;
  /** 各族中最小的有效样本数。 */
  minFamilySamples: number;
  /** 降级原因键，进报告的"方法"区块。 */
  reasons: string[];
}

/**
 * 传输层特征。这些特征**不依赖内容**，因此对"数值改写"类攻击免疫 ——
 * 它们是路线 C / D 的落点，也是 P1 的第一批实现。
 *
 * P0 只要求它们**被采集并记录**（用于报告与降级判断），不要求参与判定。
 */
export interface TransportFeatures {
  medianLatencyMs: number;
  p95LatencyMs: number;
  firstByteP50Ms: number;
  interChunkP50Ms: number;
  streamedRatio: number;
  chunkCountP50: number;
  usagePresent: boolean;
  /** usage 字段**结构**的哈希（字段名与嵌套形状），不含数值。 */
  usageShapeHash?: string;
  /** 响应里自报的模型名集合。永不作为判定依据。 */
  declaredModels: string[];
  /** 白名单响应头中出现过的键（只记键，不记值）。 */
  headerKeys: string[];
}

/**
 * 一次检测的完整指纹。这是证据包的核心载荷，也是跨版本可复验的锚点。
 */
export interface Fingerprint {
  /** 生成它的算法版本。与库不一致即拒绝比对。 */
  extractorVersion: string;
  suiteVersion: string;
  families: FamilyFeatures[];
  transport: TransportFeatures;
  quality: FingerprintQuality;
  /** 内容哈希，用于把指纹钉回产生它的原始观测。 */
  contentHash: string;
}

export interface ExtractFingerprintInput {
  observations: import('./normalize.js').NormalizedObservation[];
  registry: FeatureDeclaration[];
  extractorVersion: string;
  suiteVersion: string;
  /** bootstrap 随机源；指纹的不确定度列依赖它，必须可复现。 */
  rng: () => number;
  bootstrapIters: number;
}

/**
 * 纯函数：观测 → 指纹。
 *
 * 无 I/O、无时钟、无全局随机。样本不足时返回 `ok: false` 且
 * `code === 'EVIDENCE_INSUFFICIENT'`，**不返回一个低质量指纹** ——
 * 降级判断发生在指纹内部的 `quality`，而"完全无法提取"才是错误。
 */
export type ExtractFingerprint = (
  input: ExtractFingerprintInput,
) => import('./common.js').Result<Fingerprint, import('./errors.js').MError>;
