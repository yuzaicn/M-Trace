/**
 * 归因 / Attribution —— 指纹 + 参考库 → 判定结论。
 *
 * ## 本文件承载的两条硬约束
 *
 * ### 1. 决策必须是两段式，不是 argmax
 *
 * 分析报告 §2.3 的实测结论：库外模型 **36/36 全部被硬归因**，平均置信度 0.748，
 * 且该分布与"库内正确"的置信度分布**重叠、阈值分不开**。
 * 因此任何"取最像的库内模型"的设计都必然在库外模型上误报 ——
 * 而误报一次就永久摧毁工具可信度。契约据此固定两段：
 *
 * ```
 *   第一段  绝对可信度校验（credibility，零参考库）
 *           └─ implausible → 直接 unknown，stage='credibility'（不进第二段）
 *   第二段  开放集归因（库内距离 + 拒判 + 歧义分离）
 *           └─ 返回 top-N 候选 + 显式弃权，而不是单一 argmax
 * ```
 *
 * ### 2. 「无法判定」是一等公民
 *
 * `'unknown'` 是 `AttributionDecision` 联合类型的一支，走正常返回路径，
 * 有自己的退出码（`EXIT.UNKNOWN`）、自己的报告版面、自己的 i18n 文案。
 * 它**不是**异常、**不是**错误码、**不是**"最相近模型 + 相似度百分比"。
 * 对应项目硬约束：「库外模型要落到『无法判定』，不允许硬归因」。
 */

/** 四值判定。`unknown` 与 `ambiguous` 是分开的，因为下一步动作不同。 */
export type AttributionDecision =
  | 'in-library' // 命中具体参考条目（仍需 confidence ≥ 门槛）
  | 'in-library-family' // 只能定位到家族
  | 'ambiguous' // 有多个同样接近的候选，无法区分 —— 可操作：多跑几个变体
  | 'unknown'; // 不在库内，或证据不足 —— 这是**正确答案**，不是失败

/** 判定在流水线的哪一段终止。用于报告定位与排障。 */
export type DecisionStage =
  | 'input-validation' // 输入或库不可用，未进入任何判定
  | 'credibility' // 第一段就否定了"这是一次模型采样"
  | 'attribution' // 走完第二段
  | 'routing'; // 未走判定（如离线渲染既有结论）

/** 拒判原因。每个键都有对应的中英文案，直接进报告的"为什么拒判"区块。 */
export type AbstentionReason =
  | 'insufficient-evidence' // 有效样本不足（quality 门槛未过）
  | 'implausible-as-sampling' // 第一段否定：不像模型采样（缓存 / 重采样 / 非数值输出）
  | 'out-of-library' // 第一段通过、第二段距离超限：库外模型
  | 'candidates-not-separable' // 多个候选距离过于接近
  | 'library-unusable' // 库为空或全部条目不可用
  | 'extractor-mismatch' // 提取算法版本与库不一致
  | 'content-rewritten' // 网关改写比例超限，证据不可信
  | 'partial-run'; // 运行被中断，只有部分样本

/** 候选。top-N 而非单一 argmax —— N 由策略给定，默认 3。 */
export interface Candidate {
  entryId: string;
  /** 展示用标签（模型名或家族名）。已脱敏，不含端点信息。 */
  label: string;
  /** 与本次指纹的距离。越小越近。 */
  distance: number;
  /** 1-based 排名。 */
  rank: number;
  /** 该候选是否被判定为"在库内"。只有 rank 1 且过门槛才为 true。 */
  accepted: boolean;
}

/** 一条证据的原始数值。报告据此展示"我们看到了什么"，而不是"我们相信什么"。 */
export interface EvidenceItem {
  /** 证据所属层。 */
  layer: 'credibility' | 'attribution' | 'transport';
  /** 证据名，对应 `CredibilitySignalName` 或距离/边际类名字。 */
  name: string;
  /** 观测数值。 */
  value: number;
  /** 该数值的参考区间（若有）。 */
  referenceRange?: readonly [number, number];
  /** 该证据对结论是支持、削弱还是中性。 */
  polarity: 'supports' | 'weakens' | 'neutral';
  /** 是否来自 P0 的核心证据（数字指纹 + 可信度层）还是 P1 的交叉验证层。 */
  priority: 'P0' | 'P1' | 'P2';
}

/**
 * 置信度。**必须与结论同时展示**，且必须带档位 ——
 * 单独一个百分数会被读成"实锤"，档位是防止误读的机制。
 */
export interface Confidence {
  /** 0..1。**不是**"该模型为真"的概率，而是证据对被报告结论的支持强度。 */
  score: number;
  band: 'high' | 'medium' | 'low';
  /** 拉低置信度的因素键，逐条进报告。 */
  limitingFactors: string[];
}

/**
 * 一次判定的完整结论。**这是归因模块的唯一输出形态。**
 *
 * 离线复验契约：给定同一份证据包与同一个库文件，本结构的规范化序列化
 * 必须逐字节相同。因此这里**不含**时间戳、不含随机数、不含机器信息
 * （时间戳只在报告层由注入的时钟补上）。
 */
export interface AttributionVerdict {
  /** 判定结论。四值之一。 */
  decision: AttributionDecision;
  /** 在哪一段终止。 */
  stage: DecisionStage;
  confidence: Confidence;
  /** `in-library` 时必填。 */
  claimedModel?: string;
  /** `in-library-family` 时必填；`in-library` 时也可能补充。 */
  familyId?: string;
  /** 拒判原因；`unknown` / `ambiguous` 时必填，其余为 undefined。 */
  abstention?: AbstentionReason;
  /** top-N 候选，按距离升序。**永远给出**，包括 `unknown` 时 —— 用户有权看到"最像的是谁以及有多像"。 */
  candidates: Candidate[];
  /** 证据链。报告的主体内容。 */
  evidence: EvidenceItem[];
  /** 第一段的完整评估结果；未运行时为 undefined。 */
  credibility?: import('./credibility.js').CredibilityAssessment;
  /**
   * 自报模型与观测结论的一致性。
   * `null` 表示无法比较（端点未自报，或结论本身是 unknown）。
   * **自报永不参与判定**，只作旁证，并在冲突时把退出码抬到 `EXIT.MISMATCH`。
   */
  selfReportAgreement: boolean | null;
  /** 本次判定使用的库版本与哈希 —— 缺了它，结论无法被第三方复验。 */
  libraryRef: {
    bankVersion: string;
    contentHash: string;
    calibrationVersion: string;
  };
  /** 参与判定的指纹版本。 */
  fingerprintRef: {
    extractorVersion: string;
    suiteVersion: string;
    contentHash: string;
  };
  /** 降级项键（样本不足、某族缺席等），逐条进报告的"方法"区块。 */
  degradations: string[];
  /** 人话原因键。**不得**为空数组 —— 任何结论都必须能解释自己。 */
  reasons: string[];
  /**
   * 本结论在什么情况下会失效。
   *
   * **必填且非空** —— 「快照式结论」适用于所有判定，所以恒定项
   * `'snapshot-in-time'` 让"引擎忘了填"在类型上不可表达，
   * 报告层也就不需要为空数组准备兜底文案。
   *
   * 与 `reasons` 是**语义相反**的两类内容（依据 vs 反证），
   * 因此是独立字段而不是从 `reasons` 里挤 —— 混用会让报告说不清
   * "我们凭什么这么说"和"什么时候这话不成立"。
   */
  invalidations: InvalidationFlag[];
  /**
   * 证据信号（独立于参考库的可观测层）。见 `EvidenceSignal`。
   *
   * 由引擎在判定完成时汇总 —— 六项信号的来源横跨 `src/credibility/`、
   * `src/normalize/` 与样本计数，报告层拿不到这些输入，
   * 因此**不得**改为由报告层从 `appendix` 派生。
   */
  signals: import('./report.js').EvidenceSignal[];
}

/** 失效条件码。受控枚举，每个码有对应的中英文案（i18n 键 `invalidation.<code>`）。 */
export type InvalidationCode =
  | 'rewrite-suspect' // 改写比例超限，证据不可信
  | 'library-stale' // 库版本早于观测，可能是库未收录而非库外
  | 'samples-low' // 有效样本不足
  | 'snapshot-in-time' // 恒定项：结论只代表本次探测时段
  | 'extraction-mismatch' // 提取算法版本与库不一致
  | 'transport-noise' // 传输层异常（非流式 / 截断）导致特征缺席
  | 'partial-run'; // 运行被中断

/**
 * 支撑某个失效码的**已上报数据**。
 *
 * 渲染层不解析它，但契约测试断言 `evidenceKey` 在当前判定里真实存在 ——
 * 这是让"这个失效码是真的"可验证、而不是一句免责话术的机制。
 */
export interface InvalidationBasis {
  /** 指向证据信号键或统计量名，如 `'rewrite-suspect-ratio'` / `'valid-sample-count'`。 */
  evidenceKey: string;
  /** 观测值的已格式化形态，供排障与契约测试比对，不进报告正文。 */
  observed: string;
}

export interface InvalidationFlag {
  code: InvalidationCode;
  basis: InvalidationBasis;
}

export interface AttributeInput {
  fingerprint: import('./fingerprint.js').Fingerprint;
  /** 已建立索引的库。 */
  index: import('./library.js').LibraryIndex;
  /** 库本体（判定需要 `calibration` 与 `featureRegistry`）。 */
  library: import('./library.js').ReferenceLibrary;
  /** 端点自报的模型名（若有）。仅用于一致性旁证。 */
  declaredModel?: string;
  /** top-N 的 N，默认 3。 */
  topN?: number;
}

/**
 * 纯函数：指纹 + 库 → 判定。
 *
 * 契约要求（逐条可测）：
 *  1. 无 I/O、无网络、无时钟、无全局随机。随机源（bootstrap）由输入注入。
 *  2. 同一输入 → 逐字节相同的输出。
 *  3. **不得**在 `candidates` 非空时默认返回 `in-library`；
 *     必须走完距离上限（T1）与边际（T2/T3）两道门槛。
 *  4. 库不可用 → `unknown` + `abstention: 'library-unusable'`，
 *     **不得**抛异常，也**不得**降级成"用最像的凑一个结论"。
 */
export type Attribute = (
  input: AttributeInput,
) => import('./common.js').Result<
  AttributionVerdict,
  import('./errors.js').MError
>;
