import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);

test('CLI help includes English, Chinese, and the version', async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    [new URL('../bin/m-trace.js', import.meta.url).pathname, '--help'],
    { encoding: 'utf8' },
  );

  assert.match(stdout, /m-trace 0\.0\.1/);
  assert.match(stdout, /Usage/);
  assert.match(stdout, /用法/);
});
