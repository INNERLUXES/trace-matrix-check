// Finding requirement IDs in text. No regular expression from the configuration is ever run: an ID is described by a
// list of prefixes and one of three fixed sets of characters (src/data.js ID_CHARACTERS), and found by a scan that
// looks at each character a bounded number of times. An ID is a prefix, then one or more characters of the set, with
// these edges:
//
//   - the character before the prefix is not an ASCII letter or digit (so XREQ-1 does not hold REQ-1);
//   - the characters of the set are taken as far as they go; with alnum-dot-dash a dot, a dash or an underscore at the
//     end is not part of the ID (so "REQ-1.2." ends at 2);
//   - the character after the ID is not an ASCII letter or digit (so REQ-12a holds no ID when the set is digits);
//   - an ID longer than LINK_LIMITS.maxBodyLength characters after its prefix is not an ID.
//
// With ignoreCase, ASCII letters are compared without case and an ID is kept in capitals; other characters are compared
// as they are. The work is at most the length of the text times the number of prefixes.

export const LINK_LIMITS = { maxPrefixes: 10, maxPrefixLength: 20, maxBodyLength: 40, maxIdsPerText: 50 };

const isDigit = (c) => c >= 48 && c <= 57;
const isLetter = (c) => (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
const isWord = (c) => isDigit(c) || isLetter(c);
const isJoiner = (c) => c === 45 || c === 46 || c === 95;

const ALLOWED = {
  digits: isDigit,
  alnum: isWord,
  'alnum-dot-dash': (c) => isWord(c) || isJoiner(c)
};

// The characters a prefix may hold.
export const PREFIX_CHARACTERS = /^[A-Za-z0-9._:#/-]+$/;

// ASCII letters in capitals, every other character as it is: the length never changes, so offsets stay the same.
export function asciiUpper(text) {
  let out = '';
  let from = 0;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    if (c >= 97 && c <= 122) {
      out += text.slice(from, i) + String.fromCharCode(c - 32);
      from = i + 1;
    }
  }
  return from === 0 ? text : out + text.slice(from);
}

// The spec of the link from the configuration: { prefixes, idCharacters, ignoreCase }. Throws on a value that the
// configuration reader would have refused, so a caller in code gets the same rules.
export function linkSpec({ prefixes, idCharacters = 'digits', ignoreCase = false }) {
  if (!Array.isArray(prefixes) || prefixes.length === 0 || prefixes.length > LINK_LIMITS.maxPrefixes) throw new Error(`give 1 to ${LINK_LIMITS.maxPrefixes} prefixes`);
  for (const p of prefixes) {
    if (typeof p !== 'string' || p.length > LINK_LIMITS.maxPrefixLength || !PREFIX_CHARACTERS.test(p)) throw new Error(`the prefix ${String(p).slice(0, 30)} is not 1 to ${LINK_LIMITS.maxPrefixLength} of the characters A-Z a-z 0-9 . _ : # / -`);
  }
  if (!Object.hasOwn(ALLOWED, idCharacters)) throw new Error(`idCharacters is one of ${Object.keys(ALLOWED).join(', ')}`);
  const seen = new Set();
  const list = [];
  for (const p of prefixes) {
    const key = ignoreCase ? asciiUpper(p) : p;
    if (!seen.has(key)) {
      seen.add(key);
      list.push(key);
    }
  }
  return { prefixes: list, idCharacters, ignoreCase: Boolean(ignoreCase), allowed: ALLOWED[idCharacters] };
}

// Every ID in a text, in the order they appear, each once: [{ id, offset, length }]. id is the canonical form (in
// capitals with ignoreCase). truncated is true when the text held more than maxIdsPerText different IDs; the rest are
// left out.
export function findIds(text, spec, limits = LINK_LIMITS) {
  const value = String(text ?? '');
  const hay = spec.ignoreCase ? asciiUpper(value) : value;
  const n = hay.length;
  const found = [];
  for (const prefix of spec.prefixes) {
    let from = 0;
    for (;;) {
      const at = hay.indexOf(prefix, from);
      if (at === -1) break;
      if (at > 0 && isWord(hay.charCodeAt(at - 1))) {
        from = at + 1;
        continue;
      }
      const start = at + prefix.length;
      let j = start;
      while (j < n && spec.allowed(hay.charCodeAt(j))) j += 1;
      let end = j;
      if (spec.idCharacters === 'alnum-dot-dash') while (end > start && isJoiner(hay.charCodeAt(end - 1))) end -= 1;
      const body = end - start;
      const after = end < n ? hay.charCodeAt(end) : -1;
      if (body >= 1 && body <= limits.maxBodyLength && !isWord(after)) found.push({ id: hay.slice(at, end), offset: at, length: end - at });
      // The run of allowed characters is never read again: the next search starts after it, or after the prefix when
      // the run is empty.
      from = j > start ? j : at + 1;
    }
  }
  found.sort((a, b) => a.offset - b.offset || b.length - a.length);
  const out = [];
  const seen = new Set();
  let truncated = false;
  for (const f of found) {
    if (seen.has(f.id)) continue;
    if (out.length >= limits.maxIdsPerText) {
      truncated = true;
      break;
    }
    seen.add(f.id);
    out.push(f);
  }
  return { ids: out, truncated };
}

// The canonical form of a whole text that is one ID and nothing else, or null: used for the IDs of the requirements
// list, which a test can only name when they have the form of the link spec.
export function wholeId(text, spec) {
  const value = String(text ?? '');
  const { ids } = findIds(value, spec);
  return ids.length === 1 && ids[0].offset === 0 && ids[0].length === value.length ? ids[0].id : null;
}

// The key a requirement ID is compared by: the canonical form when it is one, else the text itself (with ignoreCase,
// in ASCII capitals), so two rows of the list are compared the same way as the IDs in tests.
export function idKey(text, spec) {
  return wholeId(text, spec) ?? (spec.ignoreCase ? asciiUpper(String(text)) : String(text));
}
