// The traceability matrix: every test (a JUnit testcase or a row of the test-case export) with the requirement IDs it
// names, and every requirement with the tests that name it. A requirement that is not excluded by its status gets one
// of four statuses:
//
//   not-covered      no test names it
//   covered-failing  at least one test that names it failed or had an error
//   covered-not-run  tests name it, none failed and none passed: all were skipped or not run
//   covered-passing  tests name it, at least one passed and none failed
//
// Every execution counts: a test that is in the results twice, once failed and once passed, makes the requirement
// covered-failing. An ID that a test names and that is not in the requirements list is an orphan. Nothing here opens a
// file or runs anything.

import { findIds } from './link.js';
import { norm } from './config.js';
import { testLabel } from './junit.js';

const FAILING = new Set(['failed', 'error']);

// The links of one JUnit testcase: Map(id -> { id, via, file, line }) in the order they are found, and whether a text held
// more IDs than are read. link: { spec, from, propertyNames }.
export function linksOfCase(c, link) {
  const out = new Map();
  let truncated = false;
  const add = (text, via, line) => {
    const r = findIds(text, link.spec);
    if (r.truncated) truncated = true;
    for (const { id } of r.ids) {
      const known = out.get(id);
      if (known) {
        if (!known.via.includes(via)) known.via.push(via);
      } else out.set(id, { id, via: [via], file: c.file, line });
    }
  };
  const names = new Set(link.propertyNames.map(norm));
  for (const field of link.from) {
    if (field === 'name') add(c.name, 'name', c.line);
    else if (field === 'classname') add(c.classname, 'classname', c.line);
    else for (const p of c.properties) if (names.has(norm(p.name))) add(p.value, `property ${p.name}`, p.line);
  }
  return { links: [...out.values()], truncated };
}

// The status of an included requirement from the results of the tests that name it.
export function statusOf(results) {
  if (results.length === 0) return 'not-covered';
  if (results.some((r) => FAILING.has(r))) return 'covered-failing';
  if (results.includes('passed')) return 'covered-passing';
  return 'covered-not-run';
}

// Builds the matrix. requirements: the result of readRequirements with file; junit: { cases }; testCases: { file, cases,
// column } or null; link: the link part of the configuration.
export function buildTrace({ requirements, junit, testCases, link }) {
  const tests = [];
  let truncated = 0;
  for (const c of junit?.cases ?? []) {
    const r = linksOfCase(c, link);
    if (r.truncated) truncated += 1;
    tests.push({ kind: 'junit', label: c.label ?? testLabel(c.classname, c.name), file: c.file, line: c.line, result: c.result, message: c.message ?? '', links: r.links });
  }
  for (const c of testCases?.cases ?? []) {
    if (c.truncated) truncated += 1;
    const via = `column ${testCases.column}`;
    tests.push({ kind: 'test-case', label: c.title ? `${c.id} ${c.title}` : c.id, file: testCases.file, line: c.line, result: c.result, message: '', links: c.ids.map((id) => ({ id, via: [via], file: testCases.file, line: c.line })) });
  }

  const byKey = new Map();
  const rows = requirements.rows.map((r) => {
    const row = { ...r, file: requirements.file, tests: [] };
    byKey.set(r.key, row);
    return row;
  });
  const orphans = new Map();
  let linkCount = 0;
  for (const t of tests) {
    for (const l of t.links) {
      const entry = { label: t.label, kind: t.kind, result: t.result, message: t.message, via: l.via.join(', '), file: l.file, line: l.line };
      const req = byKey.get(l.id);
      if (req) {
        req.tests.push(entry);
        linkCount += 1;
      } else {
        let o = orphans.get(l.id);
        if (!o) {
          o = { id: l.id, tests: [] };
          orphans.set(l.id, o);
        }
        o.tests.push(entry);
      }
    }
  }
  const counts = { 'covered-passing': 0, 'covered-failing': 0, 'covered-not-run': 0, 'not-covered': 0 };
  for (const row of rows) {
    if (row.excluded) row.status = 'excluded';
    else {
      row.status = statusOf(row.tests.map((t) => t.result));
      counts[row.status] += 1;
    }
    row.results = { passed: 0, failed: 0, error: 0, skipped: 0, 'not-run': 0 };
    for (const t of row.tests) row.results[t.result] += 1;
  }
  const included = rows.filter((r) => !r.excluded);
  return {
    requirements: rows,
    included: included.length,
    excluded: rows.filter((r) => r.excluded),
    counts,
    orphans: [...orphans.values()],
    duplicates: requirements.duplicates,
    unlinkable: requirements.unlinkable,
    tests: {
      total: tests.length,
      junit: tests.filter((t) => t.kind === 'junit').length,
      testCases: tests.filter((t) => t.kind === 'test-case').length,
      linked: tests.filter((t) => t.links.length > 0).length,
      unlinked: tests.filter((t) => t.links.length === 0).map((t) => ({ label: t.label, file: t.file, line: t.line, result: t.result }))
    },
    links: linkCount,
    truncated
  };
}
