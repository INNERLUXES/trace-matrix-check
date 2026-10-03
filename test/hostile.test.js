import { test } from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, symlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { LIMITS, findIds, linkSpec, main, parseCsv } from '../src/index.js';
import { ARGS, BASE_CONFIG, PASSING, REQS, configText, filesWith, reqCsv, run, suite, withFiles } from './helpers.js';

// Hostile input: a file that tries to expand entities, fetch an external entity, exhaust the memory or the time, lead the
// tool out of the folder or round in a loop, rewrite the terminal, break a table or change how objects behave. Each test
// also checks the time, because work that grows faster than the input is a failure even when the answer is right. Tests
// that need a symbolic link, a device or a special file name are guarded with process.platform, and none of them
// asserts a line or a column: those are asserted in the tests that run everywhere.

const LIMIT = { timeout: 120000 };
// Coverage counting slows every line of the tool several times over, so a run with --experimental-test-coverage gets a
// wider time limit. A plain `npm test` keeps the tight one, and that is the run that guards against slow growth.
// The runner sets NODE_V8_COVERAGE for its test processes only when coverage is on.
const COVERAGE = Boolean(process.env.NODE_V8_COVERAGE);
const fast = async (fn, ms = 5000) => {
  const limit = COVERAGE ? ms * 4 : ms;
  const start = Date.now();
  const result = await fn();
  assert.ok(Date.now() - start < limit, `took ${Date.now() - start} ms`);
  return result;
};
const CASES_CONFIG = { ...BASE_CONFIG, testCases: { columns: { id: 'Key', requirements: 'Covers', result: 'Result' }, passed: ['Passed'], failed: ['Failed'] } };

test('hostile: the billion laughs never expand; the file is refused at its DOCTYPE, at once, and no verdict is given', LIMIT, async () => {
  const lol = ['<?xml version="1.0"?>', '<!DOCTYPE lolz [', '<!ENTITY lol "lol">'];
  for (let i = 1; i < 10; i += 1) lol.push(`<!ENTITY lol${i} "${`&lol${i === 1 ? '' : i - 1};`.repeat(10)}">`);
  lol.push(']>', '<testsuite name="s"><testcase name="&lol9;"/></testsuite>');
  const r = await fast(() => run(filesWith({ 'results/lol.xml': lol.join('\n') }), ARGS), 1500);
  assert.equal(r.code, 2);
  assert.match(r.err, /results\/lol\.xml: line 2, column 1: the file has a DOCTYPE/);
  assert.ok(r.err.length < 5000);
  assert.equal(r.out, '');
});

test('hostile: an external entity is never fetched or read, declared or not', LIMIT, async () => {
  const secret = 'TOP-SECRET-CONTENT';
  await withFiles({ ...filesWith(), 'secret.txt': secret }, async (dir) => {
    const target = resolve(dir, 'secret.txt').split('\\').join('/');
    await writeFile(resolve(dir, 'results/a.xml'), `<?xml version="1.0"?>\n<!DOCTYPE testsuite [<!ENTITY xxe SYSTEM "file://${target}">]>\n<testsuite name="s"><testcase name="REQ-1 &xxe;"/></testsuite>`);
    await writeFile(resolve(dir, 'undeclared.xml'), '<testsuite name="s"><testcase name="REQ-1"><properties><property name="requirement" value="&xxe;"/></properties></testcase></testsuite>');
    for (const format of ['text', 'json', 'markdown']) {
      for (const results of ['results', 'undeclared.xml']) {
        let out = '';
        let err = '';
        const code = await main(['--config', 'config.json', '--requirements', 'reqs.csv', '--junit', results, '--format', format], { out: (t) => { out += t; }, err: (t) => { err += t; } }, undefined, dir);
        assert.equal(code, 2);
        assert.ok(!out.includes(secret) && !err.includes(secret), `${format} ${results}`);
      }
    }
  });
});

test('hostile: a parameter entity that loads a remote DTD is refused with the DOCTYPE and nothing is fetched', LIMIT, async () => {
  const r = await run(filesWith({ 'results/a.xml': '<!DOCTYPE x [<!ENTITY % remote SYSTEM "https://example.test/evil.dtd"> %remote;]><testsuite name="s"/>' }), ARGS);
  assert.equal(r.code, 2);
  assert.match(r.err, /the file has a DOCTYPE/);
});

test('hostile: elements nested a hundred thousand deep are refused at 256 levels, in one pass', LIMIT, async () => {
  const deep = `<testsuites>${'<testsuite name="s">'.repeat(100000)}${'</testsuite>'.repeat(100000)}</testsuites>`;
  const r = await fast(() => run(filesWith({ 'results/a.xml': deep }), ARGS));
  assert.equal(r.code, 2);
  assert.match(r.err, /elements nested more than 256 deep/);
  const ok = `<testsuites>${'<testsuite name="s">'.repeat(200)}<testcase name="REQ-1 a"/><testcase name="REQ-2 b"/>${'</testsuite>'.repeat(200)}</testsuites>`;
  assert.equal((await run(filesWith({ 'results/a.xml': ok }), ARGS)).code, 0);
});

test('hostile: tags, quotes, comments and CDATA that never end, and long runs of < and &, are refused in one pass', LIMIT, async () => {
  for (const text of [`<testsuite name="${'x'.repeat(300000)}`, `<testsuite><!--${'-'.repeat(300000)}`, `<testsuite><![CDATA[${']'.repeat(300000)}`, '<'.repeat(200000), `<testsuite>${'&'.repeat(200000)}</testsuite>`, `<testsuite>${'<b'.repeat(100000)}`]) {
    const r = await fast(() => run(filesWith({ 'results/a.xml': text }), ARGS), 4000);
    assert.equal(r.code, 2);
  }
});

test('hostile: a file over the size limit is an input error that names the file; each kind of input has the limit', LIMIT, async () => {
  const small = { ...LIMITS, maxFileBytes: 150, maxConfigBytes: 100 };
  const files = { ...filesWith({}, CASES_CONFIG), 'big.xml': suite(Array.from({ length: 10 }, (_, i) => ({ name: `t${i}` }))), 'big.csv': reqCsv(Array.from({ length: 20 }, (_, i) => [`REQ-${i}`, 'a', 'b', 'c'])), 'cases.csv': `Key,Covers,Result\n${'TC-1,REQ-1,Passed\n'.repeat(20)}` };
  const config = await run(files, ARGS, small);
  assert.equal(config.code, 2);
  assert.match(config.err, /config\.json: .* bytes is over the 100 byte limit/);
  const r = await run(files, ['--config', 'config.json', '--requirements', 'big.csv', '--junit', 'big.xml', '--test-cases', 'cases.csv'], { ...small, maxConfigBytes: 100000 });
  assert.equal(r.code, 2);
  for (const name of ['big.xml', 'big.csv', 'cases.csv']) assert.match(r.err, new RegExp(`${name.replace('.', '\\.')}: .* bytes is over the 150 byte limit`));
});

test('hostile: the limits of the folders refuse the input with exit code 2, rather than reading part of it', LIMIT, async () => {
  const files = filesWith({ 'results/a/b/c/d/e.xml': PASSING, 'results/f.xml': PASSING, 'results/g.xml': PASSING });
  const entries = await run(files, ARGS, { ...LIMITS, maxEntries: 3 });
  assert.equal(entries.code, 2);
  assert.match(entries.err, /the result folders hold more than 3 files and folders/);
  assert.match((await run(files, ARGS, { ...LIMITS, maxDepth: 2 })).err, /has folders nested more than 2 deep/);
  assert.match((await run(files, ARGS, { ...LIMITS, maxXmlFiles: 2 })).err, /more than 2 XML files/);
  assert.match((await run(files, ARGS, { ...LIMITS, maxTotalBytes: 2 })).err, /the XML files to read hold more than 2 byte/);
  const paths = await run(files, [...ARGS, '--junit', 'results/f.xml'], { ...LIMITS, maxResultPaths: 1 });
  assert.equal(paths.code, 2);
  assert.match(paths.err, /more than 1 --junit paths/);
});

test('hostile: a binary file or a UTF-16 file is refused and named, as results and as a requirements list', LIMIT, async () => {
  await withFiles(filesWith(), async (dir) => {
    await writeFile(resolve(dir, 'results/b.xml'), Buffer.from([0x3c, 0x00, 0x01, 0xff]));
    await writeFile(resolve(dir, 'results/c.xml'), Buffer.from([0xff, 0xfe, 0x3c, 0x00, 0x61, 0x00]));
    await writeFile(resolve(dir, 'reqs.csv'), Buffer.from([0x69, 0x64, 0x00, 0x01]));
    let err = '';
    const code = await main(ARGS, { out: () => {}, err: (t) => { err += t; } }, undefined, dir);
    assert.equal(code, 2);
    assert.match(err, /results\/b\.xml: holds binary data \(a null byte\)/);
    assert.match(err, /results\/c\.xml: is UTF-16; only UTF-8 is read/);
    assert.match(err, /reqs\.csv: holds binary data \(a null byte\)/);
  });
});

test('hostile: bad CSV quoting in the requirements or the test cases is an input error with its line, never a guess', LIMIT, async () => {
  for (const [csv, pattern] of [
    ['id,title,priority,status\nREQ-1,"open\nREQ-2,b,c,d\n', /reqs\.csv: line 2: a field in double quotes that starts on line 2 is never closed/],
    ['id,title,priority,status\nREQ-1,a"b,c,d\n', /reqs\.csv: line 2: a double quote inside a field that is not in double quotes/],
    ['id,title,priority,status\nREQ-1,"a"x,c,d\n', /reqs\.csv: line 2: text after the closing double quote/],
    ['', /reqs\.csv: line 1: the file holds no header line/]
  ]) {
    const r = await run(filesWith({ 'reqs.csv': csv }), ARGS);
    assert.equal(r.code, 2, csv);
    assert.match(r.err, pattern);
    assert.equal(r.out, '', 'no verdict on a half-read list');
  }
  const cases = await run(filesWith({ 'cases.csv': 'Key,Covers,Result\nTC-1,"REQ-1,Passed\n' }, CASES_CONFIG), [...ARGS, '--test-cases', 'cases.csv']);
  assert.equal(cases.code, 2);
  assert.match(cases.err, /cases\.csv: line 2: a field in double quotes that starts on line 2 is never closed/);
});

test('hostile: a field of a hundred thousand characters is refused by the field limit', LIMIT, () => {
  assert.throws(() => parseCsv(`a\n"${'x'.repeat(100000)}"\n`), /longer than 65,536 characters/);
});

test('hostile: a hundred thousand requirements and a hundred thousand tests are matched in a few seconds', LIMIT, async () => {
  const n = 100000;
  const reqs = `id,title,priority,status\n${Array.from({ length: n }, (_, i) => `REQ-${i},t,${i % 3 === 0 ? 'High' : 'Low'},Approved`).join('\n')}\n`;
  const results = `<testsuite name="s">${Array.from({ length: n }, (_, i) => `<testcase name="REQ-${(i * 7) % n} t${i}" classname="c${i % 50}"${i % 97 === 0 ? '><failure message="m"/></testcase>' : '/>'}`).join('')}</testsuite>`;
  const config = { ...BASE_CONFIG, gates: { mustPass: { priorities: ['High'] }, maxNotCovered: n, maxFailing: n, minPassingShare: 50, maxOrphans: 0, maxDuplicateIds: 0 } };
  const r = await fast(() => run(filesWith({ 'reqs.csv': reqs, 'results/a.xml': results }, config), ARGS), 30000);
  assert.equal(r.code, 1);
  assert.ok(r.out.includes('requirements: 100,000 included'), 'the summary line');
  assert.ok(/found: 98\.\d+% \([\d,]+ of 100,000 requirements\)/.test(r.out), 'the share of passing requirements');
});

test('hostile: text that looks almost like IDs is scanned once, however it repeats', LIMIT, async () => {
  const spec = linkSpec({ prefixes: ['REQ-', 'REQ-REQ-', 'R'], idCharacters: 'alnum-dot-dash' });
  const texts = ['REQ-'.repeat(250000), `REQ-${'1'.repeat(1000000)}`, `REQ-${'-'.repeat(1000000)}`, 'R'.repeat(1000000), `${'a'.repeat(500000)}REQ-1`, 'REQ-1.'.repeat(150000)];
  for (const text of texts) await fast(async () => findIds(text, spec), 3000);
  const digits = linkSpec({ prefixes: ['REQ-'] });
  const r = await fast(async () => findIds(Array.from({ length: 200000 }, (_, i) => `REQ-${i}`).join(' '), digits), 3000);
  assert.equal(r.ids.length, 50);
  assert.equal(r.truncated, true);
});

test('hostile: a prefix that is a pattern is refused when the configuration is read; nothing from it is ever run', LIMIT, async () => {
  for (const prefix of ['(a+)+$', 'REQ-\\d+', '.*', '[A-Z]+-']) {
    const r = await run(filesWith({}, { ...BASE_CONFIG, link: { prefixes: [prefix], from: ['name'] } }), ARGS);
    assert.equal(r.code, 2, prefix);
    assert.match(r.err, /no pattern: the tool runs no regular expression from the configuration/);
  }
});

test('hostile: a testcase with a hundred thousand properties and a name of a megabyte are read in time', LIMIT, async () => {
  const props = Array.from({ length: 100000 }, (_, i) => `<property name="requirement" value="REQ-${i % 3}"/>`).join('');
  const results = `<testsuite name="s"><testcase name="${'x '.repeat(500000)}REQ-1"><properties>${props}</properties></testcase><testcase name="REQ-2"/></testsuite>`;
  const r = await fast(() => run(filesWith({ 'results/a.xml': results }), ARGS), 15000);
  assert.equal(r.code, 0, r.err);
  assert.ok(r.out.length < 20000, `the report has ${r.out.length} characters`);
});

test('hostile: control, direction and line separator characters in names are cleaned in every format', LIMIT, async () => {
  const bad = ['x', String.fromCharCode(27), '[31m', String.fromCharCode(0x202e), 'y', String.fromCharCode(0x2028), 'z', String.fromCharCode(0x85)].join('');
  const results = suite([{ name: `REQ-1 ${bad}`, properties: { [`requirement${bad}`]: 'REQ-2' } }, { name: `REQ-2 ${bad}`, result: 'failed', message: bad }, { name: `REQ-9 ${bad}` }, { name: bad }]);
  const reqs = `id,title,priority,status\nREQ-1,"t${bad}",High,Approved\nREQ-2,b,"p${bad}",Approved\nREQ-2,c,d,e\n`;
  for (const format of ['text', 'markdown', 'json']) {
    const r = await run(filesWith({ 'results/a.xml': results, 'reqs.csv': reqs }, { ...BASE_CONFIG, gates: { maxOrphans: 0, maxFailing: 0, maxDuplicateIds: 0 } }), [...ARGS, '--format', format, '--explain']);
    assert.equal(r.code, 1, format);
    for (const c of [27, 0x202e, 0x2028, 0x85]) assert.ok(!r.out.includes(String.fromCharCode(c)), `${format}: ${c}`);
  }
});

test('hostile: a test name with a command in it is text; nothing is run and no file appears', LIMIT, async () => {
  await withFiles(filesWith({ 'results/a.xml': suite([{ name: 'REQ-1 $(touch ran-a-command.txt)' }, { name: 'REQ-2 `touch ran-a-command.txt`' }]) }), async (dir) => {
    let out = '';
    const code = await main([...ARGS, '--explain'], { out: (t) => { out += t; }, err: () => {} }, undefined, dir);
    assert.equal(code, 0);
    assert.ok(out.includes('$(touch ran-a-command.txt)'));
    await assert.rejects(access(resolve(dir, 'ran-a-command.txt')));
  });
});

test('hostile: names such as __proto__ and constructor are ordinary text in requirements, tests and properties', LIMIT, async () => {
  const results = suite([{ name: '__proto__ REQ-1', classname: 'constructor', properties: { __proto__: 'REQ-2', toString: 'x' } }, { name: 'REQ-2 hasOwnProperty' }]);
  const reqs = 'id,title,priority,status\nREQ-1,__proto__,constructor,toString\nREQ-2,b,c,d\n';
  const r = await run(filesWith({ 'results/a.xml': results, 'reqs.csv': reqs }), [...ARGS, '--format', 'json']);
  assert.equal(r.code, 0, r.err);
  const report = JSON.parse(r.out);
  assert.equal(report.requirements[0].title, '__proto__');
  assert.equal(({}).polluted, undefined);
  const json = await run(filesWith({ 'reqs.json': '[{"id": "REQ-1", "__proto__": {"polluted": true}}, {"id": "REQ-2"}]' }), ['--config', 'config.json', '--requirements', 'reqs.json', '--junit', 'results']);
  assert.equal(json.code, 0, json.err);
  assert.equal(({}).polluted, undefined);
});

test('hostile: a JSON requirements list nested deep or with a long string is refused at its limit', LIMIT, async () => {
  const deep = await fast(() => run(filesWith({ 'reqs.json': '['.repeat(100000) }), ['--config', 'config.json', '--requirements', 'reqs.json', '--junit', 'results']));
  assert.equal(deep.code, 2);
  assert.match(deep.err, /nested more than 32 deep/);
  const long = await run(filesWith({ 'reqs.json': `[{"id": "${'x'.repeat(10000)}"}]` }), ['--config', 'config.json', '--requirements', 'reqs.json', '--junit', 'results']);
  assert.match(long.err, /a string longer than 4096 characters/);
});

test('hostile: a folder with a symbolic link to a folder outside, and a link loop, is walked without following them', LIMIT, async (t) => {
  if (process.platform === 'win32') return t.skip('creating symbolic links needs a privilege on Windows');
  await withFiles({ ...filesWith(), 'outside/evil.xml': suite([{ name: 'REQ-1 evil', result: 'failed' }]) }, async (dir) => {
    await symlink(resolve(dir, 'outside'), resolve(dir, 'results/linked'));
    await mkdir(resolve(dir, 'results/sub'));
    await symlink(resolve(dir, 'results'), resolve(dir, 'results/sub/loop'));
    let out = '';
    const code = await fast(() => main(ARGS, { out: (x) => { out += x; }, err: () => {} }, undefined, dir));
    assert.equal(code, 0);
    assert.ok(!out.includes('evil'));
    assert.match(out, /note: 2 symbolic links in the result folders were not followed: results\/linked and results\/sub\/loop/);
  });
});

test('hostile: a device named as an input is refused, not read for ever', LIMIT, async (t) => {
  if (process.platform !== 'linux') return t.skip('the device /dev/zero is looked at on Linux only');
  await withFiles(filesWith(), async (dir) => {
    let err = '';
    const code = await fast(() => main(['--config', 'config.json', '--requirements', '/dev/zero.csv', '--junit', 'results'], { out: () => {}, err: (x) => { err += x; } }, undefined, dir));
    assert.equal(code, 2);
    await symlink('/dev/zero', resolve(dir, 'zero.csv'));
    err = '';
    const linked = await fast(() => main(['--config', 'config.json', '--requirements', 'zero.csv', '--junit', 'results'], { out: () => {}, err: (x) => { err += x; } }, undefined, dir));
    assert.equal(linked, 2);
    assert.match(err, /zero\.csv: not a regular file/);
  });
});

test('hostile: a result file whose name holds a control character is shown cleaned', LIMIT, async (t) => {
  if (process.platform === 'win32') return t.skip('Windows does not allow control characters in file names');
  const name = `results/a${String.fromCharCode(27)}[31m.xml`;
  const r = await run({ ...filesWith(), [name]: suite([{ name: 'REQ-1 a' }, { name: 'REQ-2 b' }]) }, [...ARGS, '--explain']);
  assert.equal(r.code, 0);
  assert.ok(!r.out.includes(String.fromCharCode(27)));
  assert.match(r.out, /results\/a \[31m\.xml/);
});

test('hostile: a requirements list of a hundred thousand rows with no ID stops at twenty problems', LIMIT, async () => {
  const reqs = `id,title,priority,status\n${',t,p,s\n'.repeat(100000)}`;
  const r = await fast(() => run(filesWith({ 'reqs.csv': reqs }), ARGS), 10000);
  assert.equal(r.code, 2);
  assert.equal(r.err.split('\n').filter((l) => l.includes('the requirement has no ID')).length, 20);
});

test('hostile: a configuration with a gate number of many digits, or nested deep, is refused', LIMIT, async () => {
  const huge = await run(filesWith({ 'config.json': configText(BASE_CONFIG).replace('"maxNotCovered": 0', `"maxNotCovered": 1${'0'.repeat(400)}`) }), ARGS);
  assert.equal(huge.code, 2);
  assert.match(huge.err, /a number too large to read|not a whole number/);
  const deep = await fast(() => run(filesWith({ 'config.json': `${'{"a":'.repeat(100000)}1${'}'.repeat(100000)}` }), ARGS));
  assert.equal(deep.code, 2);
  assert.match(deep.err, /nested more than 32 deep/);
  assert.ok(REQS.length > 0);
});
