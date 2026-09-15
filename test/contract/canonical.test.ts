/**
 * 契约测试：规范 JSON（I-10）。
 *
 * 这些用例的价值不在实现，而在**冻结字节**：
 * 它们是第三方复验契约的可执行规格。任何让同一份证据产出不同哈希的改动，
 * 都会在这里失败。新增用例可以，改期望值必须走契约变更流程。
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { CanonicalJsonError, canonicalJson } from '../../src/core/canonical.js';

test('I-10: key order does not affect the digest', () => {
  const a = { beta: 1, alpha: { z: 2, y: [3, 4] } };
  const b = { alpha: { y: [3, 4], z: 2 }, beta: 1 };
  assert.equal(canonicalJson(a), canonicalJson(b));
  assert.equal(canonicalJson(a), '{"alpha":{"y":[3,4],"z":2},"beta":1}');
});

test('I-10: array order IS significant — it carries meaning', () => {
  assert.notEqual(canonicalJson([1, 2, 3]), canonicalJson([3, 2, 1]));
});

test('I-10: non-ASCII characters are preserved, not escaped', () => {
  assert.equal(canonicalJson({ 模型: '家族级' }), '{"模型":"家族级"}');
});

test('I-10: negative zero is normalized so it cannot split a hash', () => {
  assert.equal(canonicalJson({ x: -0 }), canonicalJson({ x: 0 }));
  assert.equal(canonicalJson({ x: -0 }), '{"x":0}');
});

test('I-10: optional undefined fields are dropped, not written as null', () => {
  assert.equal(canonicalJson({ a: 1, b: undefined }), '{"a":1}');
  assert.notEqual(
    canonicalJson({ a: 1, b: undefined }),
    canonicalJson({ a: 1, b: null }),
  );
});

test('I-10: non-finite numbers are rejected — they have no canonical form', () => {
  for (const bad of [NaN, Infinity, -Infinity]) {
    assert.throws(() => canonicalJson({ x: bad }), CanonicalJsonError);
  }
});

test('I-10: object types without a defined canonical form are rejected, not coerced', () => {
  assert.throws(() => canonicalJson({ when: new Date(0) }), CanonicalJsonError);
  assert.throws(() => canonicalJson({ m: new Map() }), CanonicalJsonError);
  assert.throws(() => canonicalJson({ s: new Set([1]) }), CanonicalJsonError);
  assert.throws(() => canonicalJson({ n: 1n }), CanonicalJsonError);
});

test('I-10: circular structures are rejected instead of looping forever', () => {
  const a: Record<string, unknown> = {};
  a.self = a;
  assert.throws(() => canonicalJson(a), CanonicalJsonError);
});

test('I-10: output has no incidental whitespace and no trailing newline', () => {
  const out = canonicalJson({ a: [1, 2], b: { c: 'x' } });
  assert.equal(out, '{"a":[1,2],"b":{"c":"x"}}');
  assert.ok(!out.endsWith('\n'));
});

test('I-10: a null-prototype object is accepted (it is still a plain record)', () => {
  const bare = Object.create(null) as Record<string, unknown>;
  bare.k = 'v';
  assert.equal(canonicalJson(bare), '{"k":"v"}');
});

test('I-10: realistic library payload hashes identically regardless of field ordering', () => {
  const shape = {
    bankVersion: '2026.09.1',
    extractorVersion: '1.0.0',
    calibration: { attribution: { maxDistance: 0.5, minMargin: 0.02 } },
    entries: [
      { entryId: 'a', declaredModel: 'family-a', sampleCounts: { numeric: 6 } },
      { entryId: 'b', declaredModel: 'family-b', sampleCounts: { numeric: 4 } },
    ],
  };
  const reordered = {
    entries: [
      { sampleCounts: { numeric: 6 }, declaredModel: 'family-a', entryId: 'a' },
      { declaredModel: 'family-b', entryId: 'b', sampleCounts: { numeric: 4 } },
    ],
    calibration: { attribution: { minMargin: 0.02, maxDistance: 0.5 } },
    extractorVersion: '1.0.0',
    bankVersion: '2026.09.1',
  };
  assert.equal(canonicalJson(shape), canonicalJson(reordered));
});
