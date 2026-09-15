import assert from 'node:assert/strict';
import test from 'node:test';
import {
  challengeHash,
  renderChallengeSuite,
  renderIntegerPilot,
  selectBucketCount,
} from '../src/probe/challenge-suite.js';

test('challenge suite is deterministic, adaptive, and contains three original families', () => {
  const first = renderChallengeSuite({
    seed: 41,
    variants: 3,
    replicates: 1,
    sequenceLength: 384,
  });
  const second = renderChallengeSuite({
    seed: 41,
    variants: 3,
    replicates: 1,
    sequenceLength: 384,
  });
  assert.deepEqual(first, second);
  assert.deepEqual(
    new Set(first.challenges.map((item) => item.family)),
    new Set(['adaptive-numeric-v1', 'format-pivot-v1', 'symbol-choice-v1']),
  );
  assert.equal(first.challenges.length, 9);
  const larger = renderChallengeSuite({
    seed: 41,
    variants: 3,
    replicates: 1,
    sequenceLength: 768,
  });
  assert.notEqual(
    first.challenges[0].params.rangeExclusive,
    larger.challenges[0].params.rangeExclusive,
  );
  assert.match(challengeHash(first.challenges[0]), /^[0-9a-f]{64}$/);
});

test('integer pilot renders exactly one minimal parseable challenge', () => {
  const pilot = renderIntegerPilot({ seed: 41, sequenceLength: 16 });
  assert.equal(pilot.suiteVersion, 'pilot-1.0.0');
  assert.equal(pilot.challenges.length, 1);
  assert.equal(pilot.challenges[0].family, 'integer-pilot-v1');
  assert.equal(pilot.challenges[0].params.sequenceLength, 16);
  assert.match(pilot.challenges[0].prompt, /exactly 16/);
});

test('bucket count adapts while remaining a divisor of 256', () => {
  const small = selectBucketCount(64, 64);
  const large = selectBucketCount(1024, 64);
  assert.equal(256 % small, 0);
  assert.equal(256 % large, 0);
  assert.ok(small < large);
});

test('default collection grid has 12 environments and 3 replicates per family cell', () => {
  const suite = renderChallengeSuite();
  assert.equal(suite.challenges.length, 108);
  const environments = new Set(
    suite.challenges.map((item) => item.environmentId),
  );
  assert.equal(environments.size, 12);
  for (const family of [
    'adaptive-numeric-v1',
    'format-pivot-v1',
    'symbol-choice-v1',
  ]) {
    for (const environmentId of environments) {
      assert.equal(
        suite.challenges.filter(
          (item) =>
            item.family === family && item.environmentId === environmentId,
        ).length,
        3,
      );
    }
  }
});
