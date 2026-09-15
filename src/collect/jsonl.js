import { appendFile, readFile } from 'node:fs/promises';

export async function completedIds(path) {
  try {
    const text = await readFile(path, 'utf8');
    return new Set(
      text
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const record = JSON.parse(line);
          if (record.parseFailure) return undefined;
          return record.request?.challengeId ?? record.challengeId;
        })
        .filter(Boolean),
    );
  } catch (error) {
    if (error.code === 'ENOENT') return new Set();
    throw error;
  }
}

export async function appendJsonLine(path, value) {
  await appendFile(path, `${JSON.stringify(value)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
}
