/**
 * 契约测试：证据包与库的可复验性（I-12）。
 *
 * 命题：报告的结论要能被第三方重跑验证。
 * 因此证据包必须自带**全部**复验输入，且不得依赖任何机器状态。
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { readRepoFile } from '../helpers/repo.js';

const EVIDENCE_SRC = 'src/types/evidence.ts';
const LIBRARY_SRC = 'src/types/library.ts';

test('I-12: the evidence pack carries the library identity, not just a version string', async () => {
  const src = await readRepoFile(EVIDENCE_SRC);
  assert.match(src, /bankVersion:\s*string/);
  assert.match(src, /contentHash:\s*string/);
  assert.match(src, /calibrationVersion:\s*string/);
  assert.ok(
    /唯一确定/.test(src),
    'the contract must state that contentHash uniquely determines the bank — a version string alone ' +
      'cannot distinguish two banks and would make re-verification ambiguous',
  );
});

test('I-12: the evidence pack records both fingerprint versions, so an extractor change is visible', async () => {
  const src = await readRepoFile(EVIDENCE_SRC);
  // 提取算法版本随指纹一起走（指纹自身声明它），套件版本同理。
  assert.match(
    src,
    /fingerprint:\s*import\('\.\/fingerprint\.js'\)\.Fingerprint/,
  );
  assert.match(src, /libraryRef:\s*\{/);
  assert.match(src, /calibrationVersion:\s*string/);

  const fingerprint = await readRepoFile('src/types/fingerprint.ts');
  assert.match(
    fingerprint,
    /extractorVersion:\s*string/,
    'the fingerprint must declare the extractor version that produced it — otherwise a bank built ' +
      'by a different algorithm cannot be detected as incompatible',
  );
  assert.match(fingerprint, /suiteVersion:\s*string/);
});

test('I-12: the evidence pack keeps the verdict verbatim for field-by-field comparison', async () => {
  const src = await readRepoFile(EVIDENCE_SRC);
  assert.match(
    src,
    /verdict:\s*import\('\.\/attribute\.js'\)\.AttributionVerdict/,
  );
  assert.ok(
    /逐字段比对/.test(src),
    're-verification must compare fields, not just the decision label — otherwise a changed ' +
      'confidence or candidate set would go unnoticed',
  );
});

test('I-12: the pack exports a date, never a precise timestamp', async () => {
  const src = await readRepoFile(EVIDENCE_SRC);
  assert.match(src, /generatedOn:\s*string/);
  assert.ok(
    /不含时刻|YYYY-MM-DD/.test(src),
    'a precise timestamp leaks detection timing and adds no verification value',
  );
});

test('I-12: raw observations are optional — the default export stays small', async () => {
  const src = await readRepoFile(EVIDENCE_SRC);
  assert.match(src, /observations\?:/);
  assert.match(src, /includeObservations\?: boolean/);
});

test('I-12: serialization is deterministic, because its digest goes into the verdict', async () => {
  const src = await readRepoFile(EVIDENCE_SRC);
  assert.match(src, /SerializeEvidencePack/);
  assert.match(src, /DigestEvidencePack/);
  assert.ok(
    /逐字节相同的字符串/.test(src),
    'the pack hash is embedded in the verdict, so serialization must be byte-stable',
  );
});

test('I-12: the library hash is defined over a canonical form and is verifiable by third parties', async () => {
  const src = await readRepoFile(LIBRARY_SRC);
  assert.match(src, /ComputeLibraryHash/);
  assert.match(src, /integrity:\s*LibraryIntegrity/);
  assert.ok(
    /canonicalJson/.test(src),
    'the library hash must be defined in terms of canonicalJson, so anyone can recompute it',
  );
  assert.ok(
    /不等于.*LIBRARY_MALFORMED|不等则 `LIBRARY_MALFORMED`/.test(src),
    'a hash mismatch must be a hard load failure, not a warning',
  );
});

test('I-12: usable-ness of entries is recomputed on load, never trusted from the file', async () => {
  const src = await readRepoFile(LIBRARY_SRC);
  assert.ok(
    /不采信文件里的 `usable`|由加载器重算/.test(src),
    'trusting an editable `usable` flag would let a tampered bank silently widen its own thresholds',
  );
  assert.match(src, /usable\?:\s*boolean/);
});

test('I-12: the three-part version semantics are frozen and distinguished', async () => {
  const src = await readRepoFile(LIBRARY_SRC);
  assert.match(src, /schemaVersion/);
  assert.match(src, /extractorVersion/);
  assert.match(src, /bankVersion/);
  assert.ok(
    /拒绝加载/.test(src),
    'incompatible schema or extractor must refuse to load — silent mixed-version comparison is the ' +
      'most dangerous failure mode here',
  );
});
