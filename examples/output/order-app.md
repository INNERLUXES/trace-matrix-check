## trace-matrix-check: fail

Configuration: examples/config.json (Order management service, release 3.1). Inputs: requirements examples/order-app/requirements.csv (16 rows); JUnit results: 4 files, 17 testcases; test cases examples/order-app/test-cases.csv (6 rows).

Requirements: 13 included, 2 excluded by status; 6 covered-passing, 3 covered-failing, 2 covered-not-run, 2 not covered. Tests: 23 tests, 21 name a requirement, 2 name none; 2 orphan IDs; 1 duplicate ID. Gates: 2 met, 5 not met.

### Matrix

| Requirement | Priority | Title | Status | Tests |
| --- | --- | --- | --- | --- |
| ORD-1 | High | Place an order from the cart | covered-passing | 2 tests: 2 passed |
| ORD-2 | High | Show the order total with tax | covered-passing | 2 tests: 2 passed |
| ORD-3 | High | Reserve stock for each order line | **covered-failing** | 1 test: 1 failed |
| ORD-4 | Medium | Cancel an order before it ships | covered-passing | 2 tests: 2 passed |
| ORD-5 | High | Refund a cancelled order | covered-passing | 2 tests: 2 passed |
| ORD-6 | Medium | Send an order confirmation message | **covered-failing** | 1 test: 1 failed |
| ORD-7 | Medium | Track the delivery of an order | **covered-failing** | 3 tests: 2 passed, 1 failed |
| ORD-8 | Low | Split an order into several shipments | **covered-not-run** | 1 test: 1 skipped |
| ORD-9 | Medium | Apply a discount code at checkout | covered-passing | 2 tests: 2 passed |
| ORD-10 | Low | Export the orders of a day as a spreadsheet | **excluded** (Withdrawn) | 1 test: 1 passed |
| ORD-11 | Low | Reorder a past order in one step | **covered-not-run** | 2 tests: 1 skipped, 1 not run |
| ORD-12 | High | Reject an order over the credit limit | **not-covered** | no test names it |
| ORD-13 | Low | Print a packing slip | covered-passing | 1 test: 1 passed |
| ORD-14 | Low | Mark an order as a gift | **excluded** (Withdrawn) | 1 test: 1 passed |
| ORD-15 | Medium | Archive orders after the retention period | **not-covered** | no test names it |

### Gates

| Status | Gate | Rule | Found | Why |
| --- | --- | --- | --- | --- |
| **not met** | must-pass | every requirement of priority High is covered-passing | 3 of 5 requirements covered-passing | 2 requirements of that priority are not covered-passing |
| **not met** | not-covered | at most 0 requirements not covered | 2 requirements of 13 not covered | 2 is above 0 |
| **not met** | covered-failing | at most 0 requirements covered-failing | 3 requirements of 13 covered-failing | 3 is above 0 |
| met | covered-not-run | at most 2 requirements covered-not-run | 2 requirements of 13 covered-not-run |  |
| met | passing-share | at least 40% of the included requirements covered-passing | 46.15% (6 of 13 requirements) |  |
| **not met** | orphans | at most 0 IDs that tests name and the requirements list does not hold | 2 orphan IDs in 2 tests | 2 is above 0: a test names a requirement the list does not hold (removed, renamed or mistyped) |
| **not met** | duplicate-ids | at most 0 requirement IDs on more than one row | 1 ID on more than one row | 1 is above 0: the first row of each is used, and the others are not in the matrix |

#### must-pass

- ORD-3 (High): covered-failing
- ORD-12 (High): not covered
- from examples/order-app/requirements.csv:2: ORD-1 (High): covered-passing, 2 tests
- from examples/order-app/requirements.csv:3: ORD-2 (High): covered-passing, 2 tests
- from examples/order-app/requirements.csv:4: ORD-3 (High): covered-failing, 1 test
- from examples/order-app/requirements.csv:6: ORD-5 (High): covered-passing, 2 tests
- from examples/order-app/requirements.csv:13: ORD-12 (High): not covered, 0 tests
- basis: "A provision that contains criteria to be fulfilled." (requirement, https://glossary.istqb.org/en\_US/term/requirement)
- basis: "A black-box test technique in which test conditions are derived from atomic requirements." (requirements-based testing, https://glossary.istqb.org/en\_US/term/requirements-based-testing)

#### not-covered

- ORD-12 (High) Reject an order over the credit limit
- ORD-15 (Medium) Archive orders after the retention period
- from examples/order-app/requirements.csv:13: ORD-12 (High): not covered, 0 tests
- from examples/order-app/requirements.csv:17: ORD-15 (Medium): not covered, 0 tests
- basis: "The ability to establish explicit relationships between related work products or items within work products." (traceability, https://glossary.istqb.org/en\_US/term/traceability)
- basis: "The body of knowledge used as the basis for test analysis and test design." (test basis, https://glossary.istqb.org/en\_US/term/test-basis)

#### covered-failing

- ORD-3 (High) Reserve stock for each order line
- ORD-6 (Medium) Send an order confirmation message
- ORD-7 (Medium) Track the delivery of an order
- from examples/order-app/requirements.csv:4: ORD-3 (High): covered-failing, 1 test
- from examples/order-app/requirements.csv:7: ORD-6 (Medium): covered-failing, 1 test
- from examples/order-app/requirements.csv:8: ORD-7 (Medium): covered-failing, 3 tests
- basis: "A provision that contains criteria to be fulfilled." (requirement, https://glossary.istqb.org/en\_US/term/requirement)
- basis: "A set of preconditions, inputs, actions (where applicable), expected results and postconditions, developed based on test conditions." (test case, https://glossary.istqb.org/en\_US/term/test-case)

#### covered-not-run

- ORD-8 (Low) Split an order into several shipments
- ORD-11 (Low) Reorder a past order in one step
- from examples/order-app/requirements.csv:9: ORD-8 (Low): covered-not-run, 1 test
- from examples/order-app/requirements.csv:12: ORD-11 (Low): covered-not-run, 2 tests
- basis: "A set of preconditions, inputs, actions (where applicable), expected results and postconditions, developed based on test conditions." (test case, https://glossary.istqb.org/en\_US/term/test-case)
- basis: "&lt;xs:element name="skipped" nillable="true" minOccurs="0" maxOccurs="1"&gt;" (testcase, https://maven.apache.org/surefire/maven-surefire-plugin/xsd/surefire-test-report.xsd)

#### passing-share

- ORD-3 (High): covered-failing
- ORD-6 (Medium): covered-failing
- ORD-7 (Medium): covered-failing
- ORD-8 (Low): covered-not-run
- ORD-11 (Low): covered-not-run
- ORD-12 (High): not covered
- ORD-15 (Medium): not covered
- from examples/order-app/requirements.csv:4: ORD-3 (High): covered-failing, 1 test
- from examples/order-app/requirements.csv:7: ORD-6 (Medium): covered-failing, 1 test
- from examples/order-app/requirements.csv:8: ORD-7 (Medium): covered-failing, 3 tests
- from examples/order-app/requirements.csv:9: ORD-8 (Low): covered-not-run, 1 test
- from examples/order-app/requirements.csv:12: ORD-11 (Low): covered-not-run, 2 tests
- from examples/order-app/requirements.csv:13: ORD-12 (High): not covered, 0 tests
- from examples/order-app/requirements.csv:17: ORD-15 (Medium): not covered, 0 tests
- basis: "A black-box test technique in which test conditions are derived from atomic requirements." (requirements-based testing, https://glossary.istqb.org/en\_US/term/requirements-based-testing)

#### orphans

- ORD-41: named by shop.orders.OrderApiTest &gt; ORD-41 holds an order for a fraud review
- ORD-16: named by orders.spec.ts &gt; orders ORD-16 shows the order timeline
- from examples/order-app/results/api/TEST-shop.orders.OrderApiTest.xml:13: ORD-41: shop.orders.OrderApiTest &gt; ORD-41 holds an order for a fraud review (name)
- from examples/order-app/results/ui/playwright-results.xml:17: ORD-16: orders.spec.ts &gt; orders ORD-16 shows the order timeline (name)
- basis: "The ability to establish explicit relationships between related work products or items within work products." (traceability, https://glossary.istqb.org/en\_US/term/traceability)

#### duplicate-ids

- ORD-9: lines 10, 16; line 10 is used
- from examples/order-app/requirements.csv:16: ORD-9 again, first on line 10
- basis: "The ability to establish explicit relationships between related work products or items within work products." (traceability, https://glossary.istqb.org/en\_US/term/traceability)
- basis: "A provision that contains criteria to be fulfilled." (requirement, https://glossary.istqb.org/en\_US/term/requirement)

### Orphan IDs

- ORD-41: named by shop.orders.OrderApiTest &gt; ORD-41 holds an order for a fraud review (examples/order-app/results/api/TEST-shop.orders.OrderApiTest.xml:13)
- ORD-16: named by orders.spec.ts &gt; orders ORD-16 shows the order timeline (examples/order-app/results/ui/playwright-results.xml:17)

### Duplicate requirement IDs

- ORD-9: line 16 repeats line 10; line 10 is used

### Tests that name no requirement

- shop.orders.OrderApiTest &gt; healthCheckReturnsOk (passed, examples/order-app/results/api/TEST-shop.orders.OrderApiTest.xml:14)
- money formats an amount in the shop currency &gt; money formats an amount in the shop currency (passed, examples/order-app/results/ui/jest-junit.xml:10)

### Links

- ORD-1: passed shop.orders.OrderApiTest &gt; ORD-1 places an order from the cart (name, examples/order-app/results/api/TEST-shop.orders.OrderApiTest.xml:7); passed checkout.spec.ts &gt; checkout ORD-1 places an order as a guest (name, examples/order-app/results/ui/playwright-results.xml:3)
- ORD-2: passed order total ORD-2 shows the total with tax &gt; order total ORD-2 shows the total with tax (name, classname, examples/order-app/results/ui/jest-junit.xml:4); passed order total ORD-2 rounds the tax of each line &gt; order total ORD-2 rounds the tax of each line (name, classname, examples/order-app/results/ui/jest-junit.xml:6)
- ORD-3: failed shop.orders.OrderApiTest &gt; ORD-3 reserves stock for each order line (name, examples/order-app/results/api/TEST-shop.orders.OrderApiTest.xml:8)
- ORD-4: passed shop.orders.OrderApiTest &gt; ORD-4 cancels an order that has not shipped (name, examples/order-app/results/api/TEST-shop.orders.OrderApiTest.xml:12); passed tests.test\_orders &gt; test\_cancel\_after\_shipping\_is\_refused (property requirements, examples/order-app/results/api/pytest-refunds.xml:16)
- ORD-5: passed tests.test\_refunds &gt; test\_refund\_cancelled\_order (property requirement, examples/order-app/results/api/pytest-refunds.xml:6); passed tests.test\_refunds &gt; test\_refund\_keeps\_the\_shipping\_fee (property requirement, examples/order-app/results/api/pytest-refunds.xml:11)
- ORD-6: failed TC-103 Confirmation message holds the tracking link (column Covers, examples/order-app/test-cases.csv:4)
- ORD-7: passed tests.test\_orders &gt; test\_cancel\_after\_shipping\_is\_refused (property requirements, examples/order-app/results/api/pytest-refunds.xml:16); passed orders.spec.ts &gt; orders ORD-7 shows the delivery status (name, examples/order-app/results/ui/playwright-results.xml:11); failed TC-103 Confirmation message holds the tracking link (column Covers, examples/order-app/test-cases.csv:4)
- ORD-8: skipped TC-104 Backordered line ships separately (column Covers, examples/order-app/test-cases.csv:5)
- ORD-9: passed checkout.spec.ts &gt; checkout ORD-9 applies a discount code (name, examples/order-app/results/ui/playwright-results.xml:5); passed TC-106 Expired discount code is refused (column Covers, examples/order-app/test-cases.csv:7)
- ORD-10: passed checkout.spec.ts &gt; checkout ORD-10 exports the orders of the day (name, examples/order-app/results/ui/playwright-results.xml:7)
- ORD-11: skipped orders.spec.ts &gt; orders ORD-11 reorders a past order (name, examples/order-app/results/ui/playwright-results.xml:13); not-run TC-105 Reorder copies the delivery address (column Covers, examples/order-app/test-cases.csv:6)
- ORD-13: passed TC-101 Packing slip lists every order line (column Covers, examples/order-app/test-cases.csv:2)
- ORD-14: passed TC-102 Gift message is printed on the packing slip (column Covers, examples/order-app/test-cases.csv:3)

### Notes

- examples/order-app/test-cases.csv: 1 test case has a result that testCases does not list ((empty): 1); it counts as not run
- examples/order-app/requirements.csv: 1 requirement ID appears on more than one row; the first row of each is used

**Result: fail** - 5 gates not met.
