import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REQUIREMENT_STATUSES, buildTrace, linksOfCase, readRequirements, statusOf } from '../src/index.js';
import { BASE_CONFIG, configOf, kase, reqCsv } from './helpers.js';

const config = configOf(BASE_CONFIG);
const listOf = (rows, c = config) => ({ ...readRequirements(reqCsv(rows), 'csv', c.requirements, c.link.spec), file: 'reqs.csv' });
const ROWS = [['REQ-1', 'a', 'High', 'Approved'], ['REQ-2', 'b', 'High', 'Approved'], ['REQ-3', 'c', 'Low', 'Approved'], ['REQ-4', 'd', 'Low', 'Approved'], ['REQ-5', 'e', 'Low', 'Withdrawn']];
const traceOf = (cases, rows = ROWS, extra = {}) => buildTrace({ requirements: listOf(rows), junit: { cases }, testCases: null, link: config.link, ...extra });
const byId = (trace) => Object.fromEntries(trace.requirements.map((r) => [r.id, r]));

test('trace: the four statuses, in the order of the report', () => {
  assert.deepEqual(REQUIREMENT_STATUSES, ['not-covered', 'covered-failing', 'covered-not-run', 'covered-passing']);
  assert.equal(statusOf([]), 'not-covered');
  assert.equal(statusOf(['passed', 'failed']), 'covered-failing');
  assert.equal(statusOf(['skipped', 'error']), 'covered-failing');
  assert.equal(statusOf(['passed', 'skipped']), 'covered-passing');
  assert.equal(statusOf(['skipped', 'not-run']), 'covered-not-run');
  assert.equal(statusOf(['passed']), 'covered-passing');
});

test('trace: each requirement gets the status of the tests that name it; an excluded one is excluded', () => {
  const t = traceOf([kase('REQ-1 a'), kase('REQ-2 b', 'failed'), kase('REQ-2 c'), kase('REQ-3 d', 'skipped'), kase('REQ-5 e')]);
  const r = byId(t);
  assert.equal(r['REQ-1'].status, 'covered-passing');
  assert.equal(r['REQ-2'].status, 'covered-failing');
  assert.equal(r['REQ-3'].status, 'covered-not-run');
  assert.equal(r['REQ-4'].status, 'not-covered');
  assert.equal(r['REQ-5'].status, 'excluded');
  assert.equal(r['REQ-5'].tests.length, 1, 'the tests of an excluded requirement are still listed');
  assert.deepEqual(t.counts, { 'covered-passing': 1, 'covered-failing': 1, 'covered-not-run': 1, 'not-covered': 1 });
  assert.equal(t.included, 4);
  assert.deepEqual(t.excluded.map((x) => x.id), ['REQ-5']);
  assert.deepEqual(r['REQ-2'].results, { passed: 1, failed: 1, error: 0, skipped: 0, 'not-run': 0 });
});

test('trace: a test that runs twice, once failed and once passed, makes its requirement covered-failing', () => {
  const t = traceOf([kase('REQ-1 a', 'failed', { file: 'run-1/a.xml' }), kase('REQ-1 a', 'passed', { file: 'run-2/a.xml' })]);
  assert.equal(byId(t)['REQ-1'].status, 'covered-failing');
  assert.equal(byId(t)['REQ-1'].tests.length, 2);
});

test('trace: IDs in the name, the class name and the named properties, each test counted once per requirement', () => {
  const c = kase('REQ-1 and REQ-1 again', 'passed', { classname: 'checkout REQ-1 REQ-2', properties: [{ name: 'Requirement', value: 'REQ-3, REQ-4', line: 9 }, { name: 'other', value: 'REQ-5', line: 10 }] });
  const { links, truncated } = linksOfCase(c, config.link);
  assert.deepEqual(links.map((l) => [l.id, l.via.join(', '), l.line]), [['REQ-1', 'name, classname', c.line], ['REQ-2', 'classname', c.line], ['REQ-3', 'property Requirement', 9], ['REQ-4', 'property Requirement', 9]]);
  assert.equal(truncated, false);
});

test('trace: only the places named in link.from are read', () => {
  const nameOnly = configOf({ ...BASE_CONFIG, link: { prefixes: ['REQ-'], from: ['name'] } });
  const c = kase('test_a', 'passed', { classname: 'REQ-1', properties: [{ name: 'requirement', value: 'REQ-2', line: 3 }] });
  assert.deepEqual(linksOfCase(c, nameOnly.link).links, []);
  const propOnly = configOf({ ...BASE_CONFIG, link: { prefixes: ['REQ-'], from: ['property'], propertyNames: ['requirement'] } });
  assert.deepEqual(linksOfCase(kase('REQ-9 in the name', 'passed', { properties: [{ name: 'requirement', value: 'REQ-2', line: 3 }] }), propOnly.link).links.map((l) => l.id), ['REQ-2']);
});

test('trace: an ID that is not in the list is an orphan, with every test that names it', () => {
  const t = traceOf([kase('REQ-9 a'), kase('REQ-9 b', 'failed'), kase('REQ-1 and REQ-8')]);
  assert.deepEqual(t.orphans.map((o) => [o.id, o.tests.length]), [['REQ-9', 2], ['REQ-8', 1]]);
  assert.equal(byId(t)['REQ-1'].status, 'covered-passing');
  assert.equal(t.links, 1, 'a link to an orphan is not a link to a requirement');
});

test('trace: a test that names no ID is listed as unlinked, and the test counts add up', () => {
  const t = traceOf([kase('REQ-1 a'), kase('formats money'), kase('REQ-77 b')]);
  assert.equal(t.tests.total, 3);
  assert.equal(t.tests.linked, 2);
  assert.deepEqual(t.tests.unlinked.map((u) => u.label), ['shop.OrderTest > formats money']);
});

test('trace: the rows of a test-case export are tests too, linked through their column', () => {
  const t = buildTrace({ requirements: listOf(ROWS), junit: null, testCases: { file: 'cases.csv', column: 'Covers', cases: [{ line: 2, id: 'TC-1', title: 'Pays', result: 'passed', ids: ['REQ-1', 'REQ-2'], truncated: false }, { line: 3, id: 'TC-2', title: '', result: 'not-run', ids: ['REQ-3'], truncated: true }] }, link: config.link });
  const r = byId(t);
  assert.equal(r['REQ-1'].tests[0].via, 'column Covers');
  assert.equal(r['REQ-1'].tests[0].label, 'TC-1 Pays');
  assert.equal(r['REQ-3'].tests[0].label, 'TC-2');
  assert.equal(r['REQ-3'].status, 'covered-not-run');
  assert.equal(t.tests.testCases, 2);
  assert.equal(t.truncated, 1);
});

test('trace: duplicates and IDs no test can name are carried from the list', () => {
  const t = traceOf([kase('REQ-1')], [['REQ-1', 'a', '', ''], ['REQ-1', 'b', '', ''], ['old 3', 'c', '', '']]);
  assert.equal(t.duplicates.length, 1);
  assert.deepEqual(t.unlinkable.map((u) => u.id), ['old 3']);
  assert.equal(byId(t)['old 3'].status, 'not-covered');
});
