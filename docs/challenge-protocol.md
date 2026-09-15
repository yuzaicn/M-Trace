# Challenge and fingerprint protocol 2.0

Its prompts, parameter choices, feature layout, field names, and fixtures were created for this repository. No external prompt, fingerprint bank, calibration value, or response dataset is included.

Suite `2.0.0` measures the provider-default sampling snapshot. It never sends `temperature` or `top_p` during bank or acceptance collection. This is incompatible with suite 1.x fixed-temperature fingerprints: a loader must reject cross-suite comparison instead of silently treating provider configuration drift as a model difference. `challenge-parameter` remains available only for local mock and regression fixtures.

## Challenge families

| Family                | Evaluation role   | Signal                                                               |                        Default samples | Approximate output | Rewrite risk                                                           |
| --------------------- | ----------------- | -------------------------------------------------------------------- | -------------------------------------: | -----------------: | ---------------------------------------------------------------------- |
| `adaptive-numeric-v1` | `scored`          | Discrete sampling and number-token effects across an adaptive domain | 3 responses × 12 wrappers/environments |       384 integers | High: even small numeric rewrites may destroy the signal               |
| `format-pivot-v1`     | `scored`          | The same sampling task under JSON, CSV, and plain constraints        |                                 3 × 12 |       192 integers | High for numeric rewrites; parsing also depends on gateway conformance |
| `symbol-choice-v1`    | `collection-only` | Seeded non-numeric choice behavior                                   |                                 3 × 12 |         96 symbols | Medium; collected for future calibration and excluded from 0.0.1 gates |

`renderChallengeSuite({ seed, variants, replicates, sequenceLength, targetBucketCount })` is deterministic. The production design uses 12 environment combinations (four wrappers × three output formats) with three independent replicates per cell. The numeric domain is not fixed: the implementation selects a bucket count from `{8,16,32,64,128}` (all divisors of 256), bounded by sequence length, and derives the exclusive upper bound from desired occupancy. Every challenge records `suiteVersion`, `samplingSource`, `evaluationRole`, a challenge hash, seed-derived challenge ID, wrapper, and output format.

The four wrappers (`direct`, `brief`, `schema`, and `delimited`) convey the same task. Environment comparisons must keep challenge seed, provider-default request shape, and output format paired. A wrapper is a nuisance dimension and never a model label. Format variants rotate evenly across seeds.

## Sampling and provenance

Production collection uses `samplingSource: provider-default`. OpenAI reasoning calls use either Chat Completions (`reasoning_effort` and `max_completion_tokens`) or, where provider availability requires it, Responses (`reasoning: { effort }` and `max_output_tokens`). Both shapes omit `temperature`, `top_p`, and `max_tokens`. Raw JSONL, normalized JSONL, and the resulting bank entry preserve `samplingSource`, `effort`, `requestShape`, `generationOptions`, `transport`, provider usage, and `systemFingerprint`. The request shape and effort must be homogeneous within one bank entry.

Provider-default settings can drift outside our control. The scheduled re-probe detects that failure condition; drift creates a new `bankVersion` and never overwrites or reinterprets an earlier fingerprint.

## Fingerprint extraction

Numeric responses produce four equal-width vectors: modulo-linear, modulo-quadratic, modulo-cubic, and adaptive empirical-rank buckets. Each vector is converted directly to empirical probability mass. Similarity is the unweighted mean Hellinger distance between corresponding vectors.

The feature domain is always derived from the sequence length and target bucket occupancy. Empirical probability vectors are not smoothed or L2-normalized; Hellinger is applied only as the comparison kernel. Thresholds and weights are absent from source code; production values must be frozen from the project’s own calibration set.

The symbol family is intentionally collected but not scored in 0.0.1. Evaluator tests enforce that it cannot change distances, gates, confidence, or report conclusions. Enabling it later requires a compatible extractor/scoring version decision.

## Cost and validity

The formal grid is 108 calls per identity per round. The collector defaults and pilot are test mechanics, not authorization to call a paid service. Real collection requires approved budget, an official endpoint, and a six-model pilot that confirms request compatibility, parseability, forced-reasoning behavior, and usage read-back.

The statistical observations motivating the attack grid came from the stage-1 offline analysis corpus, not from an M-Trace online collection. They have high reported confidence for numeric jitter and closed-set behavior, but M-Trace has not yet verified cross-time stability, provider-default sampling stability, end-to-end online accuracy, or symbol-family utility.
