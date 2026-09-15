#!/usr/bin/env node
import { collect } from '../src/collect/client.js';
import {
  renderChallengeSuite,
  renderIntegerPilot,
} from '../src/probe/challenge-suite.js';

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
}

function jsonOption(name) {
  const value = option(name);
  if (value === undefined) return {};
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${name} must contain valid JSON`);
  }
}

if (process.argv.includes('--help')) {
  console.log(
    'Usage: m-trace-collect --protocol openai|anthropic --base-url URL --model ID --key-env ENV --raw FILE --normalized FILE [--pilot-integers N] [--sampling-mode challenge-temperature|provider-default] [--request-shape openai-responses] [--transport direct|tunnel] [--generation-options-json JSON] [--official-openai-only]',
  );
  process.exit(0);
}

const keyEnv = option('--key-env');
const key = keyEnv ? process.env[keyEnv] : undefined;
if (!key)
  throw new Error(
    'API key environment variable is unset; keys cannot be passed as arguments',
  );
const seed = Number(option('--seed', '73013'));
const pilotIntegers = option('--pilot-integers');
const suite = pilotIntegers
  ? renderIntegerPilot({ seed, sequenceLength: Number(pilotIntegers) })
  : renderChallengeSuite({
      seed,
      variants: Number(option('--variants', '12')),
      replicates: Number(option('--replicates', '3')),
      sequenceLength: Number(option('--sequence-length', '384')),
    });
const result = await collect({
  baseUrl: option('--base-url'),
  key,
  model: option('--model'),
  protocol: option('--protocol'),
  challenges: suite.challenges,
  rawPath: option('--raw'),
  normalizedPath: option('--normalized'),
  stream: !process.argv.includes('--no-stream'),
  retries: Number(option('--retries', '2')),
  requestsPerMinute: Number(option('--rpm', '60')),
  timeoutMs: Number(option('--timeout-ms', '20000')),
  samplingMode: option('--sampling-mode', 'provider-default'),
  requestShape: option('--request-shape'),
  transport: option('--transport', 'direct'),
  generationOptions: jsonOption('--generation-options-json'),
  requireOfficialOpenAI: process.argv.includes('--official-openai-only'),
});
console.log(JSON.stringify(result));
process.exitCode = result.failures.length ? 1 : 0;
