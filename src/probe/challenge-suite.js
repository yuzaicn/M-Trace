import { createHash } from 'node:crypto';

const BUCKET_DIVISORS = [8, 16, 32, 64, 128];
const FORMATS = ['json-array', 'csv-line', 'plain-text'];
const WRAPPERS = ['direct', 'brief', 'schema', 'delimited'];

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function selectBucketCount(sequenceLength, targetBucketCount = 32) {
  if (!Number.isInteger(sequenceLength) || sequenceLength < 64) {
    throw new RangeError('sequenceLength must be an integer >= 64');
  }
  const sampleBound = Math.max(
    8,
    2 ** Math.floor(Math.log2(sequenceLength / 8)),
  );
  return BUCKET_DIVISORS.filter((value) => value <= sampleBound).reduce(
    (best, value) =>
      Math.abs(value - targetBucketCount) < Math.abs(best - targetBucketCount)
        ? value
        : best,
    BUCKET_DIVISORS[0],
  );
}

export function numericDomain(sequenceLength, bucketCount) {
  const occupancy = Math.max(5, Math.ceil(sequenceLength / bucketCount));
  return bucketCount * occupancy * 3;
}

function wrapPrompt(body, wrapper) {
  if (wrapper === 'brief')
    return `Complete this compact reproducibility check. ${body}`;
  if (wrapper === 'schema')
    return `Task specification:\n- follow the requested output form\n- include no commentary\n${body}`;
  if (wrapper === 'delimited') return `<task>\n${body}\n</task>`;
  return body;
}

function numericPrompt({ sequenceLength, rangeExclusive, format }) {
  const shape =
    format === 'json-array'
      ? 'Return one valid JSON array.'
      : format === 'csv-line'
        ? 'Return one comma-separated line.'
        : 'Return one space-separated line.';
  return `Generate exactly ${sequenceLength} independently chosen whole numbers from 0 through ${rangeExclusive - 1}. ${shape} Do not explain the answer.`;
}

function choicePrompt(seed, variant, format) {
  const rng = seeded(seed ^ (variant * 0x9e3779b9));
  const symbols = Array.from({ length: 18 }, (_, index) =>
    String.fromCodePoint(0x391 + ((index + Math.floor(rng() * 8)) % 24)),
  );
  const shape =
    format === 'json-array'
      ? 'Return one JSON array of strings.'
      : format === 'csv-line'
        ? 'Return one comma-separated line.'
        : 'Return one space-separated line.';
  return `For each position, choose exactly one symbol from this set: ${symbols.join(' ')}. Produce exactly 96 symbols. ${shape} Reuse is allowed. Do not add prose.`;
}

export function renderChallengeSuite({
  seed = 73013,
  variants = 12,
  replicates = 3,
  sequenceLength = 384,
  targetBucketCount = 32,
} = {}) {
  const bucketCount = selectBucketCount(sequenceLength, targetBucketCount);
  const rangeExclusive = numericDomain(sequenceLength, bucketCount);
  const challenges = [];
  for (let variant = 0; variant < variants; variant += 1) {
    const format = FORMATS[variant % FORMATS.length];
    const wrapper =
      WRAPPERS[Math.floor(variant / FORMATS.length) % WRAPPERS.length];
    const environmentId = `${wrapper}/${format}`;
    for (let replicate = 0; replicate < replicates; replicate += 1) {
      const challengeSeed = seed + variant * replicates + replicate;
      const base = {
        variant,
        replicate,
        seed: challengeSeed,
        wrapper,
        environmentId,
      };
      challenges.push({
        ...base,
        id: `adaptive-numeric-v1:${seed}:${variant}:${replicate}`,
        family: 'adaptive-numeric-v1',
        format,
        prompt: wrapPrompt(
          numericPrompt({ sequenceLength, rangeExclusive, format }),
          wrapper,
        ),
        params: { sequenceLength, bucketCount, rangeExclusive, temperature: 1 },
      });
      challenges.push({
        ...base,
        id: `format-pivot-v1:${seed}:${variant}:${replicate}`,
        family: 'format-pivot-v1',
        format,
        prompt: wrapPrompt(
          numericPrompt({ sequenceLength: 192, rangeExclusive, format }),
          wrapper,
        ),
        params: {
          sequenceLength: 192,
          bucketCount,
          rangeExclusive,
          temperature: 1,
        },
      });
      challenges.push({
        ...base,
        id: `symbol-choice-v1:${seed}:${variant}:${replicate}`,
        family: 'symbol-choice-v1',
        format,
        prompt: wrapPrompt(
          choicePrompt(challengeSeed, variant, format),
          wrapper,
        ),
        params: { sequenceLength: 96, bucketCount: 32, temperature: 0.7 },
      });
    }
  }
  return { suiteVersion: '1.0.0', seed, challenges };
}

export function challengeHash(challenge) {
  return createHash('sha256').update(JSON.stringify(challenge)).digest('hex');
}
