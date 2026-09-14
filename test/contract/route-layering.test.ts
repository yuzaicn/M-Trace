/**
 * 契约测试：路线分层（I-11）。
 *
 * 这条测试保护的是**决策链**，不是代码。分析报告的排序是：
 *   A 数字指纹（实测 0.921 / 家族 1.000）→ P0 唯一必实现路线
 *   C 行为指纹 + D 协议指纹（未实测，工程推断）→ P1 交叉验证层
 *   B 文本统计指纹（未实测，信噪比不足）→ P2 仅留扩展位
 *
 * 如果实现期有人把 C/D/B 当成"也要做"的东西铺开，这组断言会失败。
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { readRepoFile } from '../helpers/repo.js';

const CLI_SOURCE = 'src/types/cli.ts';
const PROBE_SOURCE = 'src/types/probe.ts';
const ATTRIBUTE_SOURCE = 'src/types/attribute.ts';
const FINGERPRINT_SOURCE = 'src/types/fingerprint.ts';

test('I-11: the challenge-family descriptor carries an explicit priority', async () => {
  const src = await readRepoFile(PROBE_SOURCE);
  assert.match(
    src,
    /priority:\s*'P0'\s*\|\s*'P1'\s*\|\s*'P2'/,
    'families must declare a priority',
  );
  assert.match(
    src,
    /status:\s*'implemented'\s*\|\s*'reserved'/,
    'families must distinguish implemented from reserved, so "reserved" cannot be mistaken for "done"',
  );
});

test('I-11: families are optional dimensions, never filled with placeholder numbers', async () => {
  const src = await readRepoFile(FINGERPRINT_SOURCE);
  assert.match(
    src,
    /families:\s*FamilyFeatures\[\]/,
    'families must be an array — an absent family must be ABSENT, not zero-filled',
  );
  assert.match(
    src,
    /absent/i.test(src) ? /absent/i : /缺席/,
    'the contract text must state that a missing feature key means "not computable", not 0',
  );
});

test('I-11: evidence items are tagged with their route priority', async () => {
  const src = await readRepoFile(ATTRIBUTE_SOURCE);
  assert.match(
    src,
    /priority:\s*'P0'\s*\|\s*'P1'\s*\|\s*'P2'/,
    'each evidence item must carry its priority so the report can label cross-checks honestly',
  );
});

test('I-11: transport features are collected at P0 but not required to decide', async () => {
  const src = await readRepoFile(FINGERPRINT_SOURCE);
  assert.match(src, /interface TransportFeatures/);
  assert.match(
    src,
    /P0 只要求它们\*\*被采集并记录\*\*/,
    'the contract must say transport features are recorded at P0 and only weighted at P1 — ' +
      'otherwise implementers will either skip them or over-weight them',
  );
});

test('I-11: the credibility layer is specified as a separate, pre-attribution stage', async () => {
  const src = await readRepoFile('src/types/credibility.ts');
  assert.match(src, /chi-square-over-df/);
  assert.match(src, /lag1-autocorrelation/);
  assert.match(
    src,
    /零参考库|不需要参考库/,
    'the credibility layer must be documented as reference-bank-free — that is exactly why it ' +
      'works on out-of-bank models',
  );
});

test('I-11: the CLI surface stays small enough for a frozen first version', async () => {
  const src = await readRepoFile(CLI_SOURCE);
  const commands = src.match(/export type CliCommand =([\s\S]*?);/);
  assert.ok(commands, 'CliCommand union must exist');
  const listed = commands[1]!.split('|').filter((line) => line.includes("'"));
  assert.ok(
    listed.length <= 8,
    `CLI has ${listed.length} commands; the frozen first version should stay small`,
  );
});
