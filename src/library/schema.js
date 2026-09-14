import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .filter((key) => key !== 'contentHash')
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function contentHash(value) {
  return `sha256:${createHash('sha256').update(canonical(value)).digest('hex')}`;
}

function requireString(value, path) {
  if (typeof value !== 'string' || value.length === 0)
    throw new TypeError(`${path} must be a string`);
}

export function validateBank(bank, { verifyHashes = true } = {}) {
  if (!bank || typeof bank !== 'object')
    throw new TypeError('bank must be an object');
  if (bank.schemaVersion !== '1.0')
    throw new TypeError('unsupported schemaVersion');
  for (const field of [
    'bankVersion',
    'extractorVersion',
    'suiteVersion',
    'contentHash',
  ]) {
    requireString(bank[field], field);
  }
  if (!Array.isArray(bank.entries))
    throw new TypeError('entries must be an array');
  const ids = new Set();
  for (const [index, entry] of bank.entries.entries()) {
    const path = `entries[${index}]`;
    for (const field of [
      'entryId',
      'bankVersion',
      'contentHash',
      'modelId',
      'modelFamily',
      'collectedAt',
    ]) {
      requireString(entry[field], `${path}.${field}`);
    }
    if (entry.bankVersion !== bank.bankVersion)
      throw new TypeError(`${path}.bankVersion mismatch`);
    if (ids.has(entry.entryId))
      throw new TypeError(`${path}.entryId is duplicated`);
    ids.add(entry.entryId);
    if (!Array.isArray(entry.environments) || entry.environments.length === 0) {
      throw new TypeError(`${path}.environments must not be empty`);
    }
    if (!entry.calibration || !Number.isFinite(entry.calibration.maxDistance)) {
      throw new TypeError(`${path}.calibration.maxDistance must be finite`);
    }
    if (verifyHashes && entry.contentHash !== contentHash(entry))
      throw new TypeError(`${path}.contentHash mismatch`);
  }
  if (verifyHashes && bank.contentHash !== contentHash(bank))
    throw new TypeError('contentHash mismatch');
  return bank;
}

export async function loadBank(path, options) {
  return validateBank(JSON.parse(await readFile(path, 'utf8')), options);
}

export function selectEntries(bank, selectors = {}) {
  validateBank(bank);
  return bank.entries.filter(
    (entry) =>
      (!selectors.modelFamily || entry.modelFamily === selectors.modelFamily) &&
      (!selectors.modelIds || selectors.modelIds.includes(entry.modelId)),
  );
}
