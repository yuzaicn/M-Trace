/**
 * M-Trace 契约基础类型 / Contract primitives.
 *
 * 本文件是 `docs/interface.md` v1.0-frozen 的机器可读镜像。
 * 任何签名变更 = minor 版本 + `docs/interface.md` 变更条目 + 通知下游。
 * 任何数值变更（阈值、桶数、权重）= 数据或库版本变更，不是契约版本变更。
 */

/** 报告与终端文案的语言。/ Locales the CLI and report can render. */
export type Locale = 'zh-CN' | 'en';

/**
 * 公开 API 的统一返回形态。
 *
 * 业务结果**不通过抛异常表达**：`ok: false` 表示"这次调用没得出结果"，
 * 抛异常只用于调用方违反契约（未捕获的编程错误）。
 */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

/** 构造成功分支。/ Build the success arm. */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/** 构造失败分支。/ Build the failure arm. */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/**
 * 确定性来源。**所有**会读时钟或掷骰子的模块必须由调用方注入它，
 * 以免"同一份证据跑出两个结论"。
 *
 * - `now()` 返回 Unix 毫秒。仅用于计时与报告时间戳，**不得**参与任何判定。
 * - `rng()` 返回 [0, 1)。仅用于探测套件的变体生成与重试抖动，
 *   **不得**参与打分、距离或阈值计算。
 */
export interface Clock {
  now(): number;
  rng(): number;
}

/** 0..1 区间的比值。/ A ratio constrained to [0, 1]. */
export type Unit = number;

/** 版本三元组，语义在两处固定：
 *  - `schemaVersion` —— 文件**结构**版本；不兼容即拒绝加载。
 *  - `extractorVersion` —— 特征提取**算法**版本；与当前实现不一致即拒绝加载。
 *  - `libraryVersion` —— 数据**内容**版本；随采集增长，不改算法。
 */
export interface ContractVersions {
  /** `docs/interface.md` 的版本，如 '1.0'。 */
  interfaceVersion: string;
  /** `src/types/` 契约与 JSON Schema 的版本，如 1。 */
  schemaVersion: number;
  /** 挑战套件版本，进指纹。 */
  suiteVersion: string;
  /** 特征提取算法版本，进指纹与库。 */
  extractorVersion: string;
}

/** 证据包（evidence pack）的摘要，用于把一次结论钉回它当时的输入。 */
export interface EvidenceRef {
  /** 证据包序列化后的内容哈希，形如 'sha256:<hex>'。 */
  evidenceDigest: string;
  /** 产生该证据包的挑战套件版本。 */
  suiteVersion: string;
  /** 产生该证据包的提取算法版本。 */
  extractorVersion: string;
}

/**
 * 把任意字符串规范化为可安全进入报告的形式。
 * 由报告层实现；契约只规定它**必须**存在且必须幂等。
 */
export type Redactor = (raw: string) => string;
