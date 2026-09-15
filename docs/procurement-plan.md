# 首版指纹库采购清单（GUCH-362）

状态：`full-collection-paused-credit-exhausted`。owner 已将 0.0.1 库内与验收集范围收缩为 OpenAI-only；库内发布日期必须 ≥ 2026-04-15。本清单以 2026-09-15 拉取的 models.dev 价格和发布日期做预算候选，并以 OpenAI 官方文档和已批准的官方端点探活作最终门禁。

## 统一口径与硬门槛

- 正式采集仍采用 3 families × 12 environments × 3 replicates = 108 calls/identity/round，环境网格不变；做建库与第 14 天漂移复测两轮。
- OpenAI-only 候选不发送 `temperature`/`top_p`，使用厂商默认采样；发送 `max_completion_tokens` 而非 `max_tokens`，并冻结 `reasoning_effort`。默认采样漂移是明确失效条件，必须以漂移复测与新 `bankVersion` 处理，不能覆盖旧指纹。
- 全量采集前必须先完成 6 型号各一次、恰好 16 整数的最小试点。2026-09-15 六项均通过；不得因试点通过而绕过全量放行或改变模型、采样量及参数。
- 只允许 platform.openai.com 官方 key 与 TLS 终止于 `api.openai.com` 的官方 API。共享网关、镜像、转售 key、sub2api、codex-proxy 一律禁止。本次试点经审计后的本机 HTTP CONNECT 隧道传输，六条响应均记录 `transport: tunnel`。
- 试点回读并保存了完整 `usage`，包括 Chat 的 `completion_tokens_details.reasoning_tokens` 与 Responses 的 `output_tokens_details.reasoning_tokens`。这只替换最小试点的估算，不足以确定全量成本。

## 6 个库内候选（OpenAI-only）

下表金额按每模型约 3,000 输入 + 27,000 输出 token 的单重复单元（36 calls）估算，仅用于型号间比较；正式一轮为 3 个重复（108 calls），token 与基础金额均为下表的 3 倍。reasoning token 与重试上浮尚未实测。

| 官方 `model` 字段   | 发布       | 归因世代         | 输入/输出 USD/MTok | 最低 effort | 36-call 单重复单元 CNY | ID/试点状态                    |
| ------------------- | ---------- | ---------------- | -----------------: | ----------- | ---------------------: | ------------------------------ |
| `gpt-5.5`           | 2026-04-23 | OpenAI 5.5       |             5 / 30 | `none`      |                  ¥5.90 | rolling ID；Chat 试点通过      |
| `gpt-5.5-pro`       | 2026-04-23 | OpenAI 5.5 Pro   |           30 / 180 | `medium`    |                 ¥35.39 | rolling ID；Responses 试点通过 |
| `gpt-5.6-sol`       | 2026-07-09 | OpenAI 5.6 Sol   |             4 / 20 | `none`      |                  ¥3.95 | rolling ID；Chat 试点通过      |
| `gpt-5.6-terra`     | 2026-07-09 | OpenAI 5.6 Terra |             2 / 12 | `none`      |                  ¥2.36 | rolling ID；Chat 试点通过      |
| `gpt-5.6-luna`      | 2026-07-09 | OpenAI 5.6 Luna  |          0.2 / 1.2 | `none`      |                  ¥0.24 | rolling ID；Chat 试点通过      |
| `gpt-6-astra`       | 2026-09-04 | OpenAI 6 Astra   |            10 / 50 | `low`       |                  ¥9.87 | rolling ID；Chat 试点通过      |
| **合计/单重复单元** |            |                  |                    |             |     **¥57.71（≈¥58）** |                                |

`gpt-5.6` 不是第七个库内身份；它在 2026-09-15 的官方模型列表核对中不可见，取消额外别名试打且不得同时入库。`gpt-realtime-2.1` 因 audio 模态、`gpt-image-2` 因图像用途排除。

库内身份一律使用 dateless ID，其语义是厂商当前指针所指的服务，不是钉死快照。响应回显的 `model` 与 `systemFingerprint` 记录采集时指针解析结果；两周复测发现漂移时发新 `bankVersion`，不得覆盖旧库或让报告暗示身份已钉死。日期快照不保留为 alias。

2026-09-15 试点中，dateless `gpt-5.5-pro` 的 Chat Completions 明确返回 HTTP 404（零重试、无 JSONL），随后获批的同一身份 Responses 诊断返回 HTTP 200，因此该 entry 的唯一形态冻结为 `openai-responses`。其余五个身份以 `openai-reasoning-chat-completions` 通过。

| dateless 身份   | 形态      | HTTP | 可解析整数 | output tokens | reasoning tokens | transport |
| --------------- | --------- | ---: | ---------: | ------------: | ---------------: | --------- |
| `gpt-5.5`       | Chat      |  200 |         16 |            51 |                0 | tunnel    |
| `gpt-5.5-pro`   | Responses |  200 |         16 |           128 |               89 | tunnel    |
| `gpt-5.6-sol`   | Chat      |  200 |         16 |            51 |                0 | tunnel    |
| `gpt-5.6-terra` | Chat      |  200 |         16 |            36 |                0 | tunnel    |
| `gpt-5.6-luna`  | Chat      |  200 |         16 |            51 |                0 | tunnel    |
| `gpt-6-astra`   | Chat      |  200 |         16 |            51 |                0 | tunnel    |

六条成功响应合计 198 input tokens、368 output tokens（其中 89 reasoning tokens）、566 total tokens；按采购表单价与汇率折算约 ¥0.22。Pro 的 Chat 404 无 usage。该最小试点只能校验接口与短序列成本，不能线性外推正式 108-call 长序列网格。

## 8 个库外开放集身份（OpenAI 老世代 ≤6 + 路由 2）

| 分层 / 槽位      | 厂商或部署          | 冻结 `model` 字段 | 家族 / 世代                  | 来源与备注                                            |
| ---------------- | ------------------- | ----------------- | ---------------------------- | ----------------------------------------------------- |
| near-negative-01 | OpenAI              | `gpt-5.4`         | OpenAI / 5.4 rolling ID      | 官方 dateless ID；当前批准 key 不可见，记 unavailable |
| near-negative-02 | OpenAI              | `gpt-5.4-mini`    | OpenAI / 5.4 Mini rolling ID | 官方 dateless ID；当前批准 key 不可见，记 unavailable |
| near-negative-03 | OpenAI              | `gpt-5.4-nano`    | OpenAI / 5.4 nano rolling ID | 官方 dateless ID；当前批准 key 不可见，记 unavailable |
| near-negative-04 | OpenAI              | `gpt-5.2`         | OpenAI / 5.2 rolling ID      | 官方 dateless ID；当前批准 key 不可见，记 unavailable |
| near-negative-05 | OpenAI              | `gpt-5.1`         | OpenAI / 5.1 rolling ID      | 官方 dateless ID；当前批准 key 不可见，记 unavailable |
| near-negative-06 | OpenAI              | `gpt-4.1`         | OpenAI / 4.1 rolling ID      | 官方 dateless ID；当前批准 key 不可见，记 unavailable |
| routing-01       | `all-api.ccode.dev` | `routing-slot-01` | OpenAI route / unknown       | 直连路由端点；永不入 bank，构造即 unknown             |
| routing-02       | `all-api.ccode.dev` | `routing-slot-02` | OpenAI route / unknown       | 直连路由端点；永不入 bank，构造即 unknown             |

库内/库外不得出现 alias、snapshot 或量化变体重叠。当前批准 key 未在 `GET /v1/models` 暴露上述六个老世代 dateless ID，故 manifest 将其冻结为 `unavailable`；不可静默替补。任何型号、revision、分层或路由规则变化都必须先重算 `acceptance-manifest.json` 的 `contentHash`；采集后禁止按阈值表现换身份。

## 成本与决策点

- 正式一轮为 108 calls/identity，即每模型约 9,000 输入 + 81,000 输出 token；按未四舍五入的单重复估算乘 3，6 个库内模型的基础金额约 **¥173.10/轮**，其中 `gpt-5.5-pro` 约 **¥106.18/轮**。
- 库内基础金额按 1.5 重试系数和两轮计算为 **¥519.30**。加上尚未实测的 reasoning 隐藏 token 上浮、OpenAI 老世代 ≤6 + 路由 2 身份与试点，预期总额修正为 **¥550–850**，硬顶仍为 **¥1200**。
- `gpt-5.5-pro` 占基础成本约 61%，其真实 reasoning token 和稳定产出能力是试点的首要成本门槛。若试点成本异常或输出不可解析，停止并报告，不自行删除、替换或降采样。
- 预算估算基于候选数据，并非已发生账单；全量前以官方 usage 实测更新预算。

## 2026-09-15 第一轮执行状态（未完成）

按 Mika 放行规则，先用 `gpt-5.5-pro` 的 3 条 384 长度数值 challenge 做金丝雀；其中一条达到 3751 output tokens，超过 3300 停线阈值，因此 Responses 上限从 4096 提升至 8192，并补齐了截断/长度不符的失败与断点测试。随后正式 Pro 数值族轮次完成 23/36 条，23 条均为 384 个域内整数；1 条先超时，剩余 12 条在有界重试和 55 秒退避后仍返回 HTTP 429。已回读 usage 为 928 input、82975 output（63677 reasoning）、83903 total，按 Pro 价格折算约 ¥106.99。

`gpt-5.5` 的 36 条逻辑请求均返回 HTTP 429；其余四个型号尚未发请求。没有其它型号产生可计费成功响应，采集随即停止。同一官方 CONNECT 隧道上的 `GET /v1/models` 随后返回 HTTP 200，说明凭据和传输可达，但不能证明采集限流已解除。部分 JSONL checkpoint 在 `artifacts/library-round1/`，金丝雀证据在 `artifacts/library-round1-canary/`；两者都不能作为完整 bank。不得把本次部分结果写成全量通过，也不得在限流未解除前改用其他传输、模型或参数。

owner 随后将限流类 429 改为无限自动等待：优先使用 `retry-after`，缺失时按 60 秒起步指数退避、10 分钟封顶；每次等待前后写 raw checkpoint，429 不消耗有限重试或成功计费预算。首个自动续采运行从 `gpt-5.6-luna` 开始，首条 challenge 连续收到 5 次 429，依次完成 60 / 120 / 240 / 480 秒等待，实际累计 900 秒；第 5 次 600 秒等待前 checkpoint 写入后按单次运行时长边界退出。该型号仍为 0/36、缺口 36，新增成功计费 ¥0。

随后一次经批准的独立最小诊断调用读取到 `type=insufficient_quota`、`code=credit_balance_exhausted`，把根因收敛为账户余额耗尽而非限流窗口；这项结论不是由上述正式采集进程自行观察得出。现有 600 秒待等待 checkpoint 已用带来源标记的 `quota-exhausted` 记录停放，不计作新的正式调用或 429。恢复依赖 owner 充值；充值后先用连续两次最小调用 200 通过恢复门禁，再按五个便宜型号、最后 Pro 13 个缺口的顺序续采。明确的余额耗尽 429 会立即写 checkpoint 并退出；只有限流类（以及无错误体、无法分类的兼容响应）继续自动等待。

## 协议与可信度限制

GUCH-363 已冻结 Suite 2.0：全族采样语义为 provider default，`modelFamily` 对外语义为 OpenAI 世代（`gpt-5.5` / `gpt-5.6` / `gpt-6`）。正式采集仍必须等待本仓库对齐实现复核和六型号试点全部通过。

阶段 1 的数值抖动、封装鲁棒性和最低库规模结论来自离线分析语料，不是本清单的在线实测。跨时间稳定性、OpenAI 默认采样漂移、symbol family 效用、`gpt-5.5-pro`/`gpt-6-astra` 可解析性及真实 reasoning 成本均未验证，不得表述为已证实能力。

## 官方来源

- [OpenAI model catalog](https://developers.openai.com/api/docs/models)、[GPT-5.5](https://developers.openai.com/api/docs/models/gpt-5.5)、[GPT-5.5 Pro](https://developers.openai.com/api/docs/models/gpt-5.5-pro)、[GPT-5.6 Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol)、[GPT-6 Astra](https://developers.openai.com/api/docs/models/gpt-6-astra)。
- [OpenAI Chat Completions API](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)：`max_completion_tokens`、`reasoning_effort`、provider-default 时不发送 `temperature`、usage reasoning token 字段。
