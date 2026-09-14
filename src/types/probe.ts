/**
 * 探测 / Probing —— 挑战套件、传输端口、原始响应。
 *
 * `TransportPort` 是**唯一**触网面。它的存在只有一个目的：
 * 让"不触网"成为可测试的性质，而不是一句承诺。
 */

/** 挑战族标识，如 'integer-sequence'. 命名由数据侧定义，契约只要求稳定。 */
export type ChallengeFamilyId = string;

/**
 * 一个挑战族。族是**可插拔的证据源**：新增族不改契约，只加实现与库条目。
 *
 * 优先级（见 `docs/interface.md` §2）：
 *  - P0 必实现：`integer-sequence`（生成式数字指纹，路线 A）
 *  - P1 预留：行为族与协议族（路线 C / D）
 *  - P2 预留位：文本统计族（路线 B），**不分配实现预算**
 */
export interface ChallengeFamilyDescriptor {
  id: ChallengeFamilyId;
  /** 该族是否可用于**纯粘贴**场景（无需直连端点）。 */
  pasteCapable: boolean;
  /** 该族的建设优先级。 */
  priority: 'P0' | 'P1' | 'P2';
  /** 该族是否需要流式响应才有意义（如 SSE 节奏）。 */
  requiresStreaming: boolean;
  /** 该族的实现状态；'reserved' 表示契约留位但无实现。 */
  status: 'implemented' | 'reserved';
}

/** 一次具体探测请求。 */
export interface ProbeRequest {
  /** 全局唯一，形如 `<familyId>#<seed>#<variant>`；进证据包，不进报告正文。 */
  requestId: string;
  familyId: ChallengeFamilyId;
  /** 渲染后的最终 prompt 文本。 */
  prompt: string;
  /** 期望的输出格式约束，决定规范化层的解析策略。 */
  formatConstraint: 'json-array' | 'csv-line' | 'plain-text-digits';
  maxTokens: number;
  params: {
    temperature: number;
    topP?: number;
    topK?: number;
    seed?: number;
  };
  /** 请求体的线上格式。 */
  wireFormat: import('./config.js').WireFormat;
  /** 端点。仅在传输层内部使用，不进任何产物。 */
  endpoint: string;
  /** 凭据。仅在传输层内部使用，不进任何产物。 */
  credential?: string;
}

/** 响应头白名单读出后的元数据。 */
export interface ResponseMeta {
  status: number;
  latencyMs: number;
  /** 首字节延迟（流式时）。非流式时等于 latencyMs。 */
  firstByteMs: number;
  /** 是否走了流式通道。 */
  streamed: boolean;
  chunkCount: number;
  /** 相邻分块的时间间隔（毫秒）。非流式为空数组。 */
  interChunkMs: number[];
  /** 仅白名单字段，且**不做全量哈希**（request-id 类随机值会污染特征）。 */
  headers: Record<string, string>;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  /** 响应体里自报的 model 字段。**永不作为判定依据**。 */
  declaredModel?: string;
  finishReason?: string;
}

/** 一次探测的原始结果。这是证据包的基本单元。 */
export interface ProbeResponse {
  requestId: string;
  familyId: ChallengeFamilyId;
  /** 拼接后的完整文本。 */
  rawText: string;
  /** 原始响应体（非流式时为解析后的 JSON，流式时为 null）。 */
  rawBody: unknown;
  meta: ResponseMeta;
}

/** 传输策略。**全部阈值都在这里，实现里不得有魔法数字。** */
export interface TransportPolicy {
  timeoutMsPerRequest: number;
  maxRetries: number;
  /** 429 时尊重 Retry-After，但不超过该上限；超出则放弃本次。 */
  maxRetryAfterMs: number;
  backoffMs: (attempt: number, rng: () => number) => number;
  maxRequestsPerMinute: number;
  concurrency: number;
  abortSignal: AbortSignal;
}

/**
 * 唯一触网端口。
 *
 * 契约要求：实现方必须能提供一个**绑定 127.0.0.1:0 的真实 HTTP 服务器**替身，
 * 而不是函数桩 —— 只有真实 server 才能覆盖 SSE 分块边界、header 大小写与连接中断。
 */
export interface TransportPort {
  run(
    request: ProbeRequest,
    policy: TransportPolicy,
  ): Promise<
    import('./common.js').Result<ProbeResponse, import('./errors.js').MError>
  >;
}

/** 一次探测运行的计划。 */
export interface ProbePlan {
  suiteVersion: string;
  /** 种子。同一个种子必须产出同一套 prompt（确定性）。 */
  seed: number;
  /** 每族变体数。 */
  variantsPerFamily: number;
  /** 参与本次运行的族。缺席的族在指纹里整族缺席（不是空特征）。 */
  families: ChallengeFamilyId[];
  /** 每族最小有效样本；不足则该族整体失效。 */
  minValidPerFamily: number;
  /** 环境包装维度；用于检验结论不随包装变化。 */
  envWrap?: string;
}

/** 探测运行的汇总。失败**不中断整体**，而是逐条记录。 */
export interface ProbeRunResult {
  responses: ProbeResponse[];
  failures: Array<{ requestId: string; error: import('./errors.js').MError }>;
  /** 实际生效的套件版本，回填进指纹。 */
  suiteVersion: string;
}

export interface ProbeDeps {
  transport: TransportPort;
  sleep: (ms: number) => Promise<void>;
  clock: import('./common.js').Clock;
}

export type RunProbes = (
  plan: ProbePlan,
  deps: ProbeDeps,
  policy: TransportPolicy,
) => Promise<ProbeRunResult>;
