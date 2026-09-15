import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { contentHash } from '../src/library/schema.js';

const manifestPath = new URL(
  '../data/acceptance-manifest.json',
  import.meta.url,
);

test('acceptance manifest hash, generation groups, strata, and identities are frozen consistently', async () => {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  assert.equal(manifest.contentHash, contentHash(manifest));
  assert.equal(manifest.libraryModels.length, 6);
  assert.equal(manifest.slots.length, 20);
  assert.equal(manifest.availability.length, 20);
  assert.deepEqual(
    manifest.libraryModels.map(({ modelId, family }) => [modelId, family]),
    [
      ['gpt-5.5', 'gpt-5.5'],
      ['gpt-5.5-pro', 'gpt-5.5'],
      ['gpt-5.6-sol', 'gpt-5.6'],
      ['gpt-5.6-terra', 'gpt-5.6'],
      ['gpt-5.6-luna', 'gpt-5.6'],
      ['gpt-6-astra', 'gpt-6'],
    ],
  );

  const strata = manifest.slots.reduce((result, slot) => {
    (result[slot.stratum] ??= []).push(slot);
    return result;
  }, {});
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(strata).map(([stratum, slots]) => [stratum, slots.length]),
    ),
    {
      'unrepresented-hosted-family': 6,
      'represented-family-unrepresented-generation': 6,
      'open-weight-local': 6,
      'routing-or-mixture': 2,
    },
  );

  const libraryIdentities = new Set();
  for (const model of manifest.libraryModels) {
    libraryIdentities.add(model.modelId);
    for (const alias of model.aliases ?? []) libraryIdentities.add(alias);
  }
  assert.equal(
    manifest.slots.some((slot) => libraryIdentities.has(slot.modelId)),
    false,
  );
  assert.deepEqual(
    manifest.availability.map(({ slotId, modelId }) => [slotId, modelId]),
    manifest.slots.map(({ slotId, modelId }) => [slotId, modelId]),
  );
  assert.ok(
    manifest.availability.every(
      (item) =>
        item.probeAt === null && item.probeResult.startsWith('pending-'),
    ),
  );
});
