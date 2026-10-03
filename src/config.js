// The configuration file: where the requirements and the test-case export keep their columns, how a test names a
// requirement, and the gates. Every gate is optional and every number comes from this file (the tool has no built-in
// threshold), but a file must state at least one gate. Every key the tool does not know is an error, so a typo such as
// maxNotCoverd cannot silently switch a gate off. The file is read with the strict JSON reader of src/json.js, which
// refuses an object that names a key twice. validateConfig returns the configuration in the form the rest of the tool
// uses, or throws a ConfigError that lists every problem with its line.

import { JsonError, jsonProblem, parseJson } from './json.js';
import { scaledPercent } from './ratio.js';
import { isDelimiter } from './csv.js';
import { LINK_FIELDS, ID_CHARACTERS } from './data.js';
import { LINK_LIMITS, PREFIX_CHARACTERS, asciiUpper, linkSpec } from './link.js';
import { safeText } from './text.js';

export const CONFIG_LIMITS = { maxStatuses: 100, maxPriorities: 50, maxResults: 100, maxPropertyNames: 20, maxString: 200 };

// The keys of the configuration file, as a tree: what each level may hold.
export const KEYS = {
  name: 'string',
  requirements: {
    columns: { id: 'string', title: 'string', priority: 'string', status: 'string' },
    delimiter: 'delimiter',
    excludeStatuses: 'strings'
  },
  link: {
    prefixes: 'prefixes',
    idCharacters: 'idCharacters',
    ignoreCase: 'boolean',
    from: 'from',
    propertyNames: 'strings'
  },
  testCases: {
    columns: { id: 'string', title: 'string', requirements: 'string', result: 'string' },
    delimiter: 'delimiter',
    passed: 'strings',
    failed: 'strings',
    skipped: 'strings'
  },
  gates: {
    mustPass: { priorities: 'strings' },
    maxNotCovered: 'count',
    maxFailing: 'count',
    maxNotRun: 'count',
    minPassingShare: 'percent',
    maxOrphans: 'count',
    maxDuplicateIds: 'count'
  }
};

export class ConfigError extends Error {
  constructor(problems) {
    super(problems.map((p) => p.text).join('\n'));
    this.problems = problems;
  }
}

// A name or a value compared without case, without white space around it and with runs of white space as one space.
export const norm = (value) => String(value).trim().replace(/\s+/g, ' ').toLowerCase();

// The edit distance of two short words, for the "did you mean" of an unknown key.
function distance(a, b) {
  if (a.length > 40 || b.length > 40) return 99;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = row;
  }
  return prev[b.length];
}

const kindOf = (v) => (v === null ? 'null' : Array.isArray(v) ? 'an array' : typeof v === 'object' ? 'an object' : typeof v === 'string' ? 'a string' : typeof v === 'number' ? 'a number' : 'a boolean');
const CONTROL = /[\u0000-\u001f\u007f]/;

// Checks the value of the configuration against KEYS and builds the normal form.
export function validateConfig(value, lines = new Map(), file = 'config') {
  const problems = [];
  const lim = CONFIG_LIMITS;
  const at = (path) => (path === '' ? file : `${file}${lines.has(path) ? `:${lines.get(path)}` : ''}: ${path}`);
  // Records a problem and gives undefined, so a checked value that is wrong is never used.
  const bad = (path, message) => {
    problems.push({ path, text: `${at(path)}: ${message}` });
  };
  const has = (prefix) => problems.some((p) => p.path === prefix || p.path.startsWith(`${prefix}.`) || p.path.startsWith(`${prefix}[`));

  const text = (v, path) => {
    if (typeof v !== 'string' || v.trim() === '') return bad(path, `must be a string that is not empty, not ${kindOf(v)}`);
    if (v.length > lim.maxString || CONTROL.test(v)) return bad(path, `must be at most ${lim.maxString} characters with no control character`);
    return v;
  };
  const strings = (v, path, max) => {
    if (!Array.isArray(v)) return bad(path, `must be a list of strings, not ${kindOf(v)}`);
    if (v.length === 0) return bad(path, 'is an empty list; name at least one');
    if (v.length > max) return bad(path, `holds more than ${max} entries`);
    const out = [];
    const seen = new Set();
    let ok = true;
    v.forEach((s, i) => {
      const t = text(s, `${path}[${i}]`);
      if (t === undefined) ok = false;
      else if (seen.has(norm(t))) {
        bad(`${path}[${i}]`, `${safeText(t, 60)} is named twice (compared without case)`);
        ok = false;
      } else {
        seen.add(norm(t));
        out.push(t);
      }
    });
    return ok ? out : undefined;
  };
  const count = (v, path) => {
    if (typeof v !== 'number') return bad(path, `must be a whole number of 0 or more, not ${kindOf(v)}`);
    if (!Number.isSafeInteger(v) || v < 0) return bad(path, `${safeText(String(v), 30)} is not a whole number of 0 or more`);
    return v;
  };
  const percent = (v, path) => {
    if (typeof v !== 'number') return bad(path, `must be a number from 0 to 100, not ${kindOf(v)}`);
    const s = scaledPercent(v);
    if (s === null) return bad(path, `${safeText(String(v), 30)} is not a percentage from 0 to 100 with at most four decimals`);
    return { scaled: s, shown: v };
  };
  const prefixes = (v, path) => {
    if (!Array.isArray(v)) return bad(path, `must be a list of prefixes, not ${kindOf(v)}`);
    if (v.length === 0 || v.length > LINK_LIMITS.maxPrefixes) return bad(path, `must hold 1 to ${LINK_LIMITS.maxPrefixes} prefixes`);
    const out = [];
    let ok = true;
    v.forEach((p, i) => {
      if (typeof p !== 'string' || p.length === 0 || p.length > LINK_LIMITS.maxPrefixLength || !PREFIX_CHARACTERS.test(p)) {
        bad(`${path}[${i}]`, `a prefix is 1 to ${LINK_LIMITS.maxPrefixLength} of the characters A-Z a-z 0-9 . _ : # / - (no pattern: the tool runs no regular expression from the configuration)`);
        ok = false;
      } else if (out.some((o) => asciiUpper(o) === asciiUpper(p))) {
        bad(`${path}[${i}]`, `the prefix ${p} is named twice`);
        ok = false;
      } else out.push(p);
    });
    return ok ? out : undefined;
  };
  const from = (v, path) => {
    if (!Array.isArray(v) || v.length === 0) return bad(path, `must be a list of one or more of ${LINK_FIELDS.join(', ')}`);
    const out = [];
    let ok = true;
    v.forEach((f, i) => {
      if (typeof f !== 'string' || !LINK_FIELDS.includes(f)) {
        bad(`${path}[${i}]`, `must be one of ${LINK_FIELDS.join(', ')}`);
        ok = false;
      } else if (out.includes(f)) {
        bad(`${path}[${i}]`, `${f} is named twice`);
        ok = false;
      } else out.push(f);
    });
    return ok ? out : undefined;
  };

  // Walks a level of the configuration against its allowed keys; returns the checked values by key.
  const level = (obj, spec, path) => {
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
      bad(path, `must be an object, not ${kindOf(obj)}`);
      return null;
    }
    const out = {};
    for (const key of Object.keys(obj)) {
      const p = path ? `${path}.${key}` : key;
      if (!Object.hasOwn(spec, key)) {
        const near = Object.keys(spec).map((k) => [k, distance(k.toLowerCase(), key.toLowerCase())]).sort((a, b) => a[1] - b[1])[0];
        bad(p, `unknown key${near && near[1] <= 3 ? `; did you mean ${near[0]}?` : `; the keys here are ${Object.keys(spec).join(', ')}`}`);
        continue;
      }
      const kind = spec[key];
      const v = obj[key];
      if (typeof kind === 'object') out[key] = level(v, kind, p);
      else if (kind === 'string') out[key] = text(v, p);
      else if (kind === 'strings') out[key] = strings(v, p, key === 'propertyNames' ? lim.maxPropertyNames : key === 'priorities' ? lim.maxPriorities : key === 'excludeStatuses' ? lim.maxStatuses : lim.maxResults);
      else if (kind === 'count') out[key] = count(v, p);
      else if (kind === 'percent') out[key] = percent(v, p);
      else if (kind === 'prefixes') out[key] = prefixes(v, p);
      else if (kind === 'from') out[key] = from(v, p);
      else if (kind === 'boolean') {
        if (typeof v !== 'boolean') bad(p, `must be true or false, not ${kindOf(v)}`);
        else out[key] = v;
      } else if (kind === 'idCharacters') {
        if (typeof v !== 'string' || !Object.hasOwn(ID_CHARACTERS, v)) bad(p, `must be one of ${Object.keys(ID_CHARACTERS).map((k) => `"${k}"`).join(', ')}`);
        else out[key] = v;
      } else if (kind === 'delimiter') {
        if (typeof v !== 'string' || !isDelimiter(v)) bad(p, 'must be one of "," ";" or a tab ("\\t")');
        else out[key] = v;
      }
    }
    return out;
  };

  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    bad('', `the configuration must be one JSON object, not ${kindOf(value)}`);
    throw new ConfigError(problems);
  }
  const top = level(value, KEYS, '');
  for (const key of ['requirements', 'link', 'gates']) if (top[key] === undefined && !has(key)) bad(key, `is needed: ${key === 'requirements' ? 'the columns of the requirements list, with at least columns.id' : key === 'link' ? 'how a test names a requirement, with prefixes and from' : 'at least one gate; a check with no gate would always pass'}`);

  const r = top.requirements;
  if (r) {
    if (!r.columns && !has('requirements.columns')) bad('requirements.columns', 'is needed, with at least id: the column that holds the requirement ID');
    else if (r.columns && r.columns.id === undefined && !has('requirements.columns')) bad('requirements.columns.id', 'is needed: the column that holds the requirement ID');
    if (r.excludeStatuses && r.columns && !r.columns.status && !has('requirements.columns')) bad('requirements.excludeStatuses', 'needs requirements.columns.status, the column that holds the status');
  }
  const l = top.link;
  if (l) {
    if (l.prefixes === undefined && !has('link.prefixes')) bad('link.prefixes', 'is needed: the prefixes an ID starts with, such as "REQ-"');
    if (l.from === undefined && !has('link.from')) bad('link.from', `is needed: where in a JUnit testcase to look for an ID, one or more of ${LINK_FIELDS.join(', ')}`);
    if (l.from?.includes('property') && l.propertyNames === undefined && !has('link.propertyNames')) bad('link.propertyNames', 'is needed when from holds property: the names of the property elements that hold IDs');
    if (l.propertyNames && l.from && !l.from.includes('property')) bad('link.propertyNames', 'names properties, but from does not hold property, so they would not be read');
  }
  const t = top.testCases;
  if (t) {
    if (!t.columns && !has('testCases.columns')) bad('testCases.columns', 'is needed, with id, requirements and result');
    else if (t.columns && !has('testCases.columns')) for (const k of ['id', 'requirements', 'result']) if (t.columns[k] === undefined) bad(`testCases.columns.${k}`, `is needed: the column that holds the ${k === 'id' ? 'test-case ID' : k === 'requirements' ? 'requirement IDs of a test case' : 'result of a test case'}`);
    for (const k of ['passed', 'failed']) if (t[k] === undefined && !has(`testCases.${k}`)) bad(`testCases.${k}`, `is needed: the values of the result column that mean ${k}`);
    if (t.passed && t.failed) {
      const lists = [['passed', t.passed], ['failed', t.failed], ['skipped', t.skipped ?? []]];
      const owner = new Map();
      for (const [k, list] of lists) for (const v of list) {
        if (owner.has(norm(v))) bad(`testCases.${k}`, `${safeText(v, 60)} is also listed under ${owner.get(norm(v))}`);
        else owner.set(norm(v), k);
      }
    }
  }
  const g = top.gates;
  if (g) {
    if (g.mustPass && g.mustPass.priorities === undefined && !has('gates.mustPass')) bad('gates.mustPass', 'needs priorities: the priorities whose requirements must be covered-passing');
    if (g.mustPass && !top.requirements?.columns?.priority && !has('requirements')) bad('gates.mustPass', 'needs requirements.columns.priority, the column that holds the priority');
    const any = ['mustPass', 'maxNotCovered', 'maxFailing', 'maxNotRun', 'minPassingShare', 'maxOrphans', 'maxDuplicateIds'].some((k) => g[k] !== undefined && g[k] !== null);
    if (!any && !has('gates')) bad('gates', 'states no gate; a check with no gate would always pass');
  }
  if (problems.length) throw new ConfigError(problems);

  const spec = linkSpec({ prefixes: l.prefixes, idCharacters: l.idCharacters ?? 'digits', ignoreCase: l.ignoreCase ?? false });
  return {
    name: typeof top.name === 'string' ? safeText(top.name, 120) : '',
    requirements: { columns: { ...r.columns }, delimiter: r.delimiter ?? ',', excludeStatuses: r.excludeStatuses ?? [] },
    link: { spec, prefixes: l.prefixes, idCharacters: spec.idCharacters, ignoreCase: spec.ignoreCase, from: l.from, propertyNames: l.propertyNames ?? [] },
    testCases: t ? { columns: { ...t.columns }, delimiter: t.delimiter ?? ',', passed: t.passed, failed: t.failed, skipped: t.skipped ?? [] } : null,
    gates: g
  };
}

// Reads the text of a configuration file into the normal form. file is the path shown. Throws ConfigError with every
// problem.
export function readConfig(text, file = 'config') {
  let parsed;
  try {
    parsed = parseJson(text);
  } catch (error) {
    if (error instanceof JsonError) throw new ConfigError([{ path: '', text: `${file}: ${jsonProblem(error, text)}` }]);
    throw error;
  }
  return validateConfig(parsed.value, parsed.lines, file);
}
