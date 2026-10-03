// Reads the test results out of the tree of one JUnit XML file: every testcase with its class name, name, suite, result,
// the line where it starts, and the property elements inside it. It reads the shape of the test report of Maven Surefire
// (its schema is saved in research/sources): a testsuites or testsuite root, testsuite elements (nested or not), and
// testcase elements with failure, error and skipped. A property is read from a properties element that is a child of
// the testcase, as pytest writes for record_property and jest-junit writes for testcase properties; the properties of a
// testsuite are not read, because they belong to no one test. The time of a test is not read: nothing uses it.

export const RESULT_KINDS = ['passed', 'failed', 'error', 'skipped'];

// The name of a test as a report shows it.
export const testLabel = (classname, name) => (classname ? `${classname} > ${name}` : name);

// Reads the results of one file. doc is the tree of src/xml.js; file is the path shown in the report. Returns
// { cases, notes }. Throws an Error with a reason when the root element is not testsuites or testsuite.
export function readJunit(doc, file) {
  const root = doc.root;
  if (root.name !== 'testsuites' && root.name !== 'testsuite') throw new Error(`the root element is <${root.name}>, not <testsuites> or <testsuite>`);
  const cases = [];
  let unnamed = 0;
  // An explicit stack: suites may nest as deep as the reader allows, with no recursion.
  const pending = [{ el: root, suite: root.name === 'testsuite' ? root.attrs.get('name') ?? '' : '' }];
  while (pending.length) {
    const { el, suite } = pending.pop();
    for (const child of el.children) {
      if (child.name === 'testsuite') pending.push({ el: child, suite: child.attrs.get('name') ?? suite });
      else if (child.name === 'testcase') {
        const c = readCase(child, suite, file);
        if (!c) unnamed += 1;
        else cases.push(c);
      }
    }
  }
  // Suites were taken from the end of the list; put the cases back in file order.
  cases.sort((a, b) => a.offset - b.offset);
  const notes = [];
  if (unnamed) notes.push(`${unnamed} testcase ${unnamed === 1 ? 'element has' : 'elements have'} no name attribute and ${unnamed === 1 ? 'was' : 'were'} not read`);
  if (doc.replaced) notes.push(`${doc.replaced} numeric ${doc.replaced === 1 ? 'reference names a character' : 'references name characters'} that XML does not allow, read as the replacement character`);
  return { cases, notes };
}

function readCase(el, suite, file) {
  const name = el.attrs.get('name');
  if (name === undefined || name === '') return null;
  const classname = el.attrs.get('classname') ?? '';
  let failure = 0;
  let error = 0;
  let skipped = 0;
  let message = '';
  const properties = [];
  for (const child of el.children) {
    if (child.name === 'failure') failure += 1;
    else if (child.name === 'error') error += 1;
    else if (child.name === 'skipped') skipped += 1;
    else if (child.name === 'properties') {
      for (const p of child.children) {
        if (p.name !== 'property') continue;
        const pname = p.attrs.get('name');
        if (pname === undefined) continue;
        // The schema has the value in an attribute; a writer that puts it in the text of the element is read too.
        properties.push({ name: pname, value: p.attrs.get('value') ?? p.text, line: p.line });
      }
    }
    if ((child.name === 'failure' || child.name === 'error') && !message) message = child.attrs.get('message') || child.text.trim().split(/\r?\n|\r/)[0] || '';
  }
  const result = failure ? 'failed' : error ? 'error' : skipped ? 'skipped' : 'passed';
  return { classname, name, label: testLabel(classname, name), suite: suite ?? '', file, line: el.line, offset: el.offset, result, message, properties };
}
