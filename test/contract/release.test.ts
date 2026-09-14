/**
 * 契约测试：发布产物的形状（I-16）。
 *
 * owner 已决定走 **GitHub Releases 挂 tarball**，不走 npm。这条测试把
 * "解包到任何地方都能跑"从一句承诺变成可执行的断言 —— 它检查的是**产物本身**：
 *
 *  1. 发布物里只有 `dist/src/`，没有 `dist/test/`（测试不该进用户的磁盘）；
 *  2. `bin/m-trace.js` 在解包后的目录里能定位到编译产物（相对自身，不是相对 cwd）；
 *  3. 运行时依赖为空。
 *
 * 第 2 条最容易在实现期被破坏：任何一句 `process.cwd()` 或包名解析都会让
 * "换个目录就跑不起来"，而那种故障只在用户机器上出现。
 */

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import test from 'node:test';

import { REPO_ROOT, readRepoFile, repoPath } from '../helpers/repo.js';
import { stripCommentsAndStrings } from '../helpers/scan.js';

test('I-16: the executable shim anchors on its own location', async () => {
  const shim = await readRepoFile('bin/m-trace.js');
  const code = stripCommentsAndStrings(shim);
  // 这里要看原始文本：被禁的正是"把路径写成相对路径字符串"这件事本身，
  // 而扫描器为了别的检查已经把字符串内容抹掉了。
  assert.match(
    shim,
    /new URL\(\s*'\.\.\/dist\//,
    'the shim must resolve dist/ relative to itself so the tarball works wherever it is unpacked',
  );
  assert.ok(
    !/process\.cwd\s*\(/.test(code),
    'resolving from process.cwd() breaks as soon as the user runs it from another directory',
  );
});

test('I-16: published artifacts exclude the test build', async () => {
  const pkg = JSON.parse(await readRepoFile('package.json'));
  const files = pkg.files ?? [];
  assert.ok(
    files.includes('dist/src/') || files.includes('dist/src'),
    'the package must publish only the source build; shipping dist/test/ would put the contract ' +
      'suite on every user machine',
  );
  assert.ok(
    !files.some((f: string) => f.startsWith('dist/test')),
    'dist/test must never be published',
  );
  assert.ok(
    files.includes('LICENSE'),
    'MIT requires the license text to travel with the package',
  );
});

test('I-16: the test build and the release build use separate configs', async () => {
  const release = JSON.parse(await readRepoFile('tsconfig.build.json'));
  const tests = JSON.parse(await readRepoFile('tsconfig.tests.json'));
  assert.deepEqual(
    release.include,
    ['src/**/*.ts'],
    'the release build must compile src/ only',
  );
  assert.ok(
    tests.include.includes('test/**/*.ts'),
    'the test build must compile the contract suite into dist/ so node --test can run it',
  );
  assert.equal(release.compilerOptions.outDir, tests.compilerOptions.outDir);
});

test('I-16: runtime dependencies stay empty in the packed manifest', async () => {
  const pkg = JSON.parse(await readRepoFile('package.json'));
  assert.deepEqual(
    pkg.dependencies ?? {},
    {},
    'ADR-001: dependencies must be empty',
  );
  assert.equal(
    pkg.type,
    'module',
    'the package is ESM-only by contract (ADR-002)',
  );
  assert.ok(pkg.bin?.['m-trace'], 'the CLI must be exposed as a bin entry');
});

test('I-16: a built tarball layout resolves from a foreign working directory', async (t) => {
  // 只有在已经构建过的情况下才有意义；未构建时跳过而不是假装通过。
  const distEntry = repoPath('dist/src/cli/entry.js');
  if (!existsSync(distEntry)) {
    t.skip('dist/ not built yet — run npm run build first');
    return;
  }

  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const run = promisify(execFile);

  // 从一个与仓库无关的目录调用，模拟"用户解包后随手跑一下"。
  const { stdout } = await run(
    process.execPath,
    [repoPath('bin/m-trace.js'), '--version'],
    {
      cwd: '/',
      encoding: 'utf8',
    },
  );
  assert.match(
    stdout.trim(),
    /^\d+\.\d+\.\d+/,
    'the shim must report the version from a foreign cwd',
  );
  assert.ok(REPO_ROOT.length > 0);
});
