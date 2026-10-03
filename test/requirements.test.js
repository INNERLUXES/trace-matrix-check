import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REQUIREMENT_LIMITS, linkSpec, readRequirements, requirementsKind } from '../src/index.js';
import { lineOf, reqCsv } from './helpers.js';

const spec = linkSpec({ prefixes: ['REQ-'] });
const COLUMNS = { id: 'id', title: 'title', priority: 'priority', status: 'status' };
const config = (extra = {}) => ({ columns: COLUMNS, delimiter: ',', excludeStatuses: ['Withdrawn'], ...extra });
const csv = (text, c = config()) => readRequirements(text, 'csv', c, spec);

test('requirements: a CSV list with the named columns, header names compared without case and white space', () => {
  const text = 'ID , Title,PRIORITY,Status,Owner\nREQ-1,Place an order,High,Approved,ann\nREQ-2,Cancel,Low,Withdrawn,bo\n';
  const r = readRequirements(text, 'csv', config({ columns: { id: 'id', title: 'title', priority: 'priority', status: 'status' } }), spec);
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.rows.map((x) => [x.id, x.key, x.title, x.priority, x.listStatus, x.excluded, x.linkable, x.line]), [['REQ-1', 'REQ-1', 'Place an order', 'High', 'Approved', false, true, 2], ['REQ-2', 'REQ-2', 'Cancel', 'Low', 'Withdrawn', true, true, 3]]);
});

test('requirements: excludeStatuses is compared without case; without a status column nothing is excluded', () => {
  const r = csv(reqCsv([['REQ-1', 't', 'High', ' withdrawn '], ['REQ-2', 't', 'High', 'Draft']]));
  assert.deepEqual(r.rows.map((x) => x.excluded), [true, false]);
  const noStatus = readRequirements('id\nREQ-1\n', 'csv', { columns: { id: 'id' }, excludeStatuses: [] }, spec);
  assert.equal(noStatus.rows[0].excluded, false);
  assert.equal(noStatus.rows[0].title, '');
  assert.equal(noStatus.rows[0].priority, '');
});

test('requirements: an ID on a second row is a duplicate; the first row is used', () => {
  const text = reqCsv([['REQ-1', 'first', 'High', 'Approved'], ['REQ-2', 'other', 'Low', 'Approved'], ['REQ-1', 'second', 'Low', 'Approved']]);
  const r = csv(text);
  assert.deepEqual(r.rows.map((x) => x.title), ['first', 'other']);
  assert.deepEqual(r.duplicates, [{ id: 'REQ-1', key: 'REQ-1', line: lineOf(text, 'REQ-1,second'), first: lineOf(text, 'REQ-1,first') }]);
});

test('requirements: with ignoreCase two IDs that differ only in case are one ID', () => {
  const r = readRequirements(reqCsv([['REQ-1', 'a', '', ''], ['req-1', 'b', '', '']]), 'csv', config(), linkSpec({ prefixes: ['REQ-'], ignoreCase: true }));
  assert.equal(r.rows.length, 1);
  assert.equal(r.duplicates.length, 1);
});

test('requirements: an ID that does not have the form of the link spec is kept, marked as not linkable, and listed', () => {
  const r = csv(reqCsv([['REQ-1', 'a', '', ''], ['legacy 7', 'b', '', ''], ['REQ-2a', 'c', '', '']]));
  assert.deepEqual(r.rows.map((x) => x.linkable), [true, false, false]);
  assert.deepEqual(r.unlinkable.map((x) => x.id), ['legacy 7', 'REQ-2a']);
});

test('requirements: a row with no ID, an ID with a control character and an ID over the limit are problems with their line', () => {
  const r = csv(reqCsv([['REQ-1', 'a', '', ''], ['', 'no id', '', ''], [`REQ-${'1'.repeat(300)}`, 'long', '', '']]));
  assert.deepEqual(r.rows, []);
  assert.equal(r.problems[0], 'line 3: the requirement has no ID');
  assert.match(r.problems[1], /^line 4: the ID REQ-1+\.\.\. is longer than 200 characters or holds a control character$/);
  const ctl = csv(`id,title,priority,status\n"REQ-1${String.fromCharCode(7)}",a,b,c\n`);
  assert.match(ctl.problems[0], /holds a control character/);
});

test('requirements: a list with no row, a missing column, a column named twice and bad quoting are problems', () => {
  assert.deepEqual(csv('id,title,priority,status\n').problems, ['the list holds no requirement']);
  assert.match(csv('key,title,priority,status\nREQ-1,a,b,c\n').problems[0], /the header has no column named "id" for the id; the columns are "key", "title", "priority", "status"/);
  assert.match(csv('id,ID,title,priority,status\nREQ-1,x,a,b,c\n').problems[0], /the header names "id" more than once \(columns 1, 2\), so the id is not clear/);
  assert.match(csv('id,title,priority,status\nREQ-1,"a,b,c\n').problems[0], /^line 2: a field in double quotes that starts on line 2 is never closed/);
  assert.match(csv('id,title,priority,status\nREQ-1,a\n').problems[0], /^line 2: 2 fields where the header on line 1 has 4/);
});

test('requirements: the delimiter of the configuration is used', () => {
  const r = csv('id;title;priority;status\nREQ-1;Pay, then ship;High;Approved\n', config({ delimiter: ';' }));
  assert.equal(r.rows[0].title, 'Pay, then ship');
});

test('requirements: a JSON list is an array of objects with the keys named in the columns, compared as written', () => {
  const text = '[\n  { "id": "REQ-1", "title": "Place", "priority": "High", "status": "Approved" },\n  { "id": "REQ-2", "status": "Withdrawn", "owner": 3 }\n]';
  const r = readRequirements(text, 'json', config(), spec);
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.rows.map((x) => [x.id, x.title, x.priority, x.excluded, x.line]), [['REQ-1', 'Place', 'High', false, 2], ['REQ-2', '', '', true, 3]]);
  assert.match(readRequirements('[{"ID": "REQ-1"}]', 'json', config(), spec).problems[0], /the requirement has no ID/);
});

test('requirements: a JSON list that is not an array of objects with string values is a problem with its line', () => {
  const json = (text) => readRequirements(text, 'json', config(), spec).problems[0];
  assert.match(json('{"id": "REQ-1"}'), /must be one JSON array of objects/);
  assert.match(json('[\n"REQ-1"\n]'), /^line 2: item 1 is not an object/);
  assert.match(json('[\n{\n"id": 7\n}\n]'), /^line 3: the value of "id" must be a string/);
  assert.match(json('[{"id": "REQ-1", "id": "REQ-2"}]'), /appears twice in one object/);
  assert.match(json('[{"id": "REQ-1"},]'), /no trailing comma/);
  assert.deepEqual(readRequirements('[]', 'json', config(), spec).problems, ['the list holds no requirement']);
});

test('requirements: the kind of a list by the end of its name, and the limit of rows', () => {
  assert.equal(requirementsKind('a/reqs.CSV'), 'csv');
  assert.equal(requirementsKind('reqs.json'), 'json');
  assert.equal(requirementsKind('reqs.xlsx'), null);
  assert.equal(REQUIREMENT_LIMITS.maxRequirements, 100000);
  const r = readRequirements(reqCsv([['REQ-1', 'a', '', ''], ['REQ-2', 'b', '', '']]), 'csv', config(), spec, { maxRequirements: 1 });
  assert.deepEqual(r.problems, ['more than 1 requirements']);
});
