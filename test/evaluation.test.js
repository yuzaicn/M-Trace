import assert from 'node:assert/strict';
import test from 'node:test';
import { attackCases } from '../src/evaluate/attacks.js';
import { evaluateDataset } from '../src/evaluate/evaluator.js';

function rng(seed = 7) {
  let state = seed;
  return () => (state = (state * 48271) % 2147483647) / 2147483647;
}

function values(offset, environment) {
  return Array.from(
    { length: 256 },
    (_, index) => (index * (offset + 3) + environment * 7 + offset) % 384,
  );
}

function dataset() {
  const samples = [];
  for (const [modelId, family, offset] of [
    ['a', 'family-a', 1],
    ['b', 'family-b', 8],
  ]) {
    for (let environment = 0; environment < 3; environment += 1) {
      samples.push({
        provenance: 'synthetic',
        split: 'in-library',
        modelId,
        modelFamily: family,
        challengeFamily: 'adaptive-numeric-v1',
        environmentId: `env-${environment}`,
        values: values(offset, environment),
        bucketCount: 32,
        rangeExclusive: 384,
      });
    }
  }
  for (let model = 0; model < 20; model += 1) {
    for (let environment = 0; environment < 3; environment += 1) {
      samples.push({
        provenance: 'synthetic',
        split: 'out-of-library',
        modelId: `unknown-${model}`,
        modelFamily: `other-${model % 4}`,
        challengeFamily: 'adaptive-numeric-v1',
        environmentId: `acceptance-${environment}`,
        values: Array.from(
          { length: 256 },
          (_, index) =>
            (index * (model + 13) ** 2 + model * 11 + environment * 17) % 384,
        ),
        bucketCount: 32,
        rangeExclusive: 384,
      });
    }
  }
  return { provenance: 'synthetic', samples };
}

test('attack matrix contains every required numeric attack and separate wrapper dimension', () => {
  const attacks = attackCases(
    { values: values(1, 0), rangeExclusive: 384 },
    rng(),
  );
  assert.deepEqual(
    attacks
      .filter((item) => item.id.startsWith('jitter'))
      .map((item) => item.id),
    [0, 1, 2, 3, 5, 8, 15, 25].map((sigma) => `jitter-sigma-${sigma}`),
  );
  assert.ok(attacks.some((item) => item.id === 'shuffle'));
  assert.ok(attacks.some((item) => item.id === 'rank-global'));
  assert.ok(attacks.some((item) => item.id === 'rank-block'));
  assert.ok(attacks.some((item) => item.id === 'uniform-resample'));
  assert.equal(
    attacks.filter((item) => item.kind === 'text-wrapper').length,
    0,
  );
});

test('evaluation runs leave-one-environment-out, 20-model open set, and split robustness scores', () => {
  const report = evaluateDataset(dataset(), {
    maxDistance: 0.04,
    minMargin: 0.005,
    rng: rng(),
  });
  assert.equal(report.closedSet.environments.length, 3);
  assert.equal(report.seed, 73013);
  assert.equal(report.closedSet.sampleCount, 6);
  assert.equal(report.openSet.distinctModels, 20);
  assert.equal(typeof report.openSet.misattributionRate, 'number');
  assert.equal(report.openSet.modelRates.length, 20);
  assert.ok(report.openSet.eligibility.every((item) => item.eligible));
  assert.equal(typeof report.openSet.macroMisattributionRate, 'number');
  assert.equal(Object.keys(report.robustness.textWrapper).length, 3);
  assert.equal(Object.keys(report.robustness.numericRewrite).length, 12);
  assert.ok(report.robustness.perFamily['adaptive-numeric-v1']);
  assert.equal(
    typeof report.robustness.numericRewrite['jitter-sigma-2'].unknownRate,
    'number',
  );
});
