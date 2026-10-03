# trace-matrix-check

Checks that every requirement of an application is traced to tests that ran and passed. It reads the requirements list (CSV or JSON), the JUnit XML results that the pipeline already writes (Maven Surefire, pytest, Playwright, jest-junit) and, if you have one, the CSV export of the test cases of your test management tool. It finds the requirement IDs that each test names, in its name, its class name, a property element or a column of the export, and builds the traceability matrix: each requirement is covered-passing, covered-failing, covered-not-run or not covered, with the tests behind it. It lists the tests that name an ID the list does not hold, the IDs that are on more than one row, and the requirements that are excluded by their status, and then checks the gates you wrote in a configuration file.

A traceability matrix kept by hand is out of date the day after it is written. Tests are renamed, a requirement is withdrawn and its tests stay, a new requirement gets no test, and a test that names a requirement is skipped for months. The ISTQB glossary defines traceability as "The ability to establish explicit relationships between related work products or items within work products." This tool reads those relationships where the team already writes them, in the tests, and checks them on every run.

- **No pattern, no slow input.** A test names a requirement through a prefix such as `ORD-` and one of three fixed sets of ID characters. The configuration takes no regular expression, and each text is scanned once, so no test name can make the check slow.
- **Never passing by default.** A requirement is covered-passing only when a test that names it passed and none failed. A skipped test, a test case with an empty result and a priority that no requirement has are never read as a pass.
- **No built-in thresholds.** Every gate and every number comes from your configuration file; a gate it does not state is not run. A key that the tool does not know is an error, so a typo cannot switch a gate off.
- **Every link is explained.** `--explain` lists, for each requirement, every test that names it, with its result, where the ID was found, the file and the line.
- **Nothing runs.** The files are read with the tool's own small, strict readers: no test is run, no DTD is read, no entity is expanded beyond the five that XML predefines and numeric references, a file with a DOCTYPE is refused, a JSON object with a repeated key is refused, bad CSV quoting is refused with its line, and no symbolic link inside a folder is followed.
- Reports as text, Markdown and JSON, with an exit code for a pipeline gate: `0` every gate met, `1` a gate not met, `2` usage or input error.
- Plain JavaScript, no dependencies; the same files always give the same report, with LF or CRLF line ends.

```
npm test
```

```
tests 218
pass 215
fail 0
skipped 3
```

These are the summary lines that `npm test` prints at the end on Windows. The skipped tests are the ones that need a system other than Windows: a symbolic link out of a result folder and in a loop, a device behind a link, and a file name with a control character. They are guarded with `process.platform` and run on Linux and macOS, and none of them asserts a line or a column. `npm run test:coverage` runs the same tests with coverage; their time limits are four times wider when coverage is on.

## Quick start

Requires Node 22 or newer. There is nothing to install.

```
git clone https://github.com/INNERLUXES/trace-matrix-check.git
cd trace-matrix-check
node bin/trace-matrix-check.js --config examples/config.json --requirements examples/order-app/requirements.csv --junit examples/order-app/results/api --junit examples/order-app/results/ui --test-cases examples/order-app/test-cases.csv
```

Or without a clone, on the results of your own pipeline:

```
npx --yes github:INNERLUXES/trace-matrix-check --config qa/trace.json --requirements qa/requirements.csv --junit reports/junit
```

`examples/` holds a made-up order management service, release 3.1: fifteen requirements in `requirements.csv`, the JUnit results of two runs of its pipeline (the API run in `results/api`, with a Surefire file and a pytest file, and the UI run in `results/ui`, with a Playwright file and a jest-junit file), and six manual test cases in `test-cases.csv`. Some of it is in order and some of it is wrong on purpose: a stock test fails, a manual test of the confirmation message failed, two requirements have no test at all, a Playwright test names a requirement that is not in the list, one ID is on two rows, and two requirements are withdrawn.

## Usage

```
trace-matrix-check --config <file> --requirements <file> (--junit <path> | --test-cases <file>) [options]
```

```
--config <file>        the configuration file (JSON): columns, link and gates; required
--requirements <file>  the requirements list, CSV (.csv) or JSON (.json); required
--junit <path>         JUnit XML results: a file, or a folder read with its subfolders; repeat for more runs
--test-cases <file>    the CSV export of the test cases of a test management tool
--format <name>        text, markdown or json (default: text)
--explain              list for each requirement the tests that name it, with the result, where the ID was
                       found and the file and line, and the facts and sentences each gate rests on
--help                 show the usage
--version              show the version
```

Give `--junit`, `--test-cases` or both. Several `--junit` paths are one set of results. Paths in the report are relative to the folder you run the command in, with forward slashes on every system.

The report of the example starts with what was read and the counts, then the matrix, the orphan IDs, the duplicate IDs, the tests that name no requirement, and every gate:

```
trace-matrix-check: examples/config.json (Order management service, release 3.1)
inputs: requirements examples/order-app/requirements.csv (16 rows); JUnit results: 4 files, 17 testcases; test cases examples/order-app/test-cases.csv (6 rows)
link: prefixes ORD-; ID characters digits; read from name, classname, property requirement or requirements, the requirements column of the test cases
requirements: 13 included, 2 excluded by status; 6 covered-passing, 3 covered-failing, 2 covered-not-run, 2 not covered
tests: 23 tests, 21 name a requirement, 2 name none; 2 orphan IDs; 1 duplicate ID
gates: 2 met, 5 not met

Requirements (15)

  COVERED-PASSING  ORD-1   High    Place an order from the cart
                   2 tests: 2 passed
  COVERED-PASSING  ORD-2   High    Show the order total with tax
                   2 tests: 2 passed
  COVERED-FAILING  ORD-3   High    Reserve stock for each order line
                   1 test: 1 failed
  COVERED-PASSING  ORD-4   Medium  Cancel an order before it ships
                   2 tests: 2 passed
  COVERED-PASSING  ORD-5   High    Refund a cancelled order
                   2 tests: 2 passed
  COVERED-FAILING  ORD-6   Medium  Send an order confirmation message
                   1 test: 1 failed
  COVERED-FAILING  ORD-7   Medium  Track the delivery of an order
                   3 tests: 2 passed, 1 failed
  COVERED-NOT-RUN  ORD-8   Low     Split an order into several shipments
                   1 test: 1 skipped
  COVERED-PASSING  ORD-9   Medium  Apply a discount code at checkout
                   2 tests: 2 passed
  EXCLUDED         ORD-10  Low     Export the orders of a day as a spreadsheet
                   status Withdrawn; 1 test: 1 passed
  COVERED-NOT-RUN  ORD-11  Low     Reorder a past order in one step
                   2 tests: 1 skipped, 1 not run
  NOT COVERED      ORD-12  High    Reject an order over the credit limit
                   no test names it
  COVERED-PASSING  ORD-13  Low     Print a packing slip
                   1 test: 1 passed
  EXCLUDED         ORD-14  Low     Mark an order as a gift
                   status Withdrawn; 1 test: 1 passed
  NOT COVERED      ORD-15  Medium  Archive orders after the retention period
                   no test names it

Orphan IDs (2): named by tests, not in the requirements list

  ORD-41  named by 1 test
      - examples/order-app/results/api/TEST-shop.orders.OrderApiTest.xml:13  name  shop.orders.OrderApiTest > ORD-41 holds an order for a fraud review
  ORD-16  named by 1 test
      - examples/order-app/results/ui/playwright-results.xml:17  name  orders.spec.ts > orders ORD-16 shows the order timeline

Duplicate requirement IDs (1 extra row)

  ORD-9  line 16 repeats line 10; line 10 is used

Tests that name no requirement (2)

  passed   examples/order-app/results/api/TEST-shop.orders.OrderApiTest.xml:14  shop.orders.OrderApiTest > healthCheckReturnsOk
  passed   examples/order-app/results/ui/jest-junit.xml:10  money formats an amount in the shop currency > money formats an amount in the shop currency

Gates (7)

  NOT MET  must-pass  Requirements of the named priorities are covered-passing
           rule: every requirement of priority High is covered-passing
           found: 3 of 5 requirements covered-passing
           why: 2 requirements of that priority are not covered-passing
           - ORD-3 (High): covered-failing
           - ORD-12 (High): not covered

  NOT MET  not-covered  Most requirements that no test covers
           rule: at most 0 requirements not covered
           found: 2 requirements of 13 not covered
           why: 2 is above 0
           - ORD-12 (High) Reject an order over the credit limit
           - ORD-15 (Medium) Archive orders after the retention period

  NOT MET  covered-failing  Most requirements with a failing test
           rule: at most 0 requirements covered-failing
           found: 3 requirements of 13 covered-failing
           why: 3 is above 0
           - ORD-3 (High) Reserve stock for each order line
           - ORD-6 (Medium) Send an order confirmation message
           - ORD-7 (Medium) Track the delivery of an order

  MET      covered-not-run  Most requirements whose tests did not run
           rule: at most 2 requirements covered-not-run
           found: 2 requirements of 13 covered-not-run
           - ORD-8 (Low) Split an order into several shipments
           - ORD-11 (Low) Reorder a past order in one step

  MET      passing-share  Least share of requirements that are covered-passing
           rule: at least 40% of the included requirements covered-passing
           found: 46.15% (6 of 13 requirements)
           - ORD-3 (High): covered-failing
           - ORD-6 (Medium): covered-failing
           - ORD-7 (Medium): covered-failing
           - ORD-8 (Low): covered-not-run
           - ORD-11 (Low): covered-not-run
           - ORD-12 (High): not covered
           - ORD-15 (Medium): not covered

  NOT MET  orphans  Most IDs that tests name and the list does not hold
           rule: at most 0 IDs that tests name and the requirements list does not hold
           found: 2 orphan IDs in 2 tests
           why: 2 is above 0: a test names a requirement the list does not hold (removed, renamed or mistyped)
           - ORD-41: named by shop.orders.OrderApiTest > ORD-41 holds an order for a fraud review
           - ORD-16: named by orders.spec.ts > orders ORD-16 shows the order timeline

  NOT MET  duplicate-ids  Most requirement IDs on more than one row
           rule: at most 0 requirement IDs on more than one row
           found: 1 ID on more than one row
           why: 1 is above 0: the first row of each is used, and the others are not in the matrix
           - ORD-9: lines 10, 16; line 10 is used

note: examples/order-app/test-cases.csv: 1 test case has a result that testCases does not list ((empty): 1); it counts as not run
note: examples/order-app/requirements.csv: 1 requirement ID appears on more than one row; the first row of each is used

RESULT: FAIL - 5 gates not met
```

The exit code is `1`. `--explain` shows where each link came from; for ORD-7, which has two passing tests and one failing manual test:

```
  COVERED-FAILING  ORD-7   Medium  Track the delivery of an order
                   3 tests: 2 passed, 1 failed
                   - passed   examples/order-app/results/api/pytest-refunds.xml:16  property requirements  tests.test_orders > test_cancel_after_shipping_is_refused
                   - passed   examples/order-app/results/ui/playwright-results.xml:11  name  orders.spec.ts > orders ORD-7 shows the delivery status
                   - failed   examples/order-app/test-cases.csv:4  column Covers  TC-103 Confirmation message holds the tracking link
```

[examples/output](examples/output) holds the report as text, with `--explain`, as Markdown and as JSON.

## What it checks

| Status | When |
| --- | --- |
| covered-passing | tests name the requirement, at least one passed, and none failed or had an error |
| covered-failing | at least one test that names it failed or had an error |
| covered-not-run | tests name it, none failed and none passed: every one was skipped or not run |
| not covered | no test names it |
| excluded | its status in the list is one of `requirements.excludeStatuses`; listed, and in no gate |

Every test that names a requirement counts, and a failure wins over a pass: a test that failed in one run and passed in another, given together, makes the requirement covered-failing. Besides the matrix the report lists the orphan IDs (named by a test, not held by the list), the IDs on more than one row (the first row is used), the requirement IDs that no test can name, and the tests that name no requirement.

| Gate | Key | Met when |
| --- | --- | --- |
| `must-pass` | `gates.mustPass` | every included requirement of the named priorities is covered-passing, and every named priority is the priority of at least one requirement |
| `not-covered` | `gates.maxNotCovered` | at most that many included requirements are not covered |
| `covered-failing` | `gates.maxFailing` | at most that many included requirements have a failing test |
| `covered-not-run` | `gates.maxNotRun` | at most that many included requirements have tests that were all skipped or not run |
| `passing-share` | `gates.minPassingShare` | at least that share of the included requirements is covered-passing |
| `orphans` | `gates.maxOrphans` | at most that many IDs are named by tests and not held by the list; 0 allows none |
| `duplicate-ids` | `gates.maxDuplicateIds` | at most that many IDs are on more than one row |

[docs/method.md](docs/method.md) gives each status and each gate with its exact rule, what it can see and what it cannot. [docs/rules-and-sources.md](docs/rules-and-sources.md) lists every quoted sentence with the saved page it comes from.

## How a test names a requirement

An ID is one of the prefixes of `link.prefixes`, then one or more characters of `link.idCharacters`: `digits`, `alnum` (ASCII letters and digits) or `alnum-dot-dash` (also a dot, a dash or an underscore between them). The character before the prefix and the character after the ID must not be an ASCII letter or digit, so `XORD-1` and `ORD-12a` hold no ID with `digits`. The tool looks for IDs in the places named in `link.from`:

| Place | Example |
| --- | --- |
| `name`, the name of the testcase | `<testcase name="ORD-1 places an order from the cart" .../>` (a JUnit 5 display name, a Playwright or Jest title) |
| `classname`, the class name of the testcase | `<testcase classname="order total ORD-2 shows the total with tax" .../>` (jest-junit puts the title in both) |
| `property`, a property inside the testcase | `<property name="requirement" value="ORD-5" />` (pytest `record_property`, jest-junit testcase properties) |
| the requirements column of `--test-cases` | `TC-103,...,"ORD-6, ORD-7",Failed` |

A test that names an ID twice, or in two places, is linked once. A requirement ID in the list that does not have this form cannot be named by any test, and a note lists it. [docs/inputs.md](docs/inputs.md) has the details of every input.

## The configuration file

[docs/inputs.md](docs/inputs.md) has every key. The configuration of the example is [examples/config.json](examples/config.json):

```json
{
  "name": "Order management service, release 3.1",
  "requirements": {
    "columns": { "id": "ID", "title": "Title", "priority": "Priority", "status": "Status" },
    "excludeStatuses": ["Withdrawn"]
  },
  "link": {
    "prefixes": ["ORD-"],
    "idCharacters": "digits",
    "from": ["name", "classname", "property"],
    "propertyNames": ["requirement", "requirements"]
  },
  "testCases": {
    "columns": { "id": "Key", "title": "Summary", "requirements": "Covers", "result": "Last Result" },
    "passed": ["Passed"],
    "failed": ["Failed"],
    "skipped": ["Blocked", "Skipped"]
  },
  "gates": {
    "mustPass": { "priorities": ["High"] },
    "maxNotCovered": 0,
    "maxFailing": 0,
    "maxNotRun": 2,
    "minPassingShare": 40,
    "maxOrphans": 0,
    "maxDuplicateIds": 0
  }
}
```

`requirements.columns` names the columns of the list (only `id` is needed; `priority` is needed for `mustPass`, `status` for `excludeStatuses`). `testCases` names the columns of the export and the result values that mean passed, failed and skipped; any other value counts as not run. Every gate is optional, but a configuration with no gate is refused.

## Formats

- `text`: for a terminal: the inputs, the counts, the matrix with one line a requirement and the count of its tests by result, the orphan IDs, the duplicate IDs, the tests that name no requirement, every gate with its rule, what was found, why and the items behind it, the notes and the result. With `--explain` also every link with its file and line, and the facts and the sentences each gate rests on.
- `markdown`: the same for a pull request comment or the job summary, with the matrix and the gates as tables. Pipes, square brackets, backticks, asterisks, underscores, line breaks and angle brackets from the input are escaped, so a test name cannot break a table, make a link or be read as HTML.
- `json`: the whole report: the configuration and its link spec, the inputs, the counts, every requirement with its status, its results and its tests with their place, the orphans, the duplicates, the tests that name no requirement, every gate with its facts and basis, the result and the notes.

To put the matrix in the job summary of a GitHub Actions run, and stop the pipeline when a gate is not met:

```yaml
permissions:
  contents: read
steps:
  - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
  - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
    with:
      node-version: 22
  # run the tests into reports/junit here
  - name: Traceability matrix in the job summary
    run: npx --yes github:INNERLUXES/trace-matrix-check --config qa/trace.json --requirements qa/requirements.csv --junit reports/junit --format markdown >> "$GITHUB_STEP_SUMMARY"
  - name: Traceability gate
    run: npx --yes github:INNERLUXES/trace-matrix-check --config qa/trace.json --requirements qa/requirements.csv --junit reports/junit
```

It needs no secrets and no network beyond the download; a Linux runner is enough. [docs/secure-defaults.md](docs/secure-defaults.md) says how to protect the configuration and the requirements list with a code owner, and which gates fail closed.

## Exit codes

`0`: every gate is met. `1`: at least one gate is not met. `2`: a usage or input error: no configuration, no requirements list or no test input, an unknown option, a configuration with an unknown key, a key named twice or no gate, a path that does not exist, an input that is not readable (a result file that is not well formed or has a DOCTYPE, a list or an export with bad quoting or without a named column, a requirement with no ID), an input over the limits. With exit code `2` the tool gives no verdict and prints the problems on standard error.

## Architecture

Plain ES modules in `src/`, with no dependencies. Each reader is one file, written for its format and nothing else, and `src/check.js` is the only place that puts them together.

| File | Job |
| --- | --- |
| `src/cli.js` | the command line, the usage and the exit codes |
| `src/check.js` | reads the configuration and the inputs, builds the matrix, evaluates the gates, builds the report |
| `src/config.js` | validates the configuration against the known keys and builds its normal form |
| `src/link.js` | finds IDs in a text: a prefix and a fixed set of characters, one scan, no pattern |
| `src/requirements.js`, `src/testcases.js` | the requirements list in CSV or JSON, and the test-case export |
| `src/junit.js` | the testcases of a result file with their result and properties |
| `src/trace.js` | the matrix: the links, the status of each requirement, orphans and tests that name no requirement |
| `src/gates.js` | the gates: one count or share of the matrix against one number of the configuration |
| `src/xml.js`, `src/json.js`, `src/csv.js` | the strict readers: no DOCTYPE, no repeated key, RFC 4180 quoting |
| `src/files.js` | bounded reading and the folder walk with `lstat` |
| `src/report.js`, `src/text.js`, `src/size.js`, `src/ratio.js` | the text, Markdown and JSON reports, the cleaning of text from the input, number formats, exact shares |
| `src/data.js` | the sentences and lists the tool rests on, compared with the saved pages in `research/sources` |
| `tools/check.mjs`, `tools/example.mjs` | the repository checks, and the example with its real output |

## Where the facts come from

| Fact | Source |
| --- | --- |
| What traceability, requirements-based testing, the test basis, a requirement and a test case are | ISTQB Glossary, https://glossary.istqb.org/ |
| The elements and attributes of a test report: testcase, name, classname, skipped, property | Maven Surefire, https://maven.apache.org/surefire/maven-surefire-plugin/xsd/surefire-test-report.xsd |
| A property written inside a testcase | pytest, https://docs.pytest.org/en/stable/how-to/output.html#record-property, and jest-junit, https://github.com/jest-community/jest-junit |
| The JUnit report of Playwright and the project name in a test name | Playwright, https://playwright.dev/docs/test-reporters#junit-reporter |
| The CSV format | RFC 4180, https://www.rfc-editor.org/rfc/rfc4180 |
| Repeated names in a JSON object | RFC 8259, https://www.rfc-editor.org/rfc/rfc8259 |
| The document type declaration, references and the five predefined entities | W3C XML 1.0, https://www.w3.org/TR/xml/ |

## Limits

The tool reads names; it never runs a test and never reads the code of one. A test that names a requirement covers it, for the tool, whether or not the test checks it, so a test that asserts nothing makes its requirement covered-passing. A requirement that is missing from the list is never reported, a link that is kept only in a tool and not in the files is not seen, and an ID written in another form (`ORD 12`, a free-text ID) is not found. A failure in an old run given next to a new one counts. [docs/limits.md](docs/limits.md) lists these, with the size limits.

## Background

How an application testing engagement keeps requirements, test cases and results traced to each other, and checks the matrix on every build, is described on the page [Application Testing Services](https://innerluxes.dev/application/testing).

## License

MIT
