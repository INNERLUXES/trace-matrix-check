# Inputs

The tool reads four kinds of file: the configuration (JSON), the requirements list (CSV or JSON), JUnit XML results, and the CSV export of the test cases of a test management tool. Every file is named on the command line; the tool opens nothing else. This page lists every key of the configuration and exactly what is taken from each file.

## The command line

```
trace-matrix-check --config <file> --requirements <file> (--junit <path> | --test-cases <file>) [--format text|markdown|json] [--explain]
```

`--config` and `--requirements` are required, and at least one of `--junit` and `--test-cases`. `--junit` takes a file or a folder and can be repeated: all the paths together are one set of results, so the API run and the UI run of one pipeline can be given side by side. A folder is read with its subfolders; only files ending in `.xml` are read, no symbolic link inside it is followed, and the folders `.git`, `.hg`, `.svn`, `node_modules` and `.cache` are not entered. Paths in the report are relative to the folder the command runs in, with forward slashes on every system.

## The configuration file

One JSON object, read with the tool's strict JSON reader: no comments, no trailing comma, and an object that names a key twice is refused, because RFC 8259 says "When the names within an object are not unique, the behavior of software that receives such an object is unpredictable." Every key the tool does not know is an error with its line and, when a known key is close, a suggestion. A complete example is [examples/config.json](../examples/config.json).

| Key | Kind | Needed | Meaning |
| --- | --- | --- | --- |
| `name` | string | no | a name shown at the top of the report |
| `requirements` | object | yes | where the requirements list keeps its columns |
| `requirements.columns` | object | yes | the names of the columns (CSV) or keys (JSON) |
| `requirements.columns.id` | string | yes | the column of the requirement ID |
| `requirements.columns.title` | string | no | the column of the title, shown in the report |
| `requirements.columns.priority` | string | for `gates.mustPass` | the column of the priority |
| `requirements.columns.status` | string | for `requirements.excludeStatuses` | the column of the status in the list (Approved, Draft, Withdrawn) |
| `requirements.delimiter` | `","`, `";"` or `"\t"` | no, `","` | the delimiter of a CSV list |
| `requirements.excludeStatuses` | list of strings | no | statuses that take a requirement out of the gates, such as Withdrawn; compared without case |
| `link` | object | yes | how a test names a requirement |
| `link.prefixes` | list of 1 to 10 strings | yes | the prefixes an ID starts with, such as `ORD-`; each 1 to 20 of the characters `A-Z a-z 0-9 . _ : # / -` |
| `link.idCharacters` | `"digits"`, `"alnum"` or `"alnum-dot-dash"` | no, `"digits"` | the characters an ID holds after its prefix |
| `link.ignoreCase` | true or false | no, false | compare ASCII letters of IDs without case |
| `link.from` | list of `"name"`, `"classname"`, `"property"` | yes | where in a JUnit testcase an ID is looked for |
| `link.propertyNames` | list of strings | when `link.from` holds `"property"` | the names of the property elements whose value holds IDs; compared without case |
| `testCases` | object | for `--test-cases` | the columns and results of the test-case export |
| `testCases.columns` | object | yes | the names of the columns |
| `testCases.columns.id` | string | yes | the column of the test-case ID |
| `testCases.columns.title` | string | no | the column of the title, shown in the report |
| `testCases.columns.requirements` | string | yes | the column that holds the requirement IDs of a test case |
| `testCases.columns.result` | string | yes | the column of the last result |
| `testCases.delimiter` | `","`, `";"` or `"\t"` | no, `","` | the delimiter of the export |
| `testCases.passed` | list of strings | yes | the result values that mean passed, such as Passed; compared without case |
| `testCases.failed` | list of strings | yes | the result values that mean failed |
| `testCases.skipped` | list of strings | no | the result values that mean skipped, such as Blocked |
| `gates` | object | yes, with at least one gate | the gates; [method.md](method.md) describes each |
| `gates.mustPass` | object | no | gate `must-pass` |
| `gates.mustPass.priorities` | list of strings | yes, in `mustPass` | the priorities whose requirements must be covered-passing; compared without case |
| `gates.maxNotCovered` | whole number | no | gate `not-covered` |
| `gates.maxFailing` | whole number | no | gate `covered-failing` |
| `gates.maxNotRun` | whole number | no | gate `covered-not-run` |
| `gates.minPassingShare` | percentage, at most four decimals | no | gate `passing-share` |
| `gates.maxOrphans` | whole number | no | gate `orphans`; 0 means no orphan is allowed |
| `gates.maxDuplicateIds` | whole number | no | gate `duplicate-ids` |

A string holds at most 200 characters and no control character. A value listed twice in one list, a prefix named twice, and a result value listed under two of `passed`, `failed` and `skipped` are errors. A configuration with no gate is an error: a check with no gate would always pass.

## The requirements list

A CSV file (`.csv`) or a JSON file (`.json`); the kind is taken from the end of the file name.

- **CSV**: read with the tool's strict reader, written from RFC 4180. The first record is the header. Header names are compared with the names in `requirements.columns` without case and without white space around them. A column that is named in the configuration and missing from the header, or that the header names twice, is an input error. A field in double quotes may hold the delimiter, line breaks and doubled quotes; a double quote inside a field that is not in quotes, text after a closing quote, a quote that is never closed and a record with another number of fields than the header are refused with their line. LF, CRLF and a lone CR all end a record; empty lines are skipped.
- **JSON**: one array of objects, one object a requirement. The keys named in `requirements.columns` are compared as written. A value must be a string; a key that is missing is an empty value, except the ID. Other keys are ignored.

From each row the tool takes the ID (with white space around it removed), the title, the priority and the status when those columns are named. A row with no ID, and an ID longer than 200 characters or with a control character, is an input error with its line; the first twenty such rows are named. A list with no requirement is an input error.

- **Excluded**: a requirement whose status is one of `requirements.excludeStatuses` is excluded. It is listed in the matrix with its status and the tests that still name it, and it is in no gate.
- **Duplicate**: an ID on a second row (compared as the IDs in tests are, so without case when `link.ignoreCase` is true) is a duplicate. The first row is used; the others are listed with their lines and are not in the matrix.
- **Not linkable**: an ID that does not have the form of the link spec (`legacy 7` when the prefix is `REQ-`) cannot be named by any test. It stays in the matrix and the gates as a requirement that no test covers, and a note lists it.

## JUnit XML results

Read with the tool's strict XML reader: a DOCTYPE is refused, no entity is expanded but the five predefined ones and numeric references, and a file that is not well formed is an input error with its line and column. The root must be `testsuites` or `testsuite`; suites may nest. From each `testcase` the tool takes:

- the `name` attribute (a testcase with no name is not read, and a note counts it) and the `classname` attribute;
- the result: failed when it has a `failure` element, error when it has an `error` element, skipped when it has a `skipped` element, passed otherwise;
- the message of the first failure or error, shown with `--explain`;
- every `property` element of a `properties` element that is a child of the testcase, with its `name` and its `value` attribute, or its text when it has no `value`;
- the line where the testcase starts, and the line of each property.

The `properties` of a `testsuite` are not read: they belong to the suite, not to one test. The time, the timestamp, `system-out` and `system-err` are not read.

These shapes are read the same way: the test report of Maven Surefire, whose schema defines the `testsuite` and `testcase` elements; pytest, which writes a `properties` element inside the testcase for `record_property`; Playwright, whose JUnit reporter writes a `testsuites` root; and jest-junit, which builds the class name and the name of a testcase from templates and can write properties inside a testcase. The [examples](../examples/order-app/results) hold one file in each shape, written by hand for a made-up service.

## Where a test names a requirement

[method.md](method.md#how-an-id-is-found) gives the exact rule. In short: an ID is one of `link.prefixes`, then one or more characters of `link.idCharacters`, with no ASCII letter or digit right before the prefix or right after the ID. The tool looks for IDs in the places named in `link.from`:

| Place | What is scanned |
| --- | --- |
| `name` | the `name` attribute of the testcase |
| `classname` | the `classname` attribute of the testcase |
| `property` | the value of each property of the testcase whose name is one of `link.propertyNames` |
| the test-case export | the cell of `testCases.columns.requirements` |

A test that names the same ID in two places is linked once, and `--explain` names both places. A text with more than 50 different IDs is cut to the first 50, and a note says so.

## The test-case export

A CSV file read like the requirements list, with the columns of `testCases.columns`. Each row is one test with its own result: a manual test, or the last run of a test case in the tool. The result is passed, failed or skipped when the value of the result column is listed under `testCases.passed`, `testCases.failed` or `testCases.skipped`, compared without case. An empty result, or a value that is not listed (Retest, Untested), counts as not run, and a note names the values and their counts. A test case is never passing unless its result says so.
