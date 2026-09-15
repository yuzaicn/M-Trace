/**
 * 配置发现 / Local configuration discovery.
 *
 * 这是**唯一**读本机文件系统的模块之一（另一个是 CLITextIO）。
 * 它同时是隐私红线的落点：`auth.json` 只允许判存在，永不允许读值。
 */

/** 一条配置的来源。只记来源类型与**脱敏后**的位置，不记内容。 */
export interface ConfigSource {
  kind:
    'codex-config' | 'codex-auth-existence' | 'env' | 'cli-flag' | 'default';
  /** 来源的展示名，如 'MT_BASE_URL' 或 'codex config.toml'。不含绝对路径。 */
  label: string;
  /** 该来源贡献了哪些字段名（不含值）。 */
  contributesKeys: string[];
  /** 被更高优先级来源覆盖的字段名。 */
  overriddenKeys?: string[];
}

/** 传输格式。决定请求体形状与响应解析路径。 */
export type WireFormat = 'openai-compatible' | 'anthropic-compatible';

/**
 * 一次配置发现的**结果摘要**。
 *
 * 隐私契约（可静态检查）：本类型是唯一允许携带凭据的类型，
 * 它**不得**出现在 `ReportViewModel`、任何 JSON 产物、任何日志中。
 * 报告只允许出现 `endpointDisplay`。
 */
export interface ConfigSummary {
  /** 规范化后的端点。**仅内存**；报告只允许用 `endpointDisplay`。 */
  endpoint: string;
  /** 报告中允许出现的端点展示形态：保留 scheme + host，path 与 query 丢弃。 */
  endpointDisplay: string;
  wireFormat: WireFormat;
  /** 配置里自报的模型名。**永不作为判定依据**，只作旁证。 */
  declaredModel?: string;
  /** 凭据是否存在。取值本身永不外泄。 */
  credentialPresent: boolean;
  /** 凭据引用的**位置描述**（如 'env:OPENAI_API_KEY'），不含取值。 */
  credentialSourceLabel?: string;
  /** 已发现的来源清单，按优先级从高到低。 */
  sources: ConfigSource[];
  /** 非致命问题（来源冲突、字段缺失但可降级）。 */
  warnings: ConfigWarning[];
}

export interface ConfigWarning {
  code:
    | 'source-conflict'
    | 'field-missing'
    | 'endpoint-unparsable'
    | 'auth-unreadable';
  /** 人话，进终端与报告的限制区；不得含凭据与绝对路径。 */
  messageKey: string;
  detail?: string;
}

/**
 * 配置发现选项。所有外部依赖**显式注入**，因此本模块可在测试里零副作用地跑。
 */
export interface DiscoverOptions {
  /** 工作目录，用于解析项目级配置。 */
  cwd: string;
  /** 用户主目录。注入而非调用 `os.homedir()`，便于夹具测试。 */
  homeDir: string;
  /** 环境变量快照。 */
  env: Record<string, string | undefined>;
  /** 命令行显式覆盖，优先级最高。 */
  explicit?: {
    endpoint?: string;
    model?: string;
    wireFormat?: WireFormat;
  };
  /**
   * 是否允许读取本机 Codex 配置。默认 true。
   * `--no-config-read` 置 false，此时只认 env 与 CLI 参数。
   */
  readLocalConfig?: boolean;
  /**
   * 由测试注入的文件读取器。生产实现用 `node:fs/promises`。
   * **注意**：实现不得用它对 `auth.json` 做值读取，只允许 existence 探测。
   */
  fsPort?: ConfigFsPort;
}

/** 配置发现触达的最小文件系统面。故意做窄，便于审计与替身。 */
export interface ConfigFsPort {
  /**
   * 判断路径是否存在。
   * **`auth.json` 只允许经由此方法被访问** —— 它是凭据文件，
   * 只做存在性判断，永不读取其内容。这条是可静态检查的硬约束。
   */
  exists(path: string): Promise<boolean>;
  /** 读取一个文本文件。**实现方必须保证调用点不指向 auth.json**。 */
  readTextFile(path: string): Promise<string>;
  /** 列出目录中的条目名。 */
  listDir(path: string): Promise<string[]>;
  /** 返回文件的 mtime（Unix 毫秒）。用于"用户是否在用"的粗判，不读内容。 */
  mtimeMs(path: string): Promise<number>;
}

/**
 * 优先级（**冻结，实现期不得更改**）：
 *   CLI 参数 > `MT_*` > `OPENAI_*` / `ANTHROPIC_*` > 本机 Codex 配置 > 默认值。
 * 任一字段冲突时取高优先级来源，并在 `warnings` 记一条 `source-conflict`。
 */
export type DiscoverConfig = (
  options: DiscoverOptions,
) => Promise<
  import('./common.js').Result<ConfigSummary, import('./errors.js').MError>
>;
