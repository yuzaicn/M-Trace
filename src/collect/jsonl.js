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
    const consecutive429ByChallenge = {};
    const pendingWaitByChallenge = {};
    for (const line of text.split('\n').filter(Boolean)) {
      const record = JSON.parse(line);
      if (record.recordType === 'raw-probe-v1') {
        delete consecutive429ByChallenge[record.request?.challengeId];
        delete pendingWaitByChallenge[record.request?.challengeId];
        continue;
      }
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
      if (checkpoint.phase === 'before-wait' && checkpoint.challengeId) {
        consecutive429ByChallenge[checkpoint.challengeId] =
          Number(checkpoint.consecutive429Count) ||
          (consecutive429ByChallenge[checkpoint.challengeId] ?? 0) + 1;
        pendingWaitByChallenge[checkpoint.challengeId] = checkpoint;
      } else if (checkpoint.phase === 'after-wait' && checkpoint.challengeId) {
        delete pendingWaitByChallenge[checkpoint.challengeId];
      } else if (
        ['quota-exhausted', 'wait-cancelled'].includes(checkpoint.phase) &&
        checkpoint.challengeId
      ) {
        delete consecutive429ByChallenge[checkpoint.challengeId];
        delete pendingWaitByChallenge[checkpoint.challengeId];
      }
    }
    return {
      cumulativeWaitMs,
      retry429Count,
      consecutive429ByChallenge,
      pendingWaitByChallenge,
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        cumulativeWaitMs: 0,
        retry429Count: 0,
        consecutive429ByChallenge: {},
        pendingWaitByChallenge: {},
      };
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
