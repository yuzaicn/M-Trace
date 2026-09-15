import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import test from 'node:test';
import { collect, parseTokens } from '../src/collect/client.js';

const challenge = {
  id: 'mock:1',
  family: 'adaptive-numeric-v1',
  wrapper: 'direct',
  prompt: 'original mock prompt',
  format: 'json-array',
  params: {
    sequenceLength: 4,
    temperature: 1,
    bucketCount: 8,
    rangeExclusive: 120,
  },
};

test('parses categorical outputs in every supported format', () => {
  assert.deepEqual(parseTokens('["Α","Β"]', 'json-array'), ['Α', 'Β']);
  assert.deepEqual(parseTokens('Α, Β', 'csv-line'), ['Α', 'Β']);
  assert.deepEqual(parseTokens('Α Β', 'plain-text'), ['Α', 'Β']);
});

async function withServer(handler, run) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await run(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('collects OpenAI SSE, retries 429, resumes, and never persists key or endpoint', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mtrace-'));
  const rawPath = join(directory, 'raw.jsonl');
  const normalizedPath = join(directory, 'normalized.jsonl');
  const secret = 'sk-sensitive-test-value';
  let calls = 0;
  await withServer(
    async (request, response) => {
      calls += 1;
      assert.equal(request.headers.authorization, `Bearer ${secret}`);
      assert.equal(request.url, '/v1/chat/completions');
      let requestBody = '';
      for await (const chunk of request) requestBody += chunk;
      const requestJson = JSON.parse(requestBody);
      assert.deepEqual(requestJson.thinking, { type: 'disabled' });
      assert.equal(requestJson.max_completion_tokens, 512);
      assert.equal(requestJson.max_tokens, undefined);
      assert.equal(requestJson.temperature, 1);
      assert.deepEqual(requestJson.stream_options, { include_usage: true });
      if (calls === 1) {
        response.writeHead(429, { 'retry-after': '0' });
        response.end();
        return;
      }
      response.writeHead(200, {
        'content-type': 'text/event-stream',
        'x-request-id': 'mock-request',
      });
      response.end(
        `data: {"model":"self-a","choices":[{"delta":{"content":"[1,2"}}]}\n\ndata: {"choices":[{"delta":{"content":",3,4]"},"finish_reason":"stop"}],"debug":"${secret}"}\n\ndata: {"choices":[],"usage":{"prompt_tokens":8,"completion_tokens":4,"total_tokens":12}}\n\ndata: [DONE]\n\n`,
      );
    },
    async (baseUrl) => {
      const options = {
        baseUrl: `${baseUrl}/v1`,
        key: secret,
        model: 'requested-a',
        protocol: 'openai',
        challenges: [challenge],
        rawPath,
        normalizedPath,
        retries: 1,
        requestsPerMinute: 0,
        sleep: async () => {},
        generationOptions: { thinking: { type: 'disabled' } },
        samplingMode: 'challenge-temperature',
      };
      assert.deepEqual(await collect(options), {
        attempted: 1,
        completed: 1,
        skipped: 0,
        failures: [],
      });
      assert.deepEqual(await collect(options), {
        attempted: 0,
        completed: 0,
        skipped: 1,
        failures: [],
      });
      const persisted = `${await readFile(rawPath, 'utf8')}\n${await readFile(normalizedPath, 'utf8')}`;
      assert.doesNotMatch(persisted, new RegExp(secret));
      assert.doesNotMatch(
        persisted,
        new RegExp(baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      );
      const normalized = JSON.parse(
        (await readFile(normalizedPath, 'utf8')).trim(),
      );
      assert.deepEqual(normalized.values, [1, 2, 3, 4]);
      assert.deepEqual(normalized.generationOptions, {
        thinking: { type: 'disabled' },
      });
      assert.deepEqual(normalized.usage, {
        prompt_tokens: 8,
        completion_tokens: 4,
        total_tokens: 12,
      });
      const raw = JSON.parse((await readFile(rawPath, 'utf8')).trim());
      assert.deepEqual(raw.request.generationOptions, {
        thinking: { type: 'disabled' },
      });
    },
  );
  assert.equal(calls, 2);
});

test('collects Anthropic non-stream response', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mtrace-'));
  await withServer(
    (request, response) => {
      assert.equal(request.headers['x-api-key'], 'mock-key');
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          model: 'self-b',
          content: [{ type: 'text', text: '1 2 3 4' }],
          usage: { output_tokens: 4 },
          stop_reason: 'end_turn',
          debug: 'mock-key',
        }),
      );
    },
    async (baseUrl) => {
      const result = await collect({
        baseUrl,
        key: 'mock-key',
        model: 'requested-b',
        protocol: 'anthropic',
        challenges: [challenge],
        rawPath: join(directory, 'raw.jsonl'),
        normalizedPath: join(directory, 'normalized.jsonl'),
        requestsPerMinute: 0,
        samplingMode: 'challenge-temperature',
      });
      assert.equal(result.completed, 1);
      assert.doesNotMatch(
        await readFile(join(directory, 'raw.jsonl'), 'utf8'),
        /mock-key/,
      );
      const normalized = JSON.parse(
        (await readFile(join(directory, 'normalized.jsonl'), 'utf8')).trim(),
      );
      assert.equal(normalized.streamed, false);
      assert.equal(normalized.selfReportedModel, 'self-b');
    },
  );
});

test('collects Anthropic SSE response', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mtrace-'));
  await withServer(
    (_request, response) => {
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      response.end(
        'event: message_start\ndata: {"type":"message_start","message":{"model":"self-stream","usage":{"input_tokens":8}}}\n\n' +
          'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"[1,2,3,4]"}}\n\n' +
          'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":4}}\n\n',
      );
    },
    async (baseUrl) => {
      const normalizedPath = join(directory, 'normalized.jsonl');
      const result = await collect({
        baseUrl,
        key: 'mock-key',
        model: 'requested-b',
        protocol: 'anthropic',
        challenges: [challenge],
        rawPath: join(directory, 'raw.jsonl'),
        normalizedPath,
        requestsPerMinute: 0,
        samplingMode: 'challenge-temperature',
      });
      assert.equal(result.completed, 1);
      const normalized = JSON.parse(
        (await readFile(normalizedPath, 'utf8')).trim(),
      );
      assert.equal(normalized.streamed, true);
      assert.equal(normalized.selfReportedModel, 'self-stream');
      assert.deepEqual(normalized.values, [1, 2, 3, 4]);
    },
  );
});

test('collects OpenAI non-stream response', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mtrace-'));
  await withServer(
    (_request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          model: 'self-json',
          choices: [
            { message: { content: '[1,2,3,4]' }, finish_reason: 'stop' },
          ],
          usage: { completion_tokens: 4 },
        }),
      );
    },
    async (baseUrl) => {
      const normalizedPath = join(directory, 'normalized.jsonl');
      const result = await collect({
        baseUrl,
        key: 'mock-key',
        model: 'requested-a',
        protocol: 'openai',
        challenges: [challenge],
        rawPath: join(directory, 'raw.jsonl'),
        normalizedPath,
        stream: false,
        requestsPerMinute: 0,
        samplingMode: 'challenge-temperature',
      });
      assert.equal(result.completed, 1);
      const normalized = JSON.parse(
        (await readFile(normalizedPath, 'utf8')).trim(),
      );
      assert.equal(normalized.streamed, false);
      assert.equal(normalized.selfReportedModel, 'self-json');
    },
  );
});

test('Anthropic provider-default mode omits sampling parameters and records its shape', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mtrace-'));
  await withServer(
    async (request, response) => {
      let requestBody = '';
      for await (const chunk of request) requestBody += chunk;
      const requestJson = JSON.parse(requestBody);
      assert.equal(requestJson.temperature, undefined);
      assert.equal(requestJson.top_p, undefined);
      assert.equal(requestJson.max_tokens, 512);
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          model: 'self-b',
          content: [{ type: 'text', text: '[1,2,3,4]' }],
        }),
      );
    },
    async (baseUrl) => {
      const normalizedPath = join(directory, 'normalized.jsonl');
      const result = await collect({
        baseUrl,
        key: 'mock-key',
        model: 'requested-b',
        protocol: 'anthropic',
        challenges: [challenge],
        rawPath: join(directory, 'raw.jsonl'),
        normalizedPath,
        requestsPerMinute: 0,
        samplingMode: 'provider-default',
      });
      assert.equal(result.completed, 1);
      const normalized = JSON.parse(await readFile(normalizedPath, 'utf8'));
      assert.equal(normalized.samplingSource, 'provider-default');
      assert.equal(normalized.requestShape, 'anthropic-messages');
    },
  );
});

test('official OpenAI guard rejects compatibility proxies before a request', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mtrace-'));
  let requested = false;
  await assert.rejects(
    collect({
      baseUrl: 'https://sub2api.example/v1',
      key: 'mock-key',
      model: 'gpt-5.6-sol',
      protocol: 'openai',
      challenges: [challenge],
      rawPath: join(directory, 'raw.jsonl'),
      normalizedPath: join(directory, 'normalized.jsonl'),
      requestsPerMinute: 0,
      requireOfficialOpenAI: true,
      fetchImpl: async () => {
        requested = true;
        throw new Error('must not be reached');
      },
    }),
    /requires https:\/\/api\.openai\.com/,
  );
  assert.equal(requested, false);
});

test('provider-default mode rejects explicit sampling overrides', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mtrace-'));
  const result = await collect({
    baseUrl: 'http://invalid.local',
    key: 'mock-key',
    model: 'gpt-5.6-sol',
    protocol: 'openai',
    challenges: [challenge],
    rawPath: join(directory, 'raw.jsonl'),
    normalizedPath: join(directory, 'normalized.jsonl'),
    requestsPerMinute: 0,
    retries: 0,
    samplingMode: 'provider-default',
    generationOptions: { reasoning_effort: 'none', temperature: 1 },
    fetchImpl: async () => {
      throw new Error('must not be reached');
    },
  });
  assert.match(result.failures[0].message, /forbids temperature/);
});

test('OpenAI provider-default without reasoning effort records the plain chat shape', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mtrace-'));
  await withServer(
    (_request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          model: 'plain-chat',
          choices: [{ message: { content: '[1,2,3,4]' } }],
        }),
      );
    },
    async (baseUrl) => {
      const normalizedPath = join(directory, 'normalized.jsonl');
      const result = await collect({
        baseUrl,
        key: 'mock-key',
        model: 'plain-chat',
        protocol: 'openai',
        challenges: [challenge],
        rawPath: join(directory, 'raw.jsonl'),
        normalizedPath,
        stream: false,
        requestsPerMinute: 0,
      });
      assert.equal(result.completed, 1);
      const normalized = JSON.parse(await readFile(normalizedPath, 'utf8'));
      assert.equal(normalized.requestShape, 'openai-chat-completions');
      assert.equal(normalized.effort, null);
    },
  );
});

test('Suite 2 challenges cannot be forced through challenge-temperature mode', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mtrace-'));
  let requested = false;
  const result = await collect({
    baseUrl: 'http://invalid.local',
    key: 'mock-key',
    model: 'gpt-5.6-sol',
    protocol: 'openai',
    challenges: [
      {
        ...challenge,
        suiteVersion: '2.0.0',
        samplingSource: 'provider-default',
        params: { ...challenge.params, temperature: undefined },
      },
    ],
    rawPath: join(directory, 'raw.jsonl'),
    normalizedPath: join(directory, 'normalized.jsonl'),
    requestsPerMinute: 0,
    retries: 0,
    samplingMode: 'challenge-temperature',
    fetchImpl: async () => {
      requested = true;
      throw new Error('must not be reached');
    },
  });
  assert.equal(requested, false);
  assert.match(result.failures[0].message, /requires a finite/);
});

test('OpenAI provider-default variant omits temperature and records reasoning provenance and usage', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mtrace-'));
  const rawPath = join(directory, 'raw.jsonl');
  const normalizedPath = join(directory, 'normalized.jsonl');
  await withServer(
    async (request, response) => {
      let requestBody = '';
      for await (const chunk of request) requestBody += chunk;
      const requestJson = JSON.parse(requestBody);
      assert.equal(requestJson.model, 'gpt-5.6-sol');
      assert.equal(requestJson.max_completion_tokens, 512);
      assert.equal(requestJson.max_tokens, undefined);
      assert.equal(requestJson.temperature, undefined);
      assert.equal(requestJson.reasoning_effort, 'none');
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          model: 'gpt-5.6-sol',
          system_fingerprint: 'fp_mock',
          choices: [
            { message: { content: '[1,2,3,4]' }, finish_reason: 'stop' },
          ],
          usage: {
            prompt_tokens: 9,
            completion_tokens: 7,
            total_tokens: 16,
            completion_tokens_details: { reasoning_tokens: 3 },
          },
        }),
      );
    },
    async (baseUrl) => {
      const result = await collect({
        baseUrl,
        key: 'official-mock-key',
        model: 'gpt-5.6-sol',
        protocol: 'openai',
        challenges: [challenge],
        rawPath,
        normalizedPath,
        stream: false,
        requestsPerMinute: 0,
        generationOptions: { reasoning_effort: 'none' },
      });
      assert.equal(result.completed, 1);
      const raw = JSON.parse((await readFile(rawPath, 'utf8')).trim());
      const normalized = JSON.parse(
        (await readFile(normalizedPath, 'utf8')).trim(),
      );
      for (const record of [raw.request, raw.response, normalized]) {
        assert.equal(record.samplingSource, 'provider-default');
        assert.equal(record.effort, 'none');
        assert.equal(record.requestShape, 'openai-reasoning-chat-completions');
      }
      assert.equal(raw.samplingSource, 'provider-default');
      assert.equal(raw.effort, 'none');
      assert.equal(raw.requestShape, 'openai-reasoning-chat-completions');
      assert.deepEqual(raw.generationOptions, { reasoning_effort: 'none' });
      assert.deepEqual(raw.usage, {
        prompt_tokens: 9,
        completion_tokens: 7,
        total_tokens: 16,
        completion_tokens_details: { reasoning_tokens: 3 },
      });
      assert.equal(raw.systemFingerprint, 'fp_mock');
      assert.deepEqual(normalized.usage, {
        prompt_tokens: 9,
        completion_tokens: 7,
        total_tokens: 16,
        completion_tokens_details: { reasoning_tokens: 3 },
      });
      assert.equal(normalized.systemFingerprint, 'fp_mock');
    },
  );
});
