# 首版指纹库采购清单（GUCH-362）

状态：`pending-budget-approval`。本版按 owner 指定的 models.dev（2026-09-15 拉取）发布日期窗口筛选，再以官方探活作最终门禁；models.dev 是社区聚合数据，不能替代探活。价格按 models.dev 记录，计价汇率 `1 USD = ¥7.15`。这是采集前冻结候选，不代表已发起任何真实请求；所有 `probeAt` 为空、`probeResult` 为 `pending-budget`，不得把候选写成已探活。

## 统一测算口径

- 每个身份正式一轮：3 个独立重复 × 36 challenge = 108 次调用，输出约 81,000 token，输入约 9,000 token；乘 1.5 重试系数，再做两轮（建库 + 2 周漂移复测）。
- 表中“单重复（36 calls）CNY”为 1 个重复单元的金额；正式采集按 3 个重复单元计费。采集前另预留一次 16 整数最小挑战试打，不计入正式 108 次调用。
- models.dev 的价格只是预算依据，实际金额以官方账单为准。
- 这是最坏上限估算；实际 token 低于上限时按量结算。自建模型/路由端点的 API 单价为 `$0`，不含下载、显卡和电费。

## 12 个库内模型（两家族、跨厂商各 6 个）

### Alibaba Qwen（官方 DashScope，6 个）

| 型号 ID               | 发布       | 输入 / 输出 USD/MTok | 单重复（36 calls）CNY | ID/探活状态                       |
| --------------------- | ---------- | -------------------: | --------------------: | --------------------------------- |
| `qwen3.8-max`         | 2026-08-03 |                2 / 6 |                ¥1.201 | stable；待探活                    |
| `qwen3.7-max`         | 2026-05-21 |            2.5 / 7.5 |                ¥1.502 | stable；待探活                    |
| `qwen3.7-plus`        | 2026-06-02 |              0.5 / 3 |                ¥0.590 | stable；待探活                    |
| `qwen3.6-max-preview` | 2026-04-20 |            1.3 / 7.8 |                ¥1.534 | preview；待探活                   |
| `qwen3.6-27b`         | 2026-04-22 |            0.6 / 3.6 |                ¥0.708 | stable；待探活                    |
| `qwen3.6-flash`       | 2026-04-27 |       0.1875 / 1.125 |                ¥0.221 | stable；待探活，family 字段需复核 |

### Google Gemini（官方 Generative Language API，6 个）

| 型号 ID                 | 发布       | 输入 / 输出 USD/MTok | 单重复（36 calls）CNY | ID/探活状态    |
| ----------------------- | ---------- | -------------------: | --------------------: | -------------- |
| `gemini-3.8-flash`      | 2026-09-02 |          0.75 / 3.75 |                ¥0.740 | stable；待探活 |
| `gemini-3.7-flash`      | 2026-08-13 |          0.75 / 3.75 |                ¥0.740 | stable；待探活 |
| `gemini-3.6-flash`      | 2026-07-21 |          0.75 / 3.75 |                ¥0.740 | stable；待探活 |
| `gemini-3.5-flash`      | 2026-05-19 |              1.5 / 9 |                ¥1.770 | stable；待探活 |
| `gemini-3.5-flash-lite` | 2026-07-21 |            0.3 / 2.5 |                ¥0.489 | stable；待探活 |
| `gemini-3.1-flash-lite` | 2026-05-07 |           0.25 / 1.5 |                ¥0.295 | stable；待探活 |

库内单重复小计：Qwen ¥5.76，Gemini ¥4.77，合计 **¥10.53**。

> 下方 OpenAI/Anthropic 表为上一版历史备选，仅保留审计轨迹，不计入本版 12 个库内型号、金额或 manifest。models.dev 将最近窗口型号标为 `temperature=false`，必须先通过实测温度探针才可重新入库。

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

旧的 OpenAI/Anthropic 12 型号表已由本版 Qwen/Gemini 定稿替换；理由是 models.dev 标注最近窗口型号 `temperature=false`，与当前挑战套件的温度可控前提不相容，必须以实测温度探针复核后方可另行入库。

## 20 个库外开放集身份（`docs/evaluation-protocol.md` 的 6/6/6/2）

| 分层 / 槽位             | 厂商或部署                      | 官方 `model` 字段（冻结值）                 | 家族 / 世代                  | USD / MTok（入 / 出） | 预估 token（入 / 出） | 预估金额（CNY） | 备注                                                                                      |
| ----------------------- | ------------------------------- | ------------------------------------------- | ---------------------------- | --------------------: | --------------------: | --------------: | ----------------------------------------------------------------------------------------- |
| hosted-unrepresented-01 | OpenAI                          | `gpt-5-nano-2025-08-07`                     | GPT / 5 nano 快照            |           0.05 / 0.40 |        3,000 / 27,000 |           ¥0.08 | 官方 API；未覆盖 hosted family                                                            |
| hosted-unrepresented-02 | OpenAI                          | `gpt-4.1-2025-04-14`                        | GPT / 4.1 快照               |                 2 / 8 |        3,000 / 27,000 |           ¥1.59 | 官方 API；未覆盖 hosted family                                                            |
| hosted-unrepresented-03 | Anthropic                       | `claude-haiku-4-5-20251001`                 | Claude / Haiku 4.5 快照      |                 1 / 5 |        3,000 / 27,000 |           ¥0.99 | 官方 API；未覆盖 hosted family                                                            |
| hosted-unrepresented-04 | Anthropic                       | `claude-sonnet-4-5-20250929`                | Claude / Sonnet 4.5 快照     |                3 / 15 |        3,000 / 27,000 |           ¥2.96 | 官方 API；未覆盖 hosted family                                                            |
| hosted-unrepresented-05 | xAI                             | `grok-4.6`                                  | Grok / 4.6                   |                 2 / 6 |        3,000 / 27,000 |           ¥1.20 | 官方 API；未覆盖 hosted family                                                            |
| hosted-unrepresented-06 | xAI                             | `grok-4.3`                                  | Grok / 4.3                   |            1.25 / 2.5 |        3,000 / 27,000 |           ¥0.51 | 官方 API；未覆盖 hosted family                                                            |
| near-negative-01        | Alibaba Cloud DashScope         | `qwen3-max`                                 | Qwen / 3 Max                 |                     — |        3,000 / 27,000 |               — | 同家族旧代近邻；价格/在线状态待 models.dev 与官方探活复核                                 |
| near-negative-02        | Alibaba Cloud DashScope         | `qwen3-plus`                                | Qwen / 3 Plus                |                     — |        3,000 / 27,000 |               — | 同家族旧代近邻；价格/在线状态待复核                                                       |
| near-negative-03        | Alibaba Cloud DashScope         | `qwen3-235b-a22b`                           | Qwen / 3 235B A22B           |                     — |        3,000 / 27,000 |               — | 同家族不同规模近邻；价格/在线状态待复核                                                   |
| near-negative-04        | Google                          | `gemini-3.1-pro-preview`                    | Gemini / 3.1 Pro preview     |                     — |        3,000 / 27,000 |               — | 同家族近邻；preview，在线状态待复核                                                       |
| near-negative-05        | Google                          | `gemini-2.5-pro-preview-05-06`              | Gemini / 2.5 Pro preview     |                     — |        3,000 / 27,000 |               — | 同家族旧代近邻；在线状态待复核                                                            |
| near-negative-06        | Google                          | `gemini-2.5-flash`                          | Gemini / 2.5 Flash           |             0.3 / 2.5 |        3,000 / 27,000 |           ¥0.49 | 同家族旧代近邻；官方 API                                                                  |
| local-open-01           | Qwen/Hugging Face 独立部署      | `Qwen/Qwen3-4B`                             | Qwen / 3 4B instruct         |                 0 / 0 |       12,000 / 53,432 |           ¥0.00 | 固定 HF revision；BF16 safetensors，禁用量化                                              |
| local-open-02           | Google/Hugging Face 独立部署    | `google/gemma-3-4b-it`                      | Gemma / 3 4B IT              |                 0 / 0 |       12,000 / 53,432 |           ¥0.00 | 固定 HF revision；BF16 safetensors，禁用量化                                              |
| local-open-03           | Microsoft/Hugging Face 独立部署 | `microsoft/Phi-4-mini-instruct`             | Phi / 4 mini                 |                 0 / 0 |       12,000 / 53,432 |           ¥0.00 | 固定 HF revision；FP16/BF16 safetensors，禁用量化                                         |
| local-open-04           | Hugging Face TB 独立部署        | `HuggingFaceTB/SmolLM2-1.7B-Instruct`       | SmolLM / 2 1.7B              |                 0 / 0 |       12,000 / 53,432 |           ¥0.00 | 固定 HF revision；BF16 safetensors，禁用量化                                              |
| local-open-05           | DeepSeek/Hugging Face 独立部署  | `deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B` | DeepSeek Distill / R1 1.5B   |                 0 / 0 |       12,000 / 53,432 |           ¥0.00 | 固定 HF revision；BF16 safetensors，禁用量化                                              |
| local-open-06           | Meta/Hugging Face 独立部署      | `meta-llama/Llama-3.2-3B-Instruct`          | Llama / 3.2 3B               |                 0 / 0 |       12,000 / 53,432 |           ¥0.00 | 固定 HF revision；BF16 safetensors，禁用量化                                              |
| router-mixture-01       | 自建 OpenAI-compatible 路由     | `mtrace-router-qwen25-tinyllama-v1`         | routing/mixture / 固定 50:50 |                 0 / 0 |       12,000 / 53,432 |           ¥0.00 | 独立部署；每请求按 seed 在 Qwen2.5-1.5B 与 TinyLlama 间确定性路由；构造即 unknown         |
| router-mixture-02       | 自建 OpenAI-compatible 路由     | `mtrace-router-stablelm-phi35-v1`           | routing/mixture / 固定 50:50 |                 0 / 0 |       12,000 / 53,432 |           ¥0.00 | 独立部署；每请求按 seed 在 StableLM-2-Zephyr 与 Phi-3.5-mini 间确定性路由；构造即 unknown |

按 owner 新口径：12 模型 × 1 重复单元 ¥10.53；正式 3 重复 × 1.5 重试系数 × 2 轮（建库 + 漂移复测）¥94.77；库外 20 身份（每身份 9 次调用）¥4.39；试打余量 ¥15.00；预算合计 **¥114.16（≈¥114）**，低于 ¥1200 硬顶，未削减模型数或采样量。

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

探活执行条件：预算批复后先拉官方模型列表并记录时间，再用一次 16 整数最小挑战确认 HTTP 可用、可解析、`temperature: 1` 未被静默忽略；HTTP 404/403/参数不兼容直接标失败并按同档位补位。Qwen 显式 `enable_thinking=false` / `thinking_budget=0`，Gemini 显式 `thinkingConfig.thinkingBudget=0`，这些 generation options 与请求元数据一同写入 JSONL。采集完成后第 14 天做漂移复测，超阈值只增发新的 `bankVersion`，不覆盖旧指纹。

## 采购与冻结约束

1. 只允许厂商第一方 API，或能记录权重 revision、服务命令、采样参数的独立部署；共享网关、镜像站、转售 key 一律不采。
2. `acceptance-manifest.json` 在采集前写入并校验 `contentHash`；任何身份、revision、路由规则或分层变化都必须重算 hash。采集后不得按阈值表现替换库外身份。
3. 运行时把“文本包装”与“数值改写”分开报告；本清单的金额不代表准确率，阶段 1 的分析结论仍受其未验证项限制。

## 官方来源

- [OpenAI model catalog](https://developers.openai.com/api/docs/models) 与 [GPT-5.4 Mini](https://developers.openai.com/api/docs/models/gpt-5.4-mini)、[GPT-5.4 nano](https://developers.openai.com/api/docs/models/gpt-5.4-nano)、[GPT-5.6 Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol) 定价/快照页。
- [Anthropic Models overview](https://platform.claude.com/docs/en/models/overview)、[pricing](https://platform.claude.com/docs/en/about-claude/pricing) 与 [ID/versioning](https://platform.claude.com/docs/en/about-claude/models/model-ids-and-versions)。
- [Google Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing)、[xAI pricing](https://docs.x.ai/developers/pricing)、[DeepSeek pricing](https://api-docs.deepseek.com/quick_start/pricing)。
- 独立部署 model card：[Qwen3-4B](https://huggingface.co/Qwen/Qwen3-4B)、[Gemma 3 4B IT](https://huggingface.co/google/gemma-3-4b-it)、[Phi-4-mini](https://huggingface.co/microsoft/Phi-4-mini-instruct)、[SmolLM2](https://huggingface.co/HuggingFaceTB/SmolLM2-1.7B-Instruct)、[DeepSeek R1 Distill](https://huggingface.co/deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B)、[Llama 3.2](https://huggingface.co/meta-llama/Llama-3.2-3B-Instruct)。
