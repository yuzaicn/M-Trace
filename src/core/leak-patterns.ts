/**
 * 泄露扫描样例 / Leak-scan patterns.
 *
 * 报告与日志的泄露面**必须**有自动化断言（法务 R12、分析报告 §5.2）。
 * 这里定义的是**样例集合**，不是完整实现 —— 它的作用是：
 *
 *  1. 让"什么样的字符串算泄露"成为一个**可评审、可扩展的清单**，而不是散落在测试里的正则；
 *  2. 让阶段 3 的 `SelfCheckReport` 实现直接复用同一份定义，
 *     避免"测试用一套、实现用另一套"这种最坏的组合（测试永远绿、报告仍在泄露）。
 *
 * 清单里既有**正例**（必须命中）也有**反例**（必须不命中）：
 * 没有反例的扫描器会在报告里把正常的十六进制哈希全标成泄露，然后被人关掉。
 */

export interface LeakPattern {
  id: string;
  /** 人话说明：这一条防的是什么。 */
  rationale: string;
  pattern: RegExp;
  /** 命中后建议的处置方式。 */
  severity: 'block' | 'warn';
}

/**
 * 必须拦截的模式。`block` 级命中 = 报告不得写出。
 *
 * 注意：不做"高熵字符串"这种泛化启发式 —— 报告里本来就有 sha256 哈希、
 * base64 值序列、contentHash。泛化启发式会在真实产物上误报，
 * 然后被合理地关掉，最后真正该拦的也一起放过去了。
 */
export const LEAK_PATTERNS: readonly LeakPattern[] = [
  {
    id: 'openai-style-key',
    rationale: 'OpenAI 兼容渠道的密钥形如 sk- 前缀 + 长随机串',
    pattern: /\bsk-[A-Za-z0-9_-]{16,}\b/,
    severity: 'block',
  },
  {
    id: 'anthropic-style-key',
    rationale: 'Anthropic 密钥形如 sk-ant- 前缀',
    pattern: /\bsk-ant-[A-Za-z0-9_-]{16,}\b/,
    severity: 'block',
  },
  {
    id: 'jwt',
    rationale: 'JWT 是三段 base64url，常见于 OAuth 与网关凭据',
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/,
    severity: 'block',
  },
  {
    id: 'authorization-header',
    rationale: '授权头一旦被原样写进报告，等于把凭据随报告一起转发出去',
    pattern: /\bauthorization\b\s*[:=]\s*(?:bearer|basic)\s+\S+/i,
    severity: 'block',
  },
  {
    id: 'unix-home-path',
    rationale: '绝对路径里的用户名是可识别信息，且是 PRD 明令不得出现的内容',
    pattern: /(?:\/home\/|\/Users\/)[A-Za-z0-9._-]+/,
    severity: 'block',
  },
  {
    id: 'windows-user-path',
    rationale: '同上，Windows 形态',
    pattern: /[A-Za-z]:\\Users\\[A-Za-z0-9._-]+/,
    severity: 'block',
  },
  {
    id: 'query-credential',
    rationale: '查询串可能携带 key（?api_key=...），端点脱敏时最容易漏掉',
    pattern: /[?&](?:api[_-]?key|key|token|access[_-]?token|password)=[^&\s]+/i,
    severity: 'block',
  },
  {
    id: 'bearer-literal',
    rationale: '裸 Bearer 令牌',
    pattern: /\bBearer\s+[A-Za-z0-9._-]{20,}/,
    severity: 'block',
  },
  {
    id: 'email',
    rationale: '账号标识属法务 R12 的禁列清单',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
    severity: 'block',
  },
];

/**
 * 这些样例**必须**被相应模式命中。它们全部是**合成的**，
 * 不对应任何真实凭据（值本身就是占位符）。
 */
export const LEAK_SAMPLES_POSITIVE: ReadonlyArray<{
  patternId: string;
  sample: string;
}> = [
  { patternId: 'openai-style-key', sample: 'sk-PLACEHOLDER0000000000000000' },
  {
    patternId: 'anthropic-style-key',
    sample: 'sk-ant-PLACEHOLDER000000000000',
  },
  {
    patternId: 'jwt',
    sample:
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJwbGFjZWhvbGRlciJ9.c2lnbmF0dXJlLXBsYWNlaG9sZGVy',
  },
  {
    patternId: 'authorization-header',
    sample: 'Authorization: Bearer PLACEHOLDERTOKENVALUE',
  },
  {
    patternId: 'unix-home-path',
    sample: 'loaded from /home/someuser/.codex/config.toml',
  },
  {
    patternId: 'windows-user-path',
    sample: 'C:\\Users\\someuser\\.codex\\config.toml',
  },
  {
    patternId: 'query-credential',
    sample: 'https://relay.example/v1?api_key=PLACEHOLDER',
  },
  {
    patternId: 'bearer-literal',
    sample: 'Bearer PLACEHOLDERTOKENVALUE00000000',
  },
  { patternId: 'email', sample: 'account owner is someone@example.com' },
];

/**
 * 这些样例**必须不**被任何模式命中。
 *
 * 反例是这份清单里最重要的部分：报告里天然存在大量"看起来像凭据但其实是证据"的字符串。
 * 扫描器如果连它们都拦，就会被关掉，而关掉之后真正该拦的也一起放过去了。
 */
export const LEAK_SAMPLES_NEGATIVE: ReadonlyArray<{
  why: string;
  sample: string;
}> = [
  {
    why: 'contentHash 是 sha256，本来就该出现在报告里',
    sample:
      'sha256:9f2c1ab4c0d3e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e',
  },
  {
    why: '附录里的值序列是 base64，不是凭据',
    sample:
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/==',
  },
  {
    why: '脱敏后的端点展示形态只保留 host',
    sample: 'endpoint: relay.example.com',
  },
  {
    why: '模型名是事实性描述，不是凭据',
    sample: 'declared model: gpt-family-model-a',
  },
  {
    why: '本地相对路径不含用户名',
    sample: 'bank loaded from ./data/library.v1.json',
  },
  {
    why: '统计数值与阈值',
    sample: 'lag1-autocorrelation = -0.587 (accept range -0.75..-0.35)',
  },
];
