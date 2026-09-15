/**
 * 契约测试：归因结论的形态（I-09）。
 *
 * 核心命题：**「无法判定」是一等公民**。
 * 它不是错误码、不是异常、不是"最相近模型 + 相似度"。
 * 这一条直接对应项目硬约束，因此用断言钉住。
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { readRepoFile } from '../helpers/repo.js';

const ATTRIBUTE_SRC = 'src/types/attribute.ts';
const ERRORS_SRC = 'src/types/errors.ts';

test('I-09: the decision union contains unknown and ambiguous as peers of the positive verdicts', async () => {
  const src = await readRepoFile(ATTRIBUTE_SRC);
  assert.match(src, /'in-library'/);
  assert.match(src, /'in-library-family'/);
  assert.match(src, /'ambiguous'/);
  assert.match(src, /'unknown'/);
  assert.match(
    src,
    /export type AttributionDecision =/,
    'the four-value decision must be a named union, so it can be switched over exhaustively',
  );
});

test('I-09: unknown is NOT an error code — the two channels must stay separate', async () => {
  const errorSrc = await readRepoFile(ERRORS_SRC);
  assert.ok(
    !/\|\s*'UNKNOWN'/.test(errorSrc) && !/'OUT_OF_LIBRARY'/.test(errorSrc),
    'a "no verdict" outcome must never be modelled as an error — ' +
      'errors mean "we could not run", not "we ran and the answer is unknown"',
  );
});

test('I-09: the verdict carries top-N candidates even when abstaining', async () => {
  const src = await readRepoFile(ATTRIBUTE_SRC);
  assert.match(
    src,
    /candidates:\s*Candidate\[\]/,
    'candidates must be an array (top-N), never a single argmax field',
  );
  assert.ok(
    /永远给出/.test(src),
    'the contract must state that candidates are always returned, including for unknown — ' +
      'the user is entitled to see what the closest match was and how close',
  );
});

test('I-09: abstention reasons are enumerated, not free-form strings', async () => {
  const src = await readRepoFile(ATTRIBUTE_SRC);
  assert.match(src, /export type AbstentionReason =/);
  for (const reason of [
    'insufficient-evidence',
    'implausible-as-sampling',
    'out-of-library',
    'candidates-not-separable',
    'library-unusable',
    'extractor-mismatch',
    'content-rewritten',
    'partial-run',
  ]) {
    assert.ok(
      src.includes(`'${reason}'`),
      `abstention reason ${reason} must be part of the frozen set`,
    );
  }
});

test('I-09: every verdict must be able to explain itself', async () => {
  const src = await readRepoFile(ATTRIBUTE_SRC);
  assert.match(
    src,
    /reasons:\s*string\[\]/,
    'a verdict without machine-readable reasons cannot be rendered honestly in the report',
  );
  assert.ok(
    /不得\*\*为空数组|必须能解释自己/.test(src),
    'the contract must forbid an empty reasons array',
  );
});

test('I-09: confidence is banded, so a bare percentage cannot be read as proof', async () => {
  const src = await readRepoFile(ATTRIBUTE_SRC);
  assert.match(src, /band:\s*'high'\s*\|\s*'medium'\s*\|\s*'low'/);
  assert.ok(
    /不是.*概率|不是\*\*"该模型为真"的概率/.test(src),
    'the contract must state what the confidence score is NOT, to prevent it being read as a probability',
  );
});

test('I-09: the verdict is offline-reproducible — no clock, no machine state', async () => {
  const src = await readRepoFile(ATTRIBUTE_SRC);
  assert.ok(
    /不含\*\*时间戳/.test(src),
    'the verdict must not embed a timestamp, otherwise the same evidence yields different bytes ' +
      'and third-party re-verification cannot be a byte comparison',
  );
  assert.match(src, /libraryRef:\s*\{/);
  assert.match(src, /fingerprintRef:\s*\{/);
});

test('I-09: the decision layer is specified as two stages in the source of truth', async () => {
  const src = await readRepoFile(ATTRIBUTE_SRC);
  assert.match(src, /第一段/);
  assert.match(src, /第二段/);
  assert.match(
    src,
    /stage:\s*DecisionStage/,
    'the verdict must record which stage terminated, so a report can say *why* it abstained',
  );
});
