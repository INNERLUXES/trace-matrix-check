// Runs the README examples, checks that they report what the README shows, and writes the reports of the example order
// management service to examples/output. CI runs it and then fails if those files changed, so the example output in the
// repository is always the real output.

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../src/index.js';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');

// The arguments of the example; every path is relative to the root of the repository. The JUnit results come from two
// runs of the pipeline: the API job and the UI job.
const ARGS = [
  '--config', 'examples/config.json',
  '--requirements', 'examples/order-app/requirements.csv',
  '--junit', 'examples/order-app/results/api',
  '--junit', 'examples/order-app/results/ui',
  '--test-cases', 'examples/order-app/test-cases.csv'
];

// Runs the tool on files of the repository; the paths shown in the report are relative to the root of the repository.
async function run(argv) {
  let out = '';
  const code = await main(argv, { out: (t) => { out += t; }, err: (t) => process.stderr.write(t) }, undefined, root);
  return { code, out };
}

const problems = [];
function expect(name, result, code, expected, unwanted) {
  const missing = expected.filter((e) => !result.out.includes(e));
  const wrong = unwanted.filter((e) => result.out.includes(e));
  if (result.code !== code || missing.length || wrong.length) {
    problems.push(`${name}: unexpected report (exit code ${result.code}, expected ${code}; missing: ${missing.join(' / ') || 'none'}; should not appear: ${wrong.join(' / ') || 'none'})`);
  }
}

const full = await run(ARGS);
process.stdout.write(full.out);
expect('order service', full, 1, [
  'inputs: requirements examples/order-app/requirements.csv (16 rows); JUnit results: 4 files, 17 testcases; test cases examples/order-app/test-cases.csv (6 rows)',
  'requirements: 13 included, 2 excluded by status; 6 covered-passing, 3 covered-failing, 2 covered-not-run, 2 not covered',
  'tests: 23 tests, 21 name a requirement, 2 name none; 2 orphan IDs; 1 duplicate ID',
  'gates: 2 met, 5 not met',
  'COVERED-FAILING  ORD-7   Medium  Track the delivery of an order',
  '3 tests: 2 passed, 1 failed',
  'NOT COVERED      ORD-12  High    Reject an order over the credit limit',
  'EXCLUDED         ORD-10  Low     Export the orders of a day as a spreadsheet',
  'status Withdrawn; 1 test: 1 passed',
  'COVERED-NOT-RUN  ORD-11  Low     Reorder a past order in one step',
  'ORD-41  named by 1 test',
  'ORD-16  named by 1 test',
  'ORD-9  line 16 repeats line 10; line 10 is used',
  'NOT MET  must-pass',
  'found: 3 of 5 requirements covered-passing',
  'NOT MET  not-covered',
  'NOT MET  covered-failing',
  'MET      covered-not-run',
  'MET      passing-share',
  'found: 46.15% (6 of 13 requirements)',
  'NOT MET  orphans',
  'NOT MET  duplicate-ids',
  'RESULT: FAIL - 5 gates not met'
], ['RESULT: PASS', 'COVERED-PASSING  ORD-7']);

// The same service with the UI run left out: the requirements that only the UI tests cover fall back.
const apiOnly = await run(ARGS.filter((a, i, all) => a !== 'examples/order-app/results/ui' && !(a === '--junit' && all[i + 1] === 'examples/order-app/results/ui')));
expect('API run only', apiOnly, 1, ['JUnit results: 2 files, 8 testcases', 'NOT COVERED      ORD-2'], ['playwright-results.xml']);

// The README shows the whole report and the --explain lines of one requirement.
const readme = (await readFile(resolve(root, 'README.md'), 'utf8')).split('\r\n').join('\n');
if (!readme.includes(full.out)) problems.push('README: the sample output differs from a real run');

await mkdir(resolve(root, 'examples/output'), { recursive: true });
await writeFile(resolve(root, 'examples/output/order-app.txt'), full.out);
const explain = await run([...ARGS, '--explain']);
if (explain.code !== 1) problems.push(`explain: exit code ${explain.code}, expected 1`);
const explainLines = explain.out.split('\n');
const at7 = explainLines.findIndex((l) => l.includes('ORD-7   Medium'));
const ord7 = explainLines.slice(at7, at7 + 5).join('\n');
if (!readme.includes(ord7)) problems.push('README: the --explain sample of ORD-7 differs from a real run');
await writeFile(resolve(root, 'examples/output/order-app-explain.txt'), explain.out);
for (const [format, name] of [['markdown', 'order-app.md'], ['json', 'order-app.json']]) {
  const r = await run([...ARGS, '--format', format, '--explain']);
  if (r.code !== 1) problems.push(`${format}: exit code ${r.code}, expected 1`);
  await writeFile(resolve(root, 'examples/output', name), r.out);
}

if (problems.length) {
  for (const p of problems) console.error(`example: ${p}`);
  process.exit(1);
}
