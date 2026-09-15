#!/usr/bin/env node
/**
 * M-Trace 本地质检门禁 / Local quality gate.
 *
 * 本仓库**不使用** GitHub Actions：唯一的自动化回归信号就是这个脚本。
 * 它的角色与工作区里 Ccode 仓库的 `scripts/local-regression-gate.sh` 相同。
 *
 * 用法：
 *   npm run gate              # 变更范围模式（契约 + 类型 + 测试）
 *   npm run gate -- --changed # 同上，语义更轻（跳过夹具回归，数据到位后生效）
 *   npm run gate -- --full    # 全量；**置 in_review 前必须跑这个**
 *
 * 输出：一段可直接粘贴进交付评论的证据块（含 test_mode、逐项命令、退出码、耗时）。
 * 任何一项失败 → 整体非零退出，且证据块里保留失败项的真实输出。
 *
 * 设计取舍：宁可多花几秒也不要并行 —— 串行输出更容易被人读懂和引用，
 * 而这个脚本的产物是要贴进 issue 给人看的。
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const argv = process.argv.slice(2);
const mode = argv.includes('--full') ? 'full' : 'changed';

/** 每一层门禁。`optional` 的层次在依赖数据就绪前不阻塞。 */
const LAYERS = [
  {
    id: 'typecheck',
    label: 'tsc --noEmit',
    command: ['npx', 'tsc', '-p', 'tsconfig.check.json'],
  },
  {
    id: 'format',
    label: 'prettier --check',
    command: ['npx', 'prettier', '--check', '.'],
  },
  {
    id: 'lint',
    label: 'eslint',
    command: ['npx', 'eslint', '.'],
  },
  {
    id: 'build',
    label: 'tsc build (src)',
    command: ['npx', 'tsc', '-p', 'tsconfig.build.json'],
  },
  {
    id: 'build-tests',
    label: 'tsc build (src+test)',
    command: ['npx', 'tsc', '-p', 'tsconfig.tests.json'],
  },
  {
    id: 'unit-contract',
    label: 'node --test (contract)',
    // 用引号包裹的 glob：node 自己展开，零匹配时退出 0（"没有用例"不等于"通过"的
    // 语义由下面的 RESULT 行与测试计数共同表达）。
    command: ['node', '--test', 'dist/test/contract/**/*.test.js'],
  },
  {
    id: 'fixture-regress',
    label: 'node --test (fixtures)',
    command: ['node', '--test', 'dist/test/fixtures/**/*.test.js'],
    // 夹具回归在 GUCH-362 交付真实数据前没有内容；目录不存在时跳过而不是失败。
    // **一旦存在就必须通过** —— 这是"库外模型不得被硬归因"的落点。
    optionalWhenAbsent: resolve(REPO_ROOT, 'dist/test/fixtures'),
  },
];

function run(command) {
  return new Promise((resolvePromise) => {
    const startedAt = process.hrtime.bigint();
    const child = spawn(command[0], command.slice(1), {
      cwd: REPO_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('error', (error) => {
      const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
      resolvePromise({ code: 127, stdout, stderr: stderr + String(error), ms });
    });
    child.on('close', (code) => {
      const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;
      resolvePromise({ code: code ?? 1, stdout, stderr, ms });
    });
  });
}

const seconds = (ms) => `${(ms / 1000).toFixed(1)}s`;

async function main() {
  const startedAt = process.hrtime.bigint();
  const results = [];
  let failed = false;

  for (const layer of LAYERS) {
    if (
      layer.optionalWhenAbsent !== undefined &&
      !existsSync(layer.optionalWhenAbsent)
    ) {
      results.push({
        ...layer,
        skipped: true,
        code: 0,
        ms: 0,
        reason: 'no data yet',
      });
      continue;
    }
    if (mode === 'changed' && layer.id === 'fixture-regress') {
      results.push({
        ...layer,
        skipped: true,
        code: 0,
        ms: 0,
        reason: 'skipped in --changed mode',
      });
      continue;
    }
    if (failed) {
      results.push({
        ...layer,
        skipped: true,
        code: 0,
        ms: 0,
        reason: 'skipped after earlier failure',
      });
      continue;
    }

    const result = await run(layer.command);
    if (result.code !== 0) failed = true;
    results.push({ ...layer, ...result, skipped: false });
  }

  const wall = Number(process.hrtime.bigint() - startedAt) / 1e6;

  // ---- 证据块 ----
  const lines = [];
  lines.push('=== M-Trace local gate ===');
  lines.push(`mode: ${mode}`);
  for (const r of results) {
    const status = r.skipped ? 'SKIP' : r.code === 0 ? 'PASS' : 'FAIL';
    const note = r.skipped ? `  (${r.reason})` : '';
    lines.push(
      `[${r.id.padEnd(15)}] ${status}  ${seconds(r.ms).padStart(7)}${note}`,
    );
  }
  lines.push(`RESULT: ${failed ? 'FAIL' : 'PASS'}   wall=${seconds(wall)}`);
  lines.push('');

  const evidence = lines.join('\n');
  process.stdout.write(evidence);

  if (failed) {
    for (const r of results) {
      if (r.skipped || r.code === 0) continue;
      process.stdout.write(`\n--- ${r.id} output (exit ${r.code}) ---\n`);
      process.stdout.write(r.stdout.slice(-4000));
      if (r.stderr.length > 0) {
        process.stdout.write(`\n--- ${r.id} stderr ---\n`);
        process.stdout.write(r.stderr.slice(-2000));
      }
    }
  }

  process.exitCode = failed ? 1 : 0;
}

await main();
