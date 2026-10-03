# Secure defaults

The default run is the safe run. Nothing in the first two sections needs a flag, and none of it can be switched off. The rest of the document is about the parts that the tool cannot do for you: running it in a pipeline, protecting the configuration and the requirements list, and writing gates that fail closed.

## How the tool behaves by default

- **No threshold of its own.** Every number of a gate comes from the configuration. A gate the configuration does not state is not run, and a configuration with no gate is refused. There is no mode that relaxes a gate and no environment variable that changes a number.
- **Never passing by default.** A requirement is covered-passing only when a test that names it passed and none failed. A skipped test, a test case with an empty or unlisted result, and a requirement no test names are never passing. A priority in `must-pass` that no requirement has makes the gate not met.
- **No pattern from the configuration.** A test names a requirement through a prefix of plain characters and one of three fixed sets of ID characters. No regular expression is taken from the configuration or built from any input, so no input can make the link slow.
- **Unknown keys are errors.** A key in the configuration that the tool does not know stops the run, with its line and a suggestion, so a typo cannot switch a gate off. A key named twice stops the run.
- **Input that cannot be read stops the run.** A result file that is not well formed, a list or an export with bad quoting or without a named column, a row with no ID, a file over the size limit: each is exit code `2` with the files named and no verdict.
- **Never runs a test.** The tool reads files as text. It never runs a test, a build or a script, never evaluates anything it reads, and never puts a test name, a path or a message on a command line.
- **No DTD, no entity expansion.** The XML reader refuses a DOCTYPE, so no DTD is read, no external entity is fetched or opened, and no entity can expand into another. Only the five predefined entities and numeric references are read, once each, into one character each.
- **No network.** The tool reads the files it is given and sends nothing anywhere. It never fetches a schema, a DTD or an address named in a file, does not check for updates, and refuses an argument that looks like an address.
- **No dependencies.** Node 22 or newer and nothing else. There is no XML, JSON or CSV library and no `node_modules` to install before it runs.
- **Never follows a link.** Inside a result folder every entry is looked at with `lstat`; a symbolic link or a junction is listed and never followed.
- **Regular files only, bounded.** Each file is opened once, its type and size are taken from the open file, and anything that is not a regular file or is over the limit is refused. The number of paths, entries, folder levels and XML files, and the total bytes read, are capped, and past a cap the input is refused.
- **Bounded readers.** The XML, JSON and CSV readers each read the text once, from left to right, and never go back. Nesting, elements, attributes, names, strings, fields and records are capped, and past a cap the file is refused, not read in part.
- **Exact arithmetic.** Shares are compared with whole numbers. A limit has at most four decimals. A figure is shown cut down to two decimals, never rounded up.
- **Clean output.** Text from the input has control characters, line separators and direction controls removed and its length capped before it reaches a report or an error message. Markdown cells escape pipes, backslashes, square brackets, backticks, asterisks, underscores, line breaks and `<`, `>` and `&`.
- **No prototype tricks.** Requirements and attributes are kept in maps keyed by text, and JSON objects are built with own properties, so a name such as `__proto__` is just data.
- **The same input gives the same report.** The tool reads no clock, no environment variable and no random number. The report holds no time, so two runs of the same files give the same bytes, with LF or CRLF line ends in the inputs.
- **Writes nothing to disk.** The report goes to the screen.

## Gates that make the check stricter

- **`maxOrphans: 0`.** A test that names a requirement the list does not hold stops the run, so a removed or renamed requirement cannot leave tests behind that look like coverage.
- **`maxDuplicateIds: 0`.** An ID on two rows stops the run, so a requirement cannot carry two priorities.
- **`mustPass` for the priorities that matter.** Every requirement of those priorities must have a passing test and no failing one.
- **`maxNotRun: 0`.** A requirement whose tests were all skipped is not evidence; this gate says so.
- **`testCases.passed` and `testCases.failed` with every value your tool writes.** A value you leave out counts as not run, which errs toward the safe side.

## Running it in a pipeline

Run it after the tests, on a Linux runner, with the results downloaded or built in the same workflow. It needs no secret and no network beyond the download:

```yaml
permissions:
  contents: read
steps:
  - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
  - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
    with:
      node-version: 22
  # run the tests into reports/ here, and export the test cases if you have them
  - name: Traceability matrix in the job summary
    run: npx --yes github:INNERLUXES/trace-matrix-check --config qa/trace.json --requirements qa/requirements.csv --junit reports/junit --format markdown >> "$GITHUB_STEP_SUMMARY"
  - name: Traceability gate
    run: npx --yes github:INNERLUXES/trace-matrix-check --config qa/trace.json --requirements qa/requirements.csv --junit reports/junit
```

- Give the job read access to the contents and nothing more. The tool does not need to write to the repository, to comment on a pull request or to read a secret.
- Pin every action to a full commit, as above, and pin the tool to a release commit or a tag you have read, because `npx` runs what it downloads.
- Run it on the results of the run you are judging. Results from a fork or an unreviewed branch are data the tool treats as hostile, but the fork also controls the tests that wrote them, including their names.
- Keep the two steps separate. The first writes the matrix where people read it; the second decides, and its exit code stops the pipeline. Do not hide the exit code with a trailing `|| true`.
- Do not post a report in a public place without reading it. It quotes test names, requirement titles, paths and failure messages.

## Protecting the configuration and the requirements list

The configuration is the check written down, and the requirements list is what the check is about. A change to either is a change of the verdict, and the tool cannot see who made it or why; the repository can.

- Keep both in the repository, in their own path, and put the path in `CODEOWNERS` with the people who own the requirements: this repository does it for the files that decide a verdict. Require their review in branch protection.
- Change a gate in its own pull request, with the reason in the description, and not in the same change as the tests it judges.
- When the list is exported from a requirements tool, export it in the pipeline from a fixed query, or commit the export and review it. A list that is edited by hand on the day of the check is a list that fits the tests.
- Read the report header. It shows the path and the name of the configuration and the list, so a run on a copy in another folder is visible.

## SSDF

The repository is checked against NIST SP 800-218 (SSDF) in its own pipeline and before every release, with `ssdf-repo-check` pinned to its release commit. The evidence it looks for is in these files:

| Practice | Evidence in this repository |
| --- | --- |
| PO.1 Define security requirements | CONTRIBUTING.md, docs/secure-defaults.md |
| PO.2 Roles and responsibilities | .github/CODEOWNERS |
| PO.3 Toolchain | .github/workflows/ci.yml, codeql.yml, release.yml |
| PO.4 Criteria for security checks | CodeQL with the security-extended queries, the SSDF gate in ci.yml and release.yml |
| PO.5 Secure environments | a `permissions:` block in every workflow, actions pinned to commits |
| PS.1 Protect the code | .gitignore for keys and `.env`, `npm run check` for committed secrets |
| PS.2 Integrity of releases | SHA-256 checksums and a build provenance attestation in release.yml |
| PS.3 Archive and provenance | a CycloneDX SBOM and the CHANGELOG with every release |
| PW.1 Design for security | docs/threat-model.md |
| PW.2 Review the design | docs/decisions |
| PW.4 Reuse secure components | no runtime dependencies, a lock file, Dependabot |
| PW.5 Secure coding | CONTRIBUTING.md, `npm run check` |
| PW.6 Build settings | `npm ci` from the lock file |
| PW.7 Code review | the pull request template and CODEOWNERS |
| PW.8 Testing | `npm test` on Linux, Windows and macOS with Node 22 and 24, `npm run test:coverage`, hostile input tests |
| PW.9 Secure defaults | this document |
| RV.1 Find vulnerabilities | SECURITY.md, Dependabot |
| RV.2 Respond to vulnerabilities | SECURITY.md |
