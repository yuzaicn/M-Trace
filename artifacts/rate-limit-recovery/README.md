# Rate-limit recovery probes — 2026-09-15

Two owner-approved minimum probes were attempted after the first-round
checkpoint stopped. Both used `gpt-5.6-luna`, the official OpenAI base URL,
the approved CONNECT tunnel, provider-default sampling, and zero retries.

| Probe               | HTTP | Result                           |
| ------------------- | ---: | -------------------------------- |
| 1                   |  429 | no usage and no JSONL completion |
| 2 (8 seconds later) |  429 | no usage and no JSONL completion |

The consecutive-200 recovery gate was therefore not met. No cheap-model
continuation was started, and no Pro gap was retried after this failed gate.
The directory intentionally contains no response body, key, endpoint URL,
proxy address, or credential material.
