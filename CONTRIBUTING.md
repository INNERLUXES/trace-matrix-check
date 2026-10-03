# Contributing

Every change goes through a pull request and is reviewed before it is merged. The pipeline runs the tests on Linux, Windows and macOS with Node 22 and 24, the tests with coverage, the repository checks, CodeQL, and a secure development check of the repository itself.

Commit messages in this repository follow Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `ci:`, `chore:`, with `!` for a breaking change.

## Changing a gate

1. Describe the change in docs/method.md first: what the gate checks, the rule, when it is met and when it is not, what it can see and what it cannot, and the sentence of a saved page it rests on. Where the tool makes its own choice, say so and say why.
2. The tool has no threshold of its own, and a change must not add one. Every number a gate compares must come from the configuration file.
3. A requirement is never passing by default. A skipped test, a test case with an unknown result and a requirement that no test names must not count as covered-passing, and a failure must keep winning over a pass.
4. Add a test with the inputs written inline (`kase()`, `reqCsv()`, `suite()` and `configOf()` in test/helpers.js build them), small enough that the result can be worked out by hand, with a near miss on each side of the limit.
5. Text from the input goes through `safeText` before it reaches a report, a note or an error message, so control characters are removed and the length is capped.
6. A gate id, once released, keeps its meaning: pipelines and other tools read it from the JSON report.

## Changing how a test names a requirement

1. The link stays a prefix and a fixed set of ID characters. Never take a regular expression from the configuration, and never build one from any input; a repository test looks for `new RegExp` in src.
2. The scan reads each text once per prefix, from left to right, and reads a run of ID characters once. A new set of ID characters is added to `ID_CHARACTERS` in src/data.js, described in docs/method.md, and tested with IDs at both edges and with a hostile text of a million characters.
3. A new place to look for IDs is added to `LINK_FIELDS`, documented in docs/inputs.md with exactly what is scanned, and backed by a saved page that shows the place in the files a runner writes.

## Changing the configuration file

1. A new key is added to `KEYS` in src/config.js, documented in docs/inputs.md, and tested with a good value and a bad one. Every key the tool does not know stays an error, and an object that names a key twice stays refused.
2. A number is a whole number or a percentage with at most four decimals, checked for its range, and compared with whole numbers. Never compare a share as a floating point number.

## Changing a reader

1. The tool reads; it never runs. A change to the XML reader must not read a DTD, expand an entity other than the five predefined ones and numeric references, fetch anything a file names, or follow a link inside a folder. A DOCTYPE stays refused.
2. Keep the work linear: one pass over the text, no pattern with nested repetition, and no loop over all tests inside a loop over all requirements. Keep the limits on nesting, elements, attributes, names, strings, fields, records, requirements, test cases and files. Add a hostile test with a long input and a time check.
3. A time check in a test widens under coverage: read `process.env.NODE_V8_COVERAGE`, which the test runner sets only when coverage is on, and allow four times the time. Never read `process.execArgv` for this, because it holds the coverage flags of the runner in every run. Run `npm run test:coverage` before you open the pull request.
4. Files written with LF and with CRLF line ends must give the same report. The example inputs are stored as written (`.gitattributes`), and a test reads them both ways.
5. Paths are opened with `path.resolve`, never `path.join`, so an absolute path works on every system. Paths shown in a report are relative, with forward slashes.

## Tests that depend on the system

A test that depends on the operating system (a symbolic link, a device, a name with a control character) is guarded with `process.platform`, says why in its `t.skip`, and asserts no line or column of its own: a line or column is asserted only in a test that runs on every system, and is worked out there with `lineOf()` of test/helpers.js or from the text itself, never written by hand. `test/repo.test.js` fails when a guarded test asserts a line or a column. Every other test builds its paths with `resolve()` from names with forward slashes.

## Changing the quoted sentences

The sentences in `src/data.js` come from the pages saved in `research/sources`: five terms of the ISTQB glossary, the schema of the Surefire test report, the `record_property` section of the pytest documentation, part of the README of jest-junit, the JUnit reporter section of the Playwright documentation, RFC 4180, RFC 8259 and three sections of W3C XML 1.0. When a page changes, save the new text in `research/sources` (the address on the first line, plain ASCII, no date or year), change `src/data.js` to match, and update docs/rules-and-sources.md. `test/data.test.js` compares every quoted sentence with the saved text, so changing one without the other fails.

Never add a rule or a quoted sentence from memory or from a blog post. A new rule needs the page, opened and saved, and the words of the page that it rests on. If a page cannot be opened, do not cite it.

## Rules for the code

- No runtime dependencies. Node 22 or newer and nothing else.
- The tool reads the files it is given and writes only to the screen. It opens no network connection and runs no program.
- Source files stay ASCII; write any other character as a Unicode escape, or build it from its code point.
- Never commit a real secret, even as a fixture. `npm run check` fails on anything that looks like a credential.
- No file carries a date, and no file holds a number that reads like a year. Version numbers (Node 22, 1.0.0) are fine.

## Before you open the pull request

```
npm test
npm run test:coverage
npm run check
npm run example
```
