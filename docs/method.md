# Method

The tool builds a requirements traceability matrix from what the pipeline already writes, and compares it with the gates of the configuration. Every part of the method says what it does, what it can see and what it cannot, and, where it rests on a saved page, the sentence of that page. The pages are saved in [research/sources](../research/sources), and a test compares every quoted sentence with the saved text. Where the tool makes a choice that the pages do not state (how a test names a requirement, how the results of several tests become one status, what counts as an orphan), the text says so.

The idea behind the tool is the definition of traceability in the ISTQB glossary: "The ability to establish explicit relationships between related work products or items within work products." A requirement and the tests that check it are such related work products. The glossary calls the source of the tests the test basis, "The body of knowledge used as the basis for test analysis and test design.", and defines a requirement as "A provision that contains criteria to be fulfilled." The matrix shows, for each requirement in the test basis, which tests name it and how they ended.

## How an ID is found

A test names a requirement by holding its ID. The tool does not take a regular expression from the configuration; an ID is described by:

- **a prefix**: one of `link.prefixes`, 1 to 20 of the characters `A-Z a-z 0-9 . _ : # / -`, compared as written, or without case for ASCII letters when `link.ignoreCase` is true;
- **a set of ID characters**: `digits` (0 to 9), `alnum` (ASCII letters and digits) or `alnum-dot-dash` (ASCII letters and digits, and a dot, a dash or an underscore between them).

An ID is found where a prefix starts and:

1. the character before the prefix is not an ASCII letter or digit, so `XREQ-1` holds no ID;
2. one or more characters of the set follow, taken as far as they go; with `alnum-dot-dash` a dot, a dash or an underscore at the end is not part of the ID, so `SRS-4.2.` holds `SRS-4.2`;
3. the character after the ID is not an ASCII letter or digit, so `REQ-12a` holds no ID when the set is `digits`;
4. the part after the prefix is at most 40 characters long.

Every text is scanned once per prefix, from left to right, and each run of ID characters is read once, so the work grows with the length of the text times the number of prefixes and never more. A text that holds more than 50 different IDs is cut to the first 50, and a note says so. With `link.ignoreCase` an ID is kept in capitals, and the IDs of the requirements list are compared the same way.

A requirement ID in the list is linkable when the whole ID, and nothing else, has this form. One that is not (a free-text ID, a space in it, another prefix) cannot be named by a test: it stays in the matrix as not covered, and a note lists it. This is the tool's own rule. It keeps the scan simple enough that no input can make it slow, and it means that a team names requirements in one consistent way.

The places that are scanned are named in `link.from` and listed in [inputs.md](inputs.md#where-a-test-names-a-requirement): the `name` and `classname` attributes of a testcase, the value of the named `property` elements inside a testcase, and the requirements column of the test-case export. The Surefire schema has the name and the class name, `<xs:attribute name="name" type="xs:string" use="required"/>` and `<xs:attribute name="classname" type="xs:string"/>`, and has a property only inside `properties` of a `testsuite`, with `<xs:attribute name="value" type="xs:string" use="required"/>`. pytest writes properties inside a testcase for `record_property` ("If you want to log additional information for a test, you can use the record_property fixture:") and warns that this does not follow the schema: "Please note that using this feature will break schema verifications for the latest JUnitXML schema." jest-junit says the same of its testcase properties. The tool reads the properties inside a testcase because that is where a property belongs to one test; the properties of a suite are not read.

## The status of a requirement

Every test that names a requirement counts: each testcase of the JUnit results and each row of the test-case export is one test with one result (passed, failed, error, skipped, or not run for a test case whose result is empty or not listed). A requirement that is not excluded gets one status:

| Status | When |
| --- | --- |
| `covered-passing` | tests name it, at least one passed, and none failed or had an error |
| `covered-failing` | at least one test that names it failed or had an error |
| `covered-not-run` | tests name it, none failed and none passed: every one was skipped or not run |
| `not-covered` | no test names it |

A failure wins over a pass. A test that is in the results twice, once failed and once passed (a retry, or two runs given together), makes the requirement covered-failing: the evidence holds a failing run, and the tool does not decide which run counts. Give the results of one pipeline run. A skipped test is not evidence: the Surefire schema has the element, `<xs:element name="skipped" nillable="true" minOccurs="0" maxOccurs="1">`, and a requirement whose tests were all skipped is covered-not-run, never passing.

A requirement whose status in the list is one of `requirements.excludeStatuses` is excluded: it is listed with the tests that still name it, and it is in no gate and no count of included requirements.

Besides the matrix the report lists:

- **orphan IDs**: IDs that a test names and the list does not hold, included or excluded. A removed requirement, a renamed one or a typo in a test name shows up here. An ID that a test names is an orphan only when it has the form of the link spec, so text that merely looks similar is not reported.
- **duplicate IDs**: IDs on more than one row of the list. The first row is used, the others are listed with their lines.
- **tests that name no requirement**: tests in the results that hold no ID in the places scanned. Without `--explain` the first twelve are listed.

`--explain` lists, under each requirement, every test that names it with its result, the place the ID was found (`name`, `classname`, `property <name>` or `column <name>`), the file and the line, and the message of a failure. The same facts are always in the JSON report.

## Gates

A gate compares one count or share of the matrix with one number or list in `gates`, and is met or not met. The tool has no threshold of its own: a gate the configuration does not state is not run, and a configuration with no gate is refused. A number exactly at the limit is met. Every gate shows its rule, what was found, why it is not met, and the requirements behind it; `--explain` adds the facts with their file and line and the sentences the gate rests on.

### `must-pass`

`gates.mustPass.priorities`: every included requirement whose priority is one of these is covered-passing. Priorities are compared without case and without white space around them. It is not met when one of those requirements is covered-failing, covered-not-run or not covered, and also when a named priority is not the priority of any requirement in the list, included or excluded: a priority that matches nothing checks nothing, and is most often a typo. A priority whose requirements are all excluded is met with nothing to check. The basis is the ISTQB definition of a requirement and of requirements-based testing, "A black-box test technique in which test conditions are derived from atomic requirements." The tool cannot see whether the priority in the list is right.

### `not-covered`

`gates.maxNotCovered`: at most this many included requirements are not covered. It is not met above the limit, with the requirements named. The basis is the ISTQB definitions of traceability and of the test basis. The tool cannot see whether a test that names a requirement checks it.

### `covered-failing`

`gates.maxFailing`: at most this many included requirements have a failing test. The basis is the definitions of a requirement and of a test case, "A set of preconditions, inputs, actions (where applicable), expected results and postconditions, developed based on test conditions." A failure in any test that names the requirement counts, so a test that names several requirements makes each of them covered-failing.

### `covered-not-run`

`gates.maxNotRun`: at most this many included requirements have tests that all were skipped or not run. The basis is the definition of a test case and the `skipped` element of the Surefire schema. A test case of the export with a result the configuration does not list counts as not run, never as passed.

### `passing-share`

`gates.minPassingShare`: at least this share of the included requirements is covered-passing. The share is computed with whole numbers, so 66.6666 percent is met by 2 of 3 and 66.6667 percent is not; a figure is shown cut down to two decimals, never rounded up. It is not met when every requirement is excluded: a share of nothing is not met. The basis is the definition of requirements-based testing.

### `orphans`

`gates.maxOrphans`: at most this many different IDs are named by tests and not held by the list. 0 means no orphan is allowed. It is not met above the limit, with each ID and the tests that name it. The basis is the definition of traceability: an orphan is a link from a test to nothing.

### `duplicate-ids`

`gates.maxDuplicateIds`: at most this many IDs are on more than one row of the list. It is not met above the limit, with each ID and its lines. A requirement on two rows is ambiguous: its title, priority and status may differ, and only the first row is used.

## Result and exit codes

The result is pass when no gate is not met. The exit code is `0` for pass, `1` when a gate is not met, and `2` for a usage or input error: a missing option, an unknown option, a file that cannot be read, a configuration with an unknown key or no gate, a result file that is not well formed or has a DOCTYPE, a list or an export with bad quoting or without a named column, an input over the limits. With exit code `2` the tool gives no verdict and prints the problems on standard error, because a verdict on half-read evidence would be a guess.
