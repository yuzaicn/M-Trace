# 首版指纹库采购清单（GUCH-362）

状态：`pending-budget-approval`。这是采集前的冻结候选，不代表已发起任何真实请求。**不按发布日期硬筛**：先用厂商官方模型列表/控制台集合确认可用性，再逐个用最便宜的一次 challenge 试打；本轮预算未批，所有 `probeAt` 为空、`probeResult` 为 `pending-budget`（本地条目为 `pending-local-runtime`），不得把候选写成已探活。价格按厂商公开标准（非 fast/priority、非缓存、非 batch 折扣）核对，计价日 2026-09-15；人民币换算采用 `1 USD = ¥6.7743`。

## 统一测算口径

- 每个身份一轮：两组数值 family 合计输出上限 35,000 token，另采 `symbol-choice-v1` 的 36 个调用、每次 `max_tokens=512`，即 symbol 上限 18,432；总输出按 `53,432` token 计。
- 输入按 108 个短 prompt 保守预留 `12,000` token。金额公式：`(12,000 × 输入单价 + 53,432 × 输出单价) / 1,000,000 × 6.7743`，每行四舍五入到分。
- 这是最坏上限估算；实际 token 低于上限时按量结算。自建模型/路由端点的 API 单价为 `$0`，不含下载、显卡和电费。

## 12 个库内模型（两家族、跨厂商各 6 个）

| 厂商      | 官方 `model` 字段         | 家族 / 世代         | USD / MTok（入 / 出） | 预估 token（入 / 出） | 预估金额（CNY） | 备注                                            |
| --------- | ------------------------- | ------------------- | --------------------: | --------------------: | --------------: | ----------------------------------------------- |
| OpenAI    | `gpt-5.6-sol`             | GPT / 5.6 旗舰      |                4 / 20 |       12,000 / 53,432 |           ¥7.56 | 官方 API；固定 ID，非 alias                     |
| OpenAI    | `gpt-5.6-terra`           | GPT / 5.6 平衡档    |                2 / 12 |       12,000 / 53,432 |           ¥4.51 | 官方 API；固定 ID，非 alias                     |
| OpenAI    | `gpt-5.6-luna`            | GPT / 5.6 成本档    |           0.20 / 1.20 |       12,000 / 53,432 |           ¥0.45 | 官方 API；固定 ID，非 alias                     |
| OpenAI    | `gpt-5.4-2026-03-05`      | GPT / 5.4 旗舰快照  |              2.5 / 15 |       12,000 / 53,432 |           ¥5.63 | 官方快照；不使用滚动 alias                      |
| OpenAI    | `gpt-5.4-mini-2026-03-17` | GPT / 5.4 mini 快照 |            0.75 / 4.5 |       12,000 / 53,432 |           ¥1.69 | 官方快照；不使用滚动 alias                      |
| OpenAI    | `gpt-5.4-nano-2026-03-17` | GPT / 5.4 nano 快照 |           0.20 / 1.25 |       12,000 / 53,432 |           ¥0.47 | 官方快照；不使用滚动 alias                      |
| Anthropic | `claude-fable-5-1`        | Claude / Fable 5.1  |               10 / 50 |       12,000 / 53,432 |          ¥18.91 | Anthropic 官方 API；固定 ID                     |
| Anthropic | `claude-opus-5`           | Claude / Opus 5     |                5 / 25 |       12,000 / 53,432 |           ¥9.46 | Anthropic 官方 API；固定 ID                     |
| Anthropic | `claude-sonnet-5`         | Claude / Sonnet 5   |                2 / 10 |       12,000 / 53,432 |           ¥3.78 | Anthropic 官方 API；固定 ID                     |
| Anthropic | `claude-opus-4-8`         | Claude / Opus 4.8   |                5 / 25 |       12,000 / 53,432 |           ¥9.46 | Anthropic 官方 API；4.6+ dateless ID 是固定快照 |
| Anthropic | `claude-opus-4-7`         | Claude / Opus 4.7   |                5 / 25 |       12,000 / 53,432 |           ¥9.46 | Anthropic 官方 API；4.6+ dateless ID 是固定快照 |
| Anthropic | `claude-sonnet-4-6`       | Claude / Sonnet 4.6 |                3 / 15 |       12,000 / 53,432 |           ¥5.67 | Anthropic 官方 API；4.6+ dateless ID 是固定快照 |

库内小计：OpenAI ¥20.31，Anthropic ¥56.74，合计 **¥77.05**。

## 20 个库外开放集身份（`docs/evaluation-protocol.md` 的 6/6/6/2）

| 分层 / 槽位             | 厂商或部署                      | 官方 `model` 字段（冻结值）                 | 家族 / 世代                  | USD / MTok（入 / 出） | 预估 token（入 / 出） | 预估金额（CNY） | 备注                                                                                      |
| ----------------------- | ------------------------------- | ------------------------------------------- | ---------------------------- | --------------------: | --------------------: | --------------: | ----------------------------------------------------------------------------------------- |
| hosted-unrepresented-01 | Google                          | `gemini-3.6-flash`                          | Gemini / 3.6 Flash           |           0.75 / 3.75 |       12,000 / 53,432 |           ¥1.42 | 官方 Gemini API；与库内 GPT/Claude 无交集                                                 |
| hosted-unrepresented-02 | Google                          | `gemini-2.5-pro`                            | Gemini / 2.5 Pro             |             1.25 / 10 |       12,000 / 53,432 |           ¥3.72 | 官方 Gemini API；≤200k 标准档                                                             |
| hosted-unrepresented-03 | xAI                             | `grok-4.6`                                  | Grok / 4.6                   |                 2 / 6 |       12,000 / 53,432 |           ¥2.33 | xAI 官方 API；短上下文标准档                                                              |
| hosted-unrepresented-04 | xAI                             | `grok-4.3`                                  | Grok / 4.3                   |            1.25 / 2.5 |       12,000 / 53,432 |           ¥1.01 | xAI 官方 API；短上下文标准档                                                              |
| hosted-unrepresented-05 | DeepSeek                        | `deepseek-flash`                            | DeepSeek / V4.1 Flash        |           0.30 / 1.20 |       12,000 / 53,432 |           ¥0.46 | 官方 API；按 peak 价预算，避免时段低估                                                    |
| hosted-unrepresented-06 | DeepSeek                        | `deepseek-v4-pro`                           | DeepSeek / V4 Pro-0813       |           1.32 / 3.96 |       12,000 / 53,432 |           ¥1.54 | 官方 API；按 peak 价预算，避免时段低估                                                    |
| near-negative-01        | OpenAI                          | `gpt-5-nano-2025-08-07`                     | GPT / 5 nano 旧代快照        |           0.05 / 0.40 |       12,000 / 53,432 |           ¥0.15 | 官方快照；与库内 5.4/5.6 不同 snapshot                                                    |
| near-negative-02        | OpenAI                          | `gpt-4.1-2025-04-14`                        | GPT / 4.1 快照               |                 2 / 8 |       12,000 / 53,432 |           ¥3.06 | 官方快照；与库内 ID 不重合                                                                |
| near-negative-03        | OpenAI                          | `gpt-4o-2024-11-20`                         | GPT / 4o 快照                |              2.5 / 10 |       12,000 / 53,432 |           ¥3.82 | 官方快照；与库内 ID 不重合                                                                |
| near-negative-04        | Anthropic                       | `claude-sonnet-4-5-20250929`                | Claude / Sonnet 4.5 快照     |                3 / 15 |       12,000 / 53,432 |           ¥5.67 | 官方日期快照；不使用 `claude-sonnet-4-5` alias                                            |
| near-negative-05        | Anthropic                       | `claude-haiku-4-5-20251001`                 | Claude / Haiku 4.5 快照      |                 1 / 5 |       12,000 / 53,432 |           ¥1.89 | 官方日期快照；不使用 alias                                                                |
| near-negative-06        | Anthropic                       | `claude-opus-4-5-20251101`                  | Claude / Opus 4.5 快照       |                5 / 25 |       12,000 / 53,432 |           ¥9.46 | 官方日期快照；不使用 alias                                                                |
| local-open-01           | Qwen/Hugging Face 独立部署      | `Qwen/Qwen3-4B`                             | Qwen / 3 4B instruct         |                 0 / 0 |       12,000 / 53,432 |           ¥0.00 | 固定 HF revision；BF16 safetensors，禁用量化                                              |
| local-open-02           | Google/Hugging Face 独立部署    | `google/gemma-3-4b-it`                      | Gemma / 3 4B IT              |                 0 / 0 |       12,000 / 53,432 |           ¥0.00 | 固定 HF revision；BF16 safetensors，禁用量化                                              |
| local-open-03           | Microsoft/Hugging Face 独立部署 | `microsoft/Phi-4-mini-instruct`             | Phi / 4 mini                 |                 0 / 0 |       12,000 / 53,432 |           ¥0.00 | 固定 HF revision；FP16/BF16 safetensors，禁用量化                                         |
| local-open-04           | Hugging Face TB 独立部署        | `HuggingFaceTB/SmolLM2-1.7B-Instruct`       | SmolLM / 2 1.7B              |                 0 / 0 |       12,000 / 53,432 |           ¥0.00 | 固定 HF revision；BF16 safetensors，禁用量化                                              |
| local-open-05           | DeepSeek/Hugging Face 独立部署  | `deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B` | DeepSeek Distill / R1 1.5B   |                 0 / 0 |       12,000 / 53,432 |           ¥0.00 | 固定 HF revision；BF16 safetensors，禁用量化                                              |
| local-open-06           | Meta/Hugging Face 独立部署      | `meta-llama/Llama-3.2-3B-Instruct`          | Llama / 3.2 3B               |                 0 / 0 |       12,000 / 53,432 |           ¥0.00 | 固定 HF revision；BF16 safetensors，禁用量化                                              |
| router-mixture-01       | 自建 OpenAI-compatible 路由     | `mtrace-router-qwen25-tinyllama-v1`         | routing/mixture / 固定 50:50 |                 0 / 0 |       12,000 / 53,432 |           ¥0.00 | 独立部署；每请求按 seed 在 Qwen2.5-1.5B 与 TinyLlama 间确定性路由；构造即 unknown         |
| router-mixture-02       | 自建 OpenAI-compatible 路由     | `mtrace-router-stablelm-phi35-v1`           | routing/mixture / 固定 50:50 |                 0 / 0 |       12,000 / 53,432 |           ¥0.00 | 独立部署；每请求按 seed 在 StableLM-2-Zephyr 与 Phi-3.5-mini 间确定性路由；构造即 unknown |

库外付费小计：hosted ¥10.48，near-negative ¥24.05；本地/路由 ¥0.00。全部 32 个身份合计 **¥111.58**，低于 ¥1200 硬顶，未削减模型数或采样量。

## 可用性、稳定性与探活状态（逐条对应上表）

| 槽位                    | 型号 ID                                     | ID 状态                      | 预览/快速迭代 | 探活时间 | 探活结果                |
| ----------------------- | ------------------------------------------- | ---------------------------- | ------------- | -------- | ----------------------- |
| hosted-unrepresented-01 | `gemini-3.6-flash`                          | rolling model ID             | 否            | —        | `pending-budget`        |
| hosted-unrepresented-02 | `gemini-2.5-pro`                            | rolling model ID             | 否            | —        | `pending-budget`        |
| hosted-unrepresented-03 | `grok-4.6`                                  | rolling model ID             | 否            | —        | `pending-budget`        |
| hosted-unrepresented-04 | `grok-4.3`                                  | stable model ID              | 否            | —        | `pending-budget`        |
| hosted-unrepresented-05 | `deepseek-flash`                            | documented alias → version   | 否            | —        | `pending-budget`        |
| hosted-unrepresented-06 | `deepseek-v4-pro`                           | stable model ID              | 否            | —        | `pending-budget`        |
| near-negative-01        | `gpt-5-nano-2025-08-07`                     | dated snapshot               | 否            | —        | `pending-budget`        |
| near-negative-02        | `gpt-4.1-2025-04-14`                        | dated snapshot               | 否            | —        | `pending-budget`        |
| near-negative-03        | `gpt-4o-2024-11-20`                         | dated snapshot               | 否            | —        | `pending-budget`        |
| near-negative-04        | `claude-sonnet-4-5-20250929`                | dated snapshot               | 否            | —        | `pending-budget`        |
| near-negative-05        | `claude-haiku-4-5-20251001`                 | dated snapshot               | 否            | —        | `pending-budget`        |
| near-negative-06        | `claude-opus-4-5-20251101`                  | dated snapshot               | 否            | —        | `pending-budget`        |
| local-open-01           | `Qwen/Qwen3-4B`                             | pinned HF revision           | 否            | —        | `pending-local-runtime` |
| local-open-02           | `google/gemma-3-4b-it`                      | pinned HF revision           | 否            | —        | `pending-local-runtime` |
| local-open-03           | `microsoft/Phi-4-mini-instruct`             | pinned HF revision           | 否            | —        | `pending-local-runtime` |
| local-open-04           | `HuggingFaceTB/SmolLM2-1.7B-Instruct`       | pinned HF revision           | 否            | —        | `pending-local-runtime` |
| local-open-05           | `deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B` | pinned HF revision           | 否            | —        | `pending-local-runtime` |
| local-open-06           | `meta-llama/Llama-3.2-3B-Instruct`          | pinned HF revision           | 否            | —        | `pending-local-runtime` |
| router-mixture-01       | `mtrace-router-qwen25-tinyllama-v1`         | fixed independent deployment | 否            | —        | `pending-local-runtime` |
| router-mixture-02       | `mtrace-router-stablelm-phi35-v1`           | fixed independent deployment | 否            | —        | `pending-local-runtime` |

探活执行条件：预算批复后先拉官方模型列表并记录时间，再复用 `m-trace-collect` 以 `--variants 1 --replicates 1` 做一次最便宜的格式挑战；HTTP 404/403/参数不兼容直接标失败并记录原因。采集完成后第 14 天做漂移复测，超阈值只增发新的 `bankVersion`，不覆盖旧指纹。

## 采购与冻结约束

1. 只允许厂商第一方 API，或能记录权重 revision、服务命令、采样参数的独立部署；共享网关、镜像站、转售 key 一律不采。
2. `acceptance-manifest.json` 在采集前写入并校验 `contentHash`；任何身份、revision、路由规则或分层变化都必须重算 hash。采集后不得按阈值表现替换库外身份。
3. 运行时把“文本包装”与“数值改写”分开报告；本清单的金额不代表准确率，阶段 1 的分析结论仍受其未验证项限制。

## 官方来源

- [OpenAI model catalog](https://developers.openai.com/api/docs/models) 与 [GPT-5.4 Mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini)、[GPT-5.4 nano](https://developers.openai.com/api/docs/models/gpt-5.4-nano)、[GPT-5.6 Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol) 定价/快照页。
- [Anthropic Models overview](https://platform.claude.com/docs/en/models/overview)、[pricing](https://platform.claude.com/docs/en/about-claude/pricing) 与 [ID/versioning](https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions)。
- [Google Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing)、[xAI pricing](https://docs.x.ai/developers/pricing)、[DeepSeek pricing](https://api-docs.deepseek.com/quick_start/pricing)。
- 独立部署 model card：[Qwen3-4B](https://huggingface.co/Qwen/Qwen3-4B)、[Gemma 3 4B IT](https://huggingface.co/google/gemma-3-4b-it)、[Phi-4-mini](https://huggingface.co/microsoft/Phi-4-mini-instruct)、[SmolLM2](https://huggingface.co/HuggingFaceTB/SmolLM2-1.7B-Instruct)、[DeepSeek R1 Distill](https://huggingface.co/deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B)、[Llama 3.2](https://huggingface.co/meta-llama/Llama-3.2-3B-Instruct)。
