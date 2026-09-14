# Reference bank format and versioning

The canonical schema is `schemas/reference-bank.schema.json`. A bank is a single JSON document; the expected first-release size is small enough that compression and sharding add no value. Consumers may load the entire bank or call `selectEntries` to retain only selected families/models after validation.

Version fields evolve independently:

- `schemaVersion` changes only for an incompatible document-shape change. Unknown major shapes are rejected.
- `extractorVersion` changes whenever feature semantics change. A runtime must reject an incompatible extractor.
- `suiteVersion` identifies the prompts and challenge parameters.
- `bankVersion` identifies a calibrated content release (`YYYY.MM.patch`). Every entry repeats it to make detached/on-demand entries self-describing.
- `contentHash` is SHA-256 over canonical JSON excluding all `contentHash` keys. Both bank and entry hashes are verified before use.

Every entry contains model/family labels, collection time, environment/sample provenance, a fingerprint, and calibration thresholds. It contains no API key, request header, full endpoint, local path, or raw prompt response. Historical reports must embed the fingerprint, verdict, and all four versions used at evaluation time. A newer bank can reinterpret that frozen fingerprint, but must label the result as a reinterpretation rather than silently changing an old conclusion.

`unknown` is a first-class verdict. A nearest neighbor is accepted only when an independently calibrated absolute-distance gate and separation margin both pass. Self-reported model names are evidence metadata, never ground truth.
