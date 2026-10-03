import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LINK_LIMITS, PREFIX_CHARACTERS, asciiUpper, findIds, idKey, linkSpec, wholeId } from '../src/index.js';

const ids = (text, spec) => findIds(text, spec).ids.map((x) => x.id);
const digits = linkSpec({ prefixes: ['REQ-'] });

test('link: an ID is a prefix and a run of digits, found anywhere in a name, in the order it appears, once', () => {
  assert.deepEqual(ids('REQ-1 places an order', digits), ['REQ-1']);
  assert.deepEqual(ids('places an order [REQ-12, REQ-3]', digits), ['REQ-12', 'REQ-3']);
  assert.deepEqual(ids('REQ-7 and again REQ-7', digits), ['REQ-7']);
  assert.deepEqual(ids('checkout > REQ-40: pays', digits), ['REQ-40']);
  assert.deepEqual(ids('(REQ-5)', digits), ['REQ-5']);
  assert.deepEqual(ids('no id here', digits), []);
  assert.deepEqual(ids('', digits), []);
  assert.deepEqual(ids(undefined, digits), []);
});

test('link: the character before the prefix and after the ID must not be a letter or a digit', () => {
  assert.deepEqual(ids('XREQ-1', digits), [], 'a letter before the prefix');
  assert.deepEqual(ids('9REQ-1', digits), [], 'a digit before the prefix');
  assert.deepEqual(ids('_REQ-1', digits), ['REQ-1'], 'an underscore is not a letter or a digit');
  assert.deepEqual(ids('REQ-12a', digits), [], 'a letter after the digits');
  assert.deepEqual(ids('REQ-12_x', digits), ['REQ-12']);
  assert.deepEqual(ids('REQ-12.', digits), ['REQ-12']);
  assert.deepEqual(ids('REQ-', digits), [], 'a prefix with nothing after it');
  assert.deepEqual(ids('REQ-x REQ-2', digits), ['REQ-2']);
  assert.deepEqual(ids(`caf${String.fromCharCode(0xe9)}REQ-3`, digits), ['REQ-3'], 'only ASCII letters and digits are letters and digits');
});

test('link: alnum takes letters and digits; alnum-dot-dash also takes dots, dashes and underscores between them', () => {
  const alnum = linkSpec({ prefixes: ['US-'], idCharacters: 'alnum' });
  assert.deepEqual(ids('US-12a works, US-ABC too', alnum), ['US-12a', 'US-ABC']);
  assert.deepEqual(ids('US-1.2', alnum), ['US-1']);
  const dotted = linkSpec({ prefixes: ['SRS-'], idCharacters: 'alnum-dot-dash' });
  assert.deepEqual(ids('SRS-4.2.1 covers it.', dotted), ['SRS-4.2.1']);
  assert.deepEqual(ids('see SRS-4.2.', dotted), ['SRS-4.2'], 'a dot at the end is not part of the ID');
  assert.deepEqual(ids('SRS-a_b-c--', dotted), ['SRS-a_b-c']);
  assert.deepEqual(ids('SRS-.', dotted), [], 'only joiners after the prefix');
});

test('link: several prefixes, and prefixes of other characters', () => {
  const spec = linkSpec({ prefixes: ['REQ-', 'ORD#', 'sys:'] });
  assert.deepEqual(ids('REQ-1 ORD#22 sys:3', spec), ['REQ-1', 'ORD#22', 'sys:3']);
  assert.deepEqual(ids('sys:3 REQ-1', spec), ['sys:3', 'REQ-1'], 'in the order of the text, not of the prefixes');
  const plain = linkSpec({ prefixes: ['REQ'] });
  assert.deepEqual(ids('REQ12 and REQ 13', plain), ['REQ12']);
});

test('link: ignoreCase compares ASCII letters without case and keeps the ID in capitals', () => {
  const spec = linkSpec({ prefixes: ['req-'], ignoreCase: true });
  assert.deepEqual(spec.prefixes, ['REQ-']);
  assert.deepEqual(ids('Req-1 and REQ-1 and req-2', spec), ['REQ-1', 'REQ-2']);
  assert.deepEqual(ids('Req-1', digits), [], 'without ignoreCase the case must match');
  assert.equal(asciiUpper(`a${String.fromCharCode(0xdf)}z`), `A${String.fromCharCode(0xdf)}Z`, 'only ASCII letters change, so the length stays the same');
  assert.equal(asciiUpper('NO-CHANGE-1'), 'NO-CHANGE-1');
});

test('link: an ID longer than the limit after its prefix is not an ID, and a text holds at most 50 different IDs', () => {
  assert.equal(LINK_LIMITS.maxBodyLength, 40);
  assert.deepEqual(ids(`REQ-${'1'.repeat(40)}`, digits), [`REQ-${'1'.repeat(40)}`]);
  assert.deepEqual(ids(`REQ-${'1'.repeat(41)}`, digits), []);
  const many = Array.from({ length: 60 }, (_, i) => `REQ-${i + 1}`).join(' ');
  const r = findIds(many, digits);
  assert.equal(r.ids.length, 50);
  assert.equal(r.truncated, true);
  assert.equal(findIds('REQ-1 REQ-1', digits).truncated, false);
});

test('link: wholeId and idKey give the canonical form of a requirement ID, or the text when it is not one', () => {
  assert.equal(wholeId('REQ-1', digits), 'REQ-1');
  assert.equal(wholeId(' REQ-1', digits), null);
  assert.equal(wholeId('REQ-1 extra', digits), null);
  assert.equal(wholeId('REQ-1a', digits), null);
  assert.equal(wholeId('req-1', linkSpec({ prefixes: ['REQ-'], ignoreCase: true })), 'REQ-1');
  assert.equal(idKey('req-1', linkSpec({ prefixes: ['REQ-'], ignoreCase: true })), 'REQ-1');
  assert.equal(idKey('legacy 7', digits), 'legacy 7');
  assert.equal(idKey('legacy 7', linkSpec({ prefixes: ['REQ-'], ignoreCase: true })), 'LEGACY 7');
});

test('link: linkSpec refuses what the configuration reader refuses, and drops a prefix named twice', () => {
  assert.throws(() => linkSpec({ prefixes: [] }), /give 1 to 10 prefixes/);
  assert.throws(() => linkSpec({ prefixes: ['REQ-(\\d+)'] }), /is not 1 to 20 of the characters/);
  assert.throws(() => linkSpec({ prefixes: ['x'.repeat(21)] }), /is not 1 to 20/);
  assert.throws(() => linkSpec({ prefixes: ['REQ-'], idCharacters: 'regex' }), /idCharacters is one of digits, alnum, alnum-dot-dash/);
  assert.deepEqual(linkSpec({ prefixes: ['A-', 'a-'], ignoreCase: true }).prefixes, ['A-']);
  assert.match('REQ-', PREFIX_CHARACTERS);
  assert.doesNotMatch('REQ (', PREFIX_CHARACTERS);
});
