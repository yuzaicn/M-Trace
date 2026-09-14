#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const packageJson = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url), 'utf8'),
);

const help = `m-trace ${packageJson.version}

Trace and verify the model identity behind AI coding interactions.
追踪并验证 AI 编程交互背后的模型身份。

Usage / 用法:
  m-trace [options] / [选项]

Options / 选项:
  -h, --help       Show this bilingual help / 显示中英双语帮助
  -v, --version    Show version / 显示版本号`;

const args = process.argv.slice(2);

if (args.includes('--version') || args.includes('-v')) {
  console.log(packageJson.version);
} else {
  console.log(help);
}
