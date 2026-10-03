import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RESULT_KINDS, parseXml, readJunit, testLabel } from '../src/index.js';
import { lineOf, suite } from './helpers.js';

const read = (text, file = 'r.xml') => readJunit(parseXml(text), file);

test('junit: every testcase with its class name, name, suite, result, line and failure message', () => {
  const text = suite([{ name: 'REQ-1 a' }, { name: 'b', result: 'failed', message: 'expected 2' }, { name: 'c', result: 'error' }, { name: 'd', result: 'skipped' }]);
  const { cases, notes } = read(text);
  assert.deepEqual(cases.map((c) => [c.classname, c.name, c.result]), [['shop.OrderTest', 'REQ-1 a', 'passed'], ['shop.OrderTest', 'b', 'failed'], ['shop.OrderTest', 'c', 'error'], ['shop.OrderTest', 'd', 'skipped']]);
  assert.equal(cases[1].message, 'expected 2');
  assert.equal(cases[2].message, 'timed out');
  assert.equal(cases[0].line, lineOf(text, 'REQ-1 a'));
  assert.equal(cases[0].suite, 'shop.OrderTest');
  assert.equal(cases[0].file, 'r.xml');
  assert.equal(cases[0].label, 'shop.OrderTest > REQ-1 a');
  assert.deepEqual(notes, []);
  assert.deepEqual(RESULT_KINDS, ['passed', 'failed', 'error', 'skipped']);
});

test('junit: a failure without a message gives the first line of its text', () => {
  const { cases } = read('<testsuite name="s"><testcase name="a"><failure>\n  first line\nsecond</failure></testcase></testsuite>');
  assert.equal(cases[0].message, 'first line');
});

test('junit: the properties of a testcase are read with their name, value and line; those of a suite are not', () => {
  const text = '<testsuite name="s">\n<properties><property name="requirement" value="REQ-9"/></properties>\n<testcase name="t">\n  <properties>\n    <property name="requirement" value="REQ-1"/>\n    <property name="note">REQ-2 in the text</property>\n    <property value="no name"/>\n  </properties>\n</testcase>\n</testsuite>';
  const { cases } = read(text);
  assert.deepEqual(cases[0].properties, [{ name: 'requirement', value: 'REQ-1', line: lineOf(text, '<property name="requirement" value="REQ-1"') }, { name: 'note', value: 'REQ-2 in the text', line: lineOf(text, '<property name="note"') }]);
});

test('junit: the shapes of Surefire, pytest, Playwright and jest-junit are read', () => {
  const surefire = '<?xml version="1.0"?><testsuite name="shop.OrderTest" tests="1"><properties><property name="java.version" value="21"/></properties><testcase name="REQ-1 places" classname="shop.OrderTest" time="0.1"/></testsuite>';
  const pytest = '<testsuites name="pytest tests"><testsuite name="pytest"><testcase classname="tests.test_orders" name="test_a" file="tests/test_orders.py" line="3" time="0.1"><properties><property name="requirement" value="REQ-2" /></properties></testcase></testsuite></testsuites>';
  const playwright = '<testsuites id="" name="" tests="1"><testsuite name="checkout.spec.ts" hostname="chromium"><testcase name="checkout REQ-3 pays" classname="checkout.spec.ts" time="1"></testcase></testsuite></testsuites>';
  const jest = '<testsuites name="jest tests"><testsuite name="total"><testcase classname="total REQ-4 adds tax" name="total REQ-4 adds tax" time="0.004"></testcase></testsuite></testsuites>';
  assert.equal(read(surefire).cases[0].name, 'REQ-1 places');
  assert.equal(read(pytest).cases[0].properties[0].value, 'REQ-2');
  assert.equal(read(pytest).cases[0].suite, 'pytest');
  assert.equal(read(playwright).cases[0].classname, 'checkout.spec.ts');
  assert.equal(read(jest).cases[0].classname, 'total REQ-4 adds tax');
});

test('junit: nested suites are read in file order, and a testcase takes the name of its nearest suite', () => {
  const text = '<testsuites><testsuite name="outer"><testcase name="a"/><testsuite name="inner"><testcase name="b"/></testsuite><testcase name="c"/></testsuite><testsuite name="second"><testcase name="d"/></testsuite></testsuites>';
  const { cases } = read(text);
  assert.deepEqual(cases.map((c) => `${c.suite}:${c.name}`), ['outer:a', 'inner:b', 'outer:c', 'second:d']);
  assert.equal(cases[0].classname, '', 'no classname attribute is an empty class name');
  assert.equal(cases[0].label, 'a');
});

test('junit: a testcase with no name is not read, and a note says how many', () => {
  const { cases, notes } = read('<testsuite name="s"><testcase classname="x"/><testcase name=""/><testcase name="ok"/></testsuite>');
  assert.equal(cases.length, 1);
  assert.deepEqual(notes, ['2 testcase elements have no name attribute and were not read']);
  assert.deepEqual(read('<testsuite name="s"><testcase/></testsuite>').notes, ['1 testcase element has no name attribute and was not read']);
});

test('junit: a reference to a forbidden character is counted in a note', () => {
  const { notes } = read('<testsuite name="s"><testcase name="a&#0;"/></testsuite>');
  assert.deepEqual(notes, ['1 numeric reference names a character that XML does not allow, read as the replacement character']);
});

test('junit: a root element that is not testsuites or testsuite is refused', () => {
  assert.throws(() => read('<coverage/>'), /the root element is <coverage>, not <testsuites> or <testsuite>/);
});

test('junit: testLabel joins the class name and the name', () => {
  assert.equal(testLabel('a.B', 'c'), 'a.B > c');
  assert.equal(testLabel('', 'c'), 'c');
});
