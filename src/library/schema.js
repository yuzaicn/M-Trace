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

function requireFiniteNonNegative(value, path, { positive = false } = {}) {
  if (!Number.isFinite(value) || value < 0 || (positive && value === 0)) {
    throw new TypeError(
      `${path} must be ${positive ? 'positive' : 'non-negative'} and finite`,
    );
  }
}

function requireJsonValue(value, path) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`${path} must be finite`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => requireJsonValue(item, `${path}[${index}]`));
    return;
  }
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    for (const [key, item] of Object.entries(value)) {
      requireJsonValue(item, `${path}.${key}`);
    }
    return;
  }
  throw new TypeError(`${path} must be canonical JSON data`);
}

export function validateBank(
  bank,
  {
    verifyHashes = true,
    expectedExtractorVersion = '1.0.0',
    expectedSuiteVersion = '2.0.0',
  } = {},
) {
  if (!bank || typeof bank !== 'object')
    throw new TypeError('bank must be an object');
  if (bank.schemaVersion !== '1.1')
    throw new TypeError('unsupported schemaVersion');
  for (const field of [
    'bankVersion',
    'extractorVersion',
    'suiteVersion',
    'contentHash',
  ]) {
    requireString(bank[field], field);
  }
  if (bank.extractorVersion !== expectedExtractorVersion)
    throw new TypeError('extractorVersion mismatch');
  if (bank.suiteVersion !== expectedSuiteVersion)
    throw new TypeError('suiteVersion mismatch');
  if (!Array.isArray(bank.entries))
    throw new TypeError('entries must be an array');
  const ids = new Set();
  const modelIdentities = new Set();
  for (const [index, entry] of bank.entries.entries()) {
    const path = `entries[${index}]`;
    for (const field of [
      'entryId',
      'bankVersion',
      'contentHash',
      'modelId',
      'modelFamily',
      'vendor',
      'collectedAt',
    ]) {
      requireString(entry[field], `${path}.${field}`);
    }
    if (entry.bankVersion !== bank.bankVersion)
      throw new TypeError(`${path}.bankVersion mismatch`);
    if (entry.vendor !== 'OpenAI')
      throw new TypeError(`${path}.vendor must be OpenAI`);
    if (!['gpt-5.5', 'gpt-5.6', 'gpt-6'].includes(entry.modelFamily)) {
      throw new TypeError(`${path}.modelFamily is unsupported`);
    }
    if (ids.has(entry.entryId))
      throw new TypeError(`${path}.entryId is duplicated`);
    ids.add(entry.entryId);
    const aliases = entry.aliases ?? [];
    if (
      !Array.isArray(aliases) ||
      !aliases.every((alias) => typeof alias === 'string' && alias.length > 0)
    ) {
      throw new TypeError(`${path}.aliases must contain non-empty strings`);
    }
    if (new Set(aliases).size !== aliases.length)
      throw new TypeError(`${path}.aliases contains duplicates`);
    for (const identity of [entry.modelId, ...aliases]) {
      if (modelIdentities.has(identity)) {
        throw new TypeError(`${path} duplicates model or alias ${identity}`);
      }
      modelIdentities.add(identity);
    }
    if (!Array.isArray(entry.environments) || entry.environments.length === 0) {
      throw new TypeError(`${path}.environments must not be empty`);
    }
    if (entry.samplingSource !== 'provider-default') {
      throw new TypeError(`${path}.samplingSource must be provider-default`);
    }
    if (
      ![
        'openai-chat-completions',
        'openai-reasoning-chat-completions',
        'openai-responses',
        'anthropic-messages',
      ].includes(entry.requestShape)
    ) {
      throw new TypeError(`${path}.requestShape is unsupported`);
    }
    if (entry.effort !== null && typeof entry.effort !== 'string')
      throw new TypeError(`${path}.effort must be a string or null`);
    if (
      ['openai-reasoning-chat-completions', 'openai-responses'].includes(
        entry.requestShape,
      ) &&
      typeof entry.effort !== 'string'
    ) {
      throw new TypeError(`${path}.effort is required for reasoning requests`);
    }
    if (
      !['openai-reasoning-chat-completions', 'openai-responses'].includes(
        entry.requestShape,
      ) &&
      entry.effort !== null
    ) {
      throw new TypeError(
        `${path}.effort must be null for non-reasoning requests`,
      );
    }
    if (
      !entry.generationOptions ||
      Object.getPrototypeOf(entry.generationOptions) !== Object.prototype
    ) {
      throw new TypeError(`${path}.generationOptions must be an object`);
    }
    requireJsonValue(entry.generationOptions, `${path}.generationOptions`);
    if (
      entry.requestShape === 'openai-reasoning-chat-completions' &&
      entry.generationOptions.reasoning_effort !== entry.effort
    ) {
      throw new TypeError(
        `${path}.generationOptions.reasoning_effort must match effort`,
      );
    }
    if (
      entry.requestShape === 'openai-responses' &&
      entry.generationOptions.reasoning?.effort !== entry.effort
    ) {
      throw new TypeError(
        `${path}.generationOptions.reasoning.effort must match effort`,
      );
    }
    if (
      ['temperature', 'top_p', 'max_tokens'].some((field) =>
        Object.hasOwn(entry.generationOptions, field),
      )
    ) {
      throw new TypeError(
        `${path}.generationOptions contains a forbidden Suite 2 option`,
      );
    }
    if (!['direct', 'tunnel'].includes(entry.transport)) {
      throw new TypeError(`${path}.transport must be direct or tunnel`);
    }
    if (entry.usage !== null) {
      if (
        !entry.usage ||
        Object.getPrototypeOf(entry.usage) !== Object.prototype
      )
        throw new TypeError(`${path}.usage must be an object or null`);
      requireJsonValue(entry.usage, `${path}.usage`);
    }
    if (
      entry.systemFingerprint !== null &&
      typeof entry.systemFingerprint !== 'string'
    ) {
      throw new TypeError(`${path}.systemFingerprint must be a string or null`);
    }
    const calibration = entry.calibration;
    if (!calibration || typeof calibration !== 'object')
      throw new TypeError(`${path}.calibration must be an object`);
    for (const field of ['maxDistance', 'minMargin', 'minRelativeMargin']) {
      requireFiniteNonNegative(
        calibration[field],
        `${path}.calibration.${field}`,
      );
    }
    requireFiniteNonNegative(
      calibration.distanceScale,
      `${path}.calibration.distanceScale`,
      { positive: true },
    );
    if (!Array.isArray(calibration.nuisanceDirections)) {
      throw new TypeError(
        `${path}.calibration.nuisanceDirections must be an array`,
      );
    }
    calibration.nuisanceDirections.forEach((direction, directionIndex) => {
      if (!Array.isArray(direction) || !direction.every(Number.isFinite)) {
        throw new TypeError(
          `${path}.calibration.nuisanceDirections[${directionIndex}] must contain finite numbers`,
        );
      }
    });
    if (
      !Number.isInteger(calibration.sampleCount) ||
      calibration.sampleCount < 1
    )
      throw new TypeError(`${path}.calibration.sampleCount must be positive`);
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
