// The test-case export of a test management tool: a CSV file read with src/csv.js, with the columns named under
// testCases in the configuration. Each row is one test case with its ID, its title when that column is named, the
// requirement IDs found in its requirements column (with the same link spec as the JUnit results), and its result.
// The result is passed, failed or skipped when the value is listed under testCases.passed, testCases.failed or
// testCases.skipped (compared without case); an empty value, or a value that is not listed, is not run, and a note
// names such values. A test case is never passing unless its result says so.

import { CsvError, parseCsv } from './csv.js';
import { norm } from './config.js';
import { findIds } from './link.js';
import { safeText } from './text.js';

export const TEST_CASE_LIMITS = { maxTestCases: 100000 };

const FIELDS = ['id', 'title', 'requirements', 'result'];

// Reads the export. config: the testCases part of the configuration; spec: the link spec. Returns { cases, unlisted,
// problem } where cases is [{ line, id, title, result, resultText, ids, truncated }] and unlisted maps each result value
// that is not listed to its count. problem is a reason when the export cannot be used; then cases is empty.
export function readTestCases(text, config, spec, limits = TEST_CASE_LIMITS) {
  const lim = { ...TEST_CASE_LIMITS, ...limits };
  let parsed;
  try {
    parsed = parseCsv(text, { delimiter: config.delimiter ?? ',' });
  } catch (error) {
    if (error instanceof CsvError) return { cases: [], unlisted: new Map(), problem: `line ${error.line}: ${error.reason}` };
    throw error;
  }
  const names = parsed.header.map(norm);
  const index = {};
  for (const key of FIELDS) {
    if (config.columns[key] === undefined) continue;
    const want = norm(config.columns[key]);
    const found = names.reduce((list, name, i) => (name === want ? [...list, i] : list), []);
    if (found.length === 0) return { cases: [], unlisted: new Map(), problem: `the header has no column named "${safeText(config.columns[key], 80)}" for the ${key}; the columns are ${parsed.header.map((h) => `"${safeText(h, 60)}"`).slice(0, 12).join(', ')}` };
    if (found.length > 1) return { cases: [], unlisted: new Map(), problem: `the header names "${safeText(config.columns[key], 80)}" more than once (columns ${found.map((f) => f + 1).join(', ')}), so the ${key} is not clear` };
    index[key] = found[0];
  }
  if (parsed.records.length > lim.maxTestCases) return { cases: [], unlisted: new Map(), problem: `more than ${lim.maxTestCases.toLocaleString('en-US')} test cases` };
  const outcome = new Map();
  for (const v of config.passed ?? []) outcome.set(norm(v), 'passed');
  for (const v of config.failed ?? []) outcome.set(norm(v), 'failed');
  for (const v of config.skipped ?? []) outcome.set(norm(v), 'skipped');
  const unlisted = new Map();
  const cases = [];
  for (const record of parsed.records) {
    const f = record.fields;
    const raw = f[index.result].trim();
    let result = outcome.get(norm(raw));
    if (result === undefined) {
      result = 'not-run';
      const shown = raw === '' ? '(empty)' : safeText(raw, 40);
      unlisted.set(shown, (unlisted.get(shown) ?? 0) + 1);
    }
    const found = findIds(f[index.requirements], spec);
    cases.push({
      line: record.line,
      id: safeText(f[index.id].trim(), 80),
      title: index.title === undefined ? '' : safeText(f[index.title].trim(), 160),
      result,
      resultText: safeText(raw, 40),
      ids: found.ids.map((x) => x.id),
      truncated: found.truncated
    });
  }
  return { cases, unlisted, problem: null };
}
