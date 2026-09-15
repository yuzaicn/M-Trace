/**
 * 契约测试：报告安全（I-14）。
 *
 * 本组有两半，缺一不可：
 *  - **正例**：合成凭据必须被拦。没有这一半，扫描器可能根本没在工作。
 *  - **反例**：报告里天然存在的哈希、base64 值序列、脱敏 host 必须**不**被拦。
 *    没有这一半，扫描器会被误报淹没，然后被合理地关掉。
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { readRepoFile } from '../helpers/repo.js';

import {
  LEAK_PATTERNS,
  LEAK_SAMPLES_NEGATIVE,
  LEAK_SAMPLES_POSITIVE,
} from '../../src/core/leak-patterns.js';

const hitIds = (sample: string): string[] =>
  LEAK_PATTERNS.filter(({ pattern }) => pattern.test(sample)).map(
    ({ id }) => id,
  );

test('I-14: every synthesised credential sample is caught by its intended pattern', () => {
  for (const { patternId, sample } of LEAK_SAMPLES_POSITIVE) {
    const hits = hitIds(sample);
    assert.ok(
      hits.includes(patternId),
      `sample for ${patternId} was not caught (hits: ${hits.join(',') || 'none'}) — ` +
        'the sample and the pattern have drifted apart',
    );
  }
});

test('I-14: legitimate report content is never flagged', () => {
  for (const { why, sample } of LEAK_SAMPLES_NEGATIVE) {
    const hits = hitIds(sample);
    assert.deepEqual(
      hits,
      [],
      `false positive on "${sample}" (${why}); matched ${hits.join(',')} — ` +
        'a scanner that cries wolf gets switched off, taking the real protection with it',
    );
  }
});

test('I-14: no pattern is a broad entropy heuristic', () => {
  for (const { id, pattern, rationale } of LEAK_PATTERNS) {
    assert.ok(
      rationale.length > 0,
      `${id} must explain what it protects against`,
    );
    assert.ok(
      pattern.source.length > 4,
      `${id} looks too broad; every pattern must encode a specific shape`,
    );
  }
  const ids = LEAK_PATTERNS.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, 'pattern ids must be unique');
});

test('I-14: every block-severity pattern is paired with at least one positive sample', () => {
  const sampled = new Set(LEAK_SAMPLES_POSITIVE.map((s) => s.patternId));
  for (const { id, severity } of LEAK_PATTERNS) {
    if (severity === 'block') {
      assert.ok(
        sampled.has(id),
        `${id} is blocking but has no positive sample to prove it works`,
      );
    }
  }
});

test('I-14: the report contract requires the leaked-content scan to be part of the artifact', async () => {
  const report = await readRepoFile('src/types/report.ts');
  assert.match(report, /leakHits/);
  assert.ok(
    /必须为 0|必须\*\*为 0/.test(report),
    'the self-check must treat any leak hit as a hard failure, not a warning',
  );
});

test('I-14: report content is escaped, so captured text cannot inject markup', async () => {
  const report = await readRepoFile('src/types/report.ts');
  assert.ok(
    /转义|escape/i.test(report),
    'the contract must require escaping — the report embeds text captured from a third-party endpoint',
  );
});
