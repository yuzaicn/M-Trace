import { attackCases } from './attacks.js';
import {
  fingerprintDistance,
  meanFingerprint,
  numericFingerprint,
} from '../fingerprint/numeric.js';

export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function centroid(samples) {
  return meanFingerprint(
    samples.map((sample) => numericFingerprint(sample.values, sample)),
  );
}

function classify(sample, training, thresholds) {
  const query = numericFingerprint(sample.values, sample);
  const candidates = [...training.entries()]
    .map(([modelId, samples]) => ({
      modelId,
      family: samples[0].modelFamily,
      distance: fingerprintDistance(query, centroid(samples)),
    }))
    .sort((a, b) => a.distance - b.distance);
  const best = candidates[0];
  const second = candidates[1];
  if (!best || best.distance > thresholds.maxDistance)
    return { decision: 'unknown', candidates };
  if (second && second.distance - best.distance < thresholds.minMargin) {
    return { decision: 'ambiguous', candidates };
  }
  return {
    decision: 'in-library',
    modelId: best.modelId,
    family: best.family,
    candidates,
  };
}

function group(samples) {
  const result = new Map();
  for (const sample of samples) {
    const list = result.get(sample.modelId) ?? [];
    list.push(sample);
    result.set(sample.modelId, list);
  }
  return result;
}

export function leaveOneEnvironmentOut(samples, thresholds) {
  const environments = [
    ...new Set(samples.map((sample) => sample.environmentId)),
  ];
  const predictions = [];
  for (const environmentId of environments) {
    const training = group(
      samples.filter((sample) => sample.environmentId !== environmentId),
    );
    for (const sample of samples.filter(
      (item) => item.environmentId === environmentId,
    )) {
      predictions.push({
        sample,
        prediction: classify(sample, training, thresholds),
      });
    }
  }
  const correct = predictions.filter(
    (item) => item.prediction.modelId === item.sample.modelId,
  ).length;
  const familyCorrect = predictions.filter(
    (item) => item.prediction.family === item.sample.modelFamily,
  ).length;
  return {
    environments,
    sampleCount: predictions.length,
    top1Accuracy: correct / predictions.length,
    familyAccuracy: familyCorrect / predictions.length,
    confusionMatrix: confusionMatrix(predictions),
    predictions,
  };
}

function confusionMatrix(predictions) {
  const matrix = {};
  for (const { sample, prediction } of predictions) {
    const actual = sample.modelId;
    const predicted = prediction.modelId ?? prediction.decision;
    matrix[actual] ??= {};
    matrix[actual][predicted] = (matrix[actual][predicted] ?? 0) + 1;
  }
  return matrix;
}

export function evaluateOutOfLibrary(inLibrary, outOfLibrary, thresholds) {
  const training = group(inLibrary);
  const predictions = outOfLibrary.map((sample) => ({
    sample,
    prediction: classify(sample, training, thresholds),
  }));
  const misattributed = predictions.filter(
    (item) => item.prediction.decision === 'in-library',
  ).length;
  const byModel = new Map();
  for (const item of predictions) {
    const cell = byModel.get(item.sample.modelId) ?? {
      total: 0,
      misattributed: 0,
      unknown: 0,
    };
    cell.total += 1;
    cell.misattributed += Number(item.prediction.decision === 'in-library');
    cell.unknown += Number(item.prediction.decision === 'unknown');
    byModel.set(item.sample.modelId, cell);
  }
  const modelRates = [...byModel.entries()].map(([modelId, value]) => ({
    modelId,
    misattributionRate: value.misattributed / value.total,
    unknownRate: value.unknown / value.total,
  }));
  const modelsWithMisattribution = modelRates.filter(
    (item) => item.misattributionRate > 0,
  ).length;
  const eligibility = modelRates.map((item) => {
    const samples = outOfLibrary.filter(
      (sample) => sample.modelId === item.modelId,
    );
    const environmentCount = new Set(
      samples.map((sample) => sample.environmentId),
    ).size;
    return {
      modelId: item.modelId,
      sampleCount: samples.length,
      environmentCount,
      eligible: samples.length >= 3 && environmentCount >= 3,
    };
  });
  const macroMisattributionRate = modelRates.length
    ? modelRates.reduce((sum, item) => sum + item.misattributionRate, 0) /
      modelRates.length
    : null;
  const macroUnknownRate = modelRates.length
    ? modelRates.reduce((sum, item) => sum + item.unknownRate, 0) /
      modelRates.length
    : null;
  return {
    sampleCount: predictions.length,
    distinctModels: byModel.size,
    misattributionRate: predictions.length
      ? misattributed / predictions.length
      : null,
    unknownRate: predictions.length
      ? predictions.filter((item) => item.prediction.decision === 'unknown')
          .length / predictions.length
      : null,
    macroMisattributionRate,
    macroUnknownRate,
    modelsWithMisattribution,
    modelRates,
    eligibility,
    pass:
      byModel.size === 20 &&
      eligibility.every((item) => item.eligible) &&
      misattributed / predictions.length <= 0.05 &&
      predictions.filter((item) => item.prediction.decision === 'unknown')
        .length /
        predictions.length >=
        0.95 &&
      macroMisattributionRate <= 0.05 &&
      macroUnknownRate >= 0.95 &&
      modelsWithMisattribution <= 1,
    predictions,
  };
}

export function evaluateAttacks(samples, thresholds, rng = Math.random) {
  const rows = [];
  for (const sample of samples) {
    const training = group(
      samples.filter((item) => item.environmentId !== sample.environmentId),
    );
    for (const attack of attackCases(sample, rng)) {
      const prediction = classify(
        { ...sample, values: attack.values },
        training,
        thresholds,
      );
      rows.push({
        attackId: attack.id,
        dimension: attack.kind,
        challengeFamily: sample.challengeFamily ?? 'unspecified',
        correct: prediction.modelId === sample.modelId,
        decision: prediction.decision,
      });
    }
    const wrapperPrediction = classify(sample, training, thresholds);
    rows.push({
      attackId: `wrapper-${sample.environmentId}`,
      dimension: 'text-wrapper',
      challengeFamily: sample.challengeFamily ?? 'unspecified',
      correct: wrapperPrediction.modelId === sample.modelId,
      decision: wrapperPrediction.decision,
    });
  }
  const aggregate = {};
  for (const row of rows) {
    const cell = (aggregate[row.attackId] ??= {
      dimension: row.dimension,
      total: 0,
      correct: 0,
      unknown: 0,
      ambiguous: 0,
    });
    cell.total += 1;
    cell.correct += Number(row.correct);
    cell.unknown += Number(row.decision === 'unknown');
    cell.ambiguous += Number(row.decision === 'ambiguous');
  }
  const baselineCell = aggregate['jitter-sigma-0'];
  const baseline = baselineCell.correct / baselineCell.total;
  const metric = (value) => ({
    accuracy: value.correct / value.total,
    accuracyDeltaFromNumericBaseline: value.correct / value.total - baseline,
    unknownRate: value.unknown / value.total,
    ambiguousRate: value.ambiguous / value.total,
  });
  const summarize = (selectedRows) => {
    const cells = {};
    for (const row of selectedRows) {
      const cell = (cells[row.attackId] ??= {
        total: 0,
        correct: 0,
        unknown: 0,
        ambiguous: 0,
      });
      cell.total += 1;
      cell.correct += Number(row.correct);
      cell.unknown += Number(row.decision === 'unknown');
      cell.ambiguous += Number(row.decision === 'ambiguous');
    }
    return Object.fromEntries(
      Object.entries(cells).map(([key, value]) => [key, metric(value)]),
    );
  };
  const perFamily = Object.fromEntries(
    [...new Set(rows.map((row) => row.challengeFamily))].map((family) => [
      family,
      summarize(rows.filter((row) => row.challengeFamily === family)),
    ]),
  );
  return {
    textWrapper: Object.fromEntries(
      Object.entries(aggregate)
        .filter(([, value]) => value.dimension === 'text-wrapper')
        .map(([key, value]) => [key, metric(value)]),
    ),
    numericRewrite: Object.fromEntries(
      Object.entries(aggregate)
        .filter(([, value]) => value.dimension === 'numeric-rewrite')
        .map(([key, value]) => [key, metric(value)]),
    ),
    perFamily,
  };
}

export function evaluateDataset(
  dataset,
  { maxDistance, minMargin, seed = 73013, rng },
) {
  if (!Number.isFinite(maxDistance) || !Number.isFinite(minMargin)) {
    throw new TypeError('calibrated maxDistance and minMargin are required');
  }
  if (!dataset || !Array.isArray(dataset.samples)) {
    throw new TypeError('dataset.samples must be an array');
  }
  const thresholds = { maxDistance, minMargin };
  const random = rng ?? seededRandom(seed);
  const inLibrary = dataset.samples.filter(
    (sample) => sample.split === 'in-library',
  );
  const outOfLibrary = dataset.samples.filter(
    (sample) => sample.split === 'out-of-library',
  );
  return {
    protocolVersion: '1.0.0',
    seed,
    thresholds,
    closedSet: leaveOneEnvironmentOut(inLibrary, thresholds),
    openSet: evaluateOutOfLibrary(inLibrary, outOfLibrary, thresholds),
    robustness: evaluateAttacks(inLibrary, thresholds, random),
  };
}
