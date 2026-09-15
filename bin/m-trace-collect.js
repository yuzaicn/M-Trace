#!/usr/bin/env node
import { collect } from '../src/collect/client.js';
import {
  renderChallengeSuite,
  renderIntegerPilot,
  selectChallengeSubset,
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
    'Usage: m-trace-collect --protocol openai|anthropic --base-url URL --model ID --key-env ENV --raw FILE --normalized FILE [--pilot-integers N] [--family FAMILY] [--limit N] [--sampling-mode challenge-temperature|provider-default] [--request-shape openai-responses] [--transport direct|tunnel] [--generation-options-json JSON] [--official-openai-only]',
  );
  process.exit(0);
}

const transport = option('--transport', 'direct');
const envProxyEnabled = process.execArgv.includes('--use-env-proxy');
const tunnelProxy = process.env.HTTPS_PROXY ?? process.env.https_proxy;
const proxyActive = envProxyEnabled && Boolean(tunnelProxy);
if (transport === 'tunnel' && !proxyActive) {
  throw new Error(
    'tunnel transport requires node --use-env-proxy and HTTPS_PROXY; --transport only records provenance',
  );
}
if (transport === 'direct' && proxyActive) {
  throw new Error(
    'direct transport cannot be recorded while Node environment-proxy routing is active',
  );
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
const limitOption = option('--limit');
const challenges = selectChallengeSubset(suite.challenges, {
  family: option('--family'),
  limit: limitOption === undefined ? undefined : Number(limitOption),
});
const result = await collect({
  baseUrl: option('--base-url'),
  key,
  model: option('--model'),
  protocol: option('--protocol'),
  challenges,
  rawPath: option('--raw'),
  normalizedPath: option('--normalized'),
  stream: !process.argv.includes('--no-stream'),
  retries: Number(option('--retries', '2')),
  requestsPerMinute: Number(option('--rpm', '60')),
  timeoutMs: Number(option('--timeout-ms', '20000')),
  samplingMode: option('--sampling-mode', 'provider-default'),
  requestShape: option('--request-shape'),
  transport,
  generationOptions: jsonOption('--generation-options-json'),
  requireOfficialOpenAI: process.argv.includes('--official-openai-only'),
});
console.log(JSON.stringify(result));
process.exitCode = result.failures.length ? 1 : 0;
