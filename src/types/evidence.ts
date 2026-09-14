/**
 * 证据包 / Evidence pack —— 离线复验的载体。
 *
 * 一份证据包 = 「我观测到了什么」+ 「我用什么算法解读的」。
 * 它**不含**凭据、不含端点、不含时间戳的精确值（时间只到天，避免把检测时序外泄）。
 *
 * 复验契约（本项目对外可信度的技术基础）：
 *
 *     attribute( evidencePack.fingerprint , library )
 *
 * 其中 `library` 由 `evidencePack.libraryRef.contentHash` 唯一确定。
 * 该调用是纯函数，因此第三方在**任何机器、任何时间、无网络**下重跑，
 * 都应得到逐字节相同的 `AttributionVerdict`。若不一致，那就是我们错了 ——
 * 报告里给出的复现命令必须允许他们证明这一点。
 */

/** 证据包的版本。结构变更即 +1。 */
export type EvidencePackSchemaVersion = '1.0';

export interface EvidencePack {
  schemaVersion: EvidencePackSchemaVersion;

  /** 工具版本。仅作记录；**不参与**判定，因此复验者用不同版本也能核对结论。 */
  toolVersion: string;
  /** 生成日期（YYYY-MM-DD），不含时刻。 */
  generatedOn: string;

  /**
   * 目标标识。**已脱敏**：只有 host（不含 path / query / 端口以外的信息）。
   * 复验不需要知道是谁，只需要知道"同一份证据"。
   */
  target: {
    endpointDisplay: string;
    wireFormat: import('./config.js').WireFormat;
    declaredModel?: string;
  };

  /** 指纹本体。**判定所需的全部输入都在这里。** */
  fingerprint: import('./fingerprint.js').Fingerprint;

  /**
   * 原始观测（可选）。体积大，默认不导出；
   * 需要第三方复核"规范化是否正确"时才带上。
   */
  observations?: import('./normalize.js').NormalizedObservation[];

  /** 本次结论引用的库与判据版本。复验方据此定位同一个库文件。 */
  libraryRef: {
    bankVersion: string;
    contentHash: string;
    calibrationVersion: string;
  };

  /** 判定的完整结论。**保留原样**，以便复验方逐字段比对（而不是只看结论名）。 */
  verdict: import('./attribute.js').AttributionVerdict;

  /** 复现本次采集所需的命令（不含凭据）。 */
  reproduceCommand: string;

  /** 采集期的降级与异常记录。复验方据此判断证据是否可用。 */
  degradations: string[];
}

/** 序列化选项。 */
export interface EvidencePackSerializeOptions {
  /** 是否内联原始观测。默认 false。 */
  includeObservations?: boolean;
  /** 是否美化输出（仅供人读；复验用的哈希一律基于规范形式，与此无关）。 */
  pretty?: boolean;
}

/**
 * 纯函数：序列化证据包。
 *
 * 契约要求：键序稳定（`canonicalJson` 规则），两次序列化同一输入
 * 必须得到逐字节相同的字符串 —— 因为它的哈希会被写进结论。
 */
export type SerializeEvidencePack = (
  pack: EvidencePack,
  opts?: EvidencePackSerializeOptions,
) => string;

/** 计算证据包的规范哈希，形如 'sha256:<hex>'。 */
export type DigestEvidencePack = (pack: EvidencePack) => string;

/** 反序列化 + 结构校验。失败返回 `EVIDENCE_MALFORMED`，不抛异常。 */
export type ParseEvidencePack = (
  json: string,
) => import('./common.js').Result<EvidencePack, import('./errors.js').MError>;

/**
 * 规范 JSON。**这是复验契约的底层原语**，因此单独冻结：
 *  - 对象键按字典序递归排序；
 *  - 数组保持原序；
 *  - 数字用最短往返表示（`Number.prototype.toString` 的默认行为）；
 *  - 字符串按 JSON 规范转义，非 ASCII 保留原字符（不转 `\u`）；
 *  - 无多余空白，UTF-8，末尾无换行。
 *
 * 库哈希与证据包哈希都基于它。任何实现差异都会表现为"第三方复验不一致"，
 * 因此它必须有独立的对照测试（对固定输入的固定期望输出）。
 */
export type CanonicalJson = (value: unknown) => string;
