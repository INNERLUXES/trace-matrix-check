import { test } from 'node:test';
import assert from 'node:assert/strict';
import { USAGE, VERSION, checkPaths, mdCell, parseArgs, toJson, toMarkdown, toText } from '../src/index.js';
import { ARGS, BASE_CONFIG, PASSING, REQS, cli, configText, filesWith, lineOf, reqCsv, run, suite, withFiles } from './helpers.js';

const CASES = { columns: { id: 'Key', title: 'Summary', requirements: 'Covers', result: 'Result' }, passed: ['Passed'], failed: ['Failed'], skipped: ['Blocked'] };

test('cli: --help and --version exit 0 and print the usage and the version', async () => {
  const help = await cli(['--help']);
  assert.equal(help.code, 0);
  assert.equal(help.out, USAGE);
  for (const option of ['--config', '--requirements', '--junit', '--test-cases', '--format', '--explain']) assert.ok(USAGE.includes(option), option);
  for (const id of ['must-pass (gates.mustPass)', 'orphans (gates.maxOrphans)']) assert.ok(USAGE.includes(id), id);
  const version = await cli(['-v']);
  assert.equal(version.code, 0);
  assert.equal(version.out, `${VERSION}\n`);
  assert.match(VERSION, /^\d+\.\d+\.\d+$/);
});

test('cli: a usage error exits 2 with the reason and the usage on standard error, and nothing on standard output', async () => {
  for (const [argv, pattern] of [
    [[], /give the configuration file with --config/],
    [['--config', 'c.json'], /give the requirements list with --requirements/],
    [['--config', 'c.json', '--requirements', 'r.csv'], /give the test results with --junit <path>, the test-case export with --test-cases <file>, or both/],
    [['--config', 'c.json', '--config', 'd.json'], /--config was given twice/],
    [['--config'], /--config needs a value/],
    [['--config', '--explain'], /--config needs a value/],
    [['--config', '-'], /reading from standard input is not supported/],
    [['-'], /reading from standard input is not supported/],
    [['--strict'], /unknown argument --strict/],
    [['results'], /unexpected argument results; give each input with its option, such as --junit results/],
    [['--config', 'c.json', '--requirements', 'r.csv', '--junit', 'https://example.test/r.xml'], /give a local path; the tool never fetches a URL/],
    [['--config', 'c.json', '--requirements', 'r.csv', '--junit', 'r', '--format', 'html'], /unknown format html \(text, markdown or json\)/]
  ]) {
    const r = await cli(argv);
    assert.equal(r.code, 2, argv.join(' '));
    assert.match(r.err, pattern);
    assert.ok(r.err.includes('Usage: trace-matrix-check'));
    assert.equal(r.out, '');
  }
});

test('cli: parseArgs collects repeated --junit paths and the options', () => {
  const o = parseArgs(['--config', 'c', '--requirements', 'r.csv', '--junit', 'a', '--junit', 'b', '--test-cases', 't.csv', '--format', 'json', '--explain']);
  assert.deepEqual(o.junit, ['a', 'b']);
  assert.equal(o.testCases, 't.csv');
  assert.equal(o.format, 'json');
  assert.equal(o.explain, true);
  assert.equal(parseArgs(['--config', 'c', '--requirements', 'r', '--test-cases', 't']).junit.length, 0);
});

test('cli: every gate met exits 0; a gate not met exits 1', async () => {
  const pass = await run(filesWith(), ARGS);
  assert.equal(pass.code, 0, pass.err);
  assert.match(pass.out, /RESULT: PASS - 1 gate met\n$/);
  const fail = await run(filesWith({ 'results/a.xml': suite([{ name: 'REQ-1 places' }]) }), ARGS);
  assert.equal(fail.code, 1);
  assert.match(fail.out, /NOT MET  not-covered/);
  assert.match(fail.out, /RESULT: FAIL - 1 gate not met\n$/);
});

test('cli: an input that cannot be read exits 2 with every problem named, and no verdict', async () => {
  const broken = '<testsuite><testcase name="a"></testsuite>';
  const r = await run(filesWith({ 'results/a.xml': broken, 'results/b.xml': '<?xml version="1.0"?>\n<!DOCTYPE x [<!ENTITY a "b">]><testsuite/>', 'reqs.csv': 'key,title\nREQ-1,a\n' }), ARGS);
  assert.equal(r.code, 2);
  assert.equal(r.out, '');
  assert.match(r.err, /^trace-matrix-check: no verdict, the input has 3 problems:/);
  assert.match(r.err, /reqs\.csv: the header has no column named "id"/);
  assert.ok(r.err.includes(`results/a.xml: line 1, column ${broken.indexOf('</testsuite>') + 1}: the end tag </testsuite> does not match the start tag <testcase> at line 1`));
  assert.match(r.err, /results\/b\.xml: line 2, column 1: the file has a DOCTYPE/);
});

test('cli: a missing file, a missing folder and a requirements list of another kind exit 2', async () => {
  assert.match((await run(filesWith(), ['--config', 'nope.json', '--requirements', 'reqs.csv', '--junit', 'results'])).err, /nope\.json: no such file/);
  assert.match((await run(filesWith(), ['--config', 'config.json', '--requirements', 'nope.csv', '--junit', 'results'])).err, /nope\.csv: no such file/);
  assert.match((await run(filesWith(), ['--config', 'config.json', '--requirements', 'reqs.csv', '--junit', 'nope'])).err, /nope: no such file or folder/);
  const xlsx = await run(filesWith({ 'reqs.xlsx': 'x' }), ['--config', 'config.json', '--requirements', 'reqs.xlsx', '--junit', 'results']);
  assert.equal(xlsx.code, 2);
  assert.match(xlsx.err, /reqs\.xlsx: the requirements list is read from a file ending in \.csv or \.json/);
  assert.match((await run(filesWith(), ['--config', 'config.json', '--requirements', 'reqs.csv', '--junit', 'reqs.csv'])).err, /reqs\.csv: not an XML file/);
});

test('cli: a configuration with problems exits 2 with every problem and its line', async () => {
  const text = '{\n  "requirements": { "columns": { "id": "id" } },\n  "link": { "prefixes": ["REQ-"], "from": ["name"] },\n  "gates": { "maxNotCoverd": 0, "minPassingShare": 200 }\n}\n';
  const r = await run(filesWith({ 'config.json': text }), ARGS);
  assert.equal(r.code, 2);
  assert.match(r.err, /config\.json:4: gates\.maxNotCoverd: unknown key; did you mean maxNotCovered\?/);
  assert.match(r.err, /config\.json:4: gates\.minPassingShare: 200 is not a percentage/);
  assert.match((await run(filesWith({ 'config.json': '{"a": 1,}' }), ARGS)).err, /config\.json: line 1, column 9: a comma before the closing brace/);
});

test('cli: --test-cases needs a testCases section; a testCases section without --test-cases is a note', async () => {
  const r = await run(filesWith({ 'cases.csv': 'Key,Summary,Covers,Result\n' }), [...ARGS, '--test-cases', 'cases.csv']);
  assert.equal(r.code, 2);
  assert.match(r.err, /--test-cases was given, but config\.json has no testCases section/);
  const note = await run(filesWith({}, { ...BASE_CONFIG, testCases: CASES }), ARGS);
  assert.equal(note.code, 0);
  assert.match(note.out, /note: the configuration names the columns of a test-case export, but --test-cases was not given/);
});

test('cli: the test-case export alone is enough, and its results and unlisted values count', async () => {
  const cases = 'Key,Summary,Covers,Result\nTC-1,Pays,REQ-1,Passed\nTC-2,Cancels,REQ-2,Retest\n';
  const r = await run(filesWith({ 'cases.csv': cases }, { ...BASE_CONFIG, testCases: CASES }), ['--config', 'config.json', '--requirements', 'reqs.csv', '--test-cases', 'cases.csv', '--explain']);
  assert.equal(r.code, 0, 'REQ-2 is covered, though not run');
  assert.match(r.out, /COVERED-NOT-RUN  REQ-2/);
  assert.match(r.out, new RegExp(`- not-run  cases\\.csv:${lineOf(cases, 'TC-2')}  column Covers  TC-2 Cancels`));
  assert.match(r.out, /note: cases\.csv: 1 test case has a result that testCases does not list \(Retest: 1\); it counts as not run/);
  const bad = await run(filesWith({ 'cases.csv': 'Key,Summary,Result\n' }, { ...BASE_CONFIG, testCases: CASES }), [...ARGS, '--test-cases', 'cases.csv']);
  assert.equal(bad.code, 2);
  assert.match(bad.err, /cases\.csv: the header has no column named "Covers"/);
});

test('report: the text report has the inputs, the matrix, orphans, duplicates, unlinked tests, gates, notes and the result', async () => {
  const reqs = reqCsv([['REQ-1', 'Place', 'High', 'Approved'], ['REQ-2', 'Cancel', 'Low', 'Withdrawn'], ['REQ-1', 'Again', 'Low', 'Approved'], ['old 4', 'Legacy', 'Low', 'Approved']]);
  const results = suite([{ name: 'REQ-1 places', result: 'failed', message: 'expected 1' }, { name: 'REQ-9 ghost' }, { name: 'formats money' }, { name: 'REQ-2 cancels' }]);
  const r = await run(filesWith({ 'reqs.csv': reqs, 'results/a.xml': results }, { ...BASE_CONFIG, gates: { maxNotCovered: 5 } }), [...ARGS, '--explain']);
  assert.equal(r.code, 0);
  const lines = r.out.split('\n');
  assert.equal(lines[0], 'trace-matrix-check: config.json');
  assert.equal(lines[1], 'inputs: requirements reqs.csv (4 rows); JUnit results: 1 file, 4 testcases');
  assert.equal(lines[2], 'link: prefixes REQ-; ID characters digits; read from name, classname, property requirement');
  assert.equal(lines[3], 'requirements: 2 included, 1 excluded by status; 0 covered-passing, 1 covered-failing, 0 covered-not-run, 1 not covered');
  assert.equal(lines[4], 'tests: 4 tests, 3 name a requirement, 1 name none; 1 orphan ID; 1 duplicate ID');
  assert.ok(r.out.includes('  COVERED-FAILING  REQ-1  High  Place\n                   1 test: 1 failed\n'));
  assert.ok(r.out.includes(`                   - failed   results/a.xml:${lineOf(results, 'REQ-1 places')}  name  shop.OrderTest > REQ-1 places: expected 1\n`));
  assert.ok(r.out.includes('  EXCLUDED         REQ-2  Low   Cancel\n                   status Withdrawn; 1 test: 1 passed\n'));
  assert.ok(r.out.includes('  NOT COVERED      old 4  Low   Legacy\n                   no test names it; the ID does not have the form of the link spec\n'));
  assert.ok(r.out.includes('Orphan IDs (1): named by tests, not in the requirements list\n\n  REQ-9  named by 1 test\n'));
  assert.ok(r.out.includes(`  REQ-1  line ${lineOf(reqs, 'REQ-1,Again')} repeats line ${lineOf(reqs, 'REQ-1,Place')}; line 2 is used`));
  assert.ok(r.out.includes(`Tests that name no requirement (1)\n\n  passed   results/a.xml:${lineOf(results, 'formats money')}  shop.OrderTest > formats money`));
  assert.match(r.out, /note: reqs\.csv: 1 requirement ID does not have the form of the link spec, so no test can name it: old 4/);
  assert.match(r.out, /note: reqs\.csv: 1 requirement ID appears on more than one row/);
  assert.match(r.out, /basis: "The ability to establish explicit relationships between related work products or items within work products\." \(traceability, https:\/\/glossary\.istqb\.org\/en_US\/term\/traceability\)/);
});

test('report: without --explain, long lists are cut and say how many more there are', async () => {
  const results = suite(Array.from({ length: 15 }, (_, i) => ({ name: `helper ${i}` })).concat([{ name: 'REQ-1 a' }, { name: 'REQ-2 b' }]));
  const r = await run(filesWith({ 'results/a.xml': results }), ARGS);
  assert.match(r.out, /Tests that name no requirement \(15\)/);
  assert.match(r.out, /  and 3 more \(--explain lists all\)/);
  const all = await run(filesWith({ 'results/a.xml': results }), [...ARGS, '--explain']);
  assert.ok(all.out.includes('helper 14'));
});

test('report: JSON holds the whole report and parses; Markdown has the matrix and the gates and escapes the input', async () => {
  const results = suite([{ name: 'REQ-1 *bold* | pipe <b>x</b> [link](x)' }, { name: 'REQ-2 b', result: 'skipped' }]);
  const files = filesWith({ 'results/a.xml': results }, { ...BASE_CONFIG, name: 'Shop', gates: { maxNotRun: 0 } });
  const json = JSON.parse((await run(files, [...ARGS, '--format', 'json'])).out);
  assert.equal(json.tool, 'trace-matrix-check');
  assert.equal(json.config.name, 'Shop');
  assert.deepEqual(json.summary.statuses, { 'covered-passing': 1, 'covered-failing': 0, 'covered-not-run': 1, 'not-covered': 0 });
  assert.equal(json.requirements[0].tests[0].at, `results/a.xml:${lineOf(results, 'REQ-1 *bold*')}`);
  assert.equal(json.gates[0].id, 'covered-not-run');
  assert.equal(json.verdict.pass, false);
  assert.ok(json.gates[0].basis.length >= 1);
  const md = await run(files, [...ARGS, '--format', 'markdown', '--explain']);
  assert.equal(md.code, 1);
  assert.match(md.out, /^## trace-matrix-check: fail\n/);
  assert.match(md.out, /\| Requirement \| Priority \| Title \| Status \| Tests \|/);
  assert.match(md.out, /\| REQ-2 \| Low \| Cancel an order \| \*\*covered-not-run\*\* \| 1 test: 1 skipped \|/);
  assert.match(md.out, /\| \*\*not met\*\* \| covered-not-run \|/);
  assert.ok(md.out.includes('REQ-1 \\*bold\\* \\| pipe &lt;b&gt;x&lt;/b&gt; \\[link\\](x)'));
  assert.match(md.out, /\*\*Result: fail\*\* - 1 gate not met\.\n$/);
  const ok = await run(filesWith(), [...ARGS, '--format', 'markdown']);
  assert.match(ok.out, /\*\*Result: pass\*\* - 1 gate met\.\n$/);
});

test('report: mdCell escapes what would break a table, make a link or be read as HTML', () => {
  assert.equal(mdCell('a|b\\c[d]`e`*f*_g_<h>&i\nj'), 'a\\|b\\\\c\\[d\\]\\`e\\`\\*f\\*\\_g\\_&lt;h&gt;&amp;i j');
});

test('report: the three formats come from one report object', async () => {
  await withFiles(filesWith(), async (dir) => {
    const report = await checkPaths({ config: 'config.json', requirements: 'reqs.csv', junit: ['results'], base: dir, version: '9.9.9' });
    assert.equal(report.version, '9.9.9');
    assert.match(toText(report), /RESULT: PASS/);
    assert.match(toMarkdown(report), /Result: pass/);
    assert.deepEqual(JSON.parse(toJson(report)).summary, report.summary);
  });
});

test('cli: a JSON requirements list gives the same matrix as the CSV list', async () => {
  const json = JSON.stringify([{ id: 'REQ-1', title: 'Place an order', priority: 'High', status: 'Approved' }, { id: 'REQ-2', title: 'Cancel an order', priority: 'Low', status: 'Approved' }], null, 2);
  const a = JSON.parse((await run(filesWith({ 'reqs.json': json }), ['--config', 'config.json', '--requirements', 'reqs.json', '--junit', 'results', '--format', 'json'])).out);
  const b = JSON.parse((await run(filesWith(), [...ARGS, '--format', 'json'])).out);
  assert.deepEqual(a.requirements.map((r) => [r.id, r.status]), b.requirements.map((r) => [r.id, r.status]));
});

test('cli: several --junit paths are one set of results, and paths are shown with forward slashes', async () => {
  const r = await run(filesWith({ 'results/a.xml': suite([{ name: 'REQ-1 a' }]), 'ui/run 2/b.xml': suite([{ name: 'REQ-2 b' }]) }), [...ARGS, '--junit', 'ui', '--explain']);
  assert.equal(r.code, 0);
  assert.match(r.out, /JUnit results: 2 files, 2 testcases/);
  assert.match(r.out, /- passed   ui\/run 2\/b\.xml:\d+  name  shop\.OrderTest > REQ-2 b/);
});

test('cli: notes for files that are not XML, an empty result folder and inputs that hold no test', async () => {
  const other = await run(filesWith({ 'results/readme.txt': 'x' }), ARGS);
  assert.match(other.out, /note: 1 file in the result folders not ending in \.xml was not read/);
  await withFiles({ 'config.json': configText(BASE_CONFIG), 'reqs.csv': REQS }, async (dir) => {
    const { mkdir } = await import('node:fs/promises');
    const { resolve } = await import('node:path');
    await mkdir(resolve(dir, 'empty'));
    const r = await cli(['--config', 'config.json', '--requirements', 'reqs.csv', '--junit', 'empty'], dir);
    assert.equal(r.code, 1);
    assert.match(r.out, /note: no XML file was found in empty, so the JUnit results hold no test/);
    assert.match(r.out, /note: the inputs hold no test, so every included requirement is not covered/);
  });
});

test('cli: a testcase with no name and more than 50 IDs in one text are named in notes', async () => {
  const many = Array.from({ length: 52 }, (_, i) => `REQ-${i + 1}`).join(' ');
  const r = await run(filesWith({ 'results/a.xml': suite([{ name: many }, '<testcase classname="x"/>']) }, { ...BASE_CONFIG, gates: { maxDuplicateIds: 0 } }), ARGS);
  assert.equal(r.code, 0);
  assert.match(r.out, /note: results\/a\.xml: 1 testcase element has no name attribute and was not read/);
  assert.match(r.out, /note: 1 test named more than 50 different IDs in one text; only the first 50 of each text were read/);
});

test('cli: the same inputs with CRLF line ends give the same report', async () => {
  const crlf = (t) => t.split('\n').join('\r\n');
  const lf = await run(filesWith(), [...ARGS, '--explain']);
  const both = await run({ 'config.json': crlf(configText(BASE_CONFIG)), 'reqs.csv': crlf(REQS), 'results/a.xml': crlf(PASSING) }, [...ARGS, '--explain']);
  assert.equal(both.out, lf.out);
});
