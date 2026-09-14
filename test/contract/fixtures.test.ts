/**
 * 夹具清单的契约测试（I-15）。
 *
 * 夹具目录在真实数据到位前只有 schema 与占位样例，但**清单本身就是契约**：
 * 它规定了"哪些攻击必须有一条夹具"。这条测试保证清单不被人悄悄删项 ——
 * 尤其保证「库外模型必须落到 unknown」这条的回归点始终存在。
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { readRepoFile } from '../helpers/repo.js';

interface AdversarialCase {
  caseId: string;
  expected: { decision: string; abstention?: string; exitCode?: number };
}

interface AdversarialFile {
  schemaVersion: number;
  cases: AdversarialCase[];
}

async function loadAdversarial(): Promise<AdversarialFile> {
  return JSON.parse(
    await readRepoFile('test/fixtures/adversarial/cases.json'),
  ) as AdversarialFile;
}

test('I-15: the adversarial suite always contains an out-of-library case', async () => {
  const file = await loadAdversarial();
  const outOfLibrary = file.cases.find(
    (c) => c.caseId === 'out-of-library-model',
  );
  assert.ok(
    outOfLibrary,
    'the out-of-library case is the regression point for the project hard constraint; it must ' +
      'never be removed from the fixture list',
  );
  assert.equal(
    outOfLibrary.expected.decision,
    'unknown',
    'an out-of-library model must abstain — hard attributing it to the nearest bank entry is the ' +
      'exact defect this project exists to fix',
  );
});

test('I-15: only cases whose evidence survives intact may still attribute', async () => {
  const file = await loadAdversarial();
  const positives = file.cases.filter(
    (c) => c.expected.decision === 'in-library',
  );
  // 两个合法例外：
  //  - fenced-json-tolerated：只有包装层差异，观测分布未变；
  //  - self-report-conflict：端点自报撒谎，但**输出本身**仍是真实采样，
  //    所以归因成立、只是退出码抬到 12。自报永不参与判定（E08）。
  assert.deepEqual(
    positives.map((c) => c.caseId).sort(),
    ['fenced-json-tolerated', 'self-report-conflict'],
    'any attack that alters the observed distribution must abstain, otherwise the tool is guessing',
  );

  const spoof = file.cases.find((c) => c.caseId === 'self-report-conflict');
  assert.ok(spoof, 'the self-report spoofing case must stay in the suite');
  assert.equal(
    spoof.expected.exitCode,
    12,
    'a self-report conflict must still be reported — that is the CI signal for a downgraded channel',
  );
});

test('I-15: the attacks named in the analysis are all represented', async () => {
  const file = await loadAdversarial();
  const attackIds = new Set(file.cases.map((c) => c.caseId));
  for (const required of [
    'out-of-library-model',
    'uniform-resampled',
    'additive-jitter-sigma2',
    'gateway-rewritten-prose',
  ]) {
    assert.ok(
      attackIds.has(required),
      `${required} is a measured evasion path (analysis report §2.3) and must keep a fixture`,
    );
  }
});

test('I-15: every abstention names a reason from the frozen set', async () => {
  const file = await loadAdversarial();
  const allowed = new Set([
    'insufficient-evidence',
    'implausible-as-sampling',
    'out-of-library',
    'candidates-not-separable',
    'library-unusable',
    'extractor-mismatch',
    'content-rewritten',
    'partial-run',
  ]);
  for (const c of file.cases) {
    if (c.expected.decision === 'in-library') continue;
    assert.ok(
      c.expected.abstention,
      `${c.caseId}: an abstaining case must name its reason`,
    );
    assert.ok(
      allowed.has(c.expected.abstention),
      `${c.caseId}: abstention ${c.expected.abstention} is not in the frozen set`,
    );
  }
});

test('I-15: the intent manifest registers every contract clause with a test', async () => {
  const manifest = JSON.parse(
    await readRepoFile('test/fixtures/contract-intents.json'),
  );
  assert.ok(Array.isArray(manifest.intents), 'the manifest must list intents');
  assert.ok(
    manifest.intents.length >= 14,
    'the frozen contract has at least 14 checkable intents',
  );
  for (const intent of manifest.intents) {
    assert.match(
      intent.id,
      /^I-\d+$/,
      'intent ids must be stable and citable in the contract doc',
    );
    assert.ok(
      intent.clause.length > 0,
      `${intent.id} must cite the clause it protects`,
    );
    assert.ok(
      intent.test.length > 0,
      `${intent.id} must name the test that proves it`,
    );
  }
});

test('I-15: the sample bank fixture keeps thresholds out of reach of the implementation', async () => {
  const bank = JSON.parse(
    await readRepoFile('test/fixtures/golden/sample-bank/library.json'),
  );
  assert.ok(
    bank.calibration,
    'the fixture bank must carry calibration — thresholds come from data',
  );
  assert.ok(
    bank.calibration.credibility?.ranges,
    'credibility ranges must live in the bank, not in code',
  );
  assert.equal(
    bank.schemaVersion,
    1,
    'the fixture bank must declare the schema version it conforms to, so an incompatible loader ' +
      'is exercised',
  );
});

test('I-15: the golden fixture declares the three hard acceptance rules', async () => {
  const expect = JSON.parse(
    await readRepoFile('test/fixtures/golden/sample-in-library/expect.json'),
  );
  assert.ok(
    expect.acceptance?.zeroFalseAttribution,
    'zero false attribution must be a fixture rule',
  );
  assert.ok(
    expect.acceptance?.stability,
    'byte-stable repeat runs must be a fixture rule',
  );
  assert.ok(
    expect.acceptance?.noMagicThresholds,
    'thresholds-from-the-bank must be a fixture rule',
  );
});
