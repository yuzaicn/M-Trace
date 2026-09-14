/**
 * 参考指纹库 / Reference fingerprint bank.
 *
 * 库是**单个 JSON 文件**，随产物分发。它同时是：
 *  - 判据参数的唯一来源（实现里不得出现阈值字面量）；
 *  - 版本协商的锚点（`schema` / `extractor` / `contentHash` 三段）；
 *  - 离线复验的输入之一。
 *
 * ## 离线可复验契约（本文件的核心）
 *
 * 给定「证据包 + 库文件」两个输入，`attribute()` 必须给出**逐字节相同**的结论。
 * 因此：
 *  - 库必须自带 `integrity.contentHash`，定义为
 *    `sha256( canonicalJson({...library, integrity: undefined}) )`；
 *  - canonical JSON = 键按字典序递归排序、数组保持顺序、数字用最短往返表示、
 *    无多余空白、UTF-8、末尾无换行；
 *  - 校验方式：重算一次得到的哈希必须等于 `integrity.contentHash`，
 *    不等则 `LIBRARY_MALFORMED`（**不是**警告）。
 */

/** 库内的一条参考条目。 */
export interface ReferenceEntry {
  /** 库内唯一，如 'openai-gpt-family/sample-2026-09-a'。 */
  entryId: string;
  /** 采集时该端点自报的模型名。这是**声明**，不是结论。 */
  declaredModel: string;
  /** 归属的模型家族（若可判定）。家族级结论比模型级结论稳健。 */
  familyId?: string;
  /** 采集环境的描述性标签（不指具体厂商）。 */
  environmentLabel: string;
  /** 采集时间，ISO 8601 日期（不含时刻，避免把采集时序带进报告）。 */
  collectedOn: string;
  /** 该条目的特征，按族组织。键必须在 `featureRegistry` 中声明。 */
  features: import('./fingerprint.js').FamilyFeatures[];
  /** 该条目在各族上的有效样本量；低于阈值的条目在索引期被标为不可用。 */
  sampleCounts: Record<string, number>;
  /**
   * 该条目是否可用于判定。校验时由加载器按 `minFamilySamples` 判定，
   * **不信任文件里的取值**（防止手改库放宽门槛）。
   */
  usable?: boolean;
}

/**
 * 判据参数。**全部阈值都在库里，代码里不得有字面量。**
 *
 * 命名去掉"目标名"，改叫 `acceptance` —— 因为 `unknown` 是正确答案，
 * 用"命中/正确率"命名会诱导实现者去优化误导性指标。
 */
export interface GateCalibration {
  /** 库里冻结的判据版本，进判定结论与报告。 */
  calibrationVersion: string;
  /** 第二段归因的阈值。 */
  attribution: {
    /** 距离接受上限（T1）。超过即 `unknown`。**必须来自留出集 ROC。** */
    maxDistance: number;
    /** 最近两名距离差的绝对下限（T2）。低于即 `ambiguous`。 */
    minMargin: number;
    /** 距离差的相对下限（T3）。低于即 `ambiguous`。 */
    minRelativeMargin: number;
    /** 判定为 `in-library` 所需的最小置信度。 */
    minConfidence: number;
    /** 家族级判定所需的（更宽的）距离上限。 */
    maxDistanceFamily: number;
  };
  /** 第一段绝对可信度层的参数。**不需要参考库**。 */
  credibility: import('./credibility.js').CredibilityPolicy;
  /** 质量门槛。 */
  quality: {
    minValidRatio: number;
    minFamilySamples: number;
    /** 低于该质量等级一律短路为 `unknown`。 */
    minGradeForAttribution: import('./fingerprint.js').QualityGrade;
  };
  /** 改写容忍度：改写比例超过该值即整轮降级。 */
  maxRewrittenRatio: number;
}

/** 库的完整性自描述。 */
export interface LibraryIntegrity {
  /** 库文件内容的规范哈希，形如 'sha256:<hex>'。定义见本文件顶部。 */
  contentHash: string;
  /** 生成该库的工具版本（便于复现采集流程，不要求是 npm 包版本）。 */
  producedBy: string;
}

/**
 * 参考指纹库。
 *
 * 三段版本语义（冻结）：
 *  - `schemaVersion`   结构版本；不兼容 → `LIBRARY_VERSION_UNSUPPORTED`，**拒绝加载**
 *  - `extractorVersion` 提取算法版本；与当前实现不一致 → `LIBRARY_VERSION_UNSUPPORTED`，**拒绝加载**
 *  - `bankVersion`     数据内容版本（人类可读，如 '2026.09.1'）；随采集上涨
 *
 * 注意这是**拒绝加载**，不是警告、不是自动挑选最接近的版本。
 * 混版比对是最危险的静默错误：它不会崩，只会让结论悄悄偏。
 */
export interface ReferenceLibrary {
  schemaVersion: number;
  /** 内容版本，人类可读。**必须**出现在判定结论与报告里。 */
  bankVersion: string;
  extractorVersion: string;
  suiteVersion: string;
  /** 特征注册表：特征名与语义的唯一来源。 */
  featureRegistry: import('./fingerprint.js').FeatureDeclaration[];
  /** 判据参数：阈值唯一来源。 */
  calibration: GateCalibration;
  entries: ReferenceEntry[];
  integrity: LibraryIntegrity;
  /** 采集与方法的限制声明键，进报告。 */
  limitations: string[];
}

/** 加载期的确定性索引。 */
export interface LibraryIndex {
  bankVersion: string;
  contentHash: string;
  calibrationVersion: string;
  /** 按族分组后的可用条目。 */
  byFamily: Record<string, ReferenceEntry[]>;
  /** 被排除的条目及原因，供 `library verify` 展示。 */
  excluded: Array<{ entryId: string; reason: string }>;
  entryCount: number;
  usableCount: number;
}

/**
 * 纯函数：校验任意 JSON 是否为合法库。
 *
 * 必须完成的检查（缺一不可）：
 *  1. 结构符合 `schemaVersion`；
 *  2. `extractorVersion` 与调用方期望一致，否则 `LIBRARY_VERSION_UNSUPPORTED`；
 *  3. `integrity.contentHash` 重算一致，否则 `LIBRARY_MALFORMED`；
 *  4. `featureRegistry` 覆盖所有条目的特征键；
 *  5. 条目不可用性**由加载器重算**，不采信文件里的 `usable`。
 */
export type ValidateLibrary = (
  json: unknown,
  expected: { extractorVersion: string; schemaVersion: number },
) => import('./common.js').Result<
  ReferenceLibrary,
  import('./errors.js').MError
>;

/**
 * 纯函数：库 → 索引。不触网、不读时钟。
 * 两次调用同一库必须给出深相等的索引。
 */
export type IndexLibrary = (library: ReferenceLibrary) => LibraryIndex;

/**
 * 计算库的规范哈希。
 * 导出它是有意的：第三方复验者需要用它核对一个库文件是否被改动过。
 */
export type ComputeLibraryHash = (
  library: Omit<ReferenceLibrary, 'integrity'>,
) => string;

/** 库的对外摘要，供 `library info` 与报告的方法区块使用。 */
export interface LibrarySummary {
  bankVersion: string;
  contentHash: string;
  calibrationVersion: string;
  entryCount: number;
  usableCount: number;
  families: string[];
  collectedFrom: string;
  collectedTo: string;
}

export type SummarizeLibrary = (index: LibraryIndex) => LibrarySummary;
