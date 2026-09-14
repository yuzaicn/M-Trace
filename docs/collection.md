# Collection tool

`m-trace-collect` supports OpenAI-compatible `/v1/chat/completions` and Anthropic `/v1/messages`, including SSE and JSON responses. It retries HTTP 429/5xx, enforces a per-request timeout, applies a request-per-minute interval, and resumes by skipping challenge IDs already present in the normalized JSONL file.

Keys can only be named through `--key-env`; their values cannot be passed as arguments. JSONL records intentionally omit base URL, authorization headers, and local paths. Raw upstream response bodies are sensitive working data and must be reviewed before sharing. Files are appended with owner-only mode when newly created.

Example against a local mock endpoint:

```sh
MOCK_TOKEN=not-a-real-key m-trace-collect \
  --protocol openai --base-url http://127.0.0.1:3000 \
  --model synthetic-a --key-env MOCK_TOKEN \
  --raw raw.jsonl --normalized normalized.jsonl --rpm 600
```

This command shape does not authorize real API calls. No real collection was performed for protocol 1.0 because budget and model coverage were not approved.
