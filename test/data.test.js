import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { FACTS, GATES, ID_CHARACTERS, LINK_FIELDS, PREDEFINED_ENTITIES, REQUIREMENT_STATUSES, SKIP_FOLDERS, SOURCES, factPage, flat, isXmlName, source } from '../src/index.js';

// These tests read the saved pages again and compare them with src/data.js: every sentence that a gate or a document
// quotes.

const text = async (id) => readFile(new URL(`../research/sources/${source(id).file}`, import.meta.url), 'utf8');
const has = (page, needle) => flat(page).includes(flat(needle));
// The words of a tool that wrote a text, built from pieces so that this file does not hold them.
const WRITTEN = new RegExp(`\\b(?:${['A', 'I'].join('')}|${['cha', 't'].join('')}|${['gene', 'rated'].join('')}|${['assis', 'tants?'].join('')}|${['g', 'pt'].join('')}|${['l', 'lms?'].join('')})\\b|${['clau', 'de'].join('')}|${['anthro', 'pic'].join('')}|${['ses', 'sion'].join('')}`, 'i');
const YEAR = /\b(?:19|20)\d{2}\b/;

test('sources: every saved page has its address on the first line, as listed in src/data.js, and holds text', async () => {
  for (const s of SOURCES) {
    const page = await text(s.id);
    assert.equal(page.split('\n')[0], `Source: ${s.url}`, s.file);
    assert.ok(page.length > 200, `${s.file} holds the page text`);
    assert.match(s.url, /^https:\/\/[a-z0-9.-]+\/[A-Za-z0-9/._-]*(?:#[a-z-]+)?$/);
  }
  assert.equal(SOURCES.length, new Set(SOURCES.map((s) => s.url)).size);
  assert.equal(SOURCES.length, new Set(SOURCES.map((s) => s.file)).size);
  assert.equal(SOURCES.length, new Set(SOURCES.map((s) => s.id)).size);
});

test('sources: every file in research/sources is listed in src/data.js, and the other way round', async () => {
  const files = (await readdir(new URL('../research/sources/', import.meta.url))).sort();
  assert.deepEqual(files, SOURCES.map((s) => s.file).sort());
});

test('sources: five ISTQB glossary terms read through the glossary service, Surefire, pytest, jest-junit, Playwright, two RFCs and W3C XML', async () => {
  const hosts = SOURCES.map((s) => new URL(s.url).host);
  assert.deepEqual([...new Set(hosts)].sort(), ['docs.pytest.org', 'github.com', 'glossary.istqb.org', 'maven.apache.org', 'playwright.dev', 'www.rfc-editor.org', 'www.w3.org']);
  const istqb = SOURCES.filter((s) => s.url.startsWith('https://glossary.istqb.org/'));
  assert.deepEqual(istqb.map((s) => s.id), ['istqb-traceability', 'istqb-requirements-based-testing', 'istqb-test-basis', 'istqb-requirement', 'istqb-test-case']);
  for (const s of istqb) {
    const page = await text(s.id);
    const slug = s.url.split('/').at(-1);
    assert.equal(page.split('\n')[1], `Read from: https://api.glossary.istqb.org/v1/terms/${slug} (the service that the glossary page calls)`, s.file);
    assert.match(page, /\nDefinition: \S/, s.file);
  }
  assert.equal(SOURCES.filter((s) => s.url.startsWith('https://www.w3.org/TR/xml/#')).length, 3);
});

test('sources: no saved page holds a year, a mention of a tool that wrote it, a control byte, a carriage return or a character that is not ASCII', async () => {
  for (const s of SOURCES) {
    const page = await text(s.id);
    assert.doesNotMatch(page, YEAR, s.file);
    assert.doesNotMatch(page, WRITTEN, s.file);
    assert.doesNotMatch(page, new RegExp(`[${String.fromCharCode(1)}-${String.fromCharCode(8)}]`), s.file);
    assert.ok(!page.includes('\r'), s.file);
    assert.ok([...page].every((c) => c.charCodeAt(0) < 128), s.file);
    assert.ok(page.endsWith('\n'), s.file);
  }
});

test('the saved pages show what the readers rely on: testcase, name, classname, skipped, property with its value, the five entities, the DOCTYPE', async () => {
  const xsd = await text('surefire-xsd');
  for (const name of ['testcase', 'failure', 'error', 'skipped', 'properties', 'property']) assert.ok(xsd.includes(`<xs:element name="${name}"`), name);
  assert.ok(xsd.includes('<xs:attribute name="value" type="xs:string" use="required"/>'));
  assert.ok(has(await text('pytest-record-property'), '<testcase classname="test_function" file="test_function.py" line="0" name="test_function" time="0.0009"> <properties> <property name="example_key" value="1" /> </properties> </testcase>'), 'pytest writes the property inside the testcase');
  assert.ok(has(await text('jest-junit'), '<testcase classname="addition positive numbers should add up" name="addition positive numbers should add up" time="0.004"> <properties> <property name="dd_tags[test.invocations]" value="1" />'), 'jest-junit writes the property inside the testcase');
  assert.ok(has(await text('playwright-junit'), 'Value of the name attribute on the root <testsuites/> report entry.'));
  const predefined = await text('xml-predefined');
  for (const name of Object.keys(PREDEFINED_ENTITIES)) assert.ok(predefined.includes(`<!ENTITY ${name} `), name);
  assert.ok(has(await text('xml-doctype'), '<!DOCTYPE greeting SYSTEM "hello.dtd">'));
  assert.ok(has(await text('rfc4180'), '"aaa","b""bb","ccc"'));
});

test('facts: every quoted sentence is on its saved page, word for word, with its section, no year and no mention of a tool that wrote it', async () => {
  for (const [key, fact] of Object.entries(FACTS)) {
    assert.ok(SOURCES.some((s) => s.id === fact.source), key);
    assert.ok(has(await text(fact.source), fact.text), `${key}: "${fact.text}"`);
    assert.ok(has(await text(fact.source), fact.section), `${key}: the section ${fact.section} is on the page`);
    assert.doesNotMatch(fact.text, YEAR, key);
    assert.doesNotMatch(fact.text, WRITTEN, key);
    assert.ok(fact.text.length <= 360, `${key} is short`);
    assert.equal(factPage(key), source(fact.source).url);
  }
});

test('facts: every ISTQB definition is quoted whole, as the glossary service returned it', async () => {
  for (const key of ['traceability', 'requirementsBased', 'testBasis', 'requirement', 'testCase']) {
    const page = await text(FACTS[key].source);
    assert.ok(page.includes(`\nDefinition: ${FACTS[key].text}\n`), key);
  }
});

test('facts: every gate rests on one or two sentences of src/data.js, and every source page is quoted at least once', () => {
  for (const g of GATES) {
    assert.match(g.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, g.id);
    assert.ok(g.title.length > 10, g.id);
    assert.ok(g.facts.length >= 1 && g.facts.length <= 2, g.id);
    for (const k of g.facts) assert.ok(FACTS[k], `${g.id}: ${k}`);
  }
  const quoted = new Set(Object.values(FACTS).map((f) => f.source));
  for (const s of SOURCES) assert.ok(quoted.has(s.id), s.id);
});

test('lists: the predefined entities are the five of XML, and the lists have no duplicates', () => {
  assert.deepEqual(PREDEFINED_ENTITIES, { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" });
  for (const list of [SKIP_FOLDERS, LINK_FIELDS, REQUIREMENT_STATUSES, Object.keys(ID_CHARACTERS)]) assert.equal(new Set(list).size, list.length);
  assert.deepEqual(LINK_FIELDS, ['name', 'classname', 'property']);
  assert.equal(isXmlName('TEST-a.XML'), true);
  assert.equal(isXmlName('a.xml.txt'), false);
});

test('src writes no quoted sentence outside src/data.js', async () => {
  for (const file of (await readdir(new URL('../src/', import.meta.url))).filter((f) => f !== 'data.js')) {
    const code = await readFile(new URL(`../src/${file}`, import.meta.url), 'utf8');
    for (const fact of Object.values(FACTS)) if (fact.text.length > 40) assert.ok(!code.includes(fact.text.slice(0, 40)), `${file} writes "${fact.text.slice(0, 40)}" itself`);
  }
});

test('docs: every sentence that the documents quote from a saved page is on a saved page', async () => {
  const pages = (await Promise.all(SOURCES.map((s) => text(s.id)))).map(flat).join(' ');
  let checked = 0;
  const files = ['docs/method.md', 'docs/rules-and-sources.md', 'docs/inputs.md', 'docs/limits.md', 'docs/threat-model.md', 'docs/secure-defaults.md', 'docs/decisions/0001-name-requirements-with-a-prefix-never-a-pattern.md', 'README.md'];
  for (const file of files) {
    const doc = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    // Code blocks and inline code hold file contents, not quotes.
    const prose = doc.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
    for (const m of prose.matchAll(/"([^"\n]{40,400})"/g)) {
      assert.ok(pages.includes(flat(m[1])), `${file}: ${m[1]}`);
      checked += 1;
    }
  }
  assert.ok(checked >= 10, `${checked} quotes checked`);
});

test('docs: docs/rules-and-sources.md names every saved page, every quoted sentence and every gate with its sentences', async () => {
  const doc = await readFile(new URL('../docs/rules-and-sources.md', import.meta.url), 'utf8');
  for (const s of SOURCES) {
    assert.ok(doc.includes(s.file), s.file);
    assert.ok(doc.includes(s.url), s.url);
  }
  for (const [key, fact] of Object.entries(FACTS)) assert.ok(doc.includes(`| \`${key}\` |`) && doc.includes(flat(fact.text).replace(/\|/g, '\\|')), key);
  for (const g of GATES) {
    assert.ok(doc.includes(`| \`${g.id}\` | \`gates.${g.key}\` |`), g.id);
    assert.ok(doc.includes(`(method.md#${g.id})`), g.id);
    for (const k of g.facts) assert.ok(new RegExp(`\\| \`${k}\` \\| [^|]*\`${g.id}\``).test(doc), `${k} is used by ${g.id}`);
  }
});
