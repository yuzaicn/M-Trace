/**
 * 契约测试：退出码矩阵（I-01、I-02）。
 *
 * 这一组断言对应产品 P0-5「退出码可被 CI 使用」。
 * 它们全部是**结构断言**，不依赖任何实现 —— 因此在实现开工前就能跑，
 * 且会在实现期保护契约不被悄悄改松。
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { ERROR_EXIT_MAP, EXIT } from '../../src/types/cli.js';
import { INTERFACE_VERSION, SCHEMA_VERSION } from '../../src/types/index.js';
import { readRepoFile } from '../helpers/repo.js';

const ERROR_CODES = [
  'CONFIG_NOT_FOUND',
  'CONFIG_MALFORMED',
  'CONFIG_INCOMPLETE',
  'CONFIG_AMBIGUOUS',
  'CONFIG_READ_FORBIDDEN',
  'ENDPOINT_UNREACHABLE',
  'AUTH_REJECTED',
  'RATE_LIMITED',
  'UPSTREAM_5XX',
  'REQUEST_TIMEOUT',
  'ABORTED',
  'RESPONSE_EMPTY',
  'RESPONSE_NON_STREAM',
  'RESPONSE_TRUNCATED',
  'RESPONSE_SCHEMA_MISMATCH',
  'CONTENT_REWRITTEN',
  'EVIDENCE_INSUFFICIENT',
  'EVIDENCE_MALFORMED',
  'LIBRARY_EMPTY',
  'LIBRARY_MALFORMED',
  'LIBRARY_VERSION_UNSUPPORTED',
  'RENDER_FAILED',
  'IO_FAILED',
  'OUTPUT_TOO_LARGE',
  'USAGE_ERROR',
  'CANCELLED',
] as const;

test('I-01: every ErrorCode has exactly one exit code (the map is total)', () => {
  for (const code of ERROR_CODES) {
    assert.ok(code in ERROR_EXIT_MAP, `missing exit mapping for ${code}`);
    assert.equal(typeof ERROR_EXIT_MAP[code], 'number');
  }
  const mapped = Object.keys(ERROR_EXIT_MAP);
  assert.equal(
    mapped.length,
    ERROR_CODES.length,
    `ERROR_EXIT_MAP has ${mapped.length} keys but there are ${ERROR_CODES.length} error codes — ` +
      'a stale entry means the contract drifted',
  );
});

test('I-02: verdict-class exit codes are distinct from failure-class codes', () => {
  // 判定类：工具跑通了，结论是 X。CI 据此区分"渠道有问题"与"我自己网络有问题"。
  const verdictCodes = [
    EXIT.SUCCESS,
    EXIT.UNKNOWN,
    EXIT.AMBIGUOUS,
    EXIT.MISMATCH,
  ];
  assert.deepEqual(verdictCodes, [0, 10, 11, 12]);

  // 故障类。
  assert.equal(EXIT.USAGE, 2);
  assert.equal(EXIT.TRANSPORT, 3);
  assert.equal(EXIT.EVIDENCE, 4);
  assert.equal(EXIT.LOCAL, 5);
  assert.equal(EXIT.INTERRUPTED, 130);

  // 两类不得重叠 —— 这正是规划文档与 PRD 两套退出码冲突的裁决点。
  const verdictSet = new Set<number>(verdictCodes);
  for (const code of [
    EXIT.USAGE,
    EXIT.TRANSPORT,
    EXIT.EVIDENCE,
    EXIT.LOCAL,
    EXIT.INTERRUPTED,
  ]) {
    assert.ok(!verdictSet.has(code), `code ${code} is claimed by both classes`);
  }
});

test('I-02: unknown and ambiguous are separate codes — they imply different next actions', () => {
  assert.notEqual(
    EXIT.UNKNOWN,
    EXIT.AMBIGUOUS,
    'unknown means "not in our bank" (nothing more to do); ' +
      'ambiguous means "run more variants" — collapsing them loses the actionable signal',
  );
});

test('I-02: no failure-class code is 0 — a silent success is the worst outcome', () => {
  for (const [code, exit] of Object.entries(ERROR_EXIT_MAP)) {
    assert.notEqual(
      exit,
      EXIT.SUCCESS,
      `${code} must not map to a success exit code`,
    );
  }
});

test('I-02: aborted transport maps to the interrupted code, not to a transport failure', () => {
  assert.equal(ERROR_EXIT_MAP.ABORTED, EXIT.INTERRUPTED);
  assert.equal(ERROR_EXIT_MAP.CANCELLED, EXIT.INTERRUPTED);
});

test('contract versions are declared and consistent with the intent manifest', async () => {
  assert.equal(INTERFACE_VERSION, '1.1');
  assert.equal(SCHEMA_VERSION, 1);

  const manifest = JSON.parse(
    await readRepoFile('test/fixtures/contract-intents.json'),
  );
  assert.equal(manifest.interfaceVersion, INTERFACE_VERSION);
  assert.equal(manifest.schemaVersion, SCHEMA_VERSION);
});
