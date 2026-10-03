// Reads the inputs named on the command line, builds the traceability matrix, evaluates the gates of the configuration
// and returns one report. A file that cannot be read, a result file that is not well formed, a requirements list or a
// test-case export without the named columns or with bad quoting is an input error: the tool gives no verdict on
// evidence it only half read. The tool reads the files it is given, runs no test and opens no connection.

import { FILE_LIMITS, readResultPaths, readTextFile } from './files.js';
import { XML_LIMITS, parseXml, xmlProblem } from './xml.js';
import { readJunit } from './junit.js';
import { ConfigError, readConfig } from './config.js';
import { REQUIREMENT_LIMITS, readRequirements, requirementsKind } from './requirements.js';
import { TEST_CASE_LIMITS, readTestCases } from './testcases.js';
import { buildTrace } from './trace.js';
import { decide, evaluate, GATES } from './gates.js';
import { safeText } from './text.js';
import { grouped, listText, plural } from './size.js';

export const LIMITS = { ...FILE_LIMITS, ...XML_LIMITS, ...REQUIREMENT_LIMITS, ...TEST_CASE_LIMITS };
export { GATES };

// An error that stops the run before a verdict: every problem is one line of text.
export class InputError extends Error {
  constructor(problems) {
    super(problems.join('\n'));
    this.problems = problems;
  }
}

const shown = (text, max = 400) => safeText(text, max);

// A test that names a requirement or an orphan ID, as the report shows it.
const testOut = (t) => ({ test: shown(t.label, 300), kind: t.kind, result: t.result, ...(t.message ? { message: shown(t.message, 200) } : {}), via: shown(t.via, 200), at: shown(`${t.file}:${t.line}`, 400) });

// Reads the JUnit results of every --junit path: returns { paths, files: [{ file, cases }], cases } and pushes problems
// and notes. Every file that cannot be read is a problem.
async function readResults(paths, base, limits, problems, notes) {
  const run = await readResultPaths(paths, base, limits);
  const cases = [];
  const files = [];
  for (const f of run.files) {
    let reason = f.reason;
    if (reason === null) {
      try {
        const r = readJunit(parseXml(f.text, limits), f.file);
        cases.push(...r.cases);
        files.push({ file: f.file, cases: r.cases.length });
        for (const n of r.notes) notes.push(`${shown(f.file, 200)}: ${n}`);
      } catch (error) {
        reason = xmlProblem(error, f.text);
      }
    }
    if (reason !== null) problems.push(`${shown(f.file, 300)}: ${shown(reason)}`);
  }
  if (run.links.length) notes.push(`${plural(run.links.length, 'symbolic link')} in the result folders ${run.links.length === 1 ? 'was' : 'were'} not followed: ${listText(run.links.map((l) => shown(l, 160)), 5)}`);
  if (run.skipped.length) notes.push(`${plural(run.skipped.length, 'folder')} of tools or caches ${run.skipped.length === 1 ? 'was' : 'were'} not entered: ${listText(run.skipped.map((l) => shown(l, 160)), 5)}`);
  if (run.special.length) notes.push(`${plural(run.special.length, 'entry', 'entries')} in the result folders ${run.special.length === 1 ? 'is' : 'are'} not a regular file or folder, or could not be read: ${listText(run.special.map((u) => `${shown(u.path, 160)} (${shown(u.reason, 80)})`), 5)}`);
  if (run.otherFiles) notes.push(`${plural(run.otherFiles, 'file')} in the result folders not ending in .xml ${run.otherFiles === 1 ? 'was' : 'were'} not read`);
  if (!run.files.length) notes.push(`no XML file was found in ${shown(run.path, 300)}, so the JUnit results hold no test`);
  return { paths: run.path, files, cases };
}

// Reads the inputs and builds the report. options: config, requirements, junit (a list of paths), testCases, version,
// base, limits. Throws InputError with one line per problem.
export async function checkPaths(options) {
  const base = options.base ?? process.cwd();
  const limits = { ...LIMITS, ...(options.limits ?? {}) };
  const notes = [];
  const problems = [];
  const junitPaths = options.junit ?? [];

  let configFile;
  try {
    configFile = await readTextFile(options.config, base, limits.maxConfigBytes);
  } catch (error) {
    throw new InputError([shown(error.message)]);
  }
  let config;
  try {
    config = readConfig(configFile.text, configFile.file);
  } catch (error) {
    if (error instanceof ConfigError) throw new InputError(error.problems.map((p) => shown(p.text, 600)));
    throw error;
  }
  if (options.testCases && !config.testCases) throw new InputError([`--test-cases was given, but ${shown(configFile.file, 300)} has no testCases section that names its columns and results`]);
  if (!options.testCases && config.testCases) notes.push('the configuration names the columns of a test-case export, but --test-cases was not given; only the JUnit results were read');
  if (junitPaths.length > limits.maxResultPaths) throw new InputError([`more than ${limits.maxResultPaths} --junit paths`]);

  let requirements = null;
  const kind = requirementsKind(options.requirements);
  if (!kind) problems.push(`${shown(options.requirements, 300)}: the requirements list is read from a file ending in .csv or .json`);
  else {
    try {
      const file = await readTextFile(options.requirements, base, limits.maxFileBytes);
      const r = readRequirements(file.text, kind, config.requirements, config.link.spec, limits);
      if (r.problems.length) for (const p of r.problems) problems.push(`${shown(file.file, 300)}: ${shown(p, 500)}`);
      else requirements = { ...r, file: file.file, kind };
    } catch (error) {
      problems.push(shown(error.message));
    }
  }

  let junit = null;
  if (junitPaths.length) junit = await readResults(junitPaths, base, limits, problems, notes);

  let testCases = null;
  if (options.testCases) {
    try {
      const file = await readTextFile(options.testCases, base, limits.maxFileBytes);
      const r = readTestCases(file.text, config.testCases, config.link.spec, limits);
      if (r.problem) problems.push(`${shown(file.file, 300)}: ${shown(r.problem, 500)}`);
      else {
        testCases = { file: file.file, cases: r.cases, column: config.testCases.columns.requirements };
        if (r.unlisted.size) {
          const n = [...r.unlisted.values()].reduce((a, b) => a + b, 0);
          notes.push(`${file.file}: ${plural(n, 'test case')} ${n === 1 ? 'has' : 'have'} a result that testCases does not list (${[...r.unlisted.entries()].slice(0, 6).map(([v, k]) => `${v}: ${k}`).join(', ')}); ${n === 1 ? 'it counts' : 'they count'} as not run`);
        }
      }
    } catch (error) {
      problems.push(shown(error.message));
    }
  }

  if (problems.length) throw new InputError(problems);

  const trace = buildTrace({ requirements, junit, testCases, link: config.link });
  if (requirements.duplicates.length) notes.push(`${requirements.file}: ${plural(new Set(requirements.duplicates.map((d) => d.key)).size, 'requirement ID')} ${new Set(requirements.duplicates.map((d) => d.key)).size === 1 ? 'appears' : 'appear'} on more than one row; the first row of each is used`);
  if (requirements.unlinkable.length) notes.push(`${requirements.file}: ${plural(requirements.unlinkable.length, 'requirement ID')} ${requirements.unlinkable.length === 1 ? 'does' : 'do'} not have the form of the link spec, so no test can name ${requirements.unlinkable.length === 1 ? 'it' : 'them'}: ${listText(requirements.unlinkable.map((r) => r.id), 6)}`);
  if (trace.truncated) notes.push(`${plural(trace.truncated, 'test')} named more than 50 different IDs in one text; only the first 50 of each text were read`);
  if (trace.tests.total === 0) notes.push('the inputs hold no test, so every included requirement is not covered');

  const results = evaluate(config.gates, trace);
  const verdict = decide(results);
  return {
    tool: 'trace-matrix-check',
    version: options.version ?? '0.0.0',
    config: { file: shown(configFile.file, 300), name: config.name, link: { prefixes: config.link.prefixes, idCharacters: config.link.idCharacters, ignoreCase: config.link.ignoreCase, from: config.link.from, propertyNames: config.link.propertyNames } },
    inputs: {
      requirements: { file: shown(requirements.file, 300), rows: requirements.rows.length + requirements.duplicates.length },
      junit: junit ? { paths: shown(junit.paths, 400), files: junit.files.length, testcases: junit.cases.length } : null,
      testCases: testCases ? { file: shown(testCases.file, 300), rows: testCases.cases.length } : null
    },
    summary: {
      requirements: trace.requirements.length,
      included: trace.included,
      excluded: trace.excluded.length,
      statuses: trace.counts,
      tests: trace.tests.total,
      linkedTests: trace.tests.linked,
      unlinkedTests: trace.tests.unlinked.length,
      links: trace.links,
      orphanIds: trace.orphans.length,
      duplicateIds: new Set(trace.duplicates.map((d) => d.key)).size,
      unlinkableIds: trace.unlinkable.length
    },
    requirements: trace.requirements.map((r) => ({ id: r.id, title: r.title, priority: r.priority, listStatus: r.listStatus, status: r.status, at: `${r.file}:${r.line}`, linkable: r.linkable, results: r.results, tests: r.tests.map(testOut) })),
    orphans: trace.orphans.map((o) => ({ id: o.id, tests: o.tests.map(testOut) })),
    duplicates: trace.duplicates.map((d) => ({ id: d.id, line: d.line, first: d.first })),
    unlinkedTests: trace.tests.unlinked.map((t) => ({ test: shown(t.label, 300), result: t.result, at: shown(`${t.file}:${t.line}`, 400) })),
    gates: results,
    counts: { met: verdict.met, notMet: verdict.notMet },
    verdict: { pass: verdict.pass, text: verdict.pass ? 'pass' : 'fail' },
    notes: notes.map((n) => shown(n, 1200))
  };
}

