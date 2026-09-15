#!/usr/bin/env node
/**
 * 可执行壳 / Executable shim.
 *
 * 存在的唯一理由是：`bin` 需要是一个**静态**文件，而实现是 TypeScript。
 * 本文件不含任何业务逻辑，也不做路径魔法 —— 它按**相对自身**的位置
 * 解析编译产物，因此能被 `npx`、GitHub Releases 解包、或直接拷贝运行，
 * 三种场景行为一致（契约 §7「与分发渠道解耦」）。
 *
 * 解析失败时给出可执行的下一步，而不是抛一个栈。
 */

import { access } from 'node:fs/promises';

const entryUrl = new URL('../dist/src/cli/entry.js', import.meta.url);

try {
  await access(entryUrl);
} catch {
  process.stderr.write(
    'm-trace: build output not found / 未找到构建产物: dist/src/cli/entry.js\n' +
      'Run the build first / 请先执行构建: npm run build\n',
  );
  process.exit(5);
}

const { main } = await import(entryUrl.href);
const { readFile } = await import('node:fs/promises');
const pkgUrl = new URL('../package.json', import.meta.url);
const { version } = JSON.parse(await readFile(pkgUrl, 'utf8'));

process.exitCode = await main(process.argv.slice(2), version);
