/**
 * 契约测试：纯度与无魔法数字（I-05、I-06）。
 *
 * 两条都是**架构约束**，在实现期最容易被便利性侵蚀，因此提前钉住：
 *
 *  - I-05：判据阈值只能来自参考库的 `GateCalibration`。
 *    如果实现里能搜到阈值字面量，那么"改阈值要重新校准并留证据"这条流程就会失效 ——
 *    有人会直接改代码。
 *
 *  - I-06：除了显式声明为"有副作用"的模块，其余模块不得触网、不得读时钟、
 *    不得用全局随机、不得直接读文件系统。
 *    这是"同一份证据跑出同一结论"的机械保证。
 *
 * **扫描对象是去注释后的代码**（`code`），不是原始文本：
 * 契约的注释里会写着「不要用 `Date.now()`」，朴素的字符串搜索会把说明当成违规，
 * 然后维护者只能删掉断言 —— 那等于保护没了。
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { collectTypeScriptSources, readRepoFile } from '../helpers/repo.js';
import { stripCommentsAndStrings } from '../helpers/scan.js';

/** 允许有副作用的目录（相对 src/）。其他目录一律视为纯。 */
const IMPURE_DIRS = ['cli/', 'probe/', 'config/', 'io/'];

const isImpure = (rel: string): boolean =>
  IMPURE_DIRS.some((d) => rel.startsWith(d));

test('I-06: pure modules never touch the network', async () => {
  for (const { rel, code } of await collectTypeScriptSources()) {
    if (isImpure(rel)) continue;
    assert.ok(
      !/\bfetch\s*\(/.test(code),
      `${rel}: fetch() is only allowed in probe/`,
    );
    assert.ok(
      !/from\s+'node:http'|from\s+'node:https'|from\s+'node:net'/.test(code),
      `${rel}: no network modules in pure code`,
    );
  }
});

test('I-06: pure modules never read the clock or global randomness', async () => {
  for (const { rel, code } of await collectTypeScriptSources()) {
    if (isImpure(rel)) continue;
    assert.ok(
      !/Date\.now\s*\(/.test(code),
      `${rel}: Date.now() must be injected as a Clock`,
    );
    assert.ok(
      !/new Date\s*\(\s*\)/.test(code),
      `${rel}: argless new Date() is non-deterministic`,
    );
    assert.ok(
      !/Math\.random\s*\(/.test(code),
      `${rel}: Math.random() must be injected as rng`,
    );
  }
});

test('I-06: pure modules never read the filesystem directly', async () => {
  for (const { rel, code } of await collectTypeScriptSources()) {
    if (isImpure(rel)) continue;
    assert.ok(
      !/from\s+'node:fs'|from\s+'node:fs\/promises'/.test(code),
      `${rel}: filesystem access belongs behind a port (ConfigFsPort / CliIO / LoadCatalog)`,
    );
  }
});

test('I-06: the contract names probe/ as the single network surface', async () => {
  const text = await readRepoFile('src/types/probe.ts');
  assert.match(
    text,
    /唯一\*\*触网/,
    'the probe types must declare themselves the only network surface — that is what makes ' +
      '"tests never touch the network" a checkable property',
  );
  assert.match(text, /export interface TransportPort/);
});

test('I-06: every directory holding side effects is listed in the impurity allow-list', async () => {
  const dirs = new Set(
    (await collectTypeScriptSources())
      .map(({ rel }) => rel.split('/')[0])
      .filter((d): d is string => d !== undefined),
  );
  for (const dir of ['io', 'cli', 'probe', 'config']) {
    if (dirs.has(dir)) {
      assert.ok(
        IMPURE_DIRS.some((d) => d.startsWith(dir)),
        `${dir}/ exists and performs side effects; it must be listed in IMPURE_DIRS so the ` +
          'purity scans stop treating it as pure',
      );
    }
  }
});

test('I-05: validation thresholds live in the library, not in code', async () => {
  const library = await readRepoFile('src/types/library.ts');
  assert.match(library, /export interface GateCalibration/);
  for (const field of [
    'maxDistance',
    'minMargin',
    'minRelativeMargin',
    'minConfidence',
    'maxDistanceFamily',
    'minValidRatio',
    'minFamilySamples',
    'minGradeForAttribution',
  ]) {
    assert.ok(library.includes(field), `GateCalibration must define ${field}`);
  }
  assert.ok(
    /不得有字面量|不得出现这些数值的字面量/.test(library),
    'the contract must forbid threshold literals in implementation code',
  );
});

test('I-05: no threshold literal has leaked into implementation code', async () => {
  const suspicious = [
    /\bmaxDistance\s*[:=]\s*\d/,
    /\bminMargin\s*[:=]\s*\d/,
    /\bminConfidence\s*[:=]\s*\d/,
    /\bminValidRatio\s*[:=]\s*\d/,
  ];
  for (const { rel, code } of await collectTypeScriptSources()) {
    if (rel.startsWith('types/')) continue;
    for (const pattern of suspicious) {
      assert.ok(
        !pattern.test(code),
        `${rel}: a threshold literal appeared outside the reference bank; thresholds must be ` +
          'calibrated from data and stored in the bank, never hard-coded',
      );
    }
  }
});

test('I-05: the credibility policy is part of the library calibration, not a constant', async () => {
  const library = await readRepoFile('src/types/library.ts');
  assert.match(
    library,
    /credibility:\s*import\('\.\/credibility\.js'\)\.CredibilityPolicy/,
    'credibility ranges must be calibrated from data and stored in the bank, never hard-coded',
  );

  const credibility = await readRepoFile('src/types/credibility.ts');
  assert.match(credibility, /acceptRange:\s*readonly \[number, number\]/);
  assert.ok(
    /不得出现这些数值的字面量|全部来自参考库/.test(credibility),
    'the credibility layer must read its ranges from the bank',
  );
});

test('I-05: the stats core is declared dependency-free', async () => {
  const stats = await readRepoFile('src/types/stats.ts');
  assert.ok(
    /自实现/.test(stats),
    'the statistical core must be self-implemented — a poisoned dependency in a tool that ' +
      'adjudicates model identity is an unacceptable supply-chain risk',
  );
  const pkg = JSON.parse(await readRepoFile('package.json'));
  assert.deepEqual(
    pkg.dependencies ?? {},
    {},
    'runtime dependencies must stay empty (ADR-001); devDependencies are unrestricted',
  );
});

test('the scanner itself is not fooled by comments or doc strings', () => {
  // 模拟真实情况：说明文字里写了被禁的调用。
  const sample = [
    "    // 实现里不得使用 require.resolve('m-trace')",
    '    /* 也不要用 Math.random() 或 Date.now() */',
    "    const doc = 'never call fetch( directly in pure code';",
    '    export function ok(): number { return 1; }',
  ].join('\n');
  const code = stripCommentsAndStrings(sample);
  assert.ok(
    !/require\.resolve/.test(code),
    'comment text must not reach the code view',
  );
  assert.ok(
    !/Math\.random/.test(code),
    'block comment text must not reach the code view',
  );
  assert.ok(
    !/fetch\s*\(/.test(code),
    'string literal contents must not reach the code view',
  );
  assert.match(code, /export function ok/, 'real code must survive the strip');

  // 但真正的违规仍必须被看见。
  const real = 'export const x = require.resolve("m-trace");';
  assert.ok(/require\.resolve/.test(stripCommentsAndStrings(real)));
});
