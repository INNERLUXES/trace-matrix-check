## What changes

<!-- One or two sentences. -->

## Checks

- [ ] `npm test`, `npm run test:coverage`, `npm run check` and `npm run example` pass, and the files under `examples/output` are the ones `npm run example` wrote
- [ ] A change to a gate, a reader, the link scanner or the configuration file is described in docs/method.md or docs/inputs.md, says what it can and cannot see, and has a test with the inputs written inline and a near miss on each side of the limit
- [ ] No threshold is built in: every number a gate compares comes from the configuration file
- [ ] A requirement is never counted as covered-passing unless a test that names it passed and none failed, and an input that cannot be read stops the run with exit code 2
- [ ] The link spec is still a prefix and a fixed set of ID characters: no regular expression is built from the configuration or from any input
- [ ] A change to a quoted sentence follows the saved page: the new page text is saved in research/sources, `src/data.js` and docs/rules-and-sources.md match it, and nothing was added from memory
- [ ] Text from the input goes through `safeText` before it reaches a report, a note or an error message
- [ ] The readers still refuse a DOCTYPE, expand no entity but the five predefined ones and numeric references, fetch nothing, follow no symbolic link inside a folder, open no connection and run no program or test
- [ ] Work stays linear in the size of the input: no pattern with nested repetition, no loop over all tests inside a loop over all requirements, and a hostile test with a time check that widens under coverage through `NODE_V8_COVERAGE`
- [ ] A test that depends on the operating system (a link, a device, a file name) is guarded with `process.platform`, asserts no line or column of its own, and builds its paths with `resolve()` from forward-slash names
- [ ] No real person, company, address or key in fixtures or examples, no date, and no number that reads like a year anywhere
- [ ] The commit messages of this pull request follow Conventional Commits
