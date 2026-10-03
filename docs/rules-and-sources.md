# Rules and sources

Every sentence that the tool quotes comes from a page that is saved in [research/sources](../research/sources), with its address on the first line. `src/data.js` holds them, and `test/data.test.js` compares each one with the saved text. Nothing was added from memory. Change a sentence only after saving the new page text and updating this file.

## The saved pages

| File | Address | What it is used for |
| --- | --- | --- |
| `istqb-traceability.txt` | https://glossary.istqb.org/en_US/term/traceability | what traceability is |
| `istqb-requirements-based-testing.txt` | https://glossary.istqb.org/en_US/term/requirements-based-testing | what requirements-based testing is |
| `istqb-test-basis.txt` | https://glossary.istqb.org/en_US/term/test-basis | what the test basis is |
| `istqb-requirement.txt` | https://glossary.istqb.org/en_US/term/requirement | what a requirement is |
| `istqb-test-case.txt` | https://glossary.istqb.org/en_US/term/test-case | what a test case is |
| `surefire-test-report-xsd.txt` | https://maven.apache.org/surefire/maven-surefire-plugin/xsd/surefire-test-report.xsd | the elements and attributes of a test report: testsuite, testcase, name, classname, skipped, properties, property and its value |
| `pytest-record-property.txt` | https://docs.pytest.org/en/stable/how-to/output.html#record-property | pytest writes a property inside the testcase, and says this does not follow the schema |
| `jest-junit-testcase-properties.txt` | https://github.com/jest-community/jest-junit | jest-junit builds the class name and the name of a testcase from templates, and can write properties inside a testcase |
| `playwright-junit-reporter.txt` | https://playwright.dev/docs/test-reporters#junit-reporter | Playwright writes a JUnit-style report with a testsuites root, and can put the project name in front of every test name |
| `rfc4180-csv-definition.txt` | https://www.rfc-editor.org/rfc/rfc4180 | the CSV format: records, quoting, doubled quotes, the same number of fields in every line |
| `rfc8259-json-objects.txt` | https://www.rfc-editor.org/rfc/rfc8259 | the names within a JSON object should be unique, and what happens when they are not |
| `xml-document-type-declaration.txt` | https://www.w3.org/TR/xml/#sec-prolog-dtd | what a document type declaration is and what it can point to |
| `xml-character-and-entity-references.txt` | https://www.w3.org/TR/xml/#sec-references | character references, entity references, no recursion |
| `xml-predefined-entities.txt` | https://www.w3.org/TR/xml/#sec-predefined-ent | the five entities every XML reader knows |

The pages were read once and saved as plain text, with the navigation, the dates, the byline and the footers left out. The five glossary terms were read through the service that the glossary page itself calls, `api.glossary.istqb.org/v1/terms`, because the page is built in the browser; the text of each is the definition as the service returned it. From the pytest page only the section on `record_property` is kept, without one sentence and the example with custom markers, which use words the repository checks do not allow; the places are marked `[...]`. From the jest-junit README three rows of the table of options and the section on testcase properties are kept, with the value of the timestamp attribute in the example, a date, shown as `...`. From the Playwright page the section on the JUnit reporter is kept, without the tabs for PowerShell and Batch. The Surefire schema, RFC 4180 section 2, RFC 8259 section 4 and the three sections of W3C XML 1.0 are the same pages that were saved for the readers this tool shares. Typographic quotes and dashes are written as plain ASCII.

The pages say what traceability, a requirement, the test basis and a test case are, and what the files look like. They do not say how a traceability matrix should be judged, and the tool does not claim they do. How a test names a requirement (a prefix and a fixed set of characters), the four statuses, the rule that a failure wins over a pass, what counts as an orphan and a duplicate, and every gate are the tool's own; [method.md](method.md) says so where each is used.

## The sentences that the gates quote

| Gate | Key | Sentences | Method |
| --- | --- | --- | --- |
| `must-pass` | `gates.mustPass` | `requirement`, `requirementsBased` | [method.md](method.md#must-pass) |
| `not-covered` | `gates.maxNotCovered` | `traceability`, `testBasis` | [method.md](method.md#not-covered) |
| `covered-failing` | `gates.maxFailing` | `requirement`, `testCase` | [method.md](method.md#covered-failing) |
| `covered-not-run` | `gates.maxNotRun` | `testCase`, `schemaSkipped` | [method.md](method.md#covered-not-run) |
| `passing-share` | `gates.minPassingShare` | `requirementsBased` | [method.md](method.md#passing-share) |
| `orphans` | `gates.maxOrphans` | `traceability` | [method.md](method.md#orphans) |
| `duplicate-ids` | `gates.maxDuplicateIds` | `traceability`, `requirement` | [method.md](method.md#duplicate-ids) |

## Every quoted sentence

| Key | Used by | Sentence | Page |
| --- | --- | --- | --- |
| `traceability` | `not-covered`, `orphans`, `duplicate-ids`, method.md | The ability to establish explicit relationships between related work products or items within work products. | `istqb-traceability.txt` |
| `requirementsBased` | `must-pass`, `passing-share`, method.md | A black-box test technique in which test conditions are derived from atomic requirements. | `istqb-requirements-based-testing.txt` |
| `testBasis` | `not-covered`, method.md | The body of knowledge used as the basis for test analysis and test design. | `istqb-test-basis.txt` |
| `requirement` | `must-pass`, `covered-failing`, `duplicate-ids`, method.md | A provision that contains criteria to be fulfilled. | `istqb-requirement.txt` |
| `testCase` | `covered-failing`, `covered-not-run`, method.md | A set of preconditions, inputs, actions (where applicable), expected results and postconditions, developed based on test conditions. | `istqb-test-case.txt` |
| `schemaTestcase` | the JUnit reader | `<xs:element name="testcase" minOccurs="0" maxOccurs="unbounded">` | `surefire-test-report-xsd.txt` |
| `schemaName` | the JUnit reader, the link | `<xs:attribute name="name" type="xs:string" use="required"/>` | `surefire-test-report-xsd.txt` |
| `schemaClassname` | the JUnit reader, the link | `<xs:attribute name="classname" type="xs:string"/>` | `surefire-test-report-xsd.txt` |
| `schemaSkipped` | `covered-not-run`, the JUnit reader | `<xs:element name="skipped" nillable="true" minOccurs="0" maxOccurs="1">` | `surefire-test-report-xsd.txt` |
| `schemaProperty` | the JUnit reader | `<xs:element name="property" minOccurs="0" maxOccurs="unbounded">` | `surefire-test-report-xsd.txt` |
| `schemaPropertyValue` | the JUnit reader | `<xs:attribute name="value" type="xs:string" use="required"/>` | `surefire-test-report-xsd.txt` |
| `pytestRecordProperty` | the link, method.md | If you want to log additional information for a test, you can use the record_property fixture: | `pytest-record-property.txt` |
| `pytestPropertyLine` | the JUnit reader | `<property name="example_key" value="1" />` | `pytest-record-property.txt` |
| `pytestSchemaWarning` | method.md | Please note that using this feature will break schema verifications for the latest JUnitXML schema. | `pytest-record-property.txt` |
| `jestTitleTemplate` | the link, limits.md (by the name of the template) | Template string for the `name` attribute of `<testcase>`. | `jest-junit-testcase-properties.txt` |
| `jestClassTemplate` | the link, limits.md (by the name of the template) | Template string for the `classname` attribute of `<testcase>`. | `jest-junit-testcase-properties.txt` |
| `jestCaseProperties` | method.md | WARNING: Properties for testcases is not following standard JUnit XML schema. | `jest-junit-testcase-properties.txt` |
| `playwrightJunit` | the JUnit reader | JUnit reporter produces a JUnit-style xml report. | `playwright-junit-reporter.txt` |
| `playwrightProjectName` | limits.md | Whether to include Playwright project name in every test case as a name prefix. | `playwright-junit-reporter.txt` |
| `csvQuoting` | the CSV reader | Fields containing line breaks (CRLF), double quotes, and commas should be enclosed in double-quotes. | `rfc4180-csv-definition.txt` |
| `csvEscape` | the CSV reader | If double-quotes are used to enclose fields, then a double-quote appearing inside a field must be escaped by preceding it with another double quote. | `rfc4180-csv-definition.txt` |
| `csvPlainQuote` | the CSV reader | If fields are not enclosed with double quotes, then double quotes may not appear inside the fields. | `rfc4180-csv-definition.txt` |
| `csvSameCount` | the CSV reader | Each line should contain the same number of fields throughout the file. | `rfc4180-csv-definition.txt` |
| `jsonUnique` | the JSON reader | The names within an object SHOULD be unique. | `rfc8259-json-objects.txt` |
| `jsonUnpredictable` | the JSON reader, inputs.md | When the names within an object are not unique, the behavior of software that receives such an object is unpredictable. | `rfc8259-json-objects.txt` |
| `doctypeExternal` | the XML reader, threat-model.md | The document type declaration can point to an external subset (a special kind of external entity) containing markup declarations, or can contain the markup declarations directly in an internal subset, or can do both. | `xml-document-type-declaration.txt` |
| `legalCharacter` | the XML reader | Characters referred to using character references MUST match the production for Char. | `xml-character-and-entity-references.txt` |
| `predefinedKnown` | the XML reader | All XML processors MUST recognize these entities whether they are declared or not. | `xml-predefined-entities.txt` |
