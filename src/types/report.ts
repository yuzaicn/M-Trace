/**
 * 报告 / Report。
 *
 * 形态契约（ADR-003，冻结）：
 *  - 单文件 HTML，CSS 内联，数据内联为 `<script type="application/json">`；
 *  - **零 `<script>` 执行逻辑**，交互全靠 `<details>` / `:target` / checkbox hack；
 *  - 零外部 URL（无 CDN、无字体、无图片外链）；
 *  - 体积上限 2 MiB，超限时**裁剪附录的原始值序列并明写**，不静默增长。
 *
 * 隐私契约：`ReportViewModel` 内**不得**出现凭据、绝对路径、真实 request id、
 * 原始对话内容。为此视图模型里的端点只保留 `endpointDisplay`（scheme + host）。
 *
 * 转义契约：报告会内联**从第三方端点采回的文本片段**（证据表里的原样数值、
 * 端点自报的模型名、错误措辞）。渲染层必须对这些内容做 HTML **转义**，
 * 并且不生成任何可执行脚本 —— 两者合起来消除整类注入风险。
 */

/** 报告数据模型的版本。结构变更即 +1，与库版本无关。 */
export type ReportSchemaVersion = '1.0';

/** 图表。报告只画静态 SVG，不做缩放与 tooltip。 */
export interface ReportChart {
  id: string;
  kind: 'histogram' | 'distance-bar' | 'chunk-timing';
  /**
   * 数据序列。标签已本地化。
   *
   * `role` 区分"观测"与"库内参考"：分布对比图必须把两者配色与图例分开，
   * 并暴露"样本量不对等"（观测 n=220 vs 库内 n=1400）。靠 `id` 约定太脆。
   */
  series: Array<{
    label: string;
    values: number[];
    role: 'observed' | 'reference';
  }>;
  binEdges?: number[];
  /** 轴标题的 i18n 键，不用字面量。 */
  axisKeys?: { x?: string; y?: string };
}

/**
 * 证据信号 —— 独立于参考库的可观测层。
 *
 * 存在的理由：库内比对回答"像哪个模型"，这一层回答"这段输出本身是否可信"。
 * 它在**库内库外都成立**，因此是唯一能发现"响应被改写"的途径，
 * 也正是库外模型必须落到「无法判定」时仍然可被解释的依据。
 *
 * 六项的取值横跨三个模块（`src/credibility/` 的两项统计量、
 * `src/normalize/` 的汇总占比、以及有效样本数），**报告层都没有输入**。
 * 因此由引擎在判定完成时一次性汇总成这个显式数组；
 * 报告层只渲染，不派生、不计数、不合成总分。
 */
export interface EvidenceSignal {
  key: EvidenceSignalKey;
  /** 已格式化（VM 阶段完成全部格式化）。不适用时为 `null`，**不是 0**。 */
  displayValue: string | null;
  /** 期望区间的已格式化展示，如 `'≈0.33'`。无期望时为 undefined。 */
  displayExpected?: string;
  /** 判读。`'na'` 必须与 `displayValue: null` 同时出现。 */
  verdict: 'ok' | 'low' | 'bad' | 'na';
}

/** 证据信号的冻结集合。顺序即报告中的呈现顺序。 */
export type EvidenceSignalKey =
  | 'chi-square-over-df'
  | 'lag1-autocorrelation'
  | 'valid-sample-count'
  | 'streaming-ratio'
  | 'truncation-rate'
  | 'rewrite-suspect-ratio';

/** 报告里的一行证据。 */
export interface ReportEvidenceRow {
  /** 证据分组键（可信度层 / 归因层 / 传输层）。 */
  layerKey: string;
  nameKey: string;
  /** 已格式化的展示值。渲染层不再做数字处理。 */
  displayValue: string;
  /** 参考区间，已格式化。 */
  displayRange?: string;
  polarity: 'supports' | 'weakens' | 'neutral';
  priority: 'P0' | 'P1' | 'P2';
  /**
   * 该行的状态。
   *
   * `'unavailable'`（我们没采集）与 `'parse-failed'`（采到了但解析不了）
   * **必须区分** —— 两者对结论的含义完全不同，合并会让读者误判是端点的问题
   * 还是我们自己的问题。失败行必须保留，不得因"难看"而被过滤。
   */
  status: 'ok' | 'parse-failed' | 'unavailable';
}

/**
 * 报告的视图模型。**渲染层是它的纯函数**：同一个 VM 必须渲染出逐字节相同的 HTML。
 *
 * 因此这里的时间是**注入后固化**的字符串，不是 `Date` 对象；
 * 所有需要格式化的数值都已在此阶段格式化完毕（见 `displayValue`）。
 */
export interface ReportViewModel {
  schemaVersion: ReportSchemaVersion;

  /** 结论。默认展示语言。 */
  locale: import('./common.js').Locale;
  /** 第二种语言；报告内可切换。缺省时只渲染单语。 */
  secondaryLocale?: import('./common.js').Locale;

  /** 生成信息。全部为**已固化**的字符串或已注入值。 */
  generatedAt: string;
  /** 工具版本。从注入值取，**不读 package.json**（分发渠道解耦要求）。 */
  toolVersion: string;
  /** Node 主版本号，仅作环境记录。 */
  nodeMajor: string;

  /** 被检测目标。**已脱敏**：只有 scheme + host。 */
  target: {
    endpointDisplay: string;
    wireFormat: import('./config.js').WireFormat;
    declaredModel?: string;
    /**
     * 本次探测的时段。**只到天**，与证据包"生成日期只到时刻以上粒度"的
     * 脱敏口径一致。报告必须据此声明"本报告只代表本次探测时段"。
     */
    probeWindow: { from: string; to: string };
  };

  /** 判定结论本体。**不做任何加工**，保证与 JSON 产物一致。 */
  verdict: import('./attribute.js').AttributionVerdict;

  /**
   * 指纹质量档位。判定门槛由库的 `minGradeForAttribution` 决定；
   * 契约保证 `unknown` **不得**为 `'good'`。
   */
  qualityGrade: import('./fingerprint.js').QualityGrade;

  /** 库与套件的版本指纹，用于第三方复验。 */
  libraryRef: {
    bankVersion: string;
    contentHash: string;
    calibrationVersion: string;
  };
  fingerprintRef: {
    extractorVersion: string;
    suiteVersion: string;
    contentHash: string;
  };

  /** 复现命令：用户可复制粘贴重跑本次检测。 */
  reproduceCommand: string;

  charts: ReportChart[];
  evidenceTable: ReportEvidenceRow[];

  /** 附录。`rawSeries` 是**已裁剪到体积上限内**的原始值序列（base64 编码）。 */
  appendix: {
    rawSeries: Array<{ requestId: string; base64: string }>;
    /** 是否因体积上限被裁剪。裁剪时必须为 true 并在 `limitations` 记账。 */
    truncated: boolean;
    /** 被丢弃的序列条数。 */
    droppedCount: number;
    /**
     * 证据包摘要，用于第三方复验。
     *
     * 规则冻结：对完整挑战集与全部原始探测结果做 `canonicalJson`（§3.9）
     * 后取摘要 —— **同一份输入必须得到同一哈希**，与键顺序、数字格式化、
     * 平台无关。这是"离线可复验"唯一的锚点：第三方拿报告里的
     * `reproduceCommand` + 种子重跑，对不上这个哈希就是我们披露不足或产物不确定。
     */
    evidenceHash: string;
    /** 与 `verdict.libraryRef.contentHash` 一致，冗余一份供离线直接比对。 */
    libraryContentHash: string;
    /**
     * 本次探测是否使用了随机化。
     *
     * 用判别联合而不是 `seed?: number`：可选数字分不清"本来就没随机化"
     * 与"引擎忘了填"。前者是正当结果（写"本次未使用随机化"），
     * 后者必须让契约测试变红 —— 类型上让第二种情况不可表达。
     */
    randomization: { randomized: true; seed: number } | { randomized: false };
  };

  /** 局限声明键。**不可为空** —— 产品 P0-7 与法务 R13 的落点。 */
  limitations: string[];
  /** 免责声明键。**不可为空** —— 法务 R13。 */
  disclaimerKeys: string[];
}

export interface BuildReportViewModelInput {
  verdict: import('./attribute.js').AttributionVerdict;
  fingerprint: import('./fingerprint.js').Fingerprint;
  library: import('./library.js').ReferenceLibrary;
  locale: import('./common.js').Locale;
  secondaryLocale?: import('./common.js').Locale;
  /** 已固化的生成时间（ISO 8601）。 */
  generatedAt: string;
  toolVersion: string;
  nodeMajor: string;
  reproduceCommand: string;
  /** 端点脱敏函数。**必须**由本模块调用，不得信任上游已脱敏。 */
  redactEndpoint: import('./common.js').Redactor;
  /** 原始值序列，用于附录；会被裁剪到体积上限内。 */
  rawSeries: Array<{ requestId: string; values: number[] }>;
}

/** 报告体积上限（字节）。超出即触发附录裁剪。 */
export const REPORT_MAX_BYTES = 2 * 1024 * 1024;

/**
 * 纯函数：构造视图模型。
 *
 * 契约要求：不读时钟（时间由输入注入）、不读文件、不联网。
 * 输出的序列化形态是报告快照测试的比对对象。
 */
export type BuildReportViewModel = (
  input: BuildReportViewModelInput,
) => import('./common.js').Result<
  ReportViewModel,
  import('./errors.js').MError
>;

/**
 * 纯函数：渲染 HTML。
 *
 * 契约要求：
 *  - 返回**完整 HTML 字符串**，不是文件路径；
 *  - 渲染层只读 VM，不做数字格式化、不做脱敏（那些已在 VM 阶段完成）；
 *  - 输出中不得出现 `<script>` 执行逻辑（数据块 `type="application/json"` 除外）；
 *  - 输出中不得出现任何 `http://` / `https://` 外部资源引用；
 *  - 双语：若 `secondaryLocale` 存在，两种语言的内容**同时存在于 DOM**，
 *    由纯 CSS 切换。这不是可选项 —— 报告要能被转发给只看英文的同事。
 */
export type RenderReport = (
  vm: ReportViewModel,
  opts: { locale: import('./common.js').Locale },
) => import('./common.js').Result<string, import('./errors.js').MError>;

/** 报告落盘后的自检结果，供交付与门禁使用。 */
export interface ReportSelfCheck {
  byteLength: number;
  /** 命中凭据/路径正则的条数。**必须为 0**。 */
  leakHits: Array<{ pattern: string; sample: string }>;
  /** 外部 URL 引用条数。**必须为 0**。 */
  externalRefs: number;
  /** 是否已裁剪附录。 */
  appendixTruncated: boolean;
}

/** 纯函数：对渲染后的 HTML 做泄露与离线自检。 */
export type SelfCheckReport = (html: string) => ReportSelfCheck;
