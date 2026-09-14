# Challenge and fingerprint protocol 1.0

Its prompts, parameter choices, feature layout, field names, and fixtures were created for this repository. No external prompt, fingerprint bank, calibration value, or response dataset is included.

## Challenge families

| Family                | Signal                                                               |                        Default samples | Approximate output | Rewrite risk                                                           |
| --------------------- | -------------------------------------------------------------------- | -------------------------------------: | -----------------: | ---------------------------------------------------------------------- |
| `adaptive-numeric-v1` | Discrete sampling and number-token effects across an adaptive domain | 3 responses × 12 wrappers/environments |       384 integers | High: even small numeric rewrites may destroy the signal               |
| `format-pivot-v1`     | The same sampling task under JSON, CSV, and plain constraints        |                                 3 × 12 |       192 integers | High for numeric rewrites; parsing also depends on gateway conformance |
| `symbol-choice-v1`    | Deterministic non-numeric choice behavior over a seeded symbol set   |                                 3 × 12 |         96 symbols | Medium; intended as corroboration, not a standalone model verdict      |

`renderChallengeSuite({ seed, variants, replicates, sequenceLength, targetBucketCount })` is deterministic. The production design uses 12 environment combinations (four wrappers × three output formats) with three independent replicates per cell. The numeric domain is not fixed: the implementation selects a bucket count from `{8,16,32,64,128}` (all divisors of 256), bounded by sequence length, and derives the exclusive upper bound from desired occupancy. Every collected response records a challenge hash, suite version, seed-derived challenge ID, wrapper, and output format so environmental shifts can be measured rather than mixed into model identity.

The three wrappers (`direct`, `brief`, and `schema`) convey the same task. Environment comparisons must keep challenge seed, model settings, and output format paired. A wrapper is a nuisance dimension and never a model label. Format variants rotate evenly across seeds.

## Fingerprint extraction

Numeric responses produce four equal-width vectors: modulo-linear, modulo-quadratic, modulo-cubic, and adaptive empirical-rank buckets. Each vector is converted directly to empirical probability mass. Similarity is the unweighted mean Hellinger distance between corresponding vectors.

The feature domain is always derived from the sequence length and target bucket occupancy. Empirical probability vectors are not smoothed or L2-normalized; Hellinger is applied only as the comparison kernel. Thresholds and weights are absent from source code; production values must be frozen from the project’s own calibration set.

## Cost and validity

Calls are approximately `sequenceLength × variants × environments` output tokens per model for numeric families, plus protocol overhead. The collector defaults are for mock validation, not authorization to call a paid service. Real collection requires an approved model list and budget, and must be limited to endpoints the user is authorized to use.

The statistical observations that motivated the attack grid came from the stage-1 offline analysis corpus, not from an M-Trace online collection. They have high reported confidence for numeric jitter and closed-set behavior, but M-Trace has not yet verified cross-time stability or end-to-end online accuracy. Symbol, behavior, and protocol features remain engineering hypotheses until independently collected data validates them.
