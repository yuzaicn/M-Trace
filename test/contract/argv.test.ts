/**
 * 契约测试：参数解析（I-03、I-04）。
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { EXIT } from '../../src/types/cli.js';
import { main, parseArgv, renderHelp } from '../../src/cli/entry.js';

const VERSION = '0.0.1';

test('I-04: no subcommand defaults to detect (one command, zero config)', () => {
  const outcome = parseArgv([], VERSION);
  assert.equal(outcome.kind, 'run');
  assert.ok(outcome.kind === 'run');
  assert.equal(outcome.command, 'detect');
});

test('I-04: every declared command parses', () => {
  for (const command of [
    'detect',
    'challenges',
    'score',
    'report',
    'library',
    'doctor',
    'verify',
  ]) {
    const outcome = parseArgv([command], VERSION);
    assert.ok(outcome.kind === 'run', `${command} should parse`);
    assert.ok(outcome.kind === 'run');
    assert.equal(outcome.command, command);
  }
});

test('I-03: an unknown flag is a usage error, never silently ignored', () => {
  const outcome = parseArgv(['--definitely-not-a-flag'], VERSION);
  assert.ok(outcome.kind === 'exit');
  assert.equal(outcome.code, EXIT.USAGE);
  assert.equal(outcome.toStderr, true);
});

test('I-03: an unknown subcommand is a usage error, not a fall-through to detect', () => {
  const outcome = parseArgv(['detct'], VERSION);
  assert.ok(outcome.kind === 'exit');
  assert.equal(outcome.code, EXIT.USAGE);
});

test('I-03: help and version exit 0 on stdout and are bilingual', () => {
  const help = parseArgv(['--help'], VERSION);
  assert.ok(help.kind === 'exit');
  assert.equal(help.code, EXIT.SUCCESS);
  assert.equal(help.toStderr, false);
  assert.match(help.text, /Usage/);
  assert.match(help.text, /用法/);

  const version = parseArgv(['-v'], VERSION);
  assert.ok(version.kind === 'exit');
  assert.equal(version.text, VERSION);
});

test('the help text documents the frozen exit-code matrix', () => {
  const help = renderHelp(VERSION);
  for (const code of [
    EXIT.SUCCESS,
    EXIT.UNKNOWN,
    EXIT.AMBIGUOUS,
    EXIT.MISMATCH,
    EXIT.USAGE,
    EXIT.TRANSPORT,
  ]) {
    assert.match(
      help,
      new RegExp(`\\b${code}\\b`),
      `help must document exit code ${code}`,
    );
  }
});

test('I-03: an unimplemented command exits 5, not 0 — a defined contract is not a working feature', async () => {
  const code = await main(['detect'], VERSION);
  assert.equal(code, EXIT.LOCAL);
});
