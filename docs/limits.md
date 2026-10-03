# Limits

## Names, not proof

The tool reads the files that test runners and test management tools write, and finds the requirement IDs that tests name. A test that names a requirement covers it, for the tool. It never runs a test, never reads the code of a test, never opens the test management tool and never asks a person. A requirement that is covered-passing means that at least one test holds its ID and passed, and that none failed. It does not mean the requirement is met. [decisions/0001-name-requirements-with-a-prefix-never-a-pattern.md](decisions/0001-name-requirements-with-a-prefix-never-a-pattern.md) says why a test names a requirement in this way.

## What the matrix cannot see

- **Whether a test checks what it names.** A test named `REQ-12 rejects an order over the credit limit` that asserts nothing passes every time, and REQ-12 is covered-passing. The matrix shows the link the team wrote down, not the quality of the test behind it.
- **Whether the requirements are right.** A requirement that is missing from the list is never reported as not covered, because the tool does not know it. A requirement that is too large for one test still needs only one test that names it.
- **Links that are not written down.** A test that checks a requirement and does not hold its ID in the places the tool scans is a test that names no requirement. A link kept only in a test management tool, and not in the export or the results, is not seen.
- **IDs in other forms.** A test that writes `REQ 12`, `req-12` without `link.ignoreCase`, or an ID with a prefix that is not in `link.prefixes` does not name a requirement. A requirement ID in the list that does not have the form of the link spec cannot be named at all; a note lists such IDs.
- **Text that looks like an ID.** A test named `checks the REQ-7 bug fix` names REQ-7. The tool cannot tell a link from a mention. Keep IDs in a fixed place, such as a property, when names often hold other IDs.
- **Names that runners change.** jest-junit builds the name and the class name of a testcase from the templates `titleTemplate` and `classNameTemplate`, which a project can change. Playwright can put the project name in front of every test: "Whether to include Playwright project name in every test case as a name prefix." A change of these settings changes what the tool reads; a project name that holds an ID would name a requirement in every test.
- **Retries that leave no trace.** The result of a testcase is what the runner wrote. A runner that retries a test and writes only the last attempt hides the failure, and the tool sees a pass. A runner that writes each attempt makes the requirement covered-failing when one attempt failed.
- **Which run counts.** Every test given counts. Results of an old run given next to a new one count too, and a failure in the old run makes the requirement covered-failing. Give the results of one pipeline run.
- **Results in the export.** The result of a test case is the value of its result column, mapped by the lists of the configuration. The tool cannot see when the test case was run, on which build, or by whom.
- **Priorities and statuses.** The tool trusts the priority and the status of each requirement in the list. A wrong priority takes a requirement out of `must-pass`; a wrong status excludes it.

## Size and counts

- A configuration over 1 MB, or a requirements list, a test-case export or a result file over 32 MB, or XML files that together hold more than 512 MB, is refused.
- More than 100 `--junit` paths, 50,000 files and folders in all, folders nested more than 32 deep, or more than 10,000 XML files is refused with exit code `2`.
- Elements nested more than 256 deep, more than 500,000 elements in one file, more than 256 attributes on one element, or a name longer than 256 characters make an XML file unreadable.
- More than 100,000 requirements, 100,000 test cases, 1,000,000 CSV records, 1,000 fields in a record or a field over 65,536 characters is refused.
- JSON nested more than 32 deep, with more than 100,000 values or a string over 4,096 characters is refused.
- A requirement ID is at most 200 characters; an ID that a test names is a prefix of at most 20 characters and at most 40 characters after it; one text yields at most 50 different IDs, and a note counts the texts that held more.
- The text report lists every requirement; without `--explain` it lists the first 12 orphan IDs, duplicate rows and tests that name no requirement, and says how many more there are. A gate names its first 12 items in its details and keeps its first 200 facts for `--explain`.
- Text from the input shown in a report is cut to a fixed length: 80 characters for an ID, 160 for a title, 300 for a test name, 600 for a rule or a reason.

Every limit is reported as an input error with exit code `2` or as a count in the report, so a cut is never silent.
