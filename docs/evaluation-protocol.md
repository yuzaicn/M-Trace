# Evaluation protocol 1.0

## Splits and metrics

The in-library set uses leave-one-environment-out cross-validation: hold out one of 12 environments, fit one centroid per model on the other 11, score every held-out response, then rotate. Report model top-1 accuracy, family accuracy, abstention rate, and a full actual-by-predicted confusion matrix. No response from the held-out environment may contribute to its centroid.

The open-set acceptance set contains exactly 20 model identities that are absent from every reference-bank release used in the run. Each model contributes at least three independent responses in at least three representative environments. Report both micro rates (responses) and macro rates (models); release requires:

- misattribution rate ≤ 5%;
- `unknown` rate ≥ 95%;
- at most one of the 20 identities has any accepted in-library attribution;
- every accepted false attribution is listed with target model, distance, environment, and challenge hash.

The 20 slots are frozen before calibration to prevent threshold shopping:

| Stratum                                           | Slots | Selection rule                                                                           |
| ------------------------------------------------- | ----: | ---------------------------------------------------------------------------------------- |
| Unrepresented hosted families                     |     6 | Three providers, current and prior generation where available                            |
| Represented family, unrepresented generation/size |     6 | Near-neighbor negatives hardest for the open-set gate                                    |
| Open-weight local models                          |     6 | At least three architectures and two size bands, deterministic serving settings recorded |
| Routing/mixture endpoints                         |     2 | Endpoint may vary backing model; treat identity as unknown by construction               |

Model names are filled only after budget and coverage approval. Selection must exclude aliases or snapshots of an in-bank model, disclose quantization/serving settings, balance providers, and stay frozen in `acceptance-manifest.json` with a hash. Calibration uses a separate development-negative set; none of these 20 may tune `maxDistance` or `minMargin`.

## Robustness axes

Numeric rewriting and text wrapping are reported separately and must never be averaged into one robustness score.

- Numeric attacks: Gaussian integer jitter at σ ∈ `{0,1,2,3,5,8,15,25}`, order shuffling, global rank normalization, block rank normalization, and uniform resampling.
- Text wrapping: direct, brief, and schema wrappers with identical task semantics and paired seeds.

For every attack report absolute accuracy, delta from σ=0, unknown/ambiguous rates, and per-family results. The initial target is model top-1 ≥90%, family top-1 ≥95%, open-set misattribution ≤5%, and σ=1 degradation ≤20% relative. These are acceptance targets, not achieved results.

The offline analysis motivating this protocol reported model accuracy falling sharply under small numeric jitter and uniform resampling, while seven wrappers produced no classification flips. Those results were not collected against live M-Trace endpoints and do not validate this implementation. Cross-time stability, symbol-family utility, and protocol-family utility remain unverified.

## Dataset contract

The evaluator accepts a JSON object with `samples`. Each sample has `split`, `modelId`, `modelFamily`, `challengeFamily`, `environmentId`, `values`, `bucketCount`, and `rangeExclusive`. Synthetic/mock data must declare `provenance: "synthetic"` and cannot be promoted into a production bank or quoted as model accuracy.

The CLI requires explicit `--max-distance` and `--min-margin`; it has no default acceptance threshold. Attack transforms use a recorded deterministic seed (`--seed`, default `73013`). Production threshold values must come from a separately frozen calibration run.
