// The requirements list: a CSV file read with src/csv.js, or a JSON file read with src/json.js, with the columns named in
// the configuration (the names of a CSV header are compared without case and without white space around them; the
// keys of a JSON object are compared as written). Each row is one requirement with its ID, and its title, priority and
// status when those columns are named. A requirement whose status is one of requirements.excludeStatuses is excluded:
// it is listed, and it is in no gate. An ID that appears on more than one row is a duplicate: the first row is used and
// the others are listed. An ID that does not have the form of the link spec cannot be named by any test; it is listed
// too, and it stays in the gates as a requirement that no test covers.

import { CsvError, parseCsv } from './csv.js';
import { JsonError, jsonProblem, parseJson } from './json.js';
import { norm } from './config.js';
import { idKey, wholeId } from './link.js';
import { safeText } from './text.js';

export const REQUIREMENT_LIMITS = { maxRequirements: 100000, maxIdLength: 200 };

const FIELDS = ['id', 'title', 'priority', 'status'];

// The kind of a requirements file by its name: csv or json, or null.
export function requirementsKind(name) {
  if (/\.csv$/i.test(name)) return 'csv';
  if (/\.json$/i.test(name)) return 'json';
  return null;
}

// Reads the rows of a CSV file into [{ line, values: { id, title, priority, status } }]. Returns { rows } or { problem }.
function csvRows(text, columns, delimiter) {
  let parsed;
  try {
    parsed = parseCsv(text, { delimiter });
  } catch (error) {
    if (error instanceof CsvError) return { problem: `line ${error.line}: ${error.reason}` };
    throw error;
  }
  const names = parsed.header.map(norm);
  const index = {};
  for (const key of FIELDS) {
    if (columns[key] === undefined) continue;
    const want = norm(columns[key]);
    const found = names.reduce((list, name, i) => (name === want ? [...list, i] : list), []);
    if (found.length === 0) return { problem: `the header has no column named "${safeText(columns[key], 80)}" for the ${key}; the columns are ${parsed.header.map((h) => `"${safeText(h, 60)}"`).slice(0, 12).join(', ')}` };
    if (found.length > 1) return { problem: `the header names "${safeText(columns[key], 80)}" more than once (columns ${found.map((f) => f + 1).join(', ')}), so the ${key} is not clear` };
    index[key] = found[0];
  }
  return { rows: parsed.records.map((r) => ({ line: r.line, values: Object.fromEntries(Object.entries(index).map(([k, i]) => [k, r.fields[i]])) })) };
}

// Reads the rows of a JSON file: one array of objects, each with the keys named in the columns. A value must be a string;
// a key that is missing is an empty value, but the ID must be there.
function jsonRows(text, columns) {
  let parsed;
  try {
    parsed = parseJson(text);
  } catch (error) {
    if (error instanceof JsonError) return { problem: jsonProblem(error, text) };
    throw error;
  }
  const { value, lines } = parsed;
  if (!Array.isArray(value)) return { problem: 'the requirements must be one JSON array of objects, one object a requirement' };
  const rows = [];
  for (let i = 0; i < value.length; i += 1) {
    const item = value[i];
    const line = lines.get(`[${i}]`) ?? 1;
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return { problem: `line ${line}: item ${i + 1} is not an object` };
    const values = {};
    for (const key of FIELDS) {
      if (columns[key] === undefined) continue;
      if (!Object.hasOwn(item, columns[key])) continue;
      const v = item[columns[key]];
      if (typeof v !== 'string') return { problem: `line ${lines.get(`[${i}].${columns[key]}`) ?? line}: the value of "${safeText(columns[key], 60)}" must be a string` };
      values[key] = v;
    }
    rows.push({ line, values });
  }
  return { rows };
}

// Reads the list. config: { columns, delimiter, excludeStatuses }; spec: the link spec. Returns { rows, duplicates,
// unlinkable, problems } where rows is [{ line, id, key, title, priority, listStatus, excluded, linkable }] (the first row
// of each ID), and problems is a list of reasons when the list cannot be used; then the rows are empty.
export function readRequirements(text, kind, config, spec, limits = REQUIREMENT_LIMITS) {
  const lim = { ...REQUIREMENT_LIMITS, ...limits };
  const r = kind === 'json' ? jsonRows(text, config.columns) : csvRows(text, config.columns, config.delimiter ?? ',');
  const empty = { rows: [], duplicates: [], unlinkable: [] };
  if (r.problem) return { ...empty, problems: [r.problem] };
  if (r.rows.length > lim.maxRequirements) return { ...empty, problems: [`more than ${lim.maxRequirements.toLocaleString('en-US')} requirements`] };
  const excluded = new Set((config.excludeStatuses ?? []).map(norm));
  const problems = [];
  const rows = [];
  const duplicates = [];
  const unlinkable = [];
  const seen = new Map();
  for (const row of r.rows) {
    if (problems.length >= 20) break;
    const id = (row.values.id ?? '').trim();
    if (id === '') {
      problems.push(`line ${row.line}: the requirement has no ID`);
      continue;
    }
    if (id.length > lim.maxIdLength || /[\u0000-\u001f\u007f]/.test(id)) {
      problems.push(`line ${row.line}: the ID ${safeText(id, 40)} is longer than ${lim.maxIdLength} characters or holds a control character`);
      continue;
    }
    const key = idKey(id, spec);
    if (seen.has(key)) {
      duplicates.push({ id: safeText(id, 80), key, line: row.line, first: seen.get(key) });
      continue;
    }
    seen.set(key, row.line);
    const linkable = wholeId(id, spec) !== null;
    const req = {
      line: row.line,
      id: safeText(id, 80),
      key,
      title: safeText((row.values.title ?? '').trim(), 160),
      priority: safeText((row.values.priority ?? '').trim(), 40),
      listStatus: safeText((row.values.status ?? '').trim(), 40),
      excluded: config.columns.status !== undefined && excluded.has(norm(row.values.status ?? '')),
      linkable
    };
    if (!linkable) unlinkable.push(req);
    rows.push(req);
  }
  if (!problems.length && rows.length === 0) problems.push('the list holds no requirement');
  return problems.length ? { ...empty, problems } : { rows, duplicates, unlinkable, problems: [] };
}
