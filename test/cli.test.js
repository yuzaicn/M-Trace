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

test('collector CLI rejects tunnel provenance without Node env-proxy support', async () => {
  await assert.rejects(
    execFileAsync(
      process.execPath,
      [
        new URL('../bin/m-trace-collect.js', import.meta.url).pathname,
        '--transport',
        'tunnel',
      ],
      {
        encoding: 'utf8',
        env: {
          ...process.env,
          OPENAI_API_KEY: 'test-only-key',
          HTTPS_PROXY: '',
          https_proxy: '',
        },
      },
    ),
    /tunnel transport requires node --use-env-proxy and HTTPS_PROXY/,
  );
});
