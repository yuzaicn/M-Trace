function assertValues(values) {
  if (
    !Array.isArray(values) ||
    values.length === 0 ||
    !values.every(Number.isFinite)
  ) {
    throw new TypeError('values must be a non-empty finite-number array');
  }
}

function normalizeCounts(counts) {
  const total = counts.reduce((sum, value) => sum + value, 0);
  return counts.map((value) => value / total);
}

function polynomialBuckets(values, bucketCount, degree, rangeExclusive) {
  const counts = Array(bucketCount).fill(0);
  for (const raw of values) {
    const scaled = Math.max(0, Math.min(rangeExclusive - 1, Math.floor(raw)));
    let mapped = scaled % bucketCount;
    for (let power = 1; power < degree; power += 1)
      mapped = (mapped * scaled) % bucketCount;
    counts[mapped] += 1;
  }
  return normalizeCounts(counts);
}

export function numericFingerprint(values, { bucketCount, rangeExclusive }) {
  assertValues(values);
  if (!Number.isInteger(bucketCount) || 256 % bucketCount !== 0) {
    throw new RangeError('bucketCount must be a divisor of 256');
  }
  const sorted = [...values].sort((a, b) => a - b);
  const adaptiveCounts = Array(bucketCount).fill(0);
  for (const value of values) {
    let rank = 0;
    while (rank < sorted.length && sorted[rank] <= value) rank += 1;
    adaptiveCounts[
      Math.min(
        bucketCount - 1,
        Math.floor((rank / sorted.length) * bucketCount),
      )
    ] += 1;
  }
  return {
    method: 'polynomial-adaptive-v1',
    bucketCount,
    rangeExclusive,
    components: {
      linear: polynomialBuckets(values, bucketCount, 1, rangeExclusive),
      quadratic: polynomialBuckets(values, bucketCount, 2, rangeExclusive),
      cubic: polynomialBuckets(values, bucketCount, 3, rangeExclusive),
      adaptiveRank: normalizeCounts(adaptiveCounts),
    },
  };
}

export function categoricalFingerprint(tokens, { bucketCount = 32 }) {
  if (
    !Array.isArray(tokens) ||
    tokens.length === 0 ||
    !tokens.every((token) => typeof token === 'string')
  ) {
    throw new TypeError('tokens must be a non-empty string array');
  }
  const counts = Array(bucketCount).fill(0);
  for (const token of tokens) {
    let hash = 2166136261;
    for (const codePoint of token) {
      hash ^= codePoint.codePointAt(0);
      hash = Math.imul(hash, 16777619);
    }
    counts[(hash >>> 0) % bucketCount] += 1;
  }
  return {
    method: 'categorical-hash-v1',
    bucketCount,
    components: { categorical: normalizeCounts(counts) },
  };
}

export function hellinger(left, right) {
  if (left.length !== right.length || left.length === 0)
    throw new RangeError('shape mismatch');
  let sum = 0;
  for (let index = 0; index < left.length; index += 1) {
    sum += (Math.sqrt(left[index]) - Math.sqrt(right[index])) ** 2;
  }
  return Math.sqrt(sum) / Math.sqrt(2);
}

export function fingerprintDistance(left, right) {
  const names = ['linear', 'quadratic', 'cubic', 'adaptiveRank'];
  return (
    names.reduce(
      (sum, name) =>
        sum + hellinger(left.components[name], right.components[name]),
      0,
    ) / names.length
  );
}

export function meanFingerprint(fingerprints) {
  if (fingerprints.length === 0)
    throw new RangeError('at least one fingerprint is required');
  const first = fingerprints[0];
  const components = {};
  for (const name of Object.keys(first.components)) {
    components[name] = first.components[name].map(
      (_, index) =>
        fingerprints.reduce(
          (sum, item) => sum + item.components[name][index],
          0,
        ) / fingerprints.length,
    );
  }
  return { ...first, components };
}
