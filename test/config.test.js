import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG_LIMITS, ConfigError, KEYS, norm, readConfig, validateConfig } from '../src/index.js';
import { BASE_CONFIG, configOf, configWith } from './helpers.js';

const problems = (object) => {
  try {
    configOf(object);
  } catch (error) {
    assert.ok(error instanceof ConfigError);
    return error.problems.map((p) => p.text).join('\n');
  }
  return assert.fail('the configuration was accepted');
};

test('config: the normal form of a full configuration, with defaults only for the delimiter, the ID characters and case', () => {
  const c = configOf({ ...BASE_CONFIG, name: 'Order service', testCases: { columns: { id: 'Key', requirements: 'Covers', result: 'Result' }, passed: ['Passed'], failed: ['Failed'] }, gates: { mustPass: { priorities: ['High'] }, maxNotCovered: 0, maxFailing: 1, maxNotRun: 2, minPassingShare: 99.5, maxOrphans: 0, maxDuplicateIds: 0 } });
  assert.equal(c.name, 'Order service');
  assert.equal(c.requirements.delimiter, ',');
  assert.deepEqual(c.requirements.excludeStatuses, ['Withdrawn']);
  assert.equal(c.link.idCharacters, 'digits');
  assert.equal(c.link.ignoreCase, false);
  assert.deepEqual(c.link.spec.prefixes, ['REQ-']);
  assert.deepEqual(c.link.from, ['name', 'classname', 'property']);
  assert.deepEqual(c.testCases.skipped, []);
  assert.equal(c.testCases.delimiter, ',');
  assert.deepEqual(c.gates.minPassingShare, { scaled: 995000, shown: 99.5 });
  assert.equal(c.gates.maxFailing, 1);
  assert.equal(configOf(configWith({ testCases: undefined })).testCases, null);
});

test('config: an unknown key is an error with its line and a suggestion, at every level', () => {
  const text = '{\n  "requirements": { "columns": { "id": "id" } },\n  "link": { "prefixes": ["REQ-"], "from": ["name"] },\n  "gates": { "maxNotCoverd": 0 }\n}';
  assert.throws(() => readConfig(text, 'c.json'), (e) => e instanceof ConfigError && /c\.json:4: gates\.maxNotCoverd: unknown key; did you mean maxNotCovered\?/.test(e.message));
  assert.match(problems({ ...BASE_CONFIG, extra: 1 }), /extra: unknown key; the keys here are name, requirements, link, testCases, gates/);
  assert.match(problems(configWith({ link: { ...BASE_CONFIG.link, pattern: 'REQ-\\d+' } })), /link\.pattern: unknown key/);
});

test('config: a key named twice is refused by the JSON reader with its line', () => {
  const text = '{\n  "gates": { "maxNotCovered": 0 },\n  "gates": { "maxNotCovered": 5 }\n}';
  assert.throws(() => readConfig(text, 'c.json'), /c\.json: line 3, column 3: the name "gates" appears twice/);
});

test('config: the configuration must be one object, and requirements, link and gates are needed', () => {
  assert.throws(() => readConfig('[]', 'c.json'), /the configuration must be one JSON object, not an array/);
  const p = problems({});
  assert.match(p, /requirements: is needed/);
  assert.match(p, /link: is needed/);
  assert.match(p, /gates: is needed: at least one gate/);
});

test('config: a configuration that states no gate is refused; a check with no gate would always pass', () => {
  assert.match(problems(configWith({ gates: {} })), /gates: states no gate/);
});

test('config: the columns of the requirements, with the ID always needed and status needed for excludeStatuses', () => {
  assert.match(problems(configWith({ requirements: {} })), /requirements\.columns: is needed/);
  assert.match(problems(configWith({ requirements: { columns: { title: 't' } } })), /requirements\.columns\.id: is needed/);
  assert.match(problems(configWith({ requirements: { columns: { id: 'id' }, excludeStatuses: ['Withdrawn'] } })), /excludeStatuses: needs requirements\.columns\.status/);
  assert.match(problems(configWith({ requirements: { columns: { id: '' } } })), /columns\.id: must be a string that is not empty/);
  assert.match(problems(configWith({ requirements: { columns: { id: 'id' }, delimiter: '|' } })), /delimiter: must be one of/);
  assert.equal(configOf(configWith({ requirements: { columns: { id: 'id' }, delimiter: ';' } })).requirements.delimiter, ';');
});

test('config: the link needs prefixes and from, a property name when from holds property, and no pattern', () => {
  assert.match(problems(configWith({ link: { from: ['name'] } })), /link\.prefixes: is needed/);
  assert.match(problems(configWith({ link: { prefixes: ['REQ-'] } })), /link\.from: is needed/);
  assert.match(problems(configWith({ link: { prefixes: ['REQ-'], from: ['property'] } })), /link\.propertyNames: is needed when from holds property/);
  assert.match(problems(configWith({ link: { prefixes: ['REQ-'], from: ['name'], propertyNames: ['requirement'] } })), /propertyNames: names properties, but from does not hold property/);
  assert.match(problems(configWith({ link: { prefixes: ['REQ-\\d+'], from: ['name'] } })), /prefixes\[0\]: a prefix is 1 to 20 of the characters .* \(no pattern: the tool runs no regular expression from the configuration\)/);
  assert.match(problems(configWith({ link: { prefixes: ['REQ-', 'req-'], from: ['name'] } })), /prefixes\[1\]: the prefix req- is named twice/);
  assert.match(problems(configWith({ link: { prefixes: [], from: ['name'] } })), /must hold 1 to 10 prefixes/);
  assert.match(problems(configWith({ link: { prefixes: 'REQ-', from: ['name'] } })), /must be a list of prefixes, not a string/);
  assert.match(problems(configWith({ link: { prefixes: ['REQ-'], from: ['title'] } })), /from\[0\]: must be one of name, classname, property/);
  assert.match(problems(configWith({ link: { prefixes: ['REQ-'], from: ['name', 'name'] } })), /from\[1\]: name is named twice/);
  assert.match(problems(configWith({ link: { prefixes: ['REQ-'], from: [] } })), /from: must be a list of one or more/);
  assert.match(problems(configWith({ link: { prefixes: ['REQ-'], from: ['name'], idCharacters: '[0-9]+' } })), /idCharacters: must be one of "digits", "alnum", "alnum-dot-dash"/);
  assert.match(problems(configWith({ link: { prefixes: ['REQ-'], from: ['name'], ignoreCase: 'yes' } })), /ignoreCase: must be true or false, not a string/);
  const c = configOf(configWith({ link: { prefixes: ['req-'], from: ['classname'], idCharacters: 'alnum-dot-dash', ignoreCase: true } }));
  assert.deepEqual(c.link.spec.prefixes, ['REQ-']);
  assert.equal(c.link.idCharacters, 'alnum-dot-dash');
});

test('config: the test-case export needs its ID, requirements and result columns, and the passed and failed values', () => {
  const p = problems(configWith({ testCases: { columns: { title: 'Summary' } } }));
  assert.match(p, /testCases\.columns\.id: is needed/);
  assert.match(p, /testCases\.columns\.requirements: is needed/);
  assert.match(p, /testCases\.columns\.result: is needed/);
  assert.match(p, /testCases\.passed: is needed/);
  assert.match(p, /testCases\.failed: is needed/);
  assert.match(problems(configWith({ testCases: {} })), /testCases\.columns: is needed/);
  const both = problems(configWith({ testCases: { columns: { id: 'a', requirements: 'b', result: 'c' }, passed: ['Done'], failed: ['Failed'], skipped: ['done'] } }));
  assert.match(both, /testCases\.skipped: done is also listed under passed/);
  assert.match(problems(configWith({ testCases: { columns: { id: 'a', requirements: 'b', result: 'c' }, passed: ['Ok', 'ok'], failed: ['Failed'] } })), /passed\[1\]: ok is named twice/);
  assert.match(problems(configWith({ testCases: { columns: { id: 'a', requirements: 'b', result: 'c' }, passed: [], failed: ['Failed'] } })), /passed: is an empty list/);
});

test('config: the gates take whole numbers, a percentage with at most four decimals, and priorities that need a column', () => {
  assert.match(problems(configWith({ gates: { maxNotCovered: -1 } })), /maxNotCovered: -1 is not a whole number of 0 or more/);
  assert.match(problems(configWith({ gates: { maxNotCovered: 1.5 } })), /1\.5 is not a whole number/);
  assert.match(problems(configWith({ gates: { maxNotCovered: '0' } })), /must be a whole number of 0 or more, not a string/);
  assert.match(problems(configWith({ gates: { minPassingShare: 101 } })), /101 is not a percentage from 0 to 100/);
  assert.match(problems(configWith({ gates: { minPassingShare: 99.12345 } })), /at most four decimals/);
  assert.match(problems(configWith({ gates: { minPassingShare: true } })), /must be a number from 0 to 100, not a boolean/);
  assert.match(problems(configWith({ gates: { mustPass: {} } })), /gates\.mustPass: needs priorities/);
  assert.match(problems(configWith({ requirements: { columns: { id: 'id' } }, gates: { mustPass: { priorities: ['High'] } } })), /gates\.mustPass: needs requirements\.columns\.priority/);
  assert.match(problems(configWith({ gates: { mustPass: { priorities: 'High' } } })), /priorities: must be a list of strings, not a string/);
  assert.match(problems(configWith({ gates: { mustPass: { priorities: [''] } } })), /priorities\[0\]: must be a string that is not empty/);
  assert.match(problems(configWith({ gates: { maxNotCovered: null } })), /must be a whole number of 0 or more, not null/);
});

test('config: strings are capped and hold no control character; a level that is not an object is refused', () => {
  assert.match(problems(configWith({ name: 'x'.repeat(CONFIG_LIMITS.maxString + 1) })), /name: must be at most 200 characters/);
  assert.match(problems(configWith({ name: `a${String.fromCharCode(27)}[31m` })), /no control character/);
  assert.match(problems(configWith({ gates: [] })), /gates: must be an object, not an array/);
  assert.match(problems(configWith({ link: 'REQ-' })), /link: must be an object, not a string/);
  const list = Array.from({ length: CONFIG_LIMITS.maxPropertyNames + 1 }, (_, i) => `p${i}`);
  assert.match(problems(configWith({ link: { ...BASE_CONFIG.link, propertyNames: list } })), /holds more than 20 entries/);
});

test('config: a name such as __proto__ is an unknown key and changes nothing', () => {
  const text = '{"__proto__": {"gates": 1}, "requirements": {"columns": {"id": "id"}}, "link": {"prefixes": ["REQ-"], "from": ["name"]}, "gates": {"maxNotCovered": 0}}';
  assert.throws(() => readConfig(text, 'c.json'), /__proto__: unknown key/);
  assert.equal({}.gates, undefined);
});

test('config: the keys, the limits and norm are what the documents describe', () => {
  assert.deepEqual(Object.keys(KEYS), ['name', 'requirements', 'link', 'testCases', 'gates']);
  assert.deepEqual(Object.keys(KEYS.gates), ['mustPass', 'maxNotCovered', 'maxFailing', 'maxNotRun', 'minPassingShare', 'maxOrphans', 'maxDuplicateIds']);
  assert.equal(norm('  In   Review '), 'in review');
  assert.throws(() => validateConfig(null), /must be one JSON object, not null/);
});
