/**
 * 契约测试：隐私红线（I-08）与报告安全（I-14）。
 *
 * 法务 R12：密钥、令牌、账号标识、session 原始内容、用户名路径
 * **绝不进入报告、日志或终端输出**。
 *
 * 分析报告给了一条可静态检查的硬约束：
 * `auth.json` 只做存在性判断，**永不 readFile**。
 * 那是本组最重要的一条断言。
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { collectTypeScriptSources, readRepoFile } from '../helpers/repo.js';

test('I-08: auth.json is only ever existence-checked, never read', async () => {
  const sources = (await collectTypeScriptSources()).map(({ rel, text }) => ({
    name: rel,
    text,
  }));
  for (const { name, text } of sources) {
    if (!text.includes('auth.json')) continue;
    // 允许在同一段契约文字里提到它，但不允许把它交给一个读取函数。
    assert.ok(
      !/readTextFile\([^)]*auth\.json/.test(text),
      `${name}: auth.json must never be passed to a reader — it holds API keys and refresh tokens`,
    );
    assert.ok(
      !/readFile\([^)]*auth\.json/.test(text),
      `${name}: auth.json must never be passed to readFile`,
    );
  }
});

test('I-08: the config port exposes a narrow surface, so audited reads stay auditable', async () => {
  const config = await readRepoFile('src/types/config.ts');
  assert.match(config, /export interface ConfigFsPort/);
  assert.match(config, /exists\(path: string\): Promise<boolean>/);
  assert.ok(
    /auth\.json` \*\*只允许经由此方法被访问\*\*|`auth\.json` 只允许经由此方法被访问/.test(
      config,
    ) || /只允许经由此方法被访问/.test(config),
    'the contract must name the existence check as the only permitted route to auth.json',
  );
  const portBlock = config.slice(
    config.indexOf('export interface ConfigFsPort'),
  );
  assert.match(
    portBlock,
    /exists\(path: string\): Promise<boolean>/,
    'ConfigFsPort must expose an explicit existence check',
  );
  assert.ok(
    /只允许经由/.test(portBlock.split('readTextFile')[0] ?? ''),
    'the auth.json restriction must be documented on the existence check, before readTextFile',
  );
});

test('I-08: the config summary is the only credential-bearing type, and it is kept out of reports', async () => {
  const config = await readRepoFile('src/types/config.ts');
  assert.ok(
    /不得\*\*出现在 `ReportViewModel`/.test(config),
    'ConfigSummary must be explicitly excluded from the report view model',
  );

  const report = await readRepoFile('src/types/report.ts');
  assert.ok(
    !/credential/.test(report),
    'the report view model must not even have a field for a credential',
  );
  assert.match(
    report,
    /endpointDisplay:\s*string/,
    'reports must carry the redacted endpoint form only',
  );
});

test('I-14: the report is script-free and offline by construction', async () => {
  const report = await readRepoFile('src/types/report.ts');
  assert.ok(
    /零 `<script>` 执行逻辑|不得出现任何 `<script>` 执行逻辑/.test(report),
    'the report must contain no executable script — this removes an entire XSS class',
  );
  assert.ok(
    /不得出现任何 `http:\/\/` \/ `https:\/\/` 外部资源引用/.test(report),
    'the report must reference no external resources, so it works offline and leaks nothing',
  );
  assert.match(
    report,
    /REPORT_MAX_BYTES/,
    'the size ceiling must be a named constant, not a magic number',
  );
});

test('I-14: the report self-check asserts zero leaks and zero external references', async () => {
  const report = await readRepoFile('src/types/report.ts');
  assert.match(report, /leakHits:\s*Array</);
  assert.match(report, /externalRefs:\s*number/);
  assert.match(report, /SelfCheckReport/);
});

test('I-14: limitations and disclaimers cannot be empty — they are P0 and legal requirements', async () => {
  const report = await readRepoFile('src/types/report.ts');
  assert.ok(
    /limitations\]\.length|不可为空/.test(report),
    'limitations must be declared non-empty (product P0-7 / legal R13)',
  );
  assert.match(report, /disclaimerKeys:\s*string\[\]/);
});

test('I-08: redaction is a declared port, not an ad-hoc string replace', async () => {
  const common = await readRepoFile('src/types/common.ts');
  assert.match(common, /export type Redactor = \(raw: string\) => string/);
  assert.ok(
    /幂等/.test(common),
    'the redactor must be idempotent, otherwise double-redaction corrupts the output',
  );
});
