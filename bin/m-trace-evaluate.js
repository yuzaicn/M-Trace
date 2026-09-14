#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { evaluateDataset } from '../src/evaluate/evaluator.js';

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
}

const input = option('--input');
const maxDistance = option('--max-distance');
const minMargin = option('--min-margin');
if (!input || !maxDistance || !minMargin || process.argv.includes('--help')) {
  console.log(
    'Usage: m-trace-evaluate --input dataset.json --max-distance VALUE --min-margin VALUE [--seed 73013]',
  );
  process.exit(process.argv.includes('--help') ? 0 : 2);
}
const dataset = JSON.parse(await readFile(input, 'utf8'));
const report = evaluateDataset(dataset, {
  maxDistance: Number(maxDistance),
  minMargin: Number(minMargin),
  seed: Number(option('--seed', '73013')),
});
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.openSet.pass ? 0 : 1;
