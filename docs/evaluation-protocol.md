# Evaluation protocol 2.0

## Splits and metrics

The in-library set uses leave-one-environment-out cross-validation: hold out one of 12 environments, fit one centroid per model on the other 11, score every held-out response, then rotate. Report model top-1 accuracy, generation-level accuracy, abstention rate, and a full actual-by-predicted confusion matrix. No response from the held-out environment may contribute to its centroid. For the OpenAI-only 0.0.1 bank, `modelFamily` is exactly `gpt-5.5`, `gpt-5.6`, or `gpt-6`; `vendor` is separate metadata and never a verdict tier.

The open-set acceptance set contains exactly 20 model identities that are absent from every reference-bank release used in the run. Each model contributes at least three independent responses in at least three representative environments. Report both micro rates (responses) and macro rates (models); release requires:

- misattribution rate ≤ 5%;
- `unknown` rate ≥ 95%;
- at most one of the 20 identities has any accepted in-library attribution;
- every accepted false attribution is listed with target model, distance, environment, and challenge hash.

The 20 slots are frozen before calibration to prevent threshold shopping:

| Stratum                                           | Slots | Selection rule                                                                           |
| ------------------------------------------------- | ----: | ---------------------------------------------------------------------------------------- |
| Unrepresented hosted families                     |     6 | Qwen/Gemini first-party models absent from the OpenAI-only bank                          |
| Represented family, unrepresented generation/size |     6 | Near-neighbor negatives hardest for the open-set gate                                    |
| Open-weight local models                          |     6 | At least three architectures and two size bands, deterministic serving settings recorded |
| Routing/mixture endpoints                         |     2 | Endpoint may vary backing model; treat identity as unknown by construction               |

The frozen identities are recorded in `acceptance-manifest.json`. Selection excludes aliases or snapshots of an in-bank model, discloses quantization/serving settings, and remains frozen by hash before collection. Calibration uses a separate development-negative set; none of these 20 may tune `maxDistance`, `minMargin`, or `minRelativeMargin`.

The first planned 0.0.2 re-freeze item is to restore three-provider diversity in the hosted stratum by replacing two slots with older Anthropic snapshots. It is intentionally excluded from 0.0.1 until the frozen request-shape contract supports Anthropic's required `max_tokens`, with matching collector tests, pilot coverage, and first-party credential evidence.

## Candidate pools and ordered decisions

The model-level candidate pool includes all entries matching `extractorVersion` and `suiteVersion` whose valid sample count meets the floor. Evidence below the floor short-circuits to `unknown / insufficient-evidence`. If the closest distance exceeds `maxDistance`, return `unknown / out-of-library`. Otherwise compute `margin = d(2) - d(1)` and `relMargin = d(2) === 0 ? 0 : margin / d(2)`; fewer than two candidates cannot pass separation.

If either margin gate fails, collapse the full model pool by `modelFamily`, using the minimum member distance as the family distance, and apply the same absolute and separation gates. A separated generation yields `in-library-family`; otherwise return `ambiguous / candidates-not-separable`. Only a model that passes all three gates yields `in-library`.

## Robustness axes

Numeric rewriting and text wrapping are reported separately and must never be averaged into one robustness score.

- Numeric attacks: Gaussian integer jitter at σ ∈ `{0,1,2,3,5,8,15,25}`, order shuffling, global rank normalization, block rank normalization, and uniform resampling.
- Text wrapping: direct, brief, and schema wrappers with identical task semantics and paired seeds.

For every attack report absolute accuracy, delta from σ=0, unknown/ambiguous rates, and per-family results. `symbol-choice-v1` has `evaluationRole: collection-only` and is mechanically excluded from every score, gate, confidence, and report conclusion in 0.0.1. The initial target is model top-1 ≥90%, family top-1 ≥95%, open-set misattribution ≤5%, and σ=1 degradation ≤20% relative. These are acceptance targets, not achieved results.

The offline analysis motivating this protocol reported model accuracy falling sharply under small numeric jitter and uniform resampling, while seven wrappers produced no classification flips. Those results were not collected against live M-Trace endpoints and do not validate this implementation. Cross-time stability, provider-default sampling stability, generation-level utility, symbol-family utility, and protocol-family utility remain unverified.

## Dataset contract

The evaluator accepts a JSON object with `samples`. Each sample has `split`, `modelId`, `modelFamily`, `challengeFamily`, `environmentId`, `values`, `bucketCount`, and `rangeExclusive`; production records also carry `extractorVersion`, `suiteVersion`, evidence validity, and evaluation role. Synthetic/mock data must declare `provenance: "synthetic"` and cannot be promoted into a production bank or quoted as model accuracy.

The CLI requires explicit `--max-distance`, `--min-margin`, and `--min-relative-margin`; it has no default acceptance threshold. Attack transforms use a recorded deterministic seed (`--seed`, default `73013`). Production threshold values must come from a separately frozen calibration run.
