// Command line: trace-matrix-check --config <file> --requirements <file> (--junit <path> | --test-cases <file>) [options]

import { readFileSync } from 'node:fs';
import { InputError, checkPaths, GATES } from './check.js';
import { toText, toMarkdown, toJson } from './report.js';
import { safeText } from './text.js';

export const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;

const FORMATS = { text: toText, markdown: toMarkdown, json: toJson };

export const USAGE = `Usage: trace-matrix-check --config <file> --requirements <file> (--junit <path> | --test-cases <file>) [options]

Builds a requirements traceability matrix from a requirements list and the results of the tests, and checks it against
the gates of a configuration file. Each requirement is covered-passing, covered-failing, covered-not-run (its tests
were skipped or not run) or not covered; tests that name an ID the list does not hold, IDs on more than one row and
requirements excluded by their status are listed. A test names a requirement through a prefix and a fixed set of ID
characters, never through a pattern of your own. Every number of a gate is yours; the tool has no threshold of its own.
It refuses an XML file with a DOCTYPE, expands no entity, never runs a test, never follows a symbolic link inside a
folder, and opens no network connection.

Options:
  --config <file>        the configuration file (JSON): columns, link and gates; required
  --requirements <file>  the requirements list, CSV (.csv) or JSON (.json); required
  --junit <path>         JUnit XML results: a file, or a folder read with its subfolders; repeat for more runs
  --test-cases <file>    the CSV export of the test cases of a test management tool
  --format <name>        text, markdown or json (default: text)
  --explain              list for each requirement the tests that name it, with the result, where the ID was found
                         and the file and line, and the facts and sentences each gate rests on
  --help                 show this text
  --version              show the version

Give --junit, --test-cases or both.

Gates: ${GATES.map((g) => `${g.id} (gates.${g.key})`).join(', ')}.

Exit codes: 0 every gate met, 1 a gate not met, 2 usage or input error.
`;

const isUrl = (f) => /^[a-z][a-z0-9+.-]*:\/\//i.test(f);

export function parseArgs(argv) {
  const o = { config: null, requirements: null, junit: [], testCases: null, format: 'text', explain: false, help: false, version: false };
  const once = (name, current, value) => {
    if (current !== null) throw new Error(`${name} was given twice`);
    return value;
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => {
      const v = argv[i + 1];
      if (v === undefined || (v.startsWith('--') && v.length > 2)) throw new Error(`${a} needs a value`);
      if (v === '-') throw new Error('reading from standard input is not supported; give a file or a folder');
      i += 1;
      return v;
    };
    if (a === '--help' || a === '-h') o.help = true;
    else if (a === '--version' || a === '-v') o.version = true;
    else if (a === '--explain') o.explain = true;
    else if (a === '--config') o.config = once(a, o.config, next());
    else if (a === '--requirements') o.requirements = once(a, o.requirements, next());
    else if (a === '--junit') o.junit.push(next());
    else if (a === '--test-cases') o.testCases = once(a, o.testCases, next());
    else if (a === '--format') o.format = next();
    else if (a === '-') throw new Error('reading from standard input is not supported; give a file or a folder');
    else if (a.startsWith('-')) throw new Error(`unknown argument ${a}`);
    else throw new Error(`unexpected argument ${a}; give each input with its option, such as --junit ${a}`);
  }
  if (!o.help && !o.version) {
    if (!o.config) throw new Error('give the configuration file with --config <file>');
    if (!o.requirements) throw new Error('give the requirements list with --requirements <file>');
    if (!o.junit.length && !o.testCases) throw new Error('give the test results with --junit <path>, the test-case export with --test-cases <file>, or both');
    for (const p of [o.config, o.requirements, ...o.junit, o.testCases].filter(Boolean)) if (isUrl(p)) throw new Error('give a local path; the tool never fetches a URL');
    if (!Object.hasOwn(FORMATS, o.format)) throw new Error(`unknown format ${o.format} (text, markdown or json)`);
  }
  return o;
}

const clean = (text) => safeText(text, 1500);

// Exit code: 0 every gate met, 1 a gate not met, 2 usage or input error.
export async function main(argv, io = { out: (t) => process.stdout.write(t), err: (t) => process.stderr.write(t) }, limits = undefined, base = process.cwd()) {
  let o;
  try {
    o = parseArgs(argv);
  } catch (error) {
    io.err(`trace-matrix-check: ${clean(error.message)}\n\n${USAGE}`);
    return 2;
  }
  if (o.help) {
    io.out(USAGE);
    return 0;
  }
  if (o.version) {
    io.out(`${VERSION}\n`);
    return 0;
  }
  let report;
  try {
    report = await checkPaths({ config: o.config, requirements: o.requirements, junit: o.junit, testCases: o.testCases, version: VERSION, limits, base });
  } catch (error) {
    if (error instanceof InputError) io.err(`trace-matrix-check: no verdict, the input has ${error.problems.length === 1 ? 'a problem' : `${error.problems.length} problems`}:\n${error.problems.map((p) => `  ${clean(p)}`).join('\n')}\n`);
    else io.err(`trace-matrix-check: ${clean(error.message)}\n`);
    return 2;
  }
  io.out(FORMATS[o.format](report, { explain: o.explain }));
  return report.verdict.pass ? 0 : 1;
}
