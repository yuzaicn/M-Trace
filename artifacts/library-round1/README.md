# Suite 2.0 first-round collection — partial, rate-limited

Date: 2026-09-15. This directory contains the first-round `adaptive-numeric-v1`
family attempt for the six frozen dateless OpenAI identities. It is not a
complete bank and must not be loaded for calibration.

## Stop state

- `gpt-5.5-pro`: 23/36 challenges completed and normalized; all 23 have 384
  integers in the derived `[0,1152)` domain. One challenge timed out and the
  remaining 12 missing challenges returned HTTP 429 on repeated bounded
  attempts, including after a 55-second backoff.
- `gpt-5.5`: all 36 logical challenges returned HTTP 429 and no billed
  collection response was accepted.
- `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`, and `gpt-6-astra`: not
  started; no request was sent after the account-level limit was confirmed.
- All requests in this directory used the approved `tunnel` transport and
  the frozen request shapes. No proxy, model substitution, parameter change,
  or unapproved retry was used.
- A separate `artifacts/library-round1-canary/` directory holds the three Pro
  canary records made before the formal round. Those records are not part of
  this round and are not bank samples.

## Billed usage observed

The 23 successful Pro records report 928 input tokens, 82,975 output tokens,
63,677 reasoning tokens, and 83,903 total tokens. Using the frozen Pro price
($30/M input, $180/M output, ¥7.15/USD), the observed response usage is about
¥106.99. Failed 429 and timeout attempts returned no usage and are excluded.

The official `GET /v1/models` probe through the same tunnel returned HTTP 200
after collection stopped. This confirms the credential and transport were
reachable, but does not clear the collection-rate limit. Full collection must
resume from these JSONL checkpoints only after the rate-limit condition is
resolved; the ¥450 hard stop remains in force.
