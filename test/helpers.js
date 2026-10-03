// Shared test helpers: inputs built inline, checked in memory or written into a temporary folder that is removed after the
// test. Paths are built with resolve() from forward-slash names, so the same test runs on Linux, macOS and Windows. The
// line a test expects is found with lineOf(), which counts lines the way the tool does, so a test never holds a line
// number worked out by hand for one system only.

import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { lineStarts, main, positionOf, readConfig } from '../src/index.js';

export async function withFiles(files, fn) {
  const dir = await mkdtemp(resolve(tmpdir(), 'trace-matrix-check-'));
  try {
    for (const [rel, content] of Object.entries(files)) {
      await mkdir(dirname(resolve(dir, rel)), { recursive: true });
      await writeFile(resolve(dir, rel), content);
    }
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

// The line (from 1) of the n-th place where needle starts in text.
export function lineOf(text, needle, n = 1) {
  let at = -1;
  for (let i = 0; i < n; i += 1) {
    at = text.indexOf(needle, at + 1);
    if (at < 0) throw new Error(`${needle} is not in the text ${n} times`);
  }
  return positionOf(lineStarts(text), at).line;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

// One testcase as XML. t: { name, classname, result: 'passed' | 'failed' | 'error' | 'skipped', message, properties: { name: value } }.
export function testcase(t) {
  const attrs = [`name="${esc(t.name)}"`];
  if (t.classname !== null) attrs.push(`classname="${esc(t.classname ?? 'shop.OrderTest')}"`);
  attrs.push('time="0.01"');
  const body = [];
  if (t.properties) body.push(`<properties>${Object.entries(t.properties).map(([k, v]) => `<property name="${esc(k)}" value="${esc(v)}"/>`).join('')}</properties>`);
  if (t.result === 'failed') body.push(`<failure message="${esc(t.message ?? 'expected 1 but was 2')}" type="AssertionError">trace</failure>`);
  if (t.result === 'error') body.push(`<error message="${esc(t.message ?? 'timed out')}" type="TimeoutError">trace</error>`);
  if (t.result === 'skipped') body.push('<skipped message="later"/>');
  return body.length ? `<testcase ${attrs.join(' ')}>${body.join('')}</testcase>` : `<testcase ${attrs.join(' ')}/>`;
}

// A whole result file with one suite holding these testcases (objects for testcase(), or strings as written).
export function suite(cases, { name = 'shop.OrderTest' } = {}) {
  const body = cases.map((c) => (typeof c === 'string' ? c : testcase(c))).join('\n  ');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="${esc(name)}" tests="${cases.length}">\n  ${body}\n</testsuite>\n`;
}

// A testcase as the JUnit reader returns it, for tests of the matrix that need no files.
let offset = 0;
export function kase(name, result = 'passed', extra = {}) {
  offset += 1;
  const classname = extra.classname ?? 'shop.OrderTest';
  return { classname, name, label: `${classname} > ${name}`, suite: classname, file: extra.file ?? 'results/a.xml', line: extra.line ?? offset, offset, result, message: extra.message ?? '', properties: extra.properties ?? [] };
}

// A requirements list as CSV. rows: [[id, title, priority, status]].
export function reqCsv(rows, header = ['id', 'title', 'priority', 'status']) {
  return `${header.join(',')}\n${rows.map((r) => r.join(',')).join('\n')}\n`;
}

// The configuration that most tests use: IDs such as REQ-1 in the name, the class name or a property named requirement.
export const BASE_CONFIG = {
  requirements: { columns: { id: 'id', title: 'title', priority: 'priority', status: 'status' }, excludeStatuses: ['Withdrawn'] },
  link: { prefixes: ['REQ-'], from: ['name', 'classname', 'property'], propertyNames: ['requirement'] },
  gates: { maxNotCovered: 0 }
};

// A configuration object with some parts replaced; a part set to undefined is left out.
export function configWith(parts = {}) {
  const c = { ...BASE_CONFIG, ...parts };
  for (const k of Object.keys(c)) if (c[k] === undefined) delete c[k];
  return c;
}

// The normal form of a configuration written as an object, through the real reader.
export const configOf = (object) => readConfig(JSON.stringify(object), 'config.json');

// A configuration file text for the command line tests.
export const configText = (object) => `${JSON.stringify(object, null, 2)}\n`;

// Writes the files and runs the command line with these arguments (paths relative to the folder).
export async function run(files, args = [], limits) {
  return withFiles(files, async (dir) => {
    let out = '';
    let err = '';
    const code = await main(args, { out: (t) => { out += t; }, err: (t) => { err += t; } }, limits, dir);
    return { code, out, err };
  });
}

// Runs the command line with exactly these arguments, in a folder.
export async function cli(argv, base) {
  let out = '';
  let err = '';
  const code = await main(argv, { out: (t) => { out += t; }, err: (t) => { err += t; } }, undefined, base);
  return { code, out, err };
}

export const gate = (report, id) => report.gates.find((g) => g.id === id);
export const statuses = (report) => Object.fromEntries(report.requirements.map((r) => [r.id, r.status]));

// The arguments that most command line tests use, and the files they need.
export const ARGS = ['--config', 'config.json', '--requirements', 'reqs.csv', '--junit', 'results'];
export const REQS = reqCsv([['REQ-1', 'Place an order', 'High', 'Approved'], ['REQ-2', 'Cancel an order', 'Low', 'Approved']]);
export const PASSING = suite([{ name: 'REQ-1 places an order' }, { name: 'REQ-2 cancels an order' }, { name: 'formats money' }]);
export const filesWith = (extra = {}, config = BASE_CONFIG) => ({ 'config.json': configText(config), 'reqs.csv': REQS, 'results/a.xml': PASSING, ...extra });
