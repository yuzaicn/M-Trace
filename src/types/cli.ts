/**
 * CLI 契约 / Command-line contract。
 *
 * 本文件包含**退出码契约**，它是产品 P0 需求「退出码可被 CI 使用」的落点。
 *
 * ## 退出码冲突的裁决（见 `docs/interface.md` §5）
 *
 * 规划文档（GUCH-359）与产品 PRD（GUCH-360）各给了一套退出码，二者不兼容。
 * 裁决：**以规划文档的矩阵为骨架**（它已被写成"冻结"且粒度更细），
 * 但**保留 PRD 的语义要点**（"不一致/疑似降级"必须有一个独立的码，
 * 且不能与"无法判定"混用）。裁决后的完整映射见下。
 * 裁决理由：PRD 的 `0/1/2/3/4` 五档把"网络失败"与"判定不一致"都压在
 * 一个 `3` 上会让 CI 无法区分"渠道有问题"与"我自己的网络有问题"；
 * 而规划文档把二者分开，代价只是多几个码。已 @ 产品经理确认。
 */

/**
 * 退出码。**冻结** —— 新增码是契约 minor 变更，改语义是 major 变更。
 *
 * 数值本身有意义，不要重排：
 *  - 0     成功且结论明确
 *  - 1x    判定类结果（"跑通了，但结论是 X"），全部表示**工具工作正常**
 *  - 2     用法错误
 *  - 3     网络 / 上游
 *  - 4     数据不足或响应异常
 *  - 5     本地环境（库 / 渲染 / IO）
 *  - 130   被中断
 */
export const EXIT = {
  /** 判定为 `in-library` 或 `in-library-family`，且 quality ≥ fair。 */
  SUCCESS: 0,
  /** 判定为 `unknown`（库外模型或证据不足）。这是**正确答案**，不是失败。 */
  UNKNOWN: 10,
  /** 判定为 `ambiguous`（多个候选无法区分）。可操作：多跑几个变体。 */
  AMBIGUOUS: 11,
  /** 自报模型与观测结论**冲突**。CI 的"便宜中转 key 告警"由它承载。 */
  MISMATCH: 12,
  /** 用法 / 参数错误。 */
  USAGE: 2,
  /** 网络或上游错误（不可达 / 429 / 5xx / 超时 / 鉴权失败）。 */
  TRANSPORT: 3,
  /** 数据不足或响应异常（样本不足 / 空体 / 截断 / 改写 / 非流式）。 */
  EVIDENCE: 4,
  /** 本地环境问题（库缺失 / 版本不兼容 / 渲染失败 / 读写失败）。 */
  LOCAL: 5,
  /** 被 SIGINT / AbortSignal 中断。 */
  INTERRUPTED: 130,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];

/** CLI 子命令。 */
export type CliCommand =
  | 'detect' // 探测 → 归因 → 报告（默认命令）
  | 'challenges' // 只生成挑战文本（纯粘贴场景的入口，P0-2）
  | 'score' // 由粘贴文本或证据包打分（离线，零网络）
  | 'report' // 由已保存的证据包重新渲染报告（离线，零网络）
  | 'library' // 参考库操作：info | verify | hash
  | 'doctor' // 环境自检：Node 版本、配置发现、端点连通性（不跑完整探测）
  | 'verify'; // 第三方复验：给定证据包 + 库 → 重算结论并比对

/** 解析后的 CLI 选项。**所有路径都相对入口文件或用户 CWD 解析**，见 §7。 */
export interface CliOptions {
  command: CliCommand;
  configPath?: string;
  endpoint?: string;
  wireFormat?: import('./config.js').WireFormat;
  model?: string;
  out?: string;
  jsonPath?: string;
  locale?: import('./common.js').Locale;
  suiteSeed?: number;
  variants?: number;
  libraryPath?: string;
  evidenceIn?: string;
  /** 只用本地库，禁止一切网络。 */
  offline: boolean;
  /** 关闭本机配置读取（隐私开关，PRD 风险登记项）。 */
  noConfigRead: boolean;
  quiet: boolean;
  verbose: boolean;
  noColor: boolean;
  yes: boolean;
  /** 探测强度档位。 */
  intensity: 'quick' | 'standard' | 'thorough';
  topN: number;
}

/** CLI 的 IO 端口。注入而非直连 `process`，以便端到端测试。 */
export interface CliIO {
  stdout(text: string): void;
  stderr(text: string): void;
  /** 写文件。实现负责创建父目录。 */
  writeFile(path: string, data: string): Promise<void>;
  readFile(path: string): Promise<string>;
}

/** CLI 的外部依赖。全部注入，因此 `runCli` 可被完整地离线测试。 */
export interface CliDeps {
  io: CliIO;
  clock: import('./common.js').Clock;
  /** 环境变量快照。 */
  env: Record<string, string | undefined>;
  cwd: string;
  homeDir: string;
  /** 工具版本。**注入而非读 package.json**（分发渠道解耦）。 */
  toolVersion: string;
  nodeMajor: string;
  /** 传输端口。测试注入 mock。 */
  transport: import('./probe.js').TransportPort;
  /** 库加载端口。测试注入内存实现。 */
  libraryLoader: (path?: string) => Promise<
    import('./common.js').Result<
      {
        library: import('./library.js').ReferenceLibrary;
        index: import('./library.js').LibraryIndex;
        source: string;
      },
      import('./errors.js').MError
    >
  >;
  /** 配置发现。测试注入桩。 */
  discoverConfig: import('./config.js').DiscoverConfig;
}

/**
 * CLI 入口。**返回退出码而不是调用 `process.exit`** ——
 * 后者会截断未 flush 的 IO，也会让测试无法断言。
 */
export type RunCli = (
  argv: readonly string[],
  deps: CliDeps,
) => Promise<ExitCode>;

/**
 * 错误码 → 退出码的**唯一**映射。契约测试会断言它是全函数
 * （每个 `ErrorCode` 都有落点），因此新增错误码时编译期就会报缺口。
 *
 * 注意：`EXIT.UNKNOWN` / `AMBIGUOUS` / `MISMATCH` **不在此表内** ——
 * 它们不是错误，而是判定结果，由 `AttributionVerdict.decision` 推出。
 */
export const ERROR_EXIT_MAP = {
  CONFIG_NOT_FOUND: EXIT.USAGE,
  CONFIG_MALFORMED: EXIT.USAGE,
  CONFIG_INCOMPLETE: EXIT.USAGE,
  CONFIG_AMBIGUOUS: EXIT.USAGE,
  CONFIG_READ_FORBIDDEN: EXIT.USAGE,

  ENDPOINT_UNREACHABLE: EXIT.TRANSPORT,
  AUTH_REJECTED: EXIT.TRANSPORT,
  RATE_LIMITED: EXIT.TRANSPORT,
  UPSTREAM_5XX: EXIT.TRANSPORT,
  REQUEST_TIMEOUT: EXIT.TRANSPORT,
  ABORTED: EXIT.INTERRUPTED,

  RESPONSE_EMPTY: EXIT.EVIDENCE,
  RESPONSE_NON_STREAM: EXIT.EVIDENCE,
  RESPONSE_TRUNCATED: EXIT.EVIDENCE,
  RESPONSE_SCHEMA_MISMATCH: EXIT.EVIDENCE,
  CONTENT_REWRITTEN: EXIT.EVIDENCE,

  EVIDENCE_INSUFFICIENT: EXIT.EVIDENCE,
  EVIDENCE_MALFORMED: EXIT.EVIDENCE,

  LIBRARY_EMPTY: EXIT.LOCAL,
  LIBRARY_MALFORMED: EXIT.LOCAL,
  LIBRARY_VERSION_UNSUPPORTED: EXIT.LOCAL,

  RENDER_FAILED: EXIT.LOCAL,
  IO_FAILED: EXIT.LOCAL,
  OUTPUT_TOO_LARGE: EXIT.LOCAL,

  USAGE_ERROR: EXIT.USAGE,
  CANCELLED: EXIT.INTERRUPTED,
} as const satisfies Record<import('./errors.js').ErrorCode, ExitCode>;

/** 判定 → 退出码的映射。`selfReportAgreement === false` 时把 0 抬到 12。 */
export type VerdictToExit = (
  verdict: import('./attribute.js').AttributionVerdict,
) => ExitCode;
