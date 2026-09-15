# M-Trace 接口契约（冻结版）

**版本** v1.1-frozen · **冻结日期** 2026-09-15 · **对应 issue** GUCH-363（父：GUCH-353）
**机器可读镜像** `src/types/`（`schemaVersion: 1`）
**权威来源** 本契约的实测数字全部来自 GUCH-356 分析报告；未实测部分见 `docs/upstream-limitations.md`，本文引用处均带标注。

> 变更流程：任何签名变更 = 本文档 minor 版本 +1 + 通知全部受影响下游；任何阈值变更 = 库版本变更，**不是**契约变更。
> 契约冻结后，`src/types/` 之外**任何人不得**单方面修改。

**v1.1 变更（新增字段 / 收口口径，向后兼容）**：按 GUCH-361 设计说明 §10 收口报告契约，
并随 GUCH-363 冻结两条设计侧口径 ——
`AttributionVerdict` 增 `invalidations[]`（必填非空）与 `signals[]`（证据信号挂在这里，
报告层经 `verdict` 读取，不在 VM 上重复一份）；`InvalidationCode` 增 `margin-inseparable`
（候选在阈值内但最近两名 margin 过小，独立于 `samples-low`）；`selfReportAgreement` 家族档
口径定为「自报型号是否**属于**观测世代」（报告层不做字符串比对，映射不到 → `null` →
`self.unknown` 徽章）；`ReportViewModel` 增 `qualityGrade` / `target.probeWindow`，
`ReportChart.series[]` 增 `role`，`ReportEvidenceRow` 增 `status`，
`appendix` 增 `evidenceHash` / `libraryContentHash` / `randomization`。
详见 §3.10.1。受影响下游：GUCH-365（报告渲染）。

---

## 0. 裁决摘要（与上游三份输入的冲突处理）

Mika 指定的权威顺序：**分析报告 > 工程计划 > （合规约束一票否决）**。以下是逐条裁决记录。

| #   | 冲突                                                            | 裁决                                                                                                                   | 理由                                                                                                                                                                |
| --- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | 规划文档把四条路线按"都要做"铺开；分析给出 P0/P1/P2 排序        | **按分析排序**：A 为 P0 必实现；C/D 为 P1 可插拔证据源（接口预留、首版不实现）；B 为 P2 仅留扩展位、**不分配实现预算** | 分析的 A 有实测（具体模型 0.921 / 家族 1.000），C/D/B 均**未实测**（U2–U4），把未实测路线排进同一优先级是拿工程预算赌推断                                           |
| D2  | 规划 `attribute()` 是单值 argmax + 闭集判定                     | **改为两段式**：第一段绝对可信度校验（零参考库），第二段 top-N + 拒判                                                  | 库外模型 **36/36 被硬归因**，平均置信度 0.748，且与库内正确样本的置信度分布**重叠、阈值分不开**（已实测）。阈值分不开意味着"调个阈值"解决不了，必须在架构上分离两段 |
| D3  | 规划保留 `CalibrationParams.nuisanceDirections`（干扰方向投影） | **删除该字段**                                                                                                         | 消融实测：去掉投影后 **0.955 → 0.957**，贡献约 0 却带来自建 SVD 的复杂度。分析把它列为"最贵的负资产"                                                                |
| D4  | 规划保留"有序块特征"                                            | **删除**                                                                                                               | 同上，消融后 **0.957**，零贡献                                                                                                                                      |
| D5  | 退出码：规划给 `0/10/11/12/2/3/4/5/130`，PRD 给 `0/1/2/3/4`     | **以规划的矩阵为骨架**，吸收 PRD 的语义要点（"不一致"必须独立成码）；映射见 §5                                         | PRD 的五档把"网络失败"与"判定不一致"都压在 `3`，CI 无法区分"渠道有问题"与"我自己网络有问题"；规划的分档粒度更细且已标冻结                                           |
| D6  | 规划用 `npm` 分发（`data/library.v<N>.json` 随包发布）          | **与分发渠道解耦**：不假设 `node_modules` 布局，路径一律相对入口文件解析                                               | owner 已决定走 GitHub Releases 挂 tarball（GUCH-371）。契约不得依赖 `require.resolve` 或 npm 特有字段                                                               |
| D7  | 规划的指纹库只有 `libraryVersion`                               | **增加 `contentHash`**，并把 `bankVersion + contentHash + calibrationVersion` 一起写进结论                             | 「结论要能被第三方重跑验证」要求库**可被唯一确定**；只有版本号无法区分两个不同的库                                                                                  |
| D8  | 规划要求 `ProbePlan.seed` 默认随机                              | **保留随机默认，但种子必须进证据包**                                                                                   | 报告要可复验；"随机默认 + 不记录"会让报告无法被重跑                                                                                                                 |

---

## 1. 模块边界表

依赖方向**单向**：`types/` 被所有模块依赖，`types/` 不依赖任何模块。实现层不得反向依赖。

| 模块       | 路径                            | 职责                                                            | 纯度                       | 优先级        | 阶段               |
| ---------- | ------------------------------- | --------------------------------------------------------------- | -------------------------- | ------------- | ------------------ |
| 契约类型   | `src/types/`                    | 全部公开类型、错误码、退出码常量                                | 纯                         | **P0**        | 本 issue 已交付    |
| 规范序列化 | `src/core/canonical.ts`         | 规范 JSON（复验契约的底层原语）                                 | 纯                         | **P0**        | 本 issue 已交付    |
| 泄露模式   | `src/core/leak-patterns.ts`     | 报告泄露扫描的模式清单（正例 + 反例）                           | 纯                         | **P0**        | 本 issue 已交付    |
| 配置发现   | `src/config/`                   | 读本机 Codex / env / CLI 配置（**唯一**读本机文件面的模块之一） | 有副作用                   | **P0**        | 阶段 3（GUCH-366） |
| 探测       | `src/probe/`                    | 挑战套件渲染、请求编排、HTTP/SSE 传输（**唯一**触网面）         | 有副作用                   | **P0**        | 阶段 3（GUCH-364） |
| 规范化     | `src/normalize/`                | 原始响应 → 观测（容错解析 + 改写记账）                          | 纯                         | **P0**        | 阶段 3（GUCH-364） |
| 统计核心   | `src/stats/`                    | 纯数学，零领域知识，**自实现**                                  | 纯                         | **P0**        | 阶段 3             |
| 可信度层   | `src/credibility/`              | 绝对可信度校验（决策第一段，**零参考库**）                      | 纯                         | **P0**        | 阶段 3             |
| 指纹提取   | `src/fingerprint/`              | 观测 → 特征向量 + 质量评级                                      | 纯                         | **P0**        | 阶段 3             |
| 归因       | `src/attribute/`                | 两段式决策，top-N + 拒判                                        | 纯                         | **P0**        | 阶段 3             |
| 参考库     | `src/library/`                  | 校验、哈希、索引、版本拒绝                                      | 纯（加载由注入的端口负责） | **P0**        | 阶段 3             |
| 证据包     | `src/evidence/`                 | 序列化 / 反序列化 / 摘要                                        | 纯                         | **P0**        | 阶段 3             |
| 报告       | `src/report/`                   | 视图模型 + HTML 渲染（纯函数）                                  | 纯                         | **P0**        | 阶段 3（GUCH-365） |
| i18n       | `src/i18n/`                     | 文案目录 + 确定性格式化                                         | 纯（加载注入）             | **P0**        | 阶段 3（GUCH-365） |
| CLI        | `src/cli/`                      | 参数解析、编排、退出码                                          | 有副作用                   | **P0**        | 阶段 3（GUCH-366） |
| 本地读写   | `src/io/`                       | 本地文件 / stdout 读写端口（唯一副作用出口，由 CLI 注入）       | 有副作用                   | **P0**        | 阶段 3（GUCH-366） |
| 行为族     | `src/probe/families/behavior-*` | 上下文断点、拒绝边界、工具 schema、知识截止一致性               | 有副作用                   | **P1 预留**   | 阶段 3 之后        |
| 协议族     | `src/probe/families/protocol-*` | SSE 节奏、usage 结构、错误码措辞（传输特征已在 P0 采集）        | 有副作用                   | **P1 预留**   | 阶段 3 之后        |
| 文本统计族 | `src/probe/families/text-*`     | 分词边界、空白/标点习惯                                         | 有副作用                   | **P2 仅留位** | 不排期             |

### 1.1 路线分层与实现预算（**这是本文最重要的表**）

| 路线                           | 契约位置                                     | 首版是否实现                | 实测依据                                            |
| ------------------------------ | -------------------------------------------- | --------------------------- | --------------------------------------------------- |
| **A 生成式数字指纹（改造版）** | 核心引擎，`families` 中的 `integer-sequence` | **是（P0）**                | 具体模型 **0.921**、家族 **1.000**（已实测）        |
| **绝对可信度校验**             | 决策第一段，先于归因运行                     | **是（P0）**                | χ²/df 中位 0.332、lag-1 自相关中位 −0.587（已实测） |
| **C 行为指纹**                 | `families` 中的可插拔族                      | **否（P1 预留）**           | **未实测**，预期判据属工程推断（见 U2）             |
| **D 协议层指纹**               | `TransportFeatures` + `families` 中的协议族  | **部分（P0 只采集不判定）** | **未实测**，属工程推断（见 U3）                     |
| **B 文本统计指纹**             | `families` 的扩展位                          | **否（P2，不分配预算）**    | **未实测**，机制上推断信噪比不足（见 U4）           |

> **给实现团队的一句话**：P0 只有 A + 可信度层。C/D/B 的接口存在是为了**不改契约就能加进来**，不是为了首版要做。凡是把四条路线当"都要做"排期的计划，都与本契约冲突。

---

## 2. 归因决策契约（两段式）

### 2.1 第一段：绝对可信度校验（零参考库）

回答的问题**不是**"这是哪个模型"，而是"**这段输出是不是一次模型采样**"。

| 信号名                 | 含义                       | 真实采样中位值（实测） | iid 基线 |
| ---------------------- | -------------------------- | ---------------------- | -------- |
| `chi-square-over-df`   | 计数分布相对均匀基线的偏离 | **0.332**              | ≈ 1.0    |
| `lag1-autocorrelation` | 相邻值的自相关             | **−0.587**             | ≈ 0      |
| `distinct-ratio`       | 去重取值数 / 样本数        | **0.953**              | ≈ 0.63   |
| `repeat-rate`          | 重复取值占比               | **0.047**              | ≈ 0.37   |

判据区间来自库内的 `GateCalibration.credibility`，**代码里不得有这些数值的字面量**（有契约测试断言）。

- `'plausible'`：通过信号数 ≥ `minPassingSignals` → 进入第二段
- `'implausible'`：失败信号数 ≥ `maxFailingSignals` → **短路为 `unknown`**，`stage = 'credibility'`，**不执行第二段**
- `'weak'`：其余情况 → 进入第二段，但结论的 `confidence.band` 最高只能到 `medium`

**为什么这一段解决了最严重的问题**：它对库外模型同样有效，因为判据不依赖任何参考条目。库外模型仍然通过第一段（它们确实是采样输出），但会在第二段被距离门槛拒判 —— 两段各拦一类，缺一不可。

> **这一段的效力范围（必须随结论一起引用）**：实验 12 报告的"对伪随机 / 重采样**近 100% 拦截率**"是在该实验自建的 468 条响应数据集上测得的，**未在真实在线服务上验证**（见 U1）。它是设计依据，不是对外保证；报告与 README 不得把它写成通用拦截率。

### 2.2 第二段：开放集归因（top-N + 拒判）

```
1. 若 quality.grade < minGradeForAttribution，或 minFamilySamples < 门槛，或 validRatio < 门槛
     → decision = 'unknown'，abstention = 'insufficient-evidence'    （短路，不算距离）
2. 对每个可比库条目（同族、extractorVersion 一致、样本达标）计算距离 d_i（主度量 Hellinger）
3. d(1) ≤ d(2) 为最小两个距离；margin = d(2) − d(1)；relMargin = margin / d(2)
4. 若 d(1) > maxDistance            → 'unknown'，abstention = 'out-of-library'
5. 若 margin < minMargin 或 relMargin < minRelativeMargin
                                    → 'ambiguous'，abstention = 'candidates-not-separable'
6. 否则                             → 'in-library'（或落到族级 → 'in-library-family'）
7. confidence 由 d(1)、margin、validRatio、各证据一致性共同决定
```

**第 4 步必须存在。** 用"取最近邻"代替它，就是回到了闭集硬归因，也就是本项目要修的那个缺陷。

### 2.3 判定结论的四值语义

| 值                  | 含义                 | 用户的下一步动作           | 退出码         |
| ------------------- | -------------------- | -------------------------- | -------------- |
| `in-library`        | 命中具体参考条目     | 与宣称模型比对             | 0（冲突时 12） |
| `in-library-family` | 只能定位到家族       | 家族级结论已足够可信       | 0              |
| `ambiguous`         | 多个候选无法区分     | **多跑几个变体**（可操作） | 11             |
| `unknown`           | 库外模型，或证据不足 | 记录下来，等待库更新       | 10             |

`'unknown'` 与 `'ambiguous'` 分开，是因为它们导向**不同的操作**。把它们合并会让用户失去"该重跑还是该等库更新"这个判断。

### 2.4 「无法判定」是一等公民（**不可协商**）

- 它是 `AttributionDecision` 联合类型的一支，走**正常返回路径**；
- 它**不是**错误码（`ErrorCode` 里没有 `UNKNOWN`，有契约测试断言）；
- 它**不是**异常，**不是**错误页，**不是**"最相近模型 + 相似度百分比"；
- 它有独立的退出码、独立的报告版面、独立的中英文案；
- 即使判为 `unknown`，**候选列表照样返回** —— 用户有权看到"最像的是谁、有多像"。

---

## 3. 模块输入输出签名

完整类型定义见 `src/types/`，此处给出函数面。**所有公开函数返回 `Result<T, MError>`，不抛异常表达业务结果。**

### 3.1 配置发现 `src/config/`

```ts
discoverConfig(options: DiscoverOptions): Promise<Result<ConfigSummary, MError>>
```

- **优先级（冻结）**：CLI 参数 > `MT_*` > `OPENAI_*` / `ANTHROPIC_*` > 本机 Codex 配置 > 默认值
- **隐私红线**：`auth.json` 只允许 `exists()` 判存在，**永不 `readTextFile`**（有契约测试断言）
- `ConfigSummary` 是唯一允许携带凭据的类型，**不得**出现在报告、JSON 产物、日志
- 报告中只允许 `endpointDisplay`（scheme + host，丢弃 path 与 query）
- **未知 flag 必须报用法错误，不得静默忽略**（CI 场景下静默忽略一个拼错的 flag 比报错危险得多）

### 3.2 探测 `src/probe/`

```ts
runProbes(plan: ProbePlan, deps: ProbeDeps, policy: TransportPolicy): Promise<ProbeRunResult>
```

- `TransportPort` 是**唯一触网面**；实现方必须提供绑定 `127.0.0.1:0` 的**真实 HTTP server** 替身（不是函数桩），否则无法覆盖 SSE 分块边界、header 大小写与连接中断
- 失败**不中断整体**：逐条记入 `failures`，其余样本继续
- `TransportPolicy` 承载全部传输阈值（超时、重试、退避、限流、并发），实现里不得有魔法数字

### 3.3 规范化 `src/normalize/`

```ts
normalize(input: NormalizeInput): NormalizeResult
```

- 解析失败必须是 `values: null`，**不得是 `[]`**（空数组会伪装成"解析成功但没数字"）
- 容错解析（剥 markdown 围栏、提取首个合法 JSON）是能力；**把失败静默吞掉是缺陷**，必须落 `parseFailure` 与 `flags`
- 改写比例越过 `maxRewrittenRatio` → 整轮降级为 `unknown`

### 3.4 统计核心 `src/stats/`

```ts
mean / variance / quantile / histogram / hellinger / jensenShannon;
chiSquare / chiSquareUpperTail / regularizedGammaP;
autocorrelation / distinctRatio / lagDifferenceDistribution;
permutationPValue / bootstrapCI / fft;
```

- 全部**自实现**（零运行时依赖，ADR-001）
- 主度量 **Hellinger**（有界、稳健、纯算术）：实测 0.897；备选 JSD 0.950
- **KL 散度不用**（零桶时发散）；**χ² 距离只用于可信度层**（实测 0.748，且对 n 敏感）
- 输入含 NaN / 无穷大时**返回 NaN，不抛异常、不静默替换成 0**
- 对照基准（SciPy / R 生成的固定期望值，以 JSON 夹具提交）是**永久门禁**，不是一次性检查 —— 数学 bug 不会崩，只会让结论悄悄偏

### 3.5 可信度层 `src/credibility/`

```ts
assessCredibility(values: readonly number[], policy: CredibilityPolicy, rng: () => number): CredibilityAssessment
```

- 纯函数，无 I/O、无时钟；bootstrap 随机源显式注入
- 判据区间来自库；本层**不读参考库**

### 3.6 指纹提取 `src/fingerprint/`

```ts
extractFingerprint(input: ExtractFingerprintInput): Result<Fingerprint, MError>
```

- 族**可缺席**：`families` 是数组，缺族即整族缺席，**不得用 0 / NaN 填充**
- 特征键**缺席表示"不可计算"**，不是 0
- 样本完全不足 → `ok: false` + `EVIDENCE_INSUFFICIENT`；部分降级 → 记在 `quality`

### 3.7 参考库 `src/library/`

```ts
validateLibrary(json: unknown, expected: { extractorVersion; schemaVersion }): Result<ReferenceLibrary, MError>
indexLibrary(library: ReferenceLibrary): LibraryIndex
computeLibraryHash(library: Omit<ReferenceLibrary, 'integrity'>): string
summarizeLibrary(index: LibraryIndex): LibrarySummary
```

- **三段版本语义**：`schemaVersion`（结构）/ `extractorVersion`（算法）/ `bankVersion`（内容）
- 结构或算法不兼容 → **拒绝加载**（`LIBRARY_VERSION_UNSUPPORTED`），**不做静默降级**（混版比对是最危险的静默错误）
- `integrity.contentHash` 由加载器**重算校验**；不符 → `LIBRARY_MALFORMED`（硬失败，不是警告）
- 条目的 `usable` 由加载器**按门槛重算**，不采信文件里的取值（防止手改库放宽门槛）

### 3.8 归因 `src/attribute/`

```ts
attribute(input: AttributeInput): Result<AttributionVerdict, MError>
```

- 纯函数：无 I/O、无网络、无时钟、无全局随机 → **同一输入必然逐字节相同**
- `AttributionVerdict` **不含时间戳、不含机器信息**（时间只在报告层由注入的时钟补上）
- 库不可用 → `unknown` + `abstention: 'library-unusable'`，**不得**抛异常，**不得**降级成"用最像的凑一个结论"
- `reasons` **不得为空** —— 任何结论都必须能解释自己

### 3.9 证据包 `src/evidence/`

```ts
canonicalJson(value: unknown): string
serializeEvidencePack(pack: EvidencePack, opts?): string
digestEvidencePack(pack: EvidencePack): string
parseEvidencePack(json: string): Result<EvidencePack, MError>
```

- 证据包自带**全部**复验输入：`fingerprint` + `libraryRef{ bankVersion, contentHash, calibrationVersion }` + `verdict` 原样
- **复验契约**：`attribute(pack.fingerprint, library)` 在任何机器、任何时间、无网络下都必须得到逐字节相同的结论
- `canonicalJson` 规则冻结：键递归按字典序排序、数组保序、数字最短往返、非 ASCII 保留、无空白、无尾换行
  （`-0` 归一化为 `0`；`NaN` / `Infinity` / `Date` / `Map` / `Set` / `bigint` / 循环引用一律**拒绝**）

### 3.10 报告 `src/report/`

```ts
buildReportViewModel(input: BuildReportViewModelInput): Result<ReportViewModel, MError>
renderReport(vm: ReportViewModel, opts: { locale }): Result<string, MError>
selfCheckReport(html: string): ReportSelfCheck
```

- 视图模型阶段完成**全部**格式化与脱敏；渲染层只读 VM，不做数字处理、不信任上游已脱敏
- 单文件 HTML：CSS 内联、数据内联为 `<script type="application/json">`、**零执行脚本**、零外部 URL
- **交互全靠纯 CSS**（`<details>` / `:target` / checkbox hack）—— 无执行脚本 = 消除一整类 XSS
- 体积上限 `REPORT_MAX_BYTES = 2 MiB`；超限时**裁剪附录原始值序列并明写**，不静默增长
- `limitations` 与 `disclaimerKeys` **不可为空**（产品 P0-7 + 法务 R13）

### 3.10.1 报告与失效条件相关的字段（v1.1，对应 GUCH-361 §10）

GUCH-361 的设计说明提出 8 条契约缺口。**缺口 1 / 2 / 4 是硬需求** —— 不定则报告会缺掉对应区块；
其余 5 条一并定形，不定不阻塞设计交接。

**缺口 1 —— 失效条件是独立字段，`reasons[]` 不得复用**

```ts
type InvalidationCode =
  | 'rewrite-suspect' | 'library-stale' | 'samples-low' | 'margin-inseparable'
  | 'snapshot-in-time' | 'library-evolves' | 'extraction-mismatch'
  | 'transport-noise' | 'partial-run';

interface InvalidationBasis { evidenceKey: string; observed: string }
interface InvalidationFlag { code: InvalidationCode; basis: InvalidationBasis }

// AttributionVerdict 新增：
invalidations: InvalidationFlag[];   // 必填且非空
```

- **必填且非空**，不是可选数组。`'snapshot-in-time'` 与 `'library-evolves'` 是**恒定项**
  （任何结论都只代表本次探测时段；参考库更新后本结论可能改变），
  所以"引擎忘了填"在类型上不可表达，报告层不必为空数组写兜底文案。
  `ALWAYS_PRESENT_INVALIDATIONS` 供报告层断言失效条件栏不为空。
- `'library-evolves'` 与 `'library-stale'` 不是一回事：前者说"库将来会变，本结论可能被新库推翻"，
  是结论的固有性质；后者说"当前库版本早于观测"，是本次状态的问题。合并会误报"库过时了"。
  设计说明 §3.2 要求「无法判定」档必含「参考库更新后结论可能改变」，由前者承载。
- `'margin-inseparable'` 与 `'samples-low'` 不是一回事，两者的**恢复路径不同**（产品经理要求失效条件
  必须给出可执行的恢复路径）：`'samples-low'` 是**有效样本不足**（quality 门槛未过），恢复路径是
  "先把样本量做够再判"；`'margin-inseparable'` 是**样本够了、候选也都在阈值内，但最近两名 margin 过小
  分不开**，恢复路径是"增加样本量后可能分开 / 可能定位到具体型号"。它的 `basis.evidenceKey` 落在
  `'attribution-margin'` / `'attribution-rel-margin'`（最近两名的距离差与相对差，对应
  `GateCalibration.attribution` 的 `minMargin` / `minRelativeMargin`）。这个码对应 §2.2 第 5 步的
  `'ambiguous'` 判定，让"为什么给不出具体型号"在失效条件栏里有据可查，而不是只落一个 `ambiguous` 退出码。
- `reasons[]` 是**判定依据**，`invalidations[]` 是**失效条件**，语义相反必须分栏。
  渲染层**不得**从 `reasons[]` 派生失效条件；`invalidations` 为空是契约违规，走 `RENDER_FAILED`，不退化成兜底展示。
- `basis` 指向支撑该码的已上报数据（信号键 / 统计量名）。渲染层不解析它，
  但契约测试断言 `evidenceKey` 在当前判定里真实存在 —— 这是让失效码可被验证、
  而不是一句免责话术的机制。

**缺口 2 —— 证据信号是独立字段，不由报告层派生**

```ts
type EvidenceSignalKey =
  | 'chi-square-over-df' | 'lag1-autocorrelation' | 'valid-sample-count'
  | 'streaming-ratio' | 'truncation-rate' | 'rewrite-suspect-ratio';

interface EvidenceSignal {
  key: EvidenceSignalKey;
  displayValue: string | null;      // 不适用时为 null，不是 0
  displayExpected?: string;         // 如 '≈0.33'
  verdict: 'ok' | 'low' | 'bad' | 'na';
}

// AttributionVerdict 新增：
signals: EvidenceSignal[];          // 必填，顺序固定为上述声明序
```

> 挂在 `AttributionVerdict` 上而不是 `ReportViewModel` 顶层：`verdict` 本身已内嵌在 VM 里，
> 再放一份就是同一数据的两个真源。报告层从 `vm.verdict.signals` 读。

- 六项的来源**横跨三个模块**（`src/credibility/` 的 χ²/df 与 lag-1、`src/normalize/` 的
  流式占比与改写占比、以及有效样本数）。这三个模块的产物报告层都拿不到，
  所以"由 `appendix.rawStats` 派生"不可行 —— 不是原则之争，是输入不存在。
  由引擎在判定完成时一次性汇总成显式数组。
- `'na'` 必须与 `displayValue: null` 同时出现，对应设计 §5.4 的「不适用」徽章与
  §5.3 的「— 不显示 0」。**不得**填 0、**不得**省略该项 —— 省略会让读者以为我们没测。
- **不合成总分**：契约不提供任何 `overall` / `score` 字段，让这条原则不可被实现方顺手破坏。
- 与 `appendix.rawStats` 并存有数据冗余，体积代价在 §8.2 预算内，接受。

**缺口 4 —— 证据包哈希与随机化判据**

```ts
appendix: {
  // ...原有字段...
  evidenceHash: string;         // canonicalJson + digestEvidencePack，§3.9
  libraryContentHash: string;   // 与 verdict.libraryRef.contentHash 一致
  randomization: { randomized: true; seed: number } | { randomized: false };
}
```

- `evidenceHash` 复用 §3.9 的 `canonicalJson`，**不新造序列化规则**：同一份输入必须
  得到同一哈希，与键顺序、数字格式化、平台无关。第三方拿 `reproduceCommand` + 种子
  重跑却对不上哈希，就是我们披露不足或产物不确定。
- `randomization` 用**判别联合**而不是 `seed?: number`：可选数字分不清"本来就没随机化"
  与"引擎忘了填"。前者是正当结果（写"本次未使用随机化"），后者必须让契约测试变红。
  与 D8 一致（随机默认保留，种子必须进证据包）。

**其余 5 条**

| #   | 契约变化                                                            | 理由                                                      |
| --- | ------------------------------------------------------------------- | --------------------------------------------------------- |
| 3   | `ReportViewModel.qualityGrade: QualityGrade`                        | 展示档位；`unknown` **不得**为 `'good'`                   |
| 5   | `ReportChart.series[]` 增 `role: 'observed' \| 'reference'`         | 配色与图例依赖；靠 `id` 约定太脆                          |
| 6   | `ReportEvidenceRow.status: 'ok' \| 'parse-failed' \| 'unavailable'` | §5.5 要求区分"没采集"与"解析失败"，自由文本 `note` 撑不住 |
| 7   | `ReportViewModel.target.probeWindow: { from, to }`                  | 声明"只代表本次探测时段"；**只到天**                      |
| 8   | `limitations` / `disclaimerKeys` 的 key 集                          | key 由契约冻结，正文归产品设计师                          |

**附带收口（GUCH-361 §2 的渲染前置校验）**：`out-of-library` 与 `ambiguous` 两档下
`claimedModel` **必须为 `undefined`**，`familyId` 只在族级命中时才存在。
不得填"库里最近候选的名字" —— 那正是 36/36 硬归因的复现路径。

**缺口补充（GUCH-363 冻结）—— 家族档 `selfReportAgreement` 口径与呈现规则**

设计说明 v1.0 曾把「家族可分」画进「歧义」档；按 §2.3 判定语义，家族可分**永不落歧义**，
整体在 `in-library-family`。据此冻结如下（双语正文归产品设计师）：

- **口径**：家族档下 `selfReportAgreement` = 自报型号是否**属于**观测到的世代 —— 由库的
  别名 / 世代映射判定（如 `gpt-5.6-sol`、`gpt-5.6-terra` 都归 `gpt-5.6`）。因此
  "自报 5.6-sol、观测 5.6 世代" = `true`（属于，不是冲突）。**报告层一律不做字符串比对**，
  比对在引擎侧按库映射完成。它决定家族档落「①一致」还是「②不一致」版式。
- **映射不到 → `null`**：自报型号在库映射里找不到世代时 `selfReportAgreement = null`，
  报告走「自报世代未知」徽章（设计侧 `self.unknown`），**不得**由 `null` 反推一致或冲突。
  `null` 的三个来源统一收在这里：端点未自报、结论本身无型号 / 世代可比、库映射找不到世代。
- **呈现（阶段 3 GUCH-365）**：家族档仍用「①一致 / ②不一致」两种版式，**不新增第五种配色**；
  世代展示名由报告层从 `familyId`（承载 `modelFamily` 世代标识）映射得到
  （如 `gpt-5.6` → "GPT-5.6 世代 / generation"），**无需新增契约字段**。
- **诚实性红线**：家族档报告**永不**给出厂商级措辞（不写"OpenAI 模型""疑似 OpenAI"
  "GPT 系列（世代未知）"）—— 结论要么落到具体世代，要么落 `unknown`，中间没有"厂商但世代未知"这一档。

### 3.11 i18n `src/i18n/`

```ts
t(key, params?, locale?): string
formatNumber(value, locale, opts?): string
formatDateTime(iso, locale): string
loadCatalog(locale): Promise<MessageCatalog>
```

- 缺键**不抛异常**，返回 `⟦missing:<key>⟧` 标记（快照测试据此抓漏翻）
- 找不到 locale 回落 `en`，并在 `limitations` 记账
- 目录按**相对入口文件**的路径加载，**不用**包解析（分发渠道解耦）
- 数字格式化不按 locale 推断小数位（避免不同机器上的 `Intl` 默认值差异渗进报告产物）

### 3.12 CLI `src/cli/`

```ts
runCli(argv: readonly string[], deps: CliDeps): Promise<ExitCode>
```

- **返回退出码而不是调用 `process.exit`**（后者截断未 flush 的 IO，也让测试无法断言）
- 全部外部依赖注入：`io` / `clock` / `env` / `cwd` / `homeDir` / `toolVersion` / `transport` / `libraryLoader` / `discoverConfig`
- `bin/m-trace.js` 是不含业务逻辑的可执行壳，按相对自身的位置解析 `dist/`

---

## 4. 错误语义清单

**总则**：`Result<T, MError>`，`ok: false` 表示"这次调用没得出结果"；异常只用于调用方违反契约。
**「无法判定」不在下表** —— 它不是错误，是结论。

| #   | 场景                                                 | 契约行为                                                                                                                                                                            | 错误码                                                        | 退出码 |
| --- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------ |
| E01 | 单次请求超时                                         | 记 `failures`，`retryable: true`，按 `backoffMs` 重试至 `maxRetries`；仍失败则该样本无效，**不中断整体**                                                                            | `REQUEST_TIMEOUT`                                             | 3      |
| E02 | 429                                                  | 尊重 `Retry-After`（上限 `maxRetryAfterMs`，超限放弃）；否则指数退避 + 全抖；**并发度自动降到 1**                                                                                   | `RATE_LIMITED`                                                | 3      |
| E03 | 非流式响应（服务端忽略 `stream: true`）              | **不判失败**。打 `flags: ['non-stream']`，流式节奏类特征**整键缺席**；若**全部**样本非流式 → 降级 `quality.grade = 'poor'`，结论必为 `unknown`，报告照常生成                        | `RESPONSE_NON_STREAM`（仅全量时）                             | 4      |
| E04 | SSE 语义完整前断开                                   | 该样本无效并剔除                                                                                                                                                                    | `RESPONSE_TRUNCATED`                                          | 4      |
| E05 | 200 但内容为空                                       | 无效样本；连续 3 个空响应 → 提前中止                                                                                                                                                | `RESPONSE_EMPTY`                                              | 4      |
| E06 | 网关改写（注入水印、包一层解释、塞进 markdown 围栏） | 规范化层**容错解析**（剥围栏、提取首个合法 JSON）；仍解析不出 → `parseFailure: 'rewritten'`，**不得**静默算作空样本；改写比例 > `maxRewrittenRatio` → 结论降级 `unknown` 并写明原因 | `CONTENT_REWRITTEN`（仅超阈值时）                             | 4      |
| E07 | 响应头被网关增删                                     | 只读白名单：`content-type` / `x-request-id` / `retry-after` / `x-ratelimit-*` + 明确登记的网关指纹头。**不做 header 全量哈希** —— 随机 request-id 会变成噪声                        | —                                                             | —      |
| E08 | 自报 `model` 与实际不符                              | **不抛错**。算 `selfReportAgreement` 并进报告；冲突时把退出码从 0 抬到 12。**自报永不作为判定依据**                                                                                 | —                                                             | 12     |
| E09 | 限流导致样本量不足                                   | 结论 `unknown` + `abstention: 'insufficient-evidence'`，报告仍生成                                                                                                                  | `EVIDENCE_INSUFFICIENT`                                       | 4      |
| E10 | `--offline` 且无本地库                               | 提示需要指定 `--library`                                                                                                                                                            | `LIBRARY_EMPTY`                                               | 5      |
| E11 | 库 `extractorVersion` / `schemaVersion` 与当前不一致 | **拒绝加载**，不做静默降级                                                                                                                                                          | `LIBRARY_VERSION_UNSUPPORTED`                                 | 5      |
| E12 | 库条目样本量低于门槛                                 | 加载时标为不可用并**排除出候选**，`library verify` 列出。**不静默计入**                                                                                                             | —                                                             | —      |
| E13 | 探测中收到 SIGINT                                    | 立刻 abort；有已完成样本则生成"部分报告"（标注 `partial-run`），退出码 130                                                                                                          | `CANCELLED` / `ABORTED`                                       | 130    |
| E14 | `maxTokens` 不足导致系统性截断                       | 视为**我们自己的 bug**，写 `warnings` 而**不是**归因给端点；`doctor` 提示调大                                                                                                       | —                                                             | —      |
| E15 | 报告体积超限                                         | 裁剪附录原始值序列并**明写"附录已裁剪"**；裁剪后仍超限 → 失败                                                                                                                       | `OUTPUT_TOO_LARGE`                                            | 5      |
| E16 | 配置缺失 / 格式异常                                  | 不崩溃；给出缺失字段名与手动模式指引（P0-1 ③④）                                                                                                                                     | `CONFIG_NOT_FOUND` / `CONFIG_MALFORMED` / `CONFIG_INCOMPLETE` | 2      |
| E17 | 端点在配置中被指定但不可达                           | 传输层错误，可重试                                                                                                                                                                  | `ENDPOINT_UNREACHABLE`                                        | 3      |
| E18 | 鉴权被拒 / 上游 5xx                                  | 传输层错误                                                                                                                                                                          | `AUTH_REJECTED` / `UPSTREAM_5XX`                              | 3      |
| E19 | 响应结构与 OpenAI / Anthropic 兼容格式不符           | 无效样本                                                                                                                                                                            | `RESPONSE_SCHEMA_MISMATCH`                                    | 4      |
| E20 | 库哈希重算不符                                       | **硬失败**，拒绝加载                                                                                                                                                                | `LIBRARY_MALFORMED`                                           | 5      |
| E21 | 证据包结构校验失败                                   | 拒绝解析                                                                                                                                                                            | `EVIDENCE_MALFORMED`                                          | 4      |
| E22 | 渲染失败 / 本地读写失败                              | 本地环境问题                                                                                                                                                                        | `RENDER_FAILED` / `IO_FAILED`                                 | 5      |
| E23 | 未知子命令 / 非法参数                                | **不静默忽略**                                                                                                                                                                      | `USAGE_ERROR`                                                 | 2      |
| E24 | 隐私红线被触及（被要求读 `auth.json` 字段值）        | 直接拒绝                                                                                                                                                                            | `CONFIG_READ_FORBIDDEN`                                       | 2      |

---

## 5. 退出码契约（冻结）

```
 0    in-library / in-library-family，且 quality ≥ fair          → 断言"这个渠道确实是它宣称的模型"
 10   unknown（库外模型或证据不足）                                → 断言"不是我们库里的任何一个"
 11   ambiguous（多个候选无法区分）                                → 需要更多样本
 12   自报模型与观测结论冲突                                        → 可疑渠道告警
 2    用法 / 参数错误
 3    网络或上游错误（不可达 / 429 / 5xx / 超时 / 鉴权）
 4    数据不足或响应异常
 5    本地环境问题（库 / 渲染 / IO）
 130  被 SIGINT 或 AbortSignal 中断
```

**不变量**（全部有契约测试断言）：

1. 错误码 → 退出码的映射是**全函数**（`ERROR_EXIT_MAP` 用 `satisfies` 保证编译期无缺口）
2. 判定类（0/10/11/12）与故障类（2/3/4/5/130）**不共用码**
3. `unknown` 与 `ambiguous` **必须分开**（导向不同操作）
4. **任何错误码都不得映射到 0** —— 静默成功是最坏的结果
5. `12` 是产品级特性：让"买了个便宜中转 key"这类场景可以用一行 `if` 判出

> **裁决 D5 的落地**：PRD 的"`3` = 归因不一致"被重映射到 `12`；PRD 的"`4` = 无法判定"被映射到 `10`（并细分出 `11`）；PRD 的"`1` = 运行错误"被拆成 `3`/`4`/`5`。PRD 的全部语义要点都被保留，只是粒度更细。**已 @ 产品经理确认此裁决。**

---

## 6. 可测试的不变量（架构约束）

这些是**机械可检的性质**，不是口号。每条都有对应契约测试。

| 不变量                                            | 断言方式                                                                               | 测试                    |
| ------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------- |
| 实现里不得出现判据阈值字面量                      | `GateCalibration` 是阈值的唯一定义处；扫描实现源码                                     | `purity.test.ts`        |
| 纯模块不得触网 / 读时钟 / 用全局随机 / 读文件系统 | 除 `cli/` `probe/` `config/` `io/` 外的 `src/` 目录静态扫描                            | `purity.test.ts`        |
| 零运行时依赖                                      | `package.json` 的 `dependencies` 必须为空对象                                          | `purity.test.ts`        |
| 不依赖 `node_modules` 布局                        | 源码中不得出现 `require.resolve` / `node_modules` / 自引用包名                         | `decoupling.test.ts`    |
| `auth.json` 只判存在                              | 不得出现在任何读取函数的实参位置                                                       | `privacy.test.ts`       |
| `unknown` 不是错误码                              | `ErrorCode` 联合里不得有 `UNKNOWN`                                                     | `verdict-shape.test.ts` |
| 结论可离线复验                                    | `AttributionVerdict` 不含时间戳与机器信息                                              | `verdict-shape.test.ts` |
| 库哈希确定且与键序无关                            | 固定输入 → 固定期望字符串                                                              | `canonical.test.ts`     |
| 阈值改动可追溯                                    | 阈值文件 sha256 必须出现在 `docs/calibration.md`                                       | 阶段 3 的门禁           |
| 库外夹具零硬归因                                  | `expected.decision === 'unknown'` 被判 `in-library` → **门禁失败，无论总体准确率多高** | 阶段 4 的 L6            |

---

## 7. 分发渠道解耦

owner 已决定走 **GitHub Releases 挂 tarball**，不走 npm。契约据此要求：

- **禁止** `require.resolve('m-trace')` 或任何形式的包名解析定位包根
- **禁止**依赖 `node_modules/m-trace/...` 布局
- **禁止**把 npm 特有字段（`files` / `bin` / `exports` 等）当作运行时配置来源
- 指纹库、i18n 文案、HTML 模板一律按**相对入口文件**的路径解析（`new URL(..., import.meta.url)`）
- 必须能被**打包成单文件**运行
- `toolVersion` 由入口注入，**不读 `package.json`**（单文件包里它可能不存在）
- `bin/m-trace.js` 是静态壳，缺失构建产物时给出可执行的下一步并退出 5，不抛栈

---

## 8. 离线复验契约

报告的结论要能被第三方重跑验证。三个必要条件：

1. **库可被唯一确定**：`bankVersion` + `contentHash` + `calibrationVersion` 三者缺一不可
2. **证据包自带全部输入**：指纹 + 库引用 + 结论原样 + 生成日期（只到天，不到时刻）
3. **规范序列化确定**：`canonicalJson` 的规则见 §3.9，是复验契约的底层原语

**验收方式**：第三方执行 `m-trace verify <evidence.json> --library <bank.json>`，必须得到与证据包内**逐字段相同**的结论。任何差异都是我们的缺陷 —— 报告里给出的复现命令必须允许对方证明这一点。

---

## 9. 诚实性约束（引用分析结论时的强制口径）

分析报告第 9 节列出的未验证项，**必须**在契约与所有下游产物中一并带上置信度限制：

- **未对真实在线服务做端到端探测** —— 所有结论基于公开数据集
- **行为指纹（C）与协议层指纹（D）的预期判据是设计目标，不是实测结果**（工程推断，置信度中）
- **文本统计指纹（B）的实际准确率未测**（工程推断，置信度中）
- **未测"同模型跨时间"的指纹稳定性**（数据集内 0 对重复单元格）
- **竞品格局未做系统性市场扫描**（原则性判断，置信度中）

完整转录与逐条落点见 `docs/upstream-limitations.md`。**已实测的数字必须与上游一致，不得四舍五入成更漂亮的数**（`0.921` 不写成"约 95%"）。

---

## 10. 未决与交接

| #   | 事项                                         | 谁                    | 状态                                                             |
| --- | -------------------------------------------- | --------------------- | ---------------------------------------------------------------- |
| O1  | 退出码裁决（D5）需产品经理确认               | 产品经理              | 已 @ 确认                                                        |
| O2  | 挑战套件的具体形态与参数（桶数、范围、长度） | GUCH-362（数据）      | 进行中，不在本契约范围                                           |
| O3  | 判据阈值 T1–T6 的实测冻结                    | GUCH-362 + Analyzer   | 阶段 3，写入 `docs/calibration.md`                               |
| O4  | 指纹库的初始覆盖范围（家族数 × 模型数）      | 待 owner 批复采集预算 | 阻塞于预算决策                                                   |
| O5  | 报告信息架构与视觉方案                       | GUCH-361（设计）      | **已收口**（v1.1，见 §3.10.1；余下 §10 缺口 3/5/6/7/8 同批定形） |
| O6  | 跨时间指纹稳定性实验                         | GUCH-362              | 未排期，分析列为 R4 风险                                         |

**规范实施顺序**（规划文档的一句话总结仍然成立，此处保留并强化）：

> 先把 `TransportPort` 的接口钉死 —— 因为**它是"测试不触网"的全部前提**；
> 再把 `attribute()` 的四值语义与两段式结构钉死 —— 因为**它是"我们不做硬归因"的全部前提**；
> 其余都是围绕这两件事的填充。
