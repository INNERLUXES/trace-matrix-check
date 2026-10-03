// The gates. Each gate compares one count or share of the matrix with one number or list from the configuration and is
// met or not met. The tool has no threshold of its own: a gate the configuration does not state is not run, and every
// limit below comes from the configuration. Every gate carries the facts it used, each with the file and line it came
// from, for --explain. Nothing in this file opens a file or runs anything.

import { FACTS, factPage } from './data.js';
import { flat, safeText } from './text.js';
import { atLeast, percentText, thresholdText } from './ratio.js';
import { grouped, listText, plural } from './size.js';
import { norm } from './config.js';

export const STATUSES = ['met', 'not-met'];

// How many entries of a list a gate names in its details, and how many facts it keeps for --explain.
export const MAX_DETAILS = 12;
export const MAX_FACTS = 200;

// Every gate that the configuration can state, in report order, with its key under gates and the sentences of the
// saved pages it rests on.
export const GATES = [
  { id: 'must-pass', key: 'mustPass', title: 'Requirements of the named priorities are covered-passing', facts: ['requirement', 'requirementsBased'] },
  { id: 'not-covered', key: 'maxNotCovered', title: 'Most requirements that no test covers', facts: ['traceability', 'testBasis'] },
  { id: 'covered-failing', key: 'maxFailing', title: 'Most requirements with a failing test', facts: ['requirement', 'testCase'] },
  { id: 'covered-not-run', key: 'maxNotRun', title: 'Most requirements whose tests did not run', facts: ['testCase', 'schemaSkipped'] },
  { id: 'passing-share', key: 'minPassingShare', title: 'Least share of requirements that are covered-passing', facts: ['requirementsBased'] },
  { id: 'orphans', key: 'maxOrphans', title: 'Most IDs that tests name and the list does not hold', facts: ['traceability'] },
  { id: 'duplicate-ids', key: 'maxDuplicateIds', title: 'Most requirement IDs on more than one row', facts: ['traceability', 'requirement'] }
];
const BY_ID = Object.fromEntries(GATES.map((g) => [g.id, g]));

const basisOf = (keys) => keys.map((k) => ({ text: flat(FACTS[k].text), section: FACTS[k].section, source: factPage(k) }));

// Builds one gate result. facts: [{ text, at }].
function gate(id, met, rule, actual, reason, details = [], facts = []) {
  const base = BY_ID[id];
  return {
    id,
    title: base.title,
    status: met ? 'met' : 'not-met',
    rule: safeText(rule, 600),
    actual: safeText(actual, 600),
    reason: met ? '' : safeText(reason, 600),
    details: details.slice(0, MAX_DETAILS).map((d) => safeText(d, 400)).concat(details.length > MAX_DETAILS ? [`and ${grouped(details.length - MAX_DETAILS)} more`] : []),
    facts: facts.slice(0, MAX_FACTS).map((f) => ({ text: safeText(f.text, 400), at: safeText(f.at, 400) })).concat(facts.length > MAX_FACTS ? [{ text: `and ${grouped(facts.length - MAX_FACTS)} more facts not listed`, at: '' }] : []),
    basis: basisOf(base.facts)
  };
}

const at = (x) => `${x.file}:${x.line}`;
const STATUS_TEXT = { 'not-covered': 'not covered', 'covered-failing': 'covered-failing', 'covered-not-run': 'covered-not-run', 'covered-passing': 'covered-passing' };
const reqText = (r) => `${r.id}${r.priority ? ` (${r.priority})` : ''}`;
const reqFact = (r) => ({ text: `${reqText(r)}: ${STATUS_TEXT[r.status]}, ${plural(r.tests.length, 'test')}`, at: at(r) });

// A list for a sentence with or: "a", "a or b", "a, b or c".
const orList = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} or ${items.at(-1)}`);

// A gate on the count of included requirements with one status.
function statusCount(id, trace, status, max, label) {
  const own = trace.requirements.filter((r) => r.status === status);
  const ok = own.length <= max;
  return gate(id, ok, `at most ${plural(max, 'requirement')} ${label}`, `${plural(own.length, 'requirement')} of ${grouped(trace.included)} ${label}`, `${own.length} is above ${max}`, own.map((r) => `${reqText(r)}${r.title ? ` ${r.title}` : ''}`), own.map(reqFact));
}

// Evaluates every gate the configuration states, in the order of GATES.
export function evaluate(gates, trace) {
  const out = [];
  if (gates.mustPass) {
    const wanted = gates.mustPass.priorities;
    const keys = new Set(wanted.map(norm));
    const present = new Set(trace.requirements.map((r) => norm(r.priority)));
    const absent = wanted.filter((p) => !present.has(norm(p)));
    const own = trace.requirements.filter((r) => !r.excluded && keys.has(norm(r.priority)));
    const failing = own.filter((r) => r.status !== 'covered-passing');
    const ok = failing.length === 0 && absent.length === 0;
    const why = [];
    if (failing.length) why.push(`${plural(failing.length, 'requirement')} of ${wanted.length === 1 ? 'that priority' : 'those priorities'} ${failing.length === 1 ? 'is' : 'are'} not covered-passing`);
    if (absent.length) why.push(`no requirement has the priority ${listText(absent.map((p) => safeText(p, 40)), 4)}; check the spelling, a priority that matches nothing checks nothing`);
    out.push(gate('must-pass', ok, `every requirement of priority ${orList(wanted.map((p) => safeText(p, 40)))} is covered-passing`, `${grouped(own.length - failing.length)} of ${plural(own.length, 'requirement')} covered-passing`, why.join('; '), [...failing.map((r) => `${reqText(r)}: ${STATUS_TEXT[r.status]}`), ...absent.map((p) => `no requirement has the priority ${safeText(p, 40)}`)], own.map(reqFact)));
  }
  if (gates.maxNotCovered !== undefined) out.push(statusCount('not-covered', trace, 'not-covered', gates.maxNotCovered, 'not covered'));
  if (gates.maxFailing !== undefined) out.push(statusCount('covered-failing', trace, 'covered-failing', gates.maxFailing, 'covered-failing'));
  if (gates.maxNotRun !== undefined) out.push(statusCount('covered-not-run', trace, 'covered-not-run', gates.maxNotRun, 'covered-not-run'));
  if (gates.minPassingShare) {
    const limit = gates.minPassingShare.scaled;
    const passing = trace.counts['covered-passing'];
    const whole = trace.included;
    const ok = whole > 0 && atLeast(passing, whole, limit);
    const others = trace.requirements.filter((r) => !r.excluded && r.status !== 'covered-passing');
    out.push(gate('passing-share', ok, `at least ${thresholdText(limit)} of the included requirements covered-passing`, whole === 0 ? 'no included requirement' : `${percentText(passing, whole)} (${grouped(passing)} of ${plural(whole, 'requirement')})`, whole === 0 ? 'every requirement is excluded by its status; a share of nothing is not met' : 'too few requirements are covered-passing', others.map((r) => `${reqText(r)}: ${STATUS_TEXT[r.status]}`), others.map(reqFact)));
  }
  if (gates.maxOrphans !== undefined) {
    const max = gates.maxOrphans;
    const n = trace.orphans.length;
    const facts = trace.orphans.flatMap((o) => o.tests.map((t) => ({ text: `${o.id}: ${t.label} (${t.via})`, at: at(t) })));
    out.push(gate('orphans', n <= max, `at most ${plural(max, 'ID')} that tests name and the requirements list does not hold`, `${plural(n, 'orphan ID')} in ${plural(trace.orphans.reduce((s, o) => s + o.tests.length, 0), 'test')}`, `${n} is above ${max}: a test names a requirement the list does not hold (removed, renamed or mistyped)`, trace.orphans.map((o) => `${o.id}: named by ${listText(o.tests.map((t) => t.label), 2)}`), facts));
  }
  if (gates.maxDuplicateIds !== undefined) {
    const max = gates.maxDuplicateIds;
    const ids = new Map();
    for (const d of trace.duplicates) {
      if (!ids.has(d.key)) ids.set(d.key, { id: d.id, first: d.first, lines: [] });
      ids.get(d.key).lines.push(d.line);
    }
    const list = [...ids.values()];
    const file = trace.requirements[0]?.file ?? '';
    out.push(gate('duplicate-ids', list.length <= max, `at most ${plural(max, 'requirement ID')} on more than one row`, `${plural(list.length, 'ID')} on more than one row`, `${list.length} is above ${max}: the first row of each is used, and the others are not in the matrix`, list.map((d) => `${d.id}: lines ${[d.first, ...d.lines].join(', ')}; line ${d.first} is used`), list.flatMap((d) => d.lines.map((l) => ({ text: `${d.id} again, first on line ${d.first}`, at: `${file}:${l}` })))));
  }
  return out;
}

// The verdict of the gates: pass when none is not met.
export function decide(results) {
  const notMet = results.filter((g) => g.status === 'not-met').length;
  return { pass: notMet === 0, met: results.length - notMet, notMet };
}
