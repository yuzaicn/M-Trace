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

export async function retryCheckpointState(path) {
  try {
    const text = await readFile(path, 'utf8');
    let cumulativeWaitMs = 0;
    let retry429Count = 0;
    for (const line of text.split('\n').filter(Boolean)) {
      const record = JSON.parse(line);
      if (record.recordType !== 'retry-checkpoint-v1') continue;
      const checkpoint = record.checkpoint ?? {};
      cumulativeWaitMs = Math.max(
        cumulativeWaitMs,
        Number(checkpoint.cumulativeWaitMs) || 0,
      );
      retry429Count = Math.max(
        retry429Count,
        Number(checkpoint.retry429Count) || 0,
      );
    }
    return { cumulativeWaitMs, retry429Count };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { cumulativeWaitMs: 0, retry429Count: 0 };
    }
    throw error;
  }
}

export async function appendJsonLine(path, value) {
  await appendFile(path, `${JSON.stringify(value)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
}
