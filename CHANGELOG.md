# Changes

## 1.0.0

First release.

- Builds a requirements traceability matrix from a requirements list (CSV or JSON, with the columns named in the configuration), JUnit XML results (the shapes of Surefire, pytest, Playwright and jest-junit) and the CSV export of a test management tool, and checks it against gates. Each requirement is covered-passing, covered-failing, covered-not-run or not covered; requirements excluded by their status are listed apart. A failure in any test that names a requirement wins over a pass, and a skipped test or a test case with an unlisted result is never passing.
- A test names a requirement through a prefix and one of three fixed sets of ID characters (`digits`, `alnum`, `alnum-dot-dash`), found in the name, the class name or the named properties of a testcase, or in the requirements column of the export. No regular expression is taken from the configuration; each text is scanned once per prefix.
- Lists the IDs that tests name and the list does not hold (orphans), IDs on more than one row of the list, requirement IDs that no test can name, and tests that name no requirement.
- Gates from the configuration only: `must-pass` (every requirement of the named priorities is covered-passing; a priority that no requirement has is not met), `not-covered`, `covered-failing`, `covered-not-run`, `passing-share`, `orphans` and `duplicate-ids`. A configuration with no gate, an unknown key or a key named twice is refused.
- Reports as text, Markdown and JSON. `--explain` lists for each requirement the tests that name it, with the result, the place the ID was found, the file and line, and the failure message, and shows the facts and the sentences of the saved pages each gate rests on. Exit code `0` when every gate is met, `1` when one is not and `2` for a usage or input error; an input that cannot be read stops the run with no verdict.
- Own small strict readers: an XML reader that refuses a DOCTYPE and expands no entity (only the five predefined entities and numeric references are read), a JSON reader that refuses a repeated key, and a CSV reader written from RFC 4180 that refuses bad quoting with its line.
- Safe input: no link inside a result folder is followed; limits on files, folders, depth, bytes, elements, attributes, JSON values, CSV fields, records, requirements, test cases and IDs; control, direction and line separator characters are removed from every text shown.
- Every quoted sentence comes from the ISTQB glossary, the Surefire schema, the pytest, jest-junit and Playwright documentation, RFC 4180, RFC 8259 and W3C XML 1.0, saved in `research/sources`; a test compares `src/data.js` and the documents with the saved text.
- Release packages come with a CycloneDX SBOM, SHA-256 checksums and a build provenance attestation, after the SSDF gate of the repository.
