// The names, lists and sentences the gates and the documents rest on. Each sentence comes from a page that is saved, with
// its address on the first line, in research/sources, and test/data.test.js compares this file with the saved text.
// Change a sentence here only after saving the new page text and updating docs/rules-and-sources.md. The code in src/
// uses these constants and never writes a quoted sentence of its own.

const ISTQB = 'https://glossary.istqb.org/en_US/term/';
const XML = 'https://www.w3.org/TR/xml/';

export const SOURCES = [
  { id: 'istqb-traceability', file: 'istqb-traceability.txt', url: `${ISTQB}traceability`, label: 'ISTQB Glossary, traceability' },
  { id: 'istqb-requirements-based-testing', file: 'istqb-requirements-based-testing.txt', url: `${ISTQB}requirements-based-testing`, label: 'ISTQB Glossary, requirements-based testing' },
  { id: 'istqb-test-basis', file: 'istqb-test-basis.txt', url: `${ISTQB}test-basis`, label: 'ISTQB Glossary, test basis' },
  { id: 'istqb-requirement', file: 'istqb-requirement.txt', url: `${ISTQB}requirement`, label: 'ISTQB Glossary, requirement' },
  { id: 'istqb-test-case', file: 'istqb-test-case.txt', url: `${ISTQB}test-case`, label: 'ISTQB Glossary, test case' },
  { id: 'surefire-xsd', file: 'surefire-test-report-xsd.txt', url: 'https://maven.apache.org/surefire/maven-surefire-plugin/xsd/surefire-test-report.xsd', label: 'Maven Surefire, XML schema of the test report' },
  { id: 'pytest-record-property', file: 'pytest-record-property.txt', url: 'https://docs.pytest.org/en/stable/how-to/output.html#record-property', label: 'pytest, record_property' },
  { id: 'jest-junit', file: 'jest-junit-testcase-properties.txt', url: 'https://github.com/jest-community/jest-junit', label: 'jest-junit, README' },
  { id: 'playwright-junit', file: 'playwright-junit-reporter.txt', url: 'https://playwright.dev/docs/test-reporters#junit-reporter', label: 'Playwright, JUnit reporter' },
  { id: 'rfc4180', file: 'rfc4180-csv-definition.txt', url: 'https://www.rfc-editor.org/rfc/rfc4180', label: 'RFC 4180, Common Format and MIME Type for CSV Files' },
  { id: 'rfc8259', file: 'rfc8259-json-objects.txt', url: 'https://www.rfc-editor.org/rfc/rfc8259', label: 'RFC 8259, The JSON Data Interchange Format' },
  { id: 'xml-doctype', file: 'xml-document-type-declaration.txt', url: `${XML}#sec-prolog-dtd`, label: 'W3C XML 1.0, 2.8 Prolog and Document Type Declaration' },
  { id: 'xml-references', file: 'xml-character-and-entity-references.txt', url: `${XML}#sec-references`, label: 'W3C XML 1.0, 4.1 Character and Entity References' },
  { id: 'xml-predefined', file: 'xml-predefined-entities.txt', url: `${XML}#sec-predefined-ent`, label: 'W3C XML 1.0, 4.6 Predefined Entities' }
];

export const source = (id) => SOURCES.find((s) => s.id === id);

// Sentences quoted in the gates and the documents. Every text is on its saved page word for word
// (test/data.test.js compares them), and holds no year. Lines of a schema and of an example file are quoted as written.
export const FACTS = {
  traceability: { source: 'istqb-traceability', section: 'traceability', text: 'The ability to establish explicit relationships between related work products or items within work products.' },
  requirementsBased: { source: 'istqb-requirements-based-testing', section: 'requirements-based testing', text: 'A black-box test technique in which test conditions are derived from atomic requirements.' },
  testBasis: { source: 'istqb-test-basis', section: 'test basis', text: 'The body of knowledge used as the basis for test analysis and test design.' },
  requirement: { source: 'istqb-requirement', section: 'requirement', text: 'A provision that contains criteria to be fulfilled.' },
  testCase: { source: 'istqb-test-case', section: 'test case', text: 'A set of preconditions, inputs, actions (where applicable), expected results and postconditions, developed based on test conditions.' },
  schemaTestcase: { source: 'surefire-xsd', section: 'testsuite', text: '<xs:element name="testcase" minOccurs="0" maxOccurs="unbounded">' },
  schemaName: { source: 'surefire-xsd', section: 'testcase', text: '<xs:attribute name="name" type="xs:string" use="required"/>' },
  schemaClassname: { source: 'surefire-xsd', section: 'testcase', text: '<xs:attribute name="classname" type="xs:string"/>' },
  schemaSkipped: { source: 'surefire-xsd', section: 'testcase', text: '<xs:element name="skipped" nillable="true" minOccurs="0" maxOccurs="1">' },
  schemaProperty: { source: 'surefire-xsd', section: 'properties', text: '<xs:element name="property" minOccurs="0" maxOccurs="unbounded">' },
  schemaPropertyValue: { source: 'surefire-xsd', section: 'property', text: '<xs:attribute name="value" type="xs:string" use="required"/>' },
  pytestRecordProperty: { source: 'pytest-record-property', section: 'record_property', text: 'If you want to log additional information for a test, you can use the record_property fixture:' },
  pytestPropertyLine: { source: 'pytest-record-property', section: 'record_property', text: '<property name="example_key" value="1" />' },
  pytestSchemaWarning: { source: 'pytest-record-property', section: 'record_property', text: 'Please note that using this feature will break schema verifications for the latest JUnitXML schema.' },
  jestTitleTemplate: { source: 'jest-junit', section: 'titleTemplate', text: 'Template string for the `name` attribute of `<testcase>`.' },
  jestClassTemplate: { source: 'jest-junit', section: 'classNameTemplate', text: 'Template string for the `classname` attribute of `<testcase>`.' },
  jestCaseProperties: { source: 'jest-junit', section: 'Adding custom testcase properties', text: 'WARNING: Properties for testcases is not following standard JUnit XML schema.' },
  playwrightJunit: { source: 'playwright-junit', section: 'JUnit reporter', text: 'JUnit reporter produces a JUnit-style xml report.' },
  playwrightProjectName: { source: 'playwright-junit', section: 'JUnit reporter', text: 'Whether to include Playwright project name in every test case as a name prefix.' },
  csvQuoting: { source: 'rfc4180', section: '2. Definition of the CSV Format', text: 'Fields containing line breaks (CRLF), double quotes, and commas should be enclosed in double-quotes.' },
  csvEscape: { source: 'rfc4180', section: '2. Definition of the CSV Format', text: 'If double-quotes are used to enclose fields, then a double-quote appearing inside a field must be escaped by preceding it with another double quote.' },
  csvPlainQuote: { source: 'rfc4180', section: '2. Definition of the CSV Format', text: 'If fields are not enclosed with double quotes, then double quotes may not appear inside the fields.' },
  csvSameCount: { source: 'rfc4180', section: '2. Definition of the CSV Format', text: 'Each line should contain the same number of fields throughout the file.' },
  jsonUnique: { source: 'rfc8259', section: '4. Objects', text: 'The names within an object SHOULD be unique.' },
  jsonUnpredictable: { source: 'rfc8259', section: '4. Objects', text: 'When the names within an object are not unique, the behavior of software that receives such an object is unpredictable.' },
  doctypeExternal: { source: 'xml-doctype', section: '2.8 Prolog and Document Type Declaration', text: 'The document type declaration can point to an external subset (a special kind of external entity) containing markup declarations, or can contain the markup declarations directly in an internal subset, or can do both.' },
  legalCharacter: { source: 'xml-references', section: 'Well-formedness constraint: Legal Character', text: 'Characters referred to using character references MUST match the production for Char.' },
  predefinedKnown: { source: 'xml-predefined', section: '4.6 Predefined Entities', text: 'All XML processors MUST recognize these entities whether they are declared or not.' }
};

// The page of a quoted sentence.
export const factPage = (key) => source(FACTS[key].source).url;

// The five predefined entities of XML; no other name is ever expanded.
export const PREDEFINED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

// Folders that hold tools, caches or copies of packages, not test results. They are not entered; a note names them.
export const SKIP_FOLDERS = ['.git', '.hg', '.svn', 'node_modules', '.cache'];

// The file ending of a JUnit XML file.
export const isXmlName = (name) => /\.xml$/i.test(name);

// The places of a JUnit testcase where a requirement ID can be found: the name attribute, the classname attribute and
// the value of a property element inside the testcase. The column of a test-case export is the fourth place; it is named
// in the configuration under testCases.
export const LINK_FIELDS = ['name', 'classname', 'property'];

// The characters an ID may hold after its prefix. Only ASCII letters and digits are letters and digits here.
export const ID_CHARACTERS = {
  digits: 'the digits 0 to 9',
  alnum: 'ASCII letters and digits',
  'alnum-dot-dash': 'ASCII letters and digits, and a dot, a dash or an underscore between them'
};

// The status of an included requirement, in report order.
export const REQUIREMENT_STATUSES = ['not-covered', 'covered-failing', 'covered-not-run', 'covered-passing'];
