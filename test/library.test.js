import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
    vendor: 'OpenAI',
    modelId: 'synthetic-a',
    modelFamily: 'gpt-5.5',
    samplingSource: 'provider-default',
    requestShape: 'openai-reasoning-chat-completions',
    effort: 'none',
    generationOptions: { reasoning_effort: 'none' },
    usage: null,
    systemFingerprint: null,
    collectedAt: '2026-09-14T00:00:00.000Z',
    environments: [
      { environmentId: 'direct', wireFormat: 'openai', sampleCount: 3 },
    ],
    fingerprint: { method: 'polynomial-adaptive-v1' },
    calibration: {
      maxDistance: 0.2,
      minMargin: 0.02,
      minRelativeMargin: 0.1,
      distanceScale: 0.05,
      nuisanceDirections: [],
      frozenAt: '2026-09-14T00:00:00.000Z',
      sampleCount: 3,
    },
  };
  entry.contentHash = contentHash(entry);
  const bank = {
    schemaVersion: '1.1',
    bankVersion: '2026.09.1',
    extractorVersion: '1.0.0',
    suiteVersion: '2.0.0',
    contentHash: '',
    entries: [entry],
  };
  bank.contentHash = contentHash(bank);
  return bank;
}

test('validates nested hashes and supports selecting entries', () => {
  const bank = fixture();
  assert.equal(validateBank(bank), bank);
  assert.equal(selectEntries(bank, { modelFamily: 'gpt-5.5' }).length, 1);
});

test('published JSON schema pins Suite 2 and all required additions', async () => {
  const schema = JSON.parse(
    await readFile(
      new URL('../schemas/reference-bank.schema.json', import.meta.url),
      'utf8',
    ),
  );
  assert.equal(schema.properties.schemaVersion.const, '1.1');
  assert.equal(schema.properties.extractorVersion.const, '1.0.0');
  assert.equal(schema.properties.suiteVersion.const, '2.0.0');
  assert.deepEqual(schema.$defs.entry.properties.modelFamily.enum, [
    'gpt-5.5',
    'gpt-5.6',
    'gpt-6',
  ]);
  for (const field of [
    'minRelativeMargin',
    'distanceScale',
    'nuisanceDirections',
  ]) {
    assert.ok(
      schema.$defs.entry.properties.calibration.required.includes(field),
    );
  }
  for (const field of [
    'samplingSource',
    'requestShape',
    'effort',
    'generationOptions',
    'usage',
    'systemFingerprint',
  ]) {
    assert.ok(schema.$defs.entry.required.includes(field));
  }
});

test('rejects schema, suite, extractor, provenance, family, and calibration drift', () => {
  for (const [mutate, pattern] of [
    [(bank) => (bank.schemaVersion = '1.0'), /schemaVersion/],
    [(bank) => (bank.suiteVersion = '1.0.0'), /suiteVersion mismatch/],
    [(bank) => (bank.extractorVersion = '2.0.0'), /extractorVersion mismatch/],
    [
      (bank) => (bank.entries[0].modelFamily = 'OpenAI'),
      /modelFamily is unsupported/,
    ],
    [
      (bank) => (bank.entries[0].samplingSource = 'challenge-parameter'),
      /samplingSource must be provider-default/,
    ],
    [
      (bank) => delete bank.entries[0].calibration.minRelativeMargin,
      /minRelativeMargin/,
    ],
    [
      (bank) => delete bank.entries[0].calibration.nuisanceDirections,
      /nuisanceDirections/,
    ],
    [
      (bank) => (bank.entries[0].aliases = ['gpt-alias', 'gpt-alias']),
      /aliases contains duplicates/,
    ],
  ]) {
    const bank = fixture();
    mutate(bank);
    assert.throws(() => validateBank(bank, { verifyHashes: false }), pattern);
  }
});

test('rejects mutation and bank-version drift', () => {
  const mutated = fixture();
  mutated.entries[0].modelId = 'changed';
  assert.throws(() => validateBank(mutated), /contentHash mismatch/);
  const drifted = fixture();
  drifted.entries[0].bankVersion = '2026.10.1';
  assert.throws(() => validateBank(drifted), /bankVersion mismatch/);
});
