/**
 * 错误语义 / Error semantics —— `docs/interface.md` §4 的机器可读镜像。
 *
 * 两条铁律：
 * 1. 「无法判定」**不是错误**。它是 `AttributionVerdict` 的一支，正常返回、正常渲染。
 * 2. 每个错误码对应一个**确定的** CLI 退出码（见 `ExitCode`），退出码由错误码推算，
 *    不允许由调用点临时决定。
 */

/** 全量错误码。新增码 = 契约 minor 版本变更。 */
export type ErrorCode =
  // ---- 配置发现 ----
  | 'CONFIG_NOT_FOUND' // 未找到任何可用配置来源
  | 'CONFIG_MALFORMED' // 配置存在但解析失败
  | 'CONFIG_INCOMPLETE' // 配置存在但缺必需字段（baseUrl / wireFormat 无法推定）
  | 'CONFIG_AMBIGUOUS' // 多个来源冲突且无法按优先级裁决
  | 'CONFIG_READ_FORBIDDEN' // 命中隐私红线（如被要求读取 auth.json 的字段值）
  // ---- 传输 ----
  | 'ENDPOINT_UNREACHABLE' // DNS / TCP / TLS 层失败
  | 'AUTH_REJECTED' // 401 / 403
  | 'RATE_LIMITED' // 429（含重试后仍失败）
  | 'UPSTREAM_5XX' // 5xx（含重试后仍失败）
  | 'REQUEST_TIMEOUT' // 单次请求超时
  | 'ABORTED' // AbortSignal 触发
  // ---- 响应形态 ----
  | 'RESPONSE_EMPTY' // 200 但内容为空
  | 'RESPONSE_NON_STREAM' // 全部样本非流式（流式节奏类特征整族缺席）
  | 'RESPONSE_TRUNCATED' // SSE 在语义完整前结束
  | 'RESPONSE_SCHEMA_MISMATCH' // 结构与 OpenAI / Anthropic 兼容格式不符
  | 'CONTENT_REWRITTEN' // 网关改写比例越过降级阈值
  // ---- 证据与判定 ----
  | 'EVIDENCE_INSUFFICIENT' // 有效样本不足，无法提取指纹
  | 'EVIDENCE_MALFORMED' // 证据包结构校验失败
  // ---- 参考库 ----
  | 'LIBRARY_EMPTY' // 库为空或全部条目无效
  | 'LIBRARY_MALFORMED' // 库文件校验失败
  | 'LIBRARY_VERSION_UNSUPPORTED' // schema / extractor 版本不兼容，拒绝加载
  // ---- 本地 IO 与渲染 ----
  | 'RENDER_FAILED'
  | 'IO_FAILED' // 读写文件失败
  | 'OUTPUT_TOO_LARGE' // 报告超出体积上限且裁剪后仍超限
  // ---- CLI ----
  | 'USAGE_ERROR' // 未知子命令 / 非法参数
  | 'CANCELLED'; // 用户中断（SIGINT）

/**
 * 错误对象。
 *
 * `message` 是给**人**看的中文兜底文案；终端与报告的实际措辞由 i18n 目录按
 * `code` 覆写，因此 `message` 不参与渲染契约，也不得包含任何凭据或绝对路径。
 */
export interface MError {
  code: ErrorCode;
  message: string;
  /** 是否值得原样重试。仅传输类错误可为 true。 */
  retryable: boolean;
  /**
   * 出错位置的结构化上下文，**只允许标量**，且必须已经脱敏。
   * 它会被写进终端诊断，绝不进报告。
   */
  context?: Record<string, string | number | boolean>;
  /** 仅供本地调试；不得序列化进报告或 JSON 产物。 */
  cause?: unknown;
}

/** 带版本的错误载荷，用于跨边界传递。 */
export interface ErrorEnvelope {
  code: ErrorCode;
  messageKey: string;
  retryable: boolean;
  context?: Record<string, string | number | boolean>;
}
