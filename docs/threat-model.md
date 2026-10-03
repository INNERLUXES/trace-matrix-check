# Threat model

## What the tool touches

- It reads the configuration file, the requirements list, the files and folders named with `--junit`, and the test-case export named with `--test-cases`. Nothing else is opened.
- Inside a result folder it follows no symbolic link and no junction. A path named on the command line may itself be a link, because the person who runs the tool named it.
- It reads the XML files, the CSV files and the JSON files as text. It does not open anything they name: not a DTD, a schema, an external entity, a file named in a `file` attribute of a testcase, or an address in a test name or a message. A path or an address in a file is text.
- It writes only to the screen (standard output and standard error).
- It opens no network connection, runs no program, never runs a test and never evaluates anything it reads.

## What the input may hold

The results often come from somewhere else: a pull request from a fork, a build of a branch nobody has reviewed, an artifact downloaded from another job, or an export from a test management tool. A test that is under the control of an attacker can write anything into its own result file, including its name, its class name and its properties. The requirements list and the test-case export come from tools that many people can edit. The configuration lives in the repository, so a change to it is a change to the check. The tool treats every file as possibly hostile, and the configuration as a file that must be reviewed.

The XML can try the classic attacks on XML readers. The billion laughs: a DOCTYPE that declares entities that expand into each other, so that a few hundred bytes become gigabytes. An external entity: a DOCTYPE that declares an entity with a `SYSTEM` address, such as a file on the machine or an address on the network, so that a reader puts the content of a secret file into the report, or calls out to a host. W3C XML 1.0 says what a DOCTYPE can do: "The document type declaration can point to an external subset (a special kind of external entity) containing markup declarations, or can contain the markup declarations directly in an internal subset, or can do both." A parameter entity that loads a remote DTD. A reference to an entity that was never declared, in the hope that the reader looks it up somewhere. Numbers past the last code point, or references to characters XML forbids.

The structure can try to exhaust a reader: a huge file, elements nested a hundred thousand deep, a start tag with thousands of attributes, hundreds of thousands of elements, a tag, a quote, a comment or a CDATA section that is not closed before the end of the file, long runs of `<` or `&`. A JSON file with values nested thousands deep or a string of megabytes. A CSV file with a quote that is never closed, a field of megabytes, millions of records, or a quote placed to shift every later column. A folder can hold symbolic links that point outside it, at a device, or back at a parent folder in a link loop, millions of files, folders nested thousands deep, or a binary file with an `.xml` name.

The link between a test and a requirement is a place for a slow pattern. A tool that took a regular expression from its configuration could be given one with nested repetition, such as `(a+)+$`, that takes a time that doubles with every character of a long test name: a test name of a few hundred characters would stop the pipeline. A test name or a property of a megabyte, full of text that almost looks like an ID, can make a careless scanner go back over the same characters again and again. A hundred thousand requirements and a hundred thousand tests can make a careless match do work that grows with the square of the input.

The data can try to move the verdict. A JSON object that names the same key twice, so that two readers keep different numbers. A percentage written as 99.99999999 so that rounding lets it pass. A test that fails in one run and passes in another, given together, so that only the pass is counted. A test case with a result the configuration does not list, such as Retest, so that it falls between passed and failed. A priority in the configuration that no requirement has, so that the gate checks nothing. A requirement ID on two rows with two priorities. A requirement, a test or a property named `__proto__`, `constructor` or `toString`.

A test name, a class name, a property, a requirement title, a path or a message can hold control and direction characters, hold markup that a Markdown table would render, or look like a link.

## What could go wrong, and what stops it

| Risk | Control |
| --- | --- |
| The billion laughs expands a few bytes into gigabytes | There is no DTD support: a DOCTYPE is refused at its first byte, before anything is declared. No entity can be declared, so none can expand. A test runs the attack and checks that it is refused in well under a second and that the output stays small |
| An external entity reads a secret file into the report, or calls out to a host | The DOCTYPE that would declare it is refused; a reference to any name but the five predefined entities is refused; no module for the network is imported. A test declares an external entity that points at a secret file, in a test name and in a property, and checks that its content is in no output |
| A remote DTD is loaded through a parameter entity | Refused with the DOCTYPE; the reader never fetches anything |
| A regular expression from the configuration takes exponential time | The configuration takes no pattern. An ID is a prefix of plain characters and one of three fixed sets of characters; a prefix with any other character is refused when the configuration is read. No regular expression is ever built from the configuration or from any input; a repository test checks the code for one |
| A long test name full of near misses makes the scanner go back again and again | Each text is scanned once per prefix from left to right; a run of ID characters is read once and never again. Tests scan texts of a million characters built to look almost like IDs and check the time |
| A hundred thousand requirements and tests make the match grow with the square of the input | Requirements are kept in a map by ID; each link is one lookup. A test matches a hundred thousand tests to a hundred thousand requirements and checks the time |
| A test in the results runs, or a command in a name is run | Nothing is run or evaluated; names are text. A test puts a command in a test name and checks that no file appears |
| A symbolic link leads the tool to files outside the folder | Every entry in a result folder is looked at with `lstat`; a link is listed by name and never followed. A test links to a folder outside with a failing result in it and checks that it is not read |
| A link loop, or a link to a parent, makes the walk run for ever | Links are not followed, so there is no loop. The walk keeps its own list of folders and needs no recursion |
| Folders nested thousands deep, millions of files or many paths exhaust the stack, the memory or the time | The walk is a loop with a list, and more than 32 levels, 50,000 entries, 10,000 XML files or 100 `--junit` paths refuse the input with exit code `2` |
| A huge file, or many large files, exhaust memory | A file over 32 MB (1 MB for the configuration) is refused before it is read; all XML files read may hold at most 512 MB. Other files in a result folder are never opened |
| A pipe or a device named like an input makes the tool hang | The type is taken from the open file; anything that is not a regular file is refused |
| A binary or UTF-16 file is read as text | A null byte in the first 8,000 bytes, or the byte order mark of UTF-16, makes the file refused and named |
| Elements nested a hundred thousand deep overflow a stack | The XML reader keeps an explicit stack and refuses a file past 256 levels; the JUnit reader walks with a loop and a list; the JSON reader refuses values nested more than 32 deep |
| A tag, a quote, a comment, a CDATA section, a string or a quoted CSV field that is not closed makes a reader scan again and again | Each reader reads once and never goes back; each search for an end runs once from where it is, and a file that ends inside one is refused with the place |
| Thousands of attributes, fields or records, or hundreds of thousands of elements, exhaust memory | At most 256 attributes on an element, 500,000 elements in a file, 1,000 fields in a record, 100,000 requirements and 100,000 test cases; past any limit the file is refused. Only 4,096 characters of the text of one element are kept, and 50 IDs of one text |
| Two readers keep different numbers from a JSON object that names a key twice | The JSON reader refuses it, in the configuration and in a requirements list |
| A percentage lets a share under the limit pass through rounding | Shares are compared with whole numbers; a limit has at most four decimals; a figure is shown cut down, never rounded up |
| A failing run is hidden by a passing run of the same test | Every test that names a requirement counts, and a failure wins over a pass |
| A test case with an unlisted result passes by default | An unlisted or empty result is not run, never passed, and a note names the values |
| A typo in a priority makes `must-pass` check nothing | A priority that no requirement has makes the gate not met |
| A key is misspelled and a gate silently disappears | Every key the tool does not know is an error, with the line and a suggestion; a configuration that states no gate is an error |
| A requirement, a test or a key named `__proto__` or `constructor` changes how objects behave | Requirements are kept in maps keyed by text, attributes in maps, and JSON objects are built with own properties, so such a name is just data; in the configuration it is an unknown key |
| A name or a message rewrites the terminal through escape sequences, or reorders text with direction characters | Control characters (C0 and C1), line and paragraph separators, the byte order mark and Unicode direction controls are replaced by a space before any text reaches a report or an error message, and the length is capped |
| A test name or a requirement title breaks the Markdown table in the job summary, makes a link, or hides text as an HTML tag | Pipes, backslashes, square brackets, backticks, asterisks, underscores, line breaks, `<`, `>` and `&` are escaped in every Markdown table cell and list item |
| The argument names a URL, so the tool becomes a fetcher | Arguments that look like addresses are refused; reading from standard input is refused |
| A pull request loosens a gate, or removes a requirement from the list | The tool cannot see this. The configuration and the requirements list are files under review: `.github/CODEOWNERS` in this repository shows how, and [secure-defaults.md](secure-defaults.md) says how to protect them in yours |

## Out of scope

Whether the requirements are right, whether a test checks what its name says, and whether the product is good ([limits.md](limits.md)). The safety of the test runners that wrote the files, of the test management tool that wrote the export, and of the job that downloads them. Who may change the configuration or the requirements list in a repository: that is access control of the repository, and the tool can only say what the files say.
