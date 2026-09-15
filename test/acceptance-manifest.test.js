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
  assert.equal(manifest.status, 'full-collection-partial-rate-limited');
  assert.deepEqual(manifest.collectionRound1.completedByModel, {
    'gpt-5.5-pro': 23,
    'gpt-5.5': 0,
    'gpt-5.6-sol': 0,
    'gpt-5.6-terra': 0,
    'gpt-5.6-luna': 0,
    'gpt-6-astra': 0,
  });
  assert.equal(manifest.libraryModels.length, 6);
  assert.equal(manifest.slots.length, 8);
  assert.equal(manifest.availability.length, 8);
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
      'represented-family-unrepresented-generation': 6,
      'routing-endpoint': 2,
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
  assert.ok(
    manifest.slots.every(
      ({ vendor, source }) =>
        vendor === 'OpenAI' || source === 'routing-endpoint',
    ),
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
  const libraryProbeStates = Object.fromEntries(
    manifest.libraryModels.map(({ modelId, probeResult }) => [
      modelId,
      probeResult,
    ]),
  );
  assert.equal(libraryProbeStates['gpt-5.5-pro'], 'pilot-pass-responses');
  assert.ok(
    manifest.libraryModels.every(({ transport }) => transport === 'tunnel'),
  );
  assert.ok(manifest.probePolicy.provenanceFields.includes('transport'));
  assert.ok(
    manifest.libraryModels.every(
      ({ providerHint }) => providerHint === 'openai-platform-official',
    ),
  );
  assert.ok(
    manifest.libraryModels
      .filter(({ modelId }) => modelId !== 'gpt-5.5-pro')
      .every(
        ({ probeAt, probeResult }) =>
          probeAt !== null && probeResult === 'pilot-pass-chat',
      ),
  );
  assert.ok(
    manifest.libraryModels.every(
      ({ probeAt, probeResult }) =>
        probeAt !== null && probeResult.startsWith('pilot-pass-'),
    ),
  );
  assert.ok(
    manifest.libraryModels.every(
      ({ idStatus }) => idStatus === 'rolling-model-id',
    ),
  );
  assert.equal(
    manifest.libraryModels.some(({ modelId, aliases = [] }) =>
      [modelId, ...aliases].some((identity) =>
        /-\d{4}-\d{2}-\d{2}$/.test(identity),
      ),
    ),
    false,
  );
});
