function gaussian(rng) {
  const u = Math.max(Number.EPSILON, rng());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

export function jitter(values, sigma, rng = Math.random) {
  return values.map((value) => Math.round(value + gaussian(rng) * sigma));
}

export function shuffle(values, rng = Math.random) {
  const output = [...values];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const other = Math.floor(rng() * (index + 1));
    [output[index], output[other]] = [output[other], output[index]];
  }
  return output;
}

function rankNormalizeBlock(values, rangeExclusive) {
  const order = values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value);
  const output = Array(values.length);
  for (let rank = 0; rank < order.length; rank += 1) {
    output[order[rank].index] = Math.floor(
      ((rank + 0.5) / order.length) * rangeExclusive,
    );
  }
  return output;
}

export function rankNormalize(
  values,
  rangeExclusive,
  blockSize = values.length,
) {
  const output = [];
  for (let start = 0; start < values.length; start += blockSize) {
    output.push(
      ...rankNormalizeBlock(
        values.slice(start, start + blockSize),
        rangeExclusive,
      ),
    );
  }
  return output;
}

export function uniformResample(values, rangeExclusive, rng = Math.random) {
  return values.map(() => Math.floor(rng() * rangeExclusive));
}

export function attackCases(sample, rng = Math.random) {
  const { values, rangeExclusive } = sample;
  const cases = [
    ...[0, 1, 2, 3, 5, 8, 15, 25].map((sigma) => ({
      id: `jitter-sigma-${sigma}`,
      kind: 'numeric-rewrite',
      values: jitter(values, sigma, rng),
    })),
    { id: 'shuffle', kind: 'numeric-rewrite', values: shuffle(values, rng) },
    {
      id: 'rank-global',
      kind: 'numeric-rewrite',
      values: rankNormalize(values, rangeExclusive),
    },
    {
      id: 'rank-block',
      kind: 'numeric-rewrite',
      values: rankNormalize(
        values,
        rangeExclusive,
        Math.max(8, Math.floor(values.length / 8)),
      ),
    },
    {
      id: 'uniform-resample',
      kind: 'numeric-rewrite',
      values: uniformResample(values, rangeExclusive, rng),
    },
  ];
  return cases;
}
