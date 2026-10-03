import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEST_CASE_LIMITS, linkSpec, readTestCases } from '../src/index.js';
import { lineOf } from './helpers.js';

const spec = linkSpec({ prefixes: ['REQ-'] });
const CONFIG = { columns: { id: 'Key', title: 'Summary', requirements: 'Covers', result: 'Last Result' }, delimiter: ',', passed: ['Passed'], failed: ['Failed'], skipped: ['Blocked'] };
const read = (text, config = CONFIG, limits) => readTestCases(text, config, spec, limits);

test('test cases: each row with its ID, title, the IDs in its requirements column and its result', () => {
  const text = 'Key,Summary,Covers,Last Result\nTC-1,Pays,"REQ-1, REQ-2",Passed\nTC-2,Ships,REQ-3,failed\nTC-3,Splits,REQ-4,BLOCKED\n';
  const r = read(text);
  assert.equal(r.problem, null);
  assert.deepEqual(r.cases.map((c) => [c.id, c.title, c.ids, c.result, c.line]), [['TC-1', 'Pays', ['REQ-1', 'REQ-2'], 'passed', lineOf(text, 'TC-1')], ['TC-2', 'Ships', ['REQ-3'], 'failed', lineOf(text, 'TC-2')], ['TC-3', 'Splits', ['REQ-4'], 'skipped', lineOf(text, 'TC-3')]]);
  assert.equal(r.unlisted.size, 0);
});

test('test cases: an empty result or a result that is not listed is not run, and is counted for a note', () => {
  const r = read('Key,Summary,Covers,Last Result\nTC-1,a,REQ-1,\nTC-2,b,REQ-2,Retest\nTC-3,c,REQ-3,Retest\n');
  assert.deepEqual(r.cases.map((c) => c.result), ['not-run', 'not-run', 'not-run']);
  assert.deepEqual([...r.unlisted.entries()], [['(empty)', 1], ['Retest', 2]]);
});

test('test cases: the title column is optional, and a row with no ID in its requirements column names nothing', () => {
  const r = read('Key,Covers,Last Result\nTC-1,,Passed\nTC-2,see the wiki,Passed\n', { ...CONFIG, columns: { id: 'Key', requirements: 'Covers', result: 'Last Result' } });
  assert.deepEqual(r.cases.map((c) => [c.title, c.ids]), [['', []], ['', []]]);
});

test('test cases: a missing column, a column named twice and bad quoting are problems', () => {
  assert.match(read('Key,Summary,Last Result\nTC-1,a,Passed\n').problem, /the header has no column named "Covers" for the requirements/);
  assert.match(read('Key,Summary,Covers,covers,Last Result\nTC-1,a,b,c,d\n').problem, /names "Covers" more than once \(columns 3, 4\)/);
  assert.match(read('Key,Summary,Covers,Last Result\nTC-1,a"b,REQ-1,Passed\n').problem, /^line 2: a double quote inside a field that is not in double quotes/);
});

test('test cases: the delimiter of the configuration is used, and the number of rows has a limit', () => {
  const r = read('Key;Summary;Covers;Last Result\nTC-1;a, b;REQ-1;Passed\n', { ...CONFIG, delimiter: ';' });
  assert.equal(r.cases[0].title, 'a, b');
  assert.equal(TEST_CASE_LIMITS.maxTestCases, 100000);
  assert.match(read('Key,Summary,Covers,Last Result\nTC-1,a,REQ-1,Passed\nTC-2,a,REQ-1,Passed\n', CONFIG, { maxTestCases: 1 }).problem, /more than 1 test cases/);
});

test('test cases: more than 50 IDs in one cell are cut to 50 and marked', () => {
  const cell = Array.from({ length: 55 }, (_, i) => `REQ-${i + 1}`).join(' ');
  const r = read(`Key,Summary,Covers,Last Result\nTC-1,a,${cell},Passed\n`);
  assert.equal(r.cases[0].ids.length, 50);
  assert.equal(r.cases[0].truncated, true);
});
