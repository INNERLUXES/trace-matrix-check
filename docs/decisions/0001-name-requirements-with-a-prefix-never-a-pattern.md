# 1. Name requirements with a prefix, never a pattern

## Context

A traceability matrix answers two questions: which tests check a requirement, and how did they end. The ISTQB glossary defines traceability as "The ability to establish explicit relationships between related work products or items within work products." The relationship has to be written down somewhere both sides can be read. In most teams it is written in the test itself: an ID in the name of the test, in its class name, in a property the runner writes, or in a column of the test management tool.

The results are already written by the pipeline: JUnit XML from Surefire, pytest, Playwright or jest-junit, and a CSV export from the test management tool. They often come from tests on branches nobody has reviewed. A tool that finds IDs in them with a regular expression of the team's own choosing gives every author of a test name a way to make the check slow: a pattern with nested repetition, matched against a crafted name, takes a time that doubles with every character. A regular expression also lets two teams write IDs in many shapes, and the matrix then depends on which shapes the pattern happens to catch.

Result files are also a place for an attack on a reader. A general XML library that reads a DTD can be made to expand entities without end or to read a secret file into its output. A configuration is a place for a mistake: a misspelled key switches a gate off, and a JSON object that names a key twice gives two numbers to two readers.

## Decision

An ID is a prefix of plain characters, such as `ORD-`, and one of three fixed sets of characters after it: digits, ASCII letters and digits, or ASCII letters and digits with a dot, a dash or an underscore between them. It must not touch an ASCII letter or digit on either side. The configuration names the prefixes and the set; it cannot hold a pattern. The scan reads each text once per prefix, from left to right, and reads each run of ID characters once. A requirement ID that does not have this form cannot be named by a test, and the report says so.

The places where an ID is looked for are named in the configuration, and there are four: the name of a testcase, its class name, the value of a named property inside it, and a column of the test-case export. `--explain` shows, for each requirement, the test, the place and the file and line of every link.

A requirement is covered-passing only when a test that names it passed and none failed. Every test given counts, and a failure wins over a pass. A skipped test and a test case with an unknown result are not evidence. The tool has no threshold of its own: every gate and every number is in the configuration, and a configuration with no gate is refused.

It reads files and never runs a test. It has its own small, strict readers: an XML reader with no DTD support, which refuses a DOCTYPE and reads only the five predefined entities and numeric references; a JSON reader that refuses an object with a repeated key; and a CSV reader written from RFC 4180 that refuses bad quoting with its line. So it needs no dependency, no build and no network. An input that cannot be read stops the run with exit code `2` and no verdict.

## Consequences

No input can make the link slow, and every link can be explained by pointing at a test, a place and a line. Teams name requirements in one form, which is also the form a person searches for. The check runs in a second on Linux, macOS or Windows with only Node.

The cost is that IDs in other forms are not found: `REQ 12` with a space, IDs in free text, or IDs that differ in case without `link.ignoreCase`. The tool cannot tell a link from a mention, and cannot see whether a test checks what it names. docs/limits.md lists these. The configuration and the requirements list are files under review, and docs/secure-defaults.md says how to protect them.
