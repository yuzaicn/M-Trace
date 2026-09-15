import assert from 'node:assert/strict';
import test from 'node:test';
import { attackCases } from '../src/evaluate/attacks.js';
import { classify, evaluateDataset } from '../src/evaluate/evaluator.js';

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
        extractorVersion: '1.0.0',
        suiteVersion: '2.0.0',
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
        extractorVersion: '1.0.0',
        suiteVersion: '2.0.0',
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
    minRelativeMargin: 0.01,
    rng: rng(),
  });
  assert.equal(report.closedSet.environments.length, 3);
  assert.equal(report.seed, 73013);
  assert.equal(report.protocolVersion, '2.0.0');
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

test('classify applies relative margin and emits a family verdict only when generations separate', () => {
  const base = {
    provenance: 'synthetic',
    bucketCount: 32,
    rangeExclusive: 384,
    environmentId: 'env-0',
    extractorVersion: '1.0.0',
    suiteVersion: '2.0.0',
  };
  const training = new Map([
    [
      'a-1',
      [
        {
          ...base,
          modelId: 'a-1',
          modelFamily: 'gpt-5.5',
          values: values(1, 0),
        },
      ],
    ],
    [
      'a-2',
      [
        {
          ...base,
          modelId: 'a-2',
          modelFamily: 'gpt-5.5',
          values: values(1, 0),
        },
      ],
    ],
    [
      'b-1',
      [
        {
          ...base,
          modelId: 'b-1',
          modelFamily: 'gpt-6',
          values: values(15, 0),
        },
      ],
    ],
  ]);
  const family = classify({ ...base, values: values(1, 0) }, training, {
    maxDistance: 1,
    minMargin: 0.2,
    minRelativeMargin: 0.5,
  });
  assert.equal(family.decision, 'in-library-family');
  assert.equal(family.family, 'gpt-5.5');

  const relativeRejected = classify(
    { ...base, values: values(1, 0) },
    training,
    { maxDistance: 1, minMargin: 0, minRelativeMargin: 2 },
  );
  assert.equal(relativeRejected.decision, 'ambiguous');

  const exact = classify({ ...base, values: values(1, 0) }, training, {
    maxDistance: 1,
    minMargin: 0,
    minRelativeMargin: 0,
  });
  assert.equal(exact.decision, 'in-library');

  const outside = classify({ ...base, values: values(30, 2) }, training, {
    maxDistance: 0,
    minMargin: 0,
    minRelativeMargin: 0,
  });
  assert.equal(outside.decision, 'unknown');
  assert.equal(outside.reason, 'out-of-library');

  const insufficient = classify(
    { ...base, values: values(1, 0), validEvidence: false },
    training,
    { maxDistance: 1, minMargin: 0, minRelativeMargin: 0 },
  );
  assert.deepEqual(insufficient, {
    decision: 'unknown',
    reason: 'insufficient-evidence',
    candidates: [],
  });
});

test('symbol collection-only samples never affect scored evaluation', () => {
  const source = dataset();
  const baseline = evaluateDataset(source, {
    maxDistance: 0.04,
    minMargin: 0.005,
    minRelativeMargin: 0.01,
    rng: rng(),
  });
  source.samples.push({
    ...source.samples[0],
    challengeFamily: 'symbol-choice-v1',
    evaluationRole: 'collection-only',
    values: Array(256).fill(383),
  });
  const withSymbol = evaluateDataset(source, {
    maxDistance: 0.04,
    minMargin: 0.005,
    minRelativeMargin: 0.01,
    rng: rng(),
  });
  assert.deepEqual(withSymbol, baseline);
});
