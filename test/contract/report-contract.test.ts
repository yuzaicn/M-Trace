/**
 * 契约测试：报告 / 判定输出数据模型（I-17、I-18、I-19）。
 *
 * 这一组钉住 v1.1 报告契约（GUCH-361 §10 收口）与随之冻结的两条设计侧口径
 * （GUCH-363 产品设计师提、产品经理确认）：
 *  - 失效条件必填非空，恒定项写死，`margin-inseparable` 独立于 `samples-low`；
 *  - 证据信号是引擎汇总的独立字段，且**不合成总分**；
 *  - `selfReportAgreement` 家族档口径 = 属于观测世代，报告层不做字符串比对，映射不到→null；
 *  - 报告数据模型不携带退出码（退出码是 CLI 契约，不进报告）。
 *
 * 全部是**结构 / 源文本断言**，实现开工前即可跑，实现期保护契约不被悄悄改松。
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { ALWAYS_PRESENT_INVALIDATIONS } from '../../src/types/index.js';
import { readRepoFile } from '../helpers/repo.js';

const ATTRIBUTE_SRC = 'src/types/attribute.ts';
const REPORT_SRC = 'src/types/report.ts';

test('I-17: invalidations is a required, non-empty field — not an optional array', async () => {
  const src = await readRepoFile(ATTRIBUTE_SRC);
  assert.match(
    src,
    /invalidations:\s*InvalidationFlag\[\]/,
    'the verdict must carry an invalidations array so every conclusion states when it stops holding',
  );
  assert.ok(
    /必填且非空/.test(src),
    'the contract must state invalidations is required and non-empty, so an empty array is a contract violation, not a fallback',
  );
});

test('I-17: the always-present invalidations are frozen as a constant', () => {
  const set = new Set(ALWAYS_PRESENT_INVALIDATIONS);
  assert.ok(
    set.has('snapshot-in-time'),
    'every conclusion only represents this probe window — snapshot-in-time must always be present',
  );
  assert.ok(
    set.has('library-evolves'),
    'a later bank can overturn this conclusion — library-evolves must always be present ' +
      '(design §3.2 requires the unknown tier to carry "the bank may change")',
  );
});

test('I-17: margin-inseparable is a distinct code from samples-low', async () => {
  const src = await readRepoFile(ATTRIBUTE_SRC);
  for (const code of ['samples-low', 'margin-inseparable']) {
    assert.ok(
      src.includes(`'${code}'`),
      `${code} must be part of the frozen InvalidationCode set`,
    );
  }
  assert.ok(
    /最近两名 margin 过小|margin 过小/.test(src),
    'margin-inseparable must be documented as "candidates within threshold but margin too small" — ' +
      'it is a different thing from "too few valid samples" (samples-low)',
  );
});

test('I-18: evidence signals are a dedicated field summarised by the engine', async () => {
  const src = await readRepoFile(ATTRIBUTE_SRC);
  assert.match(
    src,
    /signals:\s*import\('\.\/report\.js'\)\.EvidenceSignal\[\]/,
    'signals must live on the verdict (engine-summarised), not be re-derived by the report layer ' +
      'which has none of the three source modules as input',
  );
});

test('I-18: the six evidence-signal keys are frozen, and no aggregate score is offered', async () => {
  const src = await readRepoFile(REPORT_SRC);
  for (const key of [
    'chi-square-over-df',
    'lag1-autocorrelation',
    'valid-sample-count',
    'streaming-ratio',
    'truncation-rate',
    'rewrite-suspect-ratio',
  ]) {
    assert.ok(
      src.includes(`'${key}'`),
      `evidence signal key ${key} must be part of the frozen set`,
    );
  }
  const signalBlock = src.slice(
    src.indexOf('interface EvidenceSignal {'),
    src.indexOf('EvidenceSignalKey ='),
  );
  assert.ok(
    signalBlock.length > 0 && !/\boverall\b/.test(signalBlock),
    'the EvidenceSignal shape must not offer an aggregate/overall score — ' +
      'a synthesised total is exactly the "looks like proof" reading the contract forbids',
  );
});

test('I-19: self-report agreement is a tri-state and the family-tier rule is frozen', async () => {
  const src = await readRepoFile(ATTRIBUTE_SRC);
  assert.match(
    src,
    /selfReportAgreement:\s*boolean\s*\|\s*null/,
    'self-report agreement must be boolean|null — null is a first-class "cannot compare", not a false',
  );
  // 家族档口径：属于观测世代，报告层不做字符串比对，映射不到→null（self.unknown）。
  assert.ok(
    /属于/.test(src) && /世代/.test(src),
    'family tier must be judged by generation membership',
  );
  assert.ok(
    /不做字符串比对|不做字符串比较/.test(src),
    'the report layer must not string-compare model names; the mapping happens in the engine',
  );
  assert.ok(
    /self\.unknown/.test(src),
    'an unmappable self-report must land on the self.unknown badge, not be guessed either way',
  );
});

test('I-19: the report data model carries no exit code', async () => {
  const src = await readRepoFile(REPORT_SRC);
  assert.ok(
    !/exitCode|ExitCode|\bEXIT\./.test(src),
    'exit codes are a CLI contract (§5); rendering them in the report would leak a CLI concern ' +
      'into a shareable artifact and invite mis-reading',
  );
});
