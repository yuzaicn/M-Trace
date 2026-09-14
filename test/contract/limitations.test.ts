/**
 * 契约测试：诚实性（I-13）。
 *
 * Mika 的要求：分析报告第 9 节列出的**未验证部分**，在契约文档里引用时必须
 * 一并带上置信度限制，不得写成已证实的事实。
 *
 * 这条要求很容易在"文档写得流畅"的过程中走样，所以用断言把它变成可检查的性质：
 * 凡是引用未实测结论的地方，必须同时出现其置信度标注。
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { readRepoFile } from '../helpers/repo.js';

const UPSTREAM = 'docs/upstream-limitations.md';
const INTERFACE = 'docs/interface.md';

/** 分析报告 §9 明确声明未验证的四项。 */
const UNVERIFIED_CLAIMS = [
  '真实在线服务',
  '行为指纹',
  '协议层指纹',
  '文本统计指纹',
  '竞品',
];

test('I-13: the upstream limitations are transcribed verbatim from the analysis report', async () => {
  const text = await readRepoFile(UPSTREAM);
  for (const claim of UNVERIFIED_CLAIMS) {
    assert.ok(
      text.includes(claim),
      `limitations doc must mention the unverified item: ${claim}`,
    );
  }
  assert.ok(
    /未验证|未实测|not verified|not measured/i.test(text),
    'the document must mark these items as unverified in plain words',
  );
});

test('I-13: measured numbers carry their source and the ones that are engineering inference say so', async () => {
  const text = await readRepoFile(UPSTREAM);
  // 已实测的数字。
  for (const measured of ['0.921', '1.000', '36/36', '0.748', '0.486']) {
    assert.ok(
      text.includes(measured),
      `measured figure ${measured} must be recorded with its value`,
    );
  }
  // 未实测、属工程推断的结论必须被如此标注。
  assert.ok(
    /工程推断|engineering inference/i.test(text),
    'conclusions that were never measured must be labelled as engineering inference',
  );
  assert.ok(
    /中\b|medium/i.test(text) || /置信度/.test(text),
    'each unverified item should carry a confidence level',
  );
});

test('I-13: the interface contract defers to the analysis and marks it as the authority', async () => {
  const text = await readRepoFile(INTERFACE);
  assert.ok(
    /GUCH-356/.test(text),
    'the contract must cite the analysis issue as its source of measured claims',
  );
  assert.ok(
    /未实测|未验证/.test(text),
    'the contract itself must flag which of its claims rest on unmeasured routes',
  );
});

test('I-13: route C/D are never presented as proven in the frozen contract', async () => {
  const text = await readRepoFile(INTERFACE);
  // 找出提到 C/D 的段落，断言其附近有限制措辞。
  const paragraphs = text.split(/\n{2,}/);
  const mentioning = paragraphs.filter((p) =>
    /行为指纹|协议层指纹|行为\/协议/.test(p),
  );
  assert.ok(mentioning.length > 0, 'the contract should discuss routes C/D');
  const flagged = mentioning.filter((p) =>
    /未实测|推断|预期|不承诺|尚未/.test(p),
  );
  assert.ok(
    flagged.length > 0,
    'every place the contract discusses the behaviour/protocol routes must carry a limitation note — ' +
      'their benefit was never measured',
  );
});

test('I-13: the confidence ceiling of the credibility layer is stated, not implied', async () => {
  const text = await readRepoFile(INTERFACE);
  assert.ok(
    /近 100%|near-100%|拦截率/.test(text),
    'the credibility layer rejection figure comes from one offline experiment and must be quoted ' +
      'with that scope, not as a general claim',
  );
});
