import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { TextDecoder } from 'node:util';
import { appendJsonLine, completedIds, retryCheckpointState } from './jsonl.js';
import {
  categoricalFingerprint,
  numericFingerprint,
} from '../fingerprint/numeric.js';
import { challengeHash } from '../probe/challenge-suite.js';

const EXTRACTOR_VERSION = '1.0.0';

const ALLOWED_RESPONSE_HEADERS = [
  'content-type',
  'x-request-id',
  'retry-after',
];

const RATE_LIMIT_MIN_WAIT_MS = 60_000;
const RATE_LIMIT_MAX_WAIT_MS = 10 * 60_000;

function endpointFor(baseUrl, protocol, requestShape) {
  const clean = baseUrl.replace(/\/$/, '');
  if (requestShape === 'openai-responses') {
    return `${clean}${clean.endsWith('/v1') ? '' : '/v1'}/responses`;
  }
  return protocol === 'anthropic'
    ? `${clean}/v1/messages`
    : `${clean}${clean.endsWith('/v1') || clean.endsWith('/v1beta/openai') ? '' : '/v1'}/chat/completions`;
}

function requestFor(
  protocol,
  model,
  challenge,
  stream,
  generationOptions = {},
  samplingMode = 'provider-default',
  requestShape,
) {
  if (!['challenge-temperature', 'provider-default'].includes(samplingMode)) {
    throw new Error('unsupported sampling mode');
  }
  if (
    samplingMode === 'challenge-temperature' &&
    !Number.isFinite(challenge.params.temperature)
  ) {
    throw new Error(
      'challenge-temperature sampling requires a finite challenge temperature',
    );
  }
  const maxOutputTokens = Math.max(512, challenge.params.sequenceLength * 4);
  if (requestShape === 'openai-responses') {
    if (samplingMode !== 'provider-default') {
      throw new Error(
        'openai-responses is only supported with provider-default sampling',
      );
    }
    if (
      [
        'temperature',
        'top_p',
        'max_tokens',
        'max_completion_tokens',
        'max_output_tokens',
      ].some((field) => Object.hasOwn(generationOptions, field))
    ) {
      throw new Error(
        'openai-responses provider-default sampling forbids explicit sampling and output-budget overrides',
      );
    }
    return {
      ...generationOptions,
      model,
      input: challenge.prompt,
      max_output_tokens: 8192,
      stream,
    };
  }
  if (protocol === 'anthropic') {
    if (samplingMode === 'provider-default') {
      throw new Error(
        'provider-default sampling for anthropic-messages is deferred to the 0.0.2 contract re-freeze',
      );
    }
    return {
      ...generationOptions,
      model,
      max_tokens: maxOutputTokens,
      stream,
      temperature: challenge.params.temperature,
      messages: [{ role: 'user', content: challenge.prompt }],
    };
  }
  if (
    samplingMode === 'provider-default' &&
    ['temperature', 'top_p', 'max_tokens'].some((field) =>
      Object.hasOwn(generationOptions, field),
    )
  ) {
    throw new Error(
      'provider-default sampling forbids temperature, top_p, and max_tokens generation options',
    );
  }
  const request = {
    ...generationOptions,
    model,
    max_completion_tokens: maxOutputTokens,
    stream,
    messages: [{ role: 'user', content: challenge.prompt }],
  };
  if (stream) {
    request.stream_options = {
      ...generationOptions.stream_options,
      include_usage: true,
    };
  }
  if (samplingMode === 'challenge-temperature') {
    request.temperature = challenge.params.temperature;
  }
  return request;
}

function requestShapeFor(protocol, generationOptions, requestedRequestShape) {
  if (requestedRequestShape !== undefined) {
    if (requestedRequestShape !== 'openai-responses' || protocol !== 'openai') {
      throw new Error('unsupported explicit request shape');
    }
    return requestedRequestShape;
  }
  if (protocol === 'anthropic') return 'anthropic-messages';
  return Object.hasOwn(generationOptions, 'reasoning_effort')
    ? 'openai-reasoning-chat-completions'
    : 'openai-chat-completions';
}

function rateLimitWaitMs(retryAfterHeader, retry429Count, now) {
  let requestedMs = Number.NaN;
  if (retryAfterHeader !== null && retryAfterHeader !== undefined) {
    const seconds = Number(retryAfterHeader);
    if (Number.isFinite(seconds) && seconds >= 0) {
      requestedMs = seconds * 1000;
    } else {
      const timestamp = Date.parse(retryAfterHeader);
      if (Number.isFinite(timestamp)) requestedMs = timestamp - now();
    }
  }
  const fallbackMs = Math.min(
    RATE_LIMIT_MAX_WAIT_MS,
    RATE_LIMIT_MIN_WAIT_MS * 2 ** retry429Count,
  );
  return Math.min(
    RATE_LIMIT_MAX_WAIT_MS,
    Math.max(
      RATE_LIMIT_MIN_WAIT_MS,
      Number.isFinite(requestedMs) ? requestedMs : fallbackMs,
    ),
  );
}

function headersFor(protocol, key) {
  return protocol === 'anthropic'
    ? {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      }
    : { 'content-type': 'application/json', authorization: `Bearer ${key}` };
}

function pickHeaders(headers) {
  return Object.fromEntries(
    ALLOWED_RESPONSE_HEADERS.map((name) => [name, headers.get(name)]).filter(
      ([, value]) => value,
    ),
  );
}

function redactSensitive(value, sensitive) {
  if (typeof value === 'string') {
    return sensitive.reduce(
      (text, secret) => (secret ? text.split(secret).join('[REDACTED]') : text),
      value,
    );
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, sensitive));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([name, item]) => [
        name,
        redactSensitive(item, sensitive),
      ]),
    );
  }
  return value;
}

function responseText(body) {
  return (body.output ?? [])
    .flatMap((item) => item.content ?? [])
    .filter((part) => part.type === 'output_text')
    .map((part) => part.text ?? '')
    .join('');
}

function extractNonStream(protocol, body, requestShape) {
  if (protocol === 'anthropic') {
    return {
      text: (body.content ?? [])
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join(''),
      selfReportedModel: body.model,
      usage: body.usage,
      finishReason: body.stop_reason,
    };
  }
  if (requestShape === 'openai-responses') {
    return {
      text: responseText(body),
      selfReportedModel: body.model,
      systemFingerprint: body.system_fingerprint,
      usage: body.usage,
      finishReason: body.status,
    };
  }
  return {
    text: body.choices?.[0]?.message?.content ?? '',
    selfReportedModel: body.model,
    systemFingerprint: body.system_fingerprint,
    usage: body.usage,
    finishReason: body.choices?.[0]?.finish_reason,
  };
}

function consumeEvent(protocol, requestShape, payload, aggregate) {
  if (protocol === 'anthropic') {
    if (
      payload.type === 'content_block_delta' &&
      payload.delta?.type === 'text_delta'
    ) {
      aggregate.text += payload.delta.text;
    }
    if (payload.type === 'message_start') {
      aggregate.selfReportedModel = payload.message?.model;
      aggregate.usage = payload.message?.usage;
    }
    if (payload.type === 'message_delta') {
      aggregate.finishReason = payload.delta?.stop_reason;
      aggregate.usage = { ...aggregate.usage, ...payload.usage };
    }
  } else if (requestShape === 'openai-responses') {
    if (payload.type === 'response.output_text.delta') {
      aggregate.text += payload.delta ?? '';
    }
    if (
      payload.type === 'response.completed' ||
      payload.type === 'response.incomplete'
    ) {
      aggregate.selfReportedModel = payload.response?.model;
      aggregate.systemFingerprint = payload.response?.system_fingerprint;
      aggregate.usage = payload.response?.usage;
      aggregate.finishReason = payload.response?.status;
    }
  } else {
    aggregate.text += payload.choices?.[0]?.delta?.content ?? '';
    aggregate.selfReportedModel ??= payload.model;
    aggregate.systemFingerprint ??= payload.system_fingerprint;
    aggregate.finishReason ??= payload.choices?.[0]?.finish_reason;
    if (payload.usage) {
      aggregate.usage = { ...aggregate.usage, ...payload.usage };
    }
  }
}

async function readSse(protocol, requestShape, response, now) {
  const aggregate = { text: '', chunkCount: 0, interChunkMs: [] };
  const decoder = new TextDecoder();
  let buffer = '';
  let previous = now();
  for await (const chunk of response.body) {
    const current = now();
    aggregate.interChunkMs.push(current - previous);
    previous = current;
    aggregate.chunkCount += 1;
    buffer += decoder.decode(chunk, { stream: true });
    const events = buffer.split(/\r?\n\r?\n/);
    buffer = events.pop() ?? '';
    for (const event of events) {
      for (const line of event.split(/\r?\n/)) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        consumeEvent(protocol, requestShape, JSON.parse(data), aggregate);
      }
    }
  }
  return aggregate;
}

export function parseValues(text) {
  const fenced = text.replace(/^```[^\n]*\n?|\n?```$/g, '').trim();
  let values;
  try {
    const parsed = JSON.parse(fenced);
    if (Array.isArray(parsed)) values = parsed;
  } catch {
    values = fenced
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
  }
  return values?.every(Number.isFinite) ? values : null;
}

export function parseTokens(text, format) {
  const fenced = text.replace(/^```[^\n]*\n?|\n?```$/g, '').trim();
  if (format === 'json-array') {
    try {
      const parsed = JSON.parse(fenced);
      return Array.isArray(parsed) &&
        parsed.every((token) => typeof token === 'string')
        ? parsed
        : null;
    } catch {
      return null;
    }
  }
  return fenced
    .split(format === 'csv-line' ? /\s*,\s*/ : /\s+/)
    .filter(Boolean);
}

function validateExtracted(challenge, extracted, values, tokens) {
  if (
    extracted.finishReason === 'length' ||
    extracted.finishReason === 'incomplete'
  ) {
    return 'truncated-response';
  }
  if (challenge.family === 'symbol-choice-v1') {
    if (!tokens) return 'non-symbol-or-unsupported';
    return tokens.length === challenge.params.sequenceLength
      ? null
      : 'sequence-length-mismatch';
  }
  if (!values) return 'non-numeric-or-unsupported';
  if (values.length !== challenge.params.sequenceLength) {
    return 'sequence-length-mismatch';
  }
  if (!values.every(Number.isInteger)) return 'non-integer-value';
  if (
    Number.isFinite(challenge.params.rangeExclusive) &&
    !values.every(
      (value) => value >= 0 && value < challenge.params.rangeExclusive,
    )
  ) {
    return 'value-out-of-range';
  }
  return null;
}

export async function collect({
  baseUrl,
  key,
  model,
  protocol,
  challenges,
  rawPath,
  normalizedPath,
  stream = true,
  retries = 2,
  requestsPerMinute = 60,
  timeoutMs = 20_000,
  generationOptions = {},
  samplingMode = 'provider-default',
  requestShape: requestedRequestShape,
  transport = 'direct',
  requireOfficialOpenAI = false,
  fetchImpl = globalThis.fetch,
  now = Date.now,
  sleep = delay,
}) {
  if (!baseUrl || !key || !model)
    throw new Error('baseUrl, key, and model are required');
  if (!rawPath || !normalizedPath)
    throw new Error('rawPath and normalizedPath are required');
  if (rawPath === normalizedPath)
    throw new Error('rawPath and normalizedPath must be different files');
  if (!['openai', 'anthropic'].includes(protocol))
    throw new Error('unsupported protocol');
  if (!['direct', 'tunnel'].includes(transport))
    throw new Error('transport must be direct or tunnel');
  const requestShape = requestShapeFor(
    protocol,
    generationOptions,
    requestedRequestShape,
  );
  if (requireOfficialOpenAI) {
    let endpoint;
    try {
      endpoint = new URL(baseUrl);
    } catch {
      throw new Error('official OpenAI collection requires a valid URL');
    }
    if (
      protocol !== 'openai' ||
      endpoint.origin !== 'https://api.openai.com' ||
      !['/', '/v1', '/v1/'].includes(endpoint.pathname) ||
      endpoint.username ||
      endpoint.password ||
      endpoint.search ||
      endpoint.hash
    ) {
      throw new Error(
        'official OpenAI collection requires https://api.openai.com as the base URL, with no credentials or extra path',
      );
    }
  }
  // A raw line may have been flushed immediately before a crash. Only the
  // normalized file marks a challenge as transactionally complete.
  const done = await completedIds(normalizedPath);
  const checkpointState = await retryCheckpointState(rawPath);
  const interval = requestsPerMinute > 0 ? 60_000 / requestsPerMinute : 0;
  const summary = {
    attempted: 0,
    completed: 0,
    skipped: 0,
    failures: [],
    retry429Count: checkpointState.retry429Count,
    cumulative429WaitMs: checkpointState.cumulativeWaitMs,
  };
  for (const challenge of challenges) {
    if (done.has(challenge.id)) {
      summary.skipped += 1;
      continue;
    }
    summary.attempted += 1;
    let succeeded = false;
    let rateLimitRetry =
      checkpointState.consecutive429ByChallenge[challenge.id] ?? 0;
    const pendingWait = checkpointState.pendingWaitByChallenge[challenge.id];
    if (pendingWait) {
      const elapsedMs = Number.isFinite(pendingWait.startedAtMs)
        ? Math.max(0, now() - pendingWait.startedAtMs)
        : 0;
      const remainingWaitMs = Math.max(0, pendingWait.waitMs - elapsedMs);
      if (remainingWaitMs > 0) await sleep(remainingWaitMs);
      summary.cumulative429WaitMs = Math.max(
        summary.cumulative429WaitMs,
        pendingWait.plannedCumulativeWaitMs ??
          pendingWait.cumulativeWaitMs + pendingWait.waitMs,
      );
      await appendJsonLine(rawPath, {
        recordType: 'retry-checkpoint-v1',
        checkpoint: {
          ...pendingWait,
          phase: 'after-wait',
          cumulativeWaitMs: summary.cumulative429WaitMs,
          resumed: true,
          remainingWaitMs,
        },
      });
    }
    let boundedRetry = 0;
    let attempt = 0;
    while (!succeeded) {
      const startedAt = now();
      try {
        const response = await fetchImpl(
          endpointFor(baseUrl, protocol, requestShape),
          {
            method: 'POST',
            headers: headersFor(protocol, key),
            body: JSON.stringify(
              requestFor(
                protocol,
                model,
                challenge,
                stream,
                generationOptions,
                samplingMode,
                requestShape,
              ),
            ),
            signal: globalThis.AbortSignal.timeout(timeoutMs),
          },
        );
        if (!response.ok) {
          if (response.status === 429) {
            const waitMs = rateLimitWaitMs(
              response.headers.get('retry-after'),
              rateLimitRetry,
              now,
            );
            summary.retry429Count += 1;
            const cumulativeWaitMsBefore = summary.cumulative429WaitMs;
            const cumulativeWaitMsAfter = cumulativeWaitMsBefore + waitMs;
            const checkpoint = {
              challengeId: challenge.id,
              challengeHash: challengeHash(challenge),
              model: model,
              requestShape,
              transport,
              httpStatus: 429,
              waitMs,
              retry429Count: summary.retry429Count,
              consecutive429Count: rateLimitRetry + 1,
              startedAtMs: now(),
            };
            await appendJsonLine(rawPath, {
              recordType: 'retry-checkpoint-v1',
              checkpoint: {
                ...checkpoint,
                phase: 'before-wait',
                cumulativeWaitMs: cumulativeWaitMsBefore,
                plannedCumulativeWaitMs: cumulativeWaitMsAfter,
              },
            });
            await sleep(waitMs);
            summary.cumulative429WaitMs = cumulativeWaitMsAfter;
            await appendJsonLine(rawPath, {
              recordType: 'retry-checkpoint-v1',
              checkpoint: {
                ...checkpoint,
                phase: 'after-wait',
                cumulativeWaitMs: cumulativeWaitMsAfter,
              },
            });
            rateLimitRetry += 1;
            attempt += 1;
            continue;
          }
          const retriable = response.status >= 500;
          if (retriable && boundedRetry < retries) {
            boundedRetry += 1;
            await sleep(250 * 2 ** (boundedRetry - 1));
            attempt += 1;
            continue;
          }
          const error = new Error(`upstream returned HTTP ${response.status}`);
          error.retryable = retriable;
          throw error;
        }
        const isStream = response.headers
          .get('content-type')
          ?.includes('text/event-stream');
        let extracted;
        let rawBody = null;
        if (isStream)
          extracted = await readSse(protocol, requestShape, response, now);
        else {
          rawBody = await response.json();
          extracted = {
            ...extractNonStream(protocol, rawBody, requestShape),
            chunkCount: 1,
            interChunkMs: [],
          };
        }
        const receivedAt = new Date(now()).toISOString();
        const samplingSource =
          samplingMode === 'provider-default'
            ? 'provider-default'
            : 'challenge-parameter';
        const effort =
          generationOptions.reasoning?.effort ??
          generationOptions.reasoning_effort ??
          null;
        const metadata = {
          requestId: response.headers.get('x-request-id') ?? null,
          challengeId: challenge.id,
          challengeHash: challengeHash(challenge),
          extractorVersion: EXTRACTOR_VERSION,
          suiteVersion: challenge.suiteVersion ?? null,
          evaluationRole: challenge.evaluationRole ?? 'scored',
          protocol,
          transport,
          requestedModel: model,
          receivedAt,
          latencyMs: now() - startedAt,
          status: response.status,
          streamed: isStream,
          chunkCount: extracted.chunkCount,
          interChunkMs: extracted.interChunkMs,
          responseHeaders: pickHeaders(response.headers),
          selfReportedModel: extracted.selfReportedModel ?? null,
          systemFingerprint: extracted.systemFingerprint ?? null,
          finishReason: extracted.finishReason ?? null,
          usage: extracted.usage ?? null,
          samplingSource,
          effort,
          requestShape,
          generationOptions,
        };
        const safeText = redactSensitive(extracted.text, [key, baseUrl]);
        const safeBody = redactSensitive(rawBody, [key, baseUrl]);
        await appendJsonLine(rawPath, {
          recordType: 'raw-probe-v1',
          request: {
            challengeId: challenge.id,
            extractorVersion: EXTRACTOR_VERSION,
            suiteVersion: challenge.suiteVersion ?? null,
            evaluationRole: challenge.evaluationRole ?? 'scored',
            protocol,
            transport,
            requestedModel: model,
            attempt,
            samplingSource,
            effort,
            requestShape,
            generationOptions,
          },
          response: { ...metadata, text: safeText, body: safeBody },
          samplingSource,
          transport,
          effort,
          requestShape,
          generationOptions,
          usage: extracted.usage ?? null,
          systemFingerprint: extracted.systemFingerprint ?? null,
        });
        const values = parseValues(extracted.text);
        const tokens =
          challenge.family === 'symbol-choice-v1'
            ? parseTokens(extracted.text, challenge.format)
            : null;
        const parseFailure = validateExtracted(
          challenge,
          extracted,
          values,
          tokens,
        );
        const fingerprint =
          !parseFailure && tokens?.length
            ? categoricalFingerprint(tokens, challenge.params)
            : !parseFailure &&
                values &&
                challenge.params.bucketCount &&
                challenge.params.rangeExclusive
              ? numericFingerprint(values, challenge.params)
              : null;
        await appendJsonLine(normalizedPath, {
          recordType: 'normalized-probe-v1',
          ...metadata,
          family: challenge.family,
          environmentId: challenge.environmentId ?? challenge.wrapper,
          contentHash: createHash('sha256')
            .update(extracted.text)
            .digest('hex'),
          values,
          tokens,
          fingerprint,
          parseFailure,
        });
        if (parseFailure) {
          summary.failures.push({
            challengeId: challenge.id,
            message: parseFailure,
          });
          break;
        }
        summary.completed += 1;
        succeeded = true;
      } catch (error) {
        if (error.retryable === false || boundedRetry >= retries) {
          summary.failures.push({
            challengeId: challenge.id,
            message: redactSensitive(error.message, [key, baseUrl]),
          });
          break;
        }
        boundedRetry += 1;
        await sleep(250 * 2 ** (boundedRetry - 1));
        attempt += 1;
      }
    }
    if (interval > 0) await sleep(interval);
  }
  return summary;
}
