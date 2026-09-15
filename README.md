# M-Trace

> WIP

M-Trace is an early-stage toolkit for tracing and verifying the model identity behind AI coding interactions; the product name, package name, and full documentation are still being finalized.

## 0.0.1 validation boundary

The open-set rejection claim in 0.0.1 is empirically validated only within the OpenAI ecosystem. Cross-provider rejection (for example, refusing to mistake a Qwen or Claude endpoint for an in-bank model) remains an offline-analysis hypothesis and has not been tested online; this is a scope decision, not a technical finding. Reports must print the available acceptance-identity count next to every open-set misattribution/unknown rate (a rate supported by two identities has different statistical power from one supported by twenty). Routing-endpoint samples are identity-unknown-by-construction and are never promoted to the reference bank or treated as truth-bearing negatives.
