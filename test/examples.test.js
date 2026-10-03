import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../src/index.js';

const root = resolve(fileURLToPath(import.meta.url), '..', '..');

const ARGS = ['--config', 'examples/config.json', '--requirements', 'examples/order-app/requirements.csv', '--junit', 'examples/order-app/results/api', '--junit', 'examples/order-app/results/ui', '--test-cases', 'examples/order-app/test-cases.csv'];

async function run(argv, base = root) {
  let out = '';
  let err = '';
  const code = await main(argv, { out: (t) => { out += t; }, err: (t) => { err += t; } }, undefined, base);
  return { code, out, err };
}

const saved = (name) => readFile(resolve(root, 'examples/output', name), 'utf8');

test('examples: the order service fails its gates with the report that is saved in examples/output', async () => {
  const r = await run(ARGS);
  assert.equal(r.code, 1);
  assert.equal(r.err, '');
  assert.equal(r.out, await saved('order-app.txt'));
  assert.match(r.out, /gates: 2 met, 5 not met/);
  assert.match(r.out, /RESULT: FAIL - 5 gates not met\n$/);
});

test('examples: --explain, Markdown and JSON are the reports that are saved', async () => {
  assert.equal((await run([...ARGS, '--explain'])).out, await saved('order-app-explain.txt'));
  assert.equal((await run([...ARGS, '--format', 'markdown', '--explain'])).out, await saved('order-app.md'));
  assert.equal((await run([...ARGS, '--format', 'json', '--explain'])).out, await saved('order-app.json'));
});

test('examples: each requirement has the status that the README says', async () => {
  const report = JSON.parse((await run([...ARGS, '--format', 'json'])).out);
  assert.deepEqual(Object.fromEntries(report.requirements.map((r) => [r.id, r.status])), {
    'ORD-1': 'covered-passing',
    'ORD-2': 'covered-passing',
    'ORD-3': 'covered-failing',
    'ORD-4': 'covered-passing',
    'ORD-5': 'covered-passing',
    'ORD-6': 'covered-failing',
    'ORD-7': 'covered-failing',
    'ORD-8': 'covered-not-run',
    'ORD-9': 'covered-passing',
    'ORD-10': 'excluded',
    'ORD-11': 'covered-not-run',
    'ORD-12': 'not-covered',
    'ORD-13': 'covered-passing',
    'ORD-14': 'excluded',
    'ORD-15': 'not-covered'
  });
  assert.deepEqual(report.orphans.map((o) => o.id), ['ORD-41', 'ORD-16']);
  assert.deepEqual(report.duplicates, [{ id: 'ORD-9', line: 16, first: 10 }]);
  assert.deepEqual(Object.fromEntries(report.gates.map((g) => [g.id, g.status])), { 'must-pass': 'not-met', 'not-covered': 'not-met', 'covered-failing': 'not-met', 'covered-not-run': 'met', 'passing-share': 'met', orphans: 'not-met', 'duplicate-ids': 'not-met' });
});

test('examples: the four kinds of JUnit file and the test-case export each link requirements', async () => {
  const report = JSON.parse((await run([...ARGS, '--format', 'json'])).out);
  const via = (id) => report.requirements.find((r) => r.id === id).tests.map((t) => `${t.at.split(':')[0].split('/').at(-1)} ${t.via}`);
  assert.deepEqual(via('ORD-1'), ['TEST-shop.orders.OrderApiTest.xml name', 'playwright-results.xml name']);
  assert.deepEqual(via('ORD-2'), ['jest-junit.xml name, classname', 'jest-junit.xml name, classname']);
  assert.deepEqual(via('ORD-5'), ['pytest-refunds.xml property requirement', 'pytest-refunds.xml property requirement']);
  assert.deepEqual(via('ORD-6'), ['test-cases.csv column Covers']);
});

test('examples: without the UI run, the requirements only the UI tests cover are not covered', async () => {
  const report = JSON.parse((await run([...ARGS.slice(0, 6), ...ARGS.slice(8), '--format', 'json'])).out);
  assert.equal(report.inputs.junit.files, 2);
  assert.equal(report.requirements.find((r) => r.id === 'ORD-2').status, 'not-covered');
  assert.equal(report.requirements.find((r) => r.id === 'ORD-1').status, 'covered-passing');
});

test('examples: the same files written with CRLF line ends give the same reports, with the same lines', async () => {
  const dir = await mkdtemp(resolve(tmpdir(), 'trace-matrix-check-crlf-'));
  try {
    await cp(resolve(root, 'examples'), resolve(dir, 'examples'), { recursive: true });
    const walk = async (rel) => {
      for (const e of await readdir(resolve(dir, rel), { withFileTypes: true })) {
        const r = `${rel}/${e.name}`;
        if (e.isDirectory()) await walk(r);
        else if (!r.startsWith('examples/output/')) {
          const text = (await readFile(resolve(dir, r), 'utf8')).split('\r\n').join('\n');
          await writeFile(resolve(dir, r), text.split('\n').join('\r\n'));
        }
      }
    };
    await walk('examples');
    const r = await run([...ARGS, '--explain'], dir);
    assert.equal(r.code, 1);
    assert.equal(r.out, await saved('order-app-explain.txt'));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
