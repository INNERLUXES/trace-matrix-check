import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GATES, MAX_DETAILS, STATUSES, buildTrace, decide, evaluate, readRequirements } from '../src/index.js';
import { BASE_CONFIG, configOf, kase, reqCsv } from './helpers.js';

const config = configOf(BASE_CONFIG);
const ROWS = [['REQ-1', 'a', 'High', 'Approved'], ['REQ-2', 'b', 'High', 'Approved'], ['REQ-3', 'c', 'Low', 'Approved'], ['REQ-4', 'd', 'Low', 'Approved'], ['REQ-5', 'e', 'High', 'Withdrawn']];
const traceOf = (cases, rows = ROWS) => buildTrace({ requirements: { ...readRequirements(reqCsv(rows), 'csv', config.requirements, config.link.spec), file: 'reqs.csv' }, junit: { cases }, testCases: null, link: config.link });
const gates = (object) => configOf({ ...BASE_CONFIG, gates: object }).gates;
const one = (object, trace) => evaluate(gates(object), trace)[0];
// REQ-1 passing, REQ-2 failing, REQ-3 not run, REQ-4 not covered, REQ-5 excluded; REQ-9 is an orphan.
const MIXED = () => traceOf([kase('REQ-1 a'), kase('REQ-2 b', 'failed'), kase('REQ-3 c', 'skipped'), kase('REQ-9 d')]);

test('gates: the list of gates, each with a key, a title and one or two sentences', () => {
  assert.deepEqual(GATES.map((g) => g.id), ['must-pass', 'not-covered', 'covered-failing', 'covered-not-run', 'passing-share', 'orphans', 'duplicate-ids']);
  assert.deepEqual(STATUSES, ['met', 'not-met']);
  assert.deepEqual(evaluate(gates({ maxOrphans: 1, maxNotCovered: 1 }), MIXED()).map((g) => g.id), ['not-covered', 'orphans'], 'only stated gates run, in report order');
});

test('gates: must-pass is met only when every included requirement of the priorities is covered-passing', () => {
  const g = one({ mustPass: { priorities: ['high'] } }, MIXED());
  assert.equal(g.status, 'not-met');
  assert.equal(g.rule, 'every requirement of priority high is covered-passing');
  assert.equal(g.actual, '1 of 2 requirements covered-passing');
  assert.deepEqual(g.details, ['REQ-2 (High): covered-failing']);
  assert.equal(g.facts.length, 2, 'the excluded REQ-5 is not in the gate');
  const ok = one({ mustPass: { priorities: ['High'] } }, traceOf([kase('REQ-1 a'), kase('REQ-2 b')]));
  assert.equal(ok.status, 'met');
  assert.equal(ok.reason, '');
  const low = one({ mustPass: { priorities: ['Low', 'Medium', 'High'] } }, MIXED());
  assert.equal(low.rule, 'every requirement of priority Low, Medium or High is covered-passing');
  assert.match(low.reason, /no requirement has the priority Medium; check the spelling/);
});

test('gates: must-pass is not met for a priority that no requirement has, even when nothing fails', () => {
  const g = one({ mustPass: { priorities: ['Hihg'] } }, traceOf([kase('REQ-1'), kase('REQ-2'), kase('REQ-3'), kase('REQ-4')]));
  assert.equal(g.status, 'not-met');
  assert.deepEqual(g.details, ['no requirement has the priority Hihg']);
  const excludedOnly = one({ mustPass: { priorities: ['High'] } }, traceOf([], [['REQ-1', 'a', 'High', 'Withdrawn'], ['REQ-2', 'b', 'Low', 'Approved']]));
  assert.equal(excludedOnly.status, 'met', 'a priority whose requirements are all excluded has nothing left to fail');
  assert.equal(excludedOnly.actual, '0 of 0 requirements covered-passing');
});

test('gates: the three count gates, each met at the limit and not met one above it', () => {
  const t = MIXED();
  for (const [key, id, n] of [['maxNotCovered', 'not-covered', 1], ['maxFailing', 'covered-failing', 1], ['maxNotRun', 'covered-not-run', 1]]) {
    const at = one({ [key]: n }, t);
    assert.equal(at.id, id);
    assert.equal(at.status, 'met', `${id} at the limit`);
    const below = one({ [key]: n - 1 }, t);
    assert.equal(below.status, 'not-met', `${id} one above the limit`);
    assert.equal(below.reason, `${n} is above ${n - 1}`);
    assert.equal(below.details.length, 1);
  }
  assert.equal(one({ maxNotCovered: 0 }, t).actual, '1 requirement of 4 not covered');
  assert.deepEqual(one({ maxNotCovered: 0 }, t).details, ['REQ-4 (Low) d']);
});

test('gates: passing-share compares with whole numbers, so a share just under the limit is not met', () => {
  const rows = Array.from({ length: 3 }, (_, i) => [`REQ-${i + 1}`, 't', 'High', 'Approved']);
  const t = traceOf([kase('REQ-1'), kase('REQ-2')], rows);
  assert.equal(one({ minPassingShare: 66.6666 }, t).status, 'met');
  assert.equal(one({ minPassingShare: 66.6667 }, t).status, 'not-met');
  const g = one({ minPassingShare: 70 }, t);
  assert.equal(g.actual, '66.66% (2 of 3 requirements)');
  assert.equal(g.rule, 'at least 70% of the included requirements covered-passing');
  assert.equal(one({ minPassingShare: 0 }, traceOf([], rows)).status, 'met');
});

test('gates: passing-share is not met when every requirement is excluded, because a share of nothing is not met', () => {
  const g = one({ minPassingShare: 0 }, traceOf([], [['REQ-1', 'a', 'High', 'Withdrawn']]));
  assert.equal(g.status, 'not-met');
  assert.equal(g.actual, 'no included requirement');
  assert.match(g.reason, /a share of nothing is not met/);
});

test('gates: orphans counts the distinct IDs that tests name and the list does not hold', () => {
  const t = traceOf([kase('REQ-9 a', 'passed', { file: 'r/x.xml', line: 4 }), kase('REQ-9 b'), kase('REQ-8 c')]);
  const g = one({ maxOrphans: 1 }, t);
  assert.equal(g.status, 'not-met');
  assert.equal(g.actual, '2 orphan IDs in 3 tests');
  assert.deepEqual(g.details, ['REQ-9: named by shop.OrderTest > REQ-9 a and shop.OrderTest > REQ-9 b', 'REQ-8: named by shop.OrderTest > REQ-8 c']);
  assert.deepEqual(g.facts[0], { text: 'REQ-9: shop.OrderTest > REQ-9 a (name)', at: 'r/x.xml:4' });
  assert.equal(one({ maxOrphans: 2 }, t).status, 'met');
  assert.equal(one({ maxOrphans: 0 }, traceOf([kase('REQ-1')])).status, 'met');
});

test('gates: duplicate-ids counts IDs on more than one row, with their lines', () => {
  const t = traceOf([], [['REQ-1', 'a', '', ''], ['REQ-1', 'b', '', ''], ['REQ-1', 'c', '', ''], ['REQ-2', 'd', '', ''], ['REQ-2', 'e', '', '']]);
  const g = one({ maxDuplicateIds: 1 }, t);
  assert.equal(g.status, 'not-met');
  assert.equal(g.actual, '2 IDs on more than one row');
  assert.deepEqual(g.details, ['REQ-1: lines 2, 3, 4; line 2 is used', 'REQ-2: lines 5, 6; line 5 is used']);
  assert.deepEqual(g.facts.map((f) => f.at), ['reqs.csv:3', 'reqs.csv:4', 'reqs.csv:6']);
  assert.equal(one({ maxDuplicateIds: 2 }, t).status, 'met');
});

test('gates: every gate carries its basis, details are capped, and the verdict is pass only when every gate is met', () => {
  const rows = Array.from({ length: 30 }, (_, i) => [`REQ-${i + 1}`, 't', 'Low', 'Approved']);
  const t = traceOf([], rows);
  const g = one({ maxNotCovered: 0 }, t);
  assert.equal(g.details.length, MAX_DETAILS + 1);
  assert.equal(g.details.at(-1), `and ${30 - MAX_DETAILS} more`);
  for (const r of evaluate(gates({ mustPass: { priorities: ['Low'] }, maxNotCovered: 0, maxFailing: 0, maxNotRun: 0, minPassingShare: 1, maxOrphans: 0, maxDuplicateIds: 0 }), t)) {
    assert.ok(r.basis.length >= 1 && r.basis.every((b) => b.source.startsWith('https://')), r.id);
  }
  assert.deepEqual(decide([{ status: 'met' }, { status: 'met' }]), { pass: true, met: 2, notMet: 0 });
  assert.deepEqual(decide([{ status: 'met' }, { status: 'not-met' }]), { pass: false, met: 1, notMet: 1 });
});
