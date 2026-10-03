// Report formats: text for a terminal, Markdown for a pull request or job summary, JSON for other tools. The report holds
// the matrix (every requirement with its status and the count of its tests by result), the orphan IDs, the duplicate
// IDs, the IDs no test can name, the tests that name no requirement, and every gate with its rule, what was found
// and why it is not met. With explain, every requirement also lists the tests that name it, each with its result, where
// the ID was found and the file and line, and every gate shows its facts and the sentences it rests on.

import { grouped, plural } from './size.js';

const GATE_LABEL = { met: 'MET', 'not-met': 'NOT MET' };
const STATUS_LABEL = { 'covered-passing': 'COVERED-PASSING', 'covered-failing': 'COVERED-FAILING', 'covered-not-run': 'COVERED-NOT-RUN', 'not-covered': 'NOT COVERED', excluded: 'EXCLUDED' };
// How many entries of a list the text and Markdown reports show without --explain.
const SHOWN = 12;

const head = (r) => `${r.config.file}${r.config.name ? ` (${r.config.name})` : ''}`;

function inputsLine(r) {
  const i = r.inputs;
  const parts = [`requirements ${i.requirements.file} (${plural(i.requirements.rows, 'row')})`];
  if (i.junit) parts.push(`JUnit results: ${plural(i.junit.files, 'file')}, ${plural(i.junit.testcases, 'testcase')}`);
  if (i.testCases) parts.push(`test cases ${i.testCases.file} (${plural(i.testCases.rows, 'row')})`);
  return parts.join('; ');
}

function linkLine(r) {
  const l = r.config.link;
  const from = l.from.map((f) => (f === 'property' ? `property ${l.propertyNames.join(' or ')}` : f));
  if (r.inputs.testCases) from.push('the requirements column of the test cases');
  return `prefixes ${l.prefixes.join(' ')}; ID characters ${l.idCharacters}${l.ignoreCase ? ', case ignored' : ''}; read from ${from.join(', ')}`;
}

function statusLine(r) {
  const s = r.summary.statuses;
  return `${grouped(r.summary.included)} included, ${grouped(r.summary.excluded)} excluded by status; ${grouped(s['covered-passing'])} covered-passing, ${grouped(s['covered-failing'])} covered-failing, ${grouped(s['covered-not-run'])} covered-not-run, ${grouped(s['not-covered'])} not covered`;
}

function testsLine(r) {
  const s = r.summary;
  return `${plural(s.tests, 'test')}, ${grouped(s.linkedTests)} name a requirement, ${grouped(s.unlinkedTests)} name none; ${plural(s.orphanIds, 'orphan ID')}; ${plural(s.duplicateIds, 'duplicate ID')}`;
}

// The counts of the tests of one requirement by result: "3 tests: 2 passed, 1 failed".
function resultsText(req) {
  if (!req.tests.length) return 'no test names it';
  const parts = Object.entries(req.results).filter(([, n]) => n > 0).map(([k, n]) => `${grouped(n)} ${k === 'not-run' ? 'not run' : k}`);
  return `${plural(req.tests.length, 'test')}: ${parts.join(', ')}`;
}

const verdictLine = (r) => (r.verdict.pass ? `RESULT: PASS - ${plural(r.counts.met, 'gate')} met` : `RESULT: FAIL - ${plural(r.counts.notMet, 'gate')} not met`);
const more = (n) => `and ${grouped(n)} more (--explain lists all)`;

export function toText(r, { explain = false } = {}) {
  const lines = [`trace-matrix-check: ${head(r)}`, `inputs: ${inputsLine(r)}`, `link: ${linkLine(r)}`, `requirements: ${statusLine(r)}`, `tests: ${testsLine(r)}`, `gates: ${r.counts.met} met, ${r.counts.notMet} not met`];
  const idWidth = Math.min(24, Math.max(2, ...r.requirements.map((q) => q.id.length)));
  const prioWidth = Math.min(16, Math.max(0, ...r.requirements.map((q) => q.priority.length)));
  lines.push('', `Requirements (${grouped(r.requirements.length)})`, '');
  for (const q of r.requirements) {
    const cells = [STATUS_LABEL[q.status].padEnd(15), q.id.padEnd(idWidth)];
    if (prioWidth) cells.push(q.priority.padEnd(prioWidth));
    if (q.title) cells.push(q.title);
    lines.push(`  ${cells.join('  ').trimEnd()}`);
    const pad = ' '.repeat(19);
    lines.push(`${pad}${q.status === 'excluded' ? `status ${q.listStatus}; ` : ''}${resultsText(q)}${q.linkable ? '' : '; the ID does not have the form of the link spec'}`);
    if (explain) for (const t of q.tests) lines.push(`${pad}- ${t.result.padEnd(7)}  ${t.at}  ${t.via}  ${t.test}${t.message ? `: ${t.message}` : ''}`);
  }
  if (r.orphans.length) {
    lines.push('', `Orphan IDs (${grouped(r.orphans.length)}): named by tests, not in the requirements list`, '');
    for (const o of explain ? r.orphans : r.orphans.slice(0, SHOWN)) {
      lines.push(`  ${o.id}  named by ${plural(o.tests.length, 'test')}`);
      for (const t of explain ? o.tests : o.tests.slice(0, 3)) lines.push(`      - ${t.at}  ${t.via}  ${t.test}`);
      if (!explain && o.tests.length > 3) lines.push(`      - ${more(o.tests.length - 3)}`);
    }
    if (!explain && r.orphans.length > SHOWN) lines.push(`  ${more(r.orphans.length - SHOWN)}`);
  }
  if (r.duplicates.length) {
    lines.push('', `Duplicate requirement IDs (${plural(r.duplicates.length, 'extra row')})`, '');
    for (const d of explain ? r.duplicates : r.duplicates.slice(0, SHOWN)) lines.push(`  ${d.id}  line ${d.line} repeats line ${d.first}; line ${d.first} is used`);
    if (!explain && r.duplicates.length > SHOWN) lines.push(`  ${more(r.duplicates.length - SHOWN)}`);
  }
  if (r.unlinkedTests.length) {
    lines.push('', `Tests that name no requirement (${grouped(r.unlinkedTests.length)})`, '');
    for (const t of explain ? r.unlinkedTests : r.unlinkedTests.slice(0, SHOWN)) lines.push(`  ${t.result.padEnd(7)}  ${t.at}  ${t.test}`);
    if (!explain && r.unlinkedTests.length > SHOWN) lines.push(`  ${more(r.unlinkedTests.length - SHOWN)}`);
  }
  lines.push('', `Gates (${grouped(r.gates.length)})`);
  for (const g of r.gates) {
    lines.push('', `  ${GATE_LABEL[g.status].padEnd(7)}  ${g.id}  ${g.title}`, `           rule: ${g.rule}`, `           found: ${g.actual}`);
    if (g.reason) lines.push(`           why: ${g.reason}`);
    for (const d of g.details) lines.push(`           - ${d}`);
    if (explain) {
      for (const f of g.facts) lines.push(`           from: ${f.at ? `${f.at}  ` : ''}${f.text}`);
      for (const b of g.basis) lines.push(`           basis: "${b.text}" (${b.section}, ${b.source})`);
    }
  }
  if (r.notes.length) lines.push('');
  for (const n of r.notes) lines.push(`note: ${n}`);
  lines.push('', verdictLine(r));
  return lines.join('\n') + '\n';
}

// A Markdown table cell: backslashes, pipes, square brackets, backticks, asterisks and underscores escaped, line breaks
// flattened, and <, > and & written as entities, so text from the input cannot break the table, make a link or be read as
// HTML.
export function mdCell(t) {
  return String(t)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/[[\]`*_]/g, (c) => `\\${c}`)
    .replace(/\r?\n|\r/g, ' ');
}

export function toMarkdown(r, { explain = false } = {}) {
  const lines = [`## trace-matrix-check: ${r.verdict.text}`, '', `Configuration: ${mdCell(head(r))}. Inputs: ${mdCell(inputsLine(r))}.`, '', `Requirements: ${mdCell(statusLine(r))}. Tests: ${mdCell(testsLine(r))}. Gates: ${r.counts.met} met, ${r.counts.notMet} not met.`];
  lines.push('', '### Matrix', '', '| Requirement | Priority | Title | Status | Tests |', '| --- | --- | --- | --- | --- |');
  for (const q of r.requirements) lines.push(`| ${mdCell(q.id)} | ${mdCell(q.priority)} | ${mdCell(q.title)} | ${q.status === 'covered-passing' ? q.status : `**${q.status}**`}${q.status === 'excluded' ? ` (${mdCell(q.listStatus)})` : ''} | ${mdCell(resultsText(q))} |`);
  lines.push('', '### Gates', '', '| Status | Gate | Rule | Found | Why |', '| --- | --- | --- | --- | --- |');
  for (const g of r.gates) lines.push(`| ${g.status === 'met' ? 'met' : '**not met**'} | ${mdCell(g.id)} | ${mdCell(g.rule)} | ${mdCell(g.actual)} | ${mdCell(g.reason)} |`);
  for (const g of r.gates) {
    if (!g.details.length && !explain) continue;
    lines.push('', `#### ${mdCell(g.id)}`, '');
    for (const d of g.details) lines.push(`- ${mdCell(d)}`);
    if (explain) {
      for (const f of g.facts) lines.push(`- from ${f.at ? `${mdCell(f.at)}: ` : ''}${mdCell(f.text)}`);
      for (const b of g.basis) lines.push(`- basis: ${mdCell(`"${b.text}" (${b.section}, ${b.source})`)}`);
    }
  }
  if (r.orphans.length) {
    lines.push('', '### Orphan IDs', '');
    for (const o of explain ? r.orphans : r.orphans.slice(0, SHOWN)) lines.push(`- ${mdCell(o.id)}: named by ${mdCell(o.tests.map((t) => `${t.test} (${t.at})`).join('; '))}`);
    if (!explain && r.orphans.length > SHOWN) lines.push(`- ${more(r.orphans.length - SHOWN)}`);
  }
  if (r.duplicates.length) {
    lines.push('', '### Duplicate requirement IDs', '');
    for (const d of explain ? r.duplicates : r.duplicates.slice(0, SHOWN)) lines.push(`- ${mdCell(d.id)}: line ${d.line} repeats line ${d.first}; line ${d.first} is used`);
    if (!explain && r.duplicates.length > SHOWN) lines.push(`- ${more(r.duplicates.length - SHOWN)}`);
  }
  if (r.unlinkedTests.length) {
    lines.push('', '### Tests that name no requirement', '');
    for (const t of explain ? r.unlinkedTests : r.unlinkedTests.slice(0, SHOWN)) lines.push(`- ${mdCell(`${t.test} (${t.result}, ${t.at})`)}`);
    if (!explain && r.unlinkedTests.length > SHOWN) lines.push(`- ${more(r.unlinkedTests.length - SHOWN)}`);
  }
  if (explain) {
    lines.push('', '### Links', '');
    for (const q of r.requirements) {
      if (!q.tests.length) continue;
      lines.push(`- ${mdCell(q.id)}: ${mdCell(q.tests.map((t) => `${t.result} ${t.test} (${t.via}, ${t.at})`).join('; '))}`);
    }
  }
  if (r.notes.length) lines.push('', '### Notes', '');
  for (const n of r.notes) lines.push(`- ${mdCell(n)}`);
  lines.push('', r.verdict.pass ? `**Result: pass** - ${plural(r.counts.met, 'gate')} met.` : `**Result: fail** - ${plural(r.counts.notMet, 'gate')} not met.`);
  return lines.join('\n') + '\n';
}

// The whole report, with the tests of every requirement, the facts and the basis of every gate.
export function toJson(r) {
  return JSON.stringify(r, null, 2) + '\n';
}
