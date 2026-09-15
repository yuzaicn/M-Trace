# Reference bank format and versioning

The canonical schema is `schemas/reference-bank.schema.json`. A bank is a single JSON document; the expected first-release size is small enough that compression and sharding add no value. Consumers may load the entire bank or call `selectEntries` to retain only selected families/models after validation.

Version fields evolve independently:

- `schemaVersion` is `1.1`; the loader accepts exactly this shape and rejects all other values.
- `extractorVersion` is `1.0.0`. A runtime rejects every mismatch.
- `suiteVersion` is `2.0.0` and identifies prompts, the challenge grid, and provider-default sampling semantics. A runtime rejects every mismatch.
- `bankVersion` identifies a calibrated content release (`YYYY.MM.patch`). Every entry repeats it to make detached/on-demand entries self-describing.
- `contentHash` is SHA-256 over canonical JSON excluding all `contentHash` keys. Each entry hash covers its full entry; the bank hash covers `schemaVersion`, `bankVersion`, `extractorVersion`, `suiteVersion`, all entries, and any other top-level content. Any entry change requires both hashes to be recomputed.

Hashes provide content addressing and integrity verification only. They do not authenticate a source or prevent an attacker from replacing an entry and recomputing internally consistent hashes; replacement detection requires an externally anchored bank hash or trusted signed release. `entryId` uniqueness prevents duplicate IDs, not malicious replacement.

Every entry contains `vendor`, a generation-group `modelFamily` (`gpt-5.5`, `gpt-5.6`, or `gpt-6`), model ID, collection time, environment/sample provenance, a fingerprint, and calibration. `samplingSource`, `requestShape`, `effort`, `generationOptions`, `usage`, and `systemFingerprint` are mandatory provenance fields. Calibration holds `maxDistance`, `minMargin`, `minRelativeMargin`, `distanceScale`, a required `nuisanceDirections` array, freeze time, and sample count. It contains no API key, request header, full endpoint, local path, or raw prompt response.

Historical reports must embed the fingerprint, verdict, and all four versions used at evaluation time. A newer bank can reinterpret that frozen fingerprint only as an explicitly labeled reinterpretation; a suite/extractor mismatch is rejected outright.

`unknown` is a first-class verdict. Model candidates must share the extractor and suite versions and meet the sample floor. A concrete model requires the absolute-distance, margin, and relative-margin gates. If model separation fails, candidates are collapsed by `modelFamily`; a separated family may yield `in-library-family`, otherwise the result is `ambiguous`. Self-reported model names are evidence metadata, never ground truth.
