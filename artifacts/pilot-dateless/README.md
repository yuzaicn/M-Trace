# Dateless OpenAI pilot — 2026-09-15

These are the raw and normalized JSONL records from the owner-approved, 16-integer preflight. They are pilot evidence (`suiteVersion: pilot-1.0.0`), not Suite 2.0 fingerprint-bank samples and must not be loaded into a bank.

All successful calls used the official OpenAI API with the project credential and the reviewed CONNECT transport; TLS terminated at `api.openai.com`. Each record therefore carries `transport: tunnel`. Credentials, authorization headers, endpoint URLs, proxy addresses, and local paths are absent.

The dateless `gpt-5.5-pro` identity first returned HTTP 404 on Chat Completions with zero retries, so that attempt produced no JSONL. The authorized follow-up on Responses succeeded and is captured here. The other five identities succeeded on Chat Completions. Full results and usage are summarized in `docs/procurement-plan.md`.
