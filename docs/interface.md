# M-Trace interface baseline

**Interface version: 2.1.0 — FROZEN (data and protocol layer).**

This document freezes the data formats, version axes, sampling semantics, and verdict semantics that every module must implement against. Module-level API signatures, error-code enumeration, and the report data model are **not yet frozen**; they follow in a separate section before implementation of the attribution engine begins. Any change to a frozen section requires a version bump here plus explicit notice to every consuming module.

Changelog:

- **2.2.0** — entry identity is defined as the provider's current pointer (dateless model ID), and the acceptance set is rescoped to OpenAI-only (prior-generation near neighbors ≤ 6 plus 2 routing endpoints; cross-provider and open-weight strata removed from 0.0.1) with the open-set gate re-expressed over the actually available negatives and a mandatory validation-boundary disclosure.
- **2.1.0** — adds the `openai-responses` request shape (for models not served on Chat Completions) and the mandatory `transport` provenance field with the tunnel-egress rule. Amended before any bank artifact exists; no collected data predates it.
- **2.0.0** — initial data/protocol-layer freeze.

## 1. Version axes

| Axis               | Value           | Meaning                                                            | Incompatibility rule                                                                                                                           |
| ------------------ | --------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`    | `1.1`           | Reference-bank document shape                                      | Loader accepts exactly `1.1`; anything else is rejected, never silently coerced                                                                |
| `suiteVersion`     | `2.0.0`         | Challenge prompts, grid, and sampling semantics                    | Fingerprints from different `suiteVersion` values must never be compared; mismatch is rejected at load, same severity as an extractor mismatch |
| `extractorVersion` | `1.0.0`         | Feature extraction math (unchanged from 1.x)                       | Mismatch rejects the bank                                                                                                                      |
| `bankVersion`      | `YYYY.MM.patch` | Calibrated content release; first real release starts the sequence | Data axis only; every entry repeats it                                                                                                         |

Rationale for the suite major bump: suite 1.x fixed the sampling temperature per challenge family; suite 2.0.0 delegates sampling entirely to the provider. A fixed-temperature distribution and a provider-default snapshot are different measurement objects, so cross-suite comparison would misread provider configuration drift as model identity change.

## 2. Sampling and request shapes

- `samplingSource` ∈ `provider-default` | `challenge-parameter`. Suite 2.0.0 bank and acceptance collection **must** use `provider-default`. `challenge-parameter` exists only for local mock and regression fixtures.
- Under `provider-default` the collector sends **no sampling parameters at all** — no `temperature`, no `top_p` — to any model, including models that would accept them. Output budget uses `max_completion_tokens` (never `max_tokens`). Reasoning control travels via `generationOptions` (`reasoning_effort`). The collector rejects generation options that conflict with this mode; that guard is normative.
- `requestShape` ∈ `openai-chat-completions` | `openai-reasoning-chat-completions` | `openai-responses` | `anthropic-messages`. The shape actually used is recorded per response; drift review must be able to distinguish "provider default changed" from "our request shape changed".
- **`openai-responses` (2.1.0):** used only for models that the provider does not serve on Chat Completions (Responses-only tiers). `POST /v1/responses`; output budget uses that API's native `max_output_tokens`; reasoning control uses its native `reasoning: { effort }`. All `provider-default` rules apply unchanged: no `temperature`, no `top_p`. A model keeps exactly one request shape per bank entry; the shape is chosen by provider availability, never by preference.
- Official-collection guard: bank collection for OpenAI models must terminate TLS at origin `https://api.openai.com` exactly, with no extra path. Shared gateways, mirrors, and resellers are forbidden sources for reference data — they hold their own keys and may swap backends. A **transport-level HTTP CONNECT tunnel** is permitted when direct egress is blocked, provided TLS still terminates at `api.openai.com` and our own key is used; the tunnel moves encrypted bytes only, and its use is recorded in provenance (§3), never omitted.

## 3. Provenance record (raw JSONL, normalized JSONL, and bank entry)

The following fields are first-class and mandatory in all three artifacts:

```
samplingSource     'provider-default' | 'challenge-parameter'
effort             string | null        // reasoning effort actually requested; null when not applicable
requestShape       see §2
generationOptions  object               // provider-specific options actually sent, echoed verbatim
usage              object | null        // provider-reported usage, including reasoning-token detail when present
systemFingerprint  string | null
transport          'direct' | 'tunnel'  // NEW in 2.1.0; per response in JSONL records
```

Bank entries summarize transport as `'direct' | 'tunnel' | 'mixed'` across their responses. The field is mandatory wherever provenance is recorded; a tunnel is never silently normalized to direct.

Records never contain API keys, authorization headers, base URLs, or local paths. Raw response bodies remain sensitive working data.

## 4. Reference bank schema 1.1

Additions and rulings on top of schema 1.0:

- **Entry identity is the provider's current pointer (2.2.0):** the dateless model ID. It denotes "whatever the provider currently serves under this name", never a pinned build. The response-echoed `model` and `systemFingerprint` in provenance (§3) record what the pointer resolved to at collection time; pointer drift is expected, watched by periodic re-probe, and absorbed by `bankVersion` releases (§8). Report copy must follow this semantics and must not imply a pinned build. Dated snapshot IDs never enter `aliases` (a snapshot-of relation is not an alias relation); when known, the resolved snapshot lives only in provenance.
- **`modelFamily` is the generation group, not the vendor.** For the 0.0.1 OpenAI-only bank the closed set of values is `gpt-5.5`, `gpt-5.6`, `gpt-6`. Vendor lives in separate metadata (`vendor`). Per-model marketing tiers ("5.6 Sol", "5.6 Terra") are informational metadata and must not be used as the grouping key: a family with exactly one member per model would make the family verdict either redundant or a vendor-level claim, and vendor-level attribution does not exist in this product (§5).
- **Alias rule:** suspected aliases are probed and distribution-compared; a confirmed alias becomes one entry with an `aliases` list. An alias must never appear as a second entry or an acceptance slot.
- **`calibration` block (per entry):**

```
maxDistance        number   // T1, absolute distance gate
minMargin          number   // T2, absolute separation
minRelativeMargin  number   // T3, relative separation, NEW in 1.1
distanceScale      number   // scale of the empirical distance distribution, NEW in 1.1
nuisanceDirections number[][] // environment-shift projection basis, NEW in 1.1;
                              // the key is required, [] is legal until a calibration run produces it
frozenAt           date-time
sampleCount        integer
```

- Entry-level provenance: `samplingSource`, `requestShape`, `effort`, `generationOptions`, and `transport` (§3 summary form) are recorded per entry (one protocol and shape per entry in 0.0.1). Schema `1.1` is amended in place for `transport` — no 1.1 artifact predates the amendment.
- **`contentHash` semantics:** canonicalization removes `contentHash` keys at every depth, so the bank-level hash covers the three version fields plus every entry, and each entry hash covers that entry. The hash defends against tampering, **not** against wholesale replacement of an entry by another internally-consistent entry; replacement is defended by `entryId` uniqueness. Any change to any entry requires recomputing the bank-level hash.
- Threshold values ship in the bank, never in source code.

## 5. Verdict semantics (four verdicts, ordered evaluation)

```
0. valid evidence below floor                → unknown  / insufficient-evidence   (short-circuit)
1. d(1) > maxDistance                        → unknown  / out-of-library
2. margin < minMargin  OR  relMargin < minRelativeMargin
     → if family-separable within the family subpool: in-library-family
     → else:                                   ambiguous / candidates-not-separable
3. otherwise                                 → in-library
```

where `d(1) ≤ d(2)` are the two smallest candidate distances, `margin = d(2) − d(1)`, `relMargin = margin / d(2)`.

- **Candidate pool, two levels.** Model-level pool: every bank entry with matching `extractorVersion`, matching `suiteVersion`, and valid sample count at or above the floor. Family-level evaluation runs within the `modelFamily` subpool. Pool membership is part of the contract: reported open-set rates are meaningless if the pool definition floats.
- **Report mapping:** `in-library` names a model; `in-library-family` names a generation ("looks like the GPT-5.6 generation"); `unknown` and `ambiguous` are first-class honest outcomes. There is **no** vendor-level tier — the report must never claim "this is OpenAI, generation unknown".
- `unknown` is a correct answer, not a failure mode. Acceptance targets: open-set misattribution ≤ 5 %, unknown ≥ 95 %, at most one acceptance identity with any accepted attribution (per evaluation protocol).

## 6. Challenge suite 2.0.0

- Prompt texts, the 4-wrapper × 3-format environment grid, and 3 independent replicates per cell are unchanged from 1.0.
- `params.temperature` is removed from every challenge family; the suite carries `samplingSource: 'provider-default'` instead.
- The symbol family is **collected but not scored** in 0.0.1: no gate or report conclusion may consume it. It is retained so that a future scorer can calibrate against data from the same provider-default configuration epoch without re-collection. This is a separately strikeable cost line item.

## 7. Acceptance manifest (rescoped in 2.2.0: OpenAI-only)

The 0.0.1 acceptance set is OpenAI-only by owner scope decision. The former 6/6/6/2 stratification is superseded:

- **Prior-generation near neighbors, up to 6 slots** — dateless OpenAI models of generations absent from the bank (gpt-5.4 / 5.2 / 5.1 / 4.1-class). These are the highest-value negatives (the realistic fraud scenario: an older generation resold as a newer one) and the hardest for the open-set gate. Slot availability depends on the key's project exposing those models; unavailable slots are recorded as unavailable, never silently substituted.
- **Routing endpoints, 2 slots** — endpoints whose backing model may vary. Identity is unknown by construction: samples are labeled `routing-endpoint / identity-unknown-by-construction`, are **never** promoted into the bank, and never serve as negatives that require ground truth. Their JSONL records carry the actual `transport` used; the §2 official-collection guard does not apply to them (they are not bank collection), but provenance completeness does.
- **Removed from 0.0.1**: the cross-provider hosted stratum and the open-weight local stratum. They may return in a later re-freeze; removal is a scope decision, not a technical judgment.
- **Gate re-expression**: the open-set targets of §5 (misattribution ≤ 5 %, unknown ≥ 95 %, at most one identity with any accepted attribution) apply over the acceptance identities actually available. If the near-neighbor slots are unavailable, acceptance runs on the routing slots alone and the release documentation must state that explicitly.
- **Mandatory validation-boundary disclosure** (report and README, must not be softened): 0.0.1's rejection capability is empirically validated **within the OpenAI ecosystem only**; cross-provider rejection (e.g. not mistaking a Qwen or Claude endpoint for an in-bank model) relies on the absolute-credibility layer's offline analysis and has not been tested online. A smaller acceptance set also reduces the statistical power of the ≤ 5 % gate; the identity count behind the reported rate must appear next to the rate.
- The manifest must carry the canonical `modelFamily` values of §4 so that stratum definitions resolve against the same grouping the verdict layer uses.
- Any manifest change recomputes its hash and re-runs the zero-overlap and alias checks before collection.

## 8. Process gates

Full-volume collection starts only after **both** gates pass: (a) this baseline plus the aligned suite/schema implementation, and (b) the per-model pilot probe (request shape accepted, parseable integer output, forced-reasoning models produce stable sequences, real usage read-back). Bank refresh policy: provider-default drift is an expected failure condition — it is disclosed in reports, watched via periodic re-probe, and absorbed by `bankVersion` releases, never by silently reinterpreting old data.
