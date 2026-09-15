# Rate-limit recovery probes — 2026-09-15

Three owner-approved minimum probes were attempted after the first-round
checkpoint stopped. All used `gpt-5.6-luna`, the official OpenAI base URL,
the approved CONNECT tunnel, provider-default sampling, and zero retries.

| Probe               | HTTP | Result                           |
| ------------------- | ---: | -------------------------------- |
| 1                   |  429 | no usage and no JSONL completion |
| 2 (8 seconds later) |  429 | no usage and no JSONL completion |
| 3                   |  429 | `credit_balance_exhausted`       |

The consecutive-200 recovery gate was therefore not met. No cheap-model
continuation was started, and no Pro gap was retried after this failed gate.
Before probe 3, more than 600 seconds of wall-clock time had elapsed since the
unfinished wait was checkpointed. The later `quota-exhausted` checkpoint had
already cleared that stale pending sleep, so it was not repeated. Probe 3 was
made by the collector after the quota-aware 429 branch was implemented; its raw
artifact contains only the sanitized error type and code, with no usage or
normalized record. The directory intentionally contains no response body, key,
endpoint URL, proxy address, or credential material.
