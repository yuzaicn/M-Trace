import assert from 'node:assert/strict';
import test from 'node:test';
import {
  contentHash,
  selectEntries,
  validateBank,
} from '../src/library/schema.js';

function fixture() {
  const entry = {
    entryId: 'synthetic-a/direct',
    bankVersion: '2026.09.1',
    contentHash: '',
    modelId: 'synthetic-a',
    modelFamily: 'synthetic',
    collectedAt: '2026-09-14T00:00:00.000Z',
    environments: [
      { environmentId: 'direct', wireFormat: 'openai', sampleCount: 3 },
    ],
    fingerprint: { method: 'polynomial-adaptive-v1' },
    calibration: {
      maxDistance: 0.2,
      minMargin: 0.02,
      frozenAt: '2026-09-14T00:00:00.000Z',
      sampleCount: 3,
    },
  };
  entry.contentHash = contentHash(entry);
  const bank = {
    schemaVersion: '1.0',
    bankVersion: '2026.09.1',
    extractorVersion: '1.0.0',
    suiteVersion: '1.0.0',
    contentHash: '',
    entries: [entry],
  };
  bank.contentHash = contentHash(bank);
  return bank;
}

test('validates nested hashes and supports selecting entries', () => {
  const bank = fixture();
  assert.equal(validateBank(bank), bank);
  assert.equal(selectEntries(bank, { modelFamily: 'synthetic' }).length, 1);
});

test('rejects mutation and bank-version drift', () => {
  const mutated = fixture();
  mutated.entries[0].modelId = 'changed';
  assert.throws(() => validateBank(mutated), /contentHash mismatch/);
  const drifted = fixture();
  drifted.entries[0].bankVersion = '2026.10.1';
  assert.throws(() => validateBank(drifted), /bankVersion mismatch/);
});
