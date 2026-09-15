# Collection tool

`m-trace-collect` supports OpenAI-compatible `/v1/chat/completions` and Anthropic `/v1/messages`, including SSE and JSON responses. It retries HTTP 429/5xx, enforces a per-request timeout, applies a request-per-minute interval, and resumes by skipping challenge IDs already present in the normalized JSONL file.

Provider-specific generation controls are passed with `--generation-options-json`. They are copied into the request and recorded in both JSONL records so a thinking budget or disabled-thinking setting is part of the reproducibility record. For example, the preflight policy for reasoning models is:

```sh
--generation-options-json '{"thinking":{"type":"disabled"}}'
```

The exact field is provider-specific; the preflight must fail closed when a provider rejects it or silently returns a response with an unreported reasoning mode.

For OpenAI models that do not accept temperature, use `--sampling-mode provider-default` and pass Chat Completions `reasoning_effort` through generation options, for example:

```sh
--sampling-mode provider-default \
--generation-options-json '{"reasoning_effort":"none"}'
```

For OpenAI, this variant sends Chat Completions `reasoning_effort` and `max_completion_tokens`, and omits `max_tokens`, `temperature`, and `top_p`. Anthropic Messages retains its required output-budget field `max_tokens` but likewise omits both sampling parameters. The collector records `samplingSource`, `effort`, the actual `requestShape`, and `generationOptions`, plus complete upstream `usage` (including `completion_tokens_details.reasoning_tokens` when returned) and `systemFingerprint` in JSONL. Provider-default is the CLI default and the only valid mode for Suite 2.0 bank/acceptance collection. The older `challenge-temperature` mode remains available only for local mock and regression fixtures. A provider-default record is valid only when the matching bank entry freezes the same effort, sampling source, and request shape.

`--pilot-integers 16` renders one direct JSON-array challenge containing exactly 16 integers. It is the paid preflight gate, not a production fingerprint sample, and replaces the normal 108-call suite for that invocation.

The OpenAI 0.0.1 pilot is additionally gated on an official direct credential and `https://api.openai.com`; keys or endpoints from compatibility proxies, resellers, mirrors, sub2api, or codex-proxy are forbidden. Its command must include `--official-openai-only`, which rejects non-official origins before making a request. Before the paid pilot, list `/v1/models` using the official endpoint and confirm each frozen model is visible. Do not print or persist that model-list request's authorization header.

Keys can only be named through `--key-env`; their values cannot be passed as arguments. JSONL records intentionally omit base URL, authorization headers, and local paths. Raw upstream response bodies are sensitive working data and must be reviewed before sharing. Files are appended with owner-only mode when newly created.

Example against a local mock endpoint:

```sh
MOCK_TOKEN=not-a-real-key m-trace-collect \
  --protocol openai --base-url http://127.0.0.1:3000 \
  --model synthetic-a --key-env MOCK_TOKEN \
  --raw raw.jsonl --normalized normalized.jsonl --rpm 600
```

This command shape does not authorize real API calls. No real collection has been performed because the pilot budget and model coverage are not yet approved.
