/**
 * 契约测试：与分发渠道解耦（I-07）。
 *
 * owner 已决定走 GitHub Releases 挂 tarball，而不是 npm。
 * 契约据此要求：**不得**假设包被安装在 `node_modules` 下。
 * 这条约束很容易在实现期被一句 `require.resolve` 破坏，所以用断言钉住。
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { collectTypeScriptSources, readRepoFile } from '../helpers/repo.js';

test('I-07: no source file resolves a package root by name', async () => {
  const sources = (await collectTypeScriptSources()).map(({ rel, code }) => ({
    path: rel,
    code,
  }));
  assert.ok(sources.length > 0, 'expected to find sources under src/');

  for (const { path, code } of sources) {
    assert.ok(
      !code.includes('require.resolve('),
      `${path}: require.resolve() assumes a node_modules layout — resolve relative to import.meta.url instead`,
    );
    assert.ok(
      !/from\s+'m-trace'/.test(code) && !/from\s+'m-trace\//.test(code),
      `${path}: self-referential package imports break when the tarball is unpacked anywhere`,
    );
    assert.ok(
      !/node_modules/.test(code),
      `${path}: the contract forbids depending on the node_modules layout`,
    );
  }
});

test('I-07: resource paths are resolved relative to the importing module', async () => {
  const entry = await readRepoFile('src/cli/entry.ts');
  assert.match(
    entry,
    /new URL\(/,
    'the entry point must resolve resources with new URL(..., import.meta.url)',
  );
  assert.match(
    entry,
    /import\.meta\.url/,
    'import.meta.url is the only anchor that survives relocation',
  );
});

test('I-07: the executable shim resolves the build output relative to itself', async () => {
  const shim = await readRepoFile('bin/m-trace.js');
  assert.match(
    shim,
    /new URL\('\.\.\/dist\//,
    'bin shim must locate dist/ relative to its own file',
  );
  assert.ok(
    /process\.exit\(5\)/.test(shim),
    'a missing build must exit with the local-environment code, not crash with a stack trace',
  );
});

test('I-07: the report model does not read package.json for its version', async () => {
  const report = (await collectTypeScriptSources()).find(
    ({ rel }) => rel === 'types/report.ts',
  );
  assert.ok(report, 'expected to find src/types/report.ts');
  // TS 的 `import('./x.js').T` 是类型位置，不是运行时读取；只禁真正的读取调用。
  assert.ok(
    !/\breadFile|\brequire\s*\(|readFileSync|process\.cwd/.test(report.code),
    'toolVersion must be injected, not read from package.json — that file does not exist in a ' +
      'single-file bundle and is not a runtime configuration surface',
  );
  assert.match(
    report.text,
    /toolVersion:\s*string/,
    'toolVersion must be part of the view model input',
  );
});

test('I-07: i18n catalogs are loaded through injection, not package resolution', async () => {
  const i18n = await readRepoFile('src/types/i18n.ts');
  assert.match(i18n, /LoadCatalog\s*=/);
  assert.ok(
    /相对入口文件/.test(i18n),
    'the contract must state that catalogs resolve relative to the entry file',
  );
});
