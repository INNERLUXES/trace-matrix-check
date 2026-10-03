# Security

## Reporting a problem

Write to info@innerluxes.dev with the subject line "trace-matrix-check security", or use private vulnerability reporting on this repository. Please do not open a public issue for a vulnerability.

Include a small made-up input that shows the problem, what you expected and what happened. Use made-up requirement IDs, test names and paths, and never a real key, token or password, even a revoked one.

## Scope

In scope:

- an XML result file that makes the tool expand an entity, read a DTD, or fetch or open an external entity, a schema or any other address named in the file
- an input that makes the tool run a test, load a module, evaluate any part of a file, or run a program
- a folder that makes the tool follow a symbolic link or a junction inside it, or read a file outside the paths it was given
- a configuration that makes the tool run a regular expression or a pattern of its own, or accept a key it does not know or a key named twice
- an input that makes the tool hang, take very long, or use unbounded memory, such as a very large file, very many files, requirements, tests or properties, deep folders, elements or JSON values nested very deep, a tag, a comment, a quote or a CDATA section that is never closed, or a test name or a property built to look almost like an ID
- text from a file name, a test name, a class name, a property, a requirement title, a result value or a message that breaks a Markdown table, rewrites the terminal through control or direction characters, or is shown unescaped in a report
- a name such as `__proto__` that changes how objects behave inside the tool
- an input that the tool fails to read and passes over without a note or an error
- a requirement reported as covered-passing when no test that names it passed, when a test that names it failed, or when its only tests were skipped or not run; a gate reported as met when the count is on the wrong side of its limit, or a share just under a limit treated as the limit
- a sentence in src/data.js that differs from the saved page in research/sources

Out of scope: whether the requirements are right, whether a test checks what its name says (docs/limits.md lists what the tool cannot see), the safety of the test runners and the test management tool that wrote the files, who may change the configuration or the requirements list in your repository, and how your pipeline stores the reports.

Read [docs/threat-model.md](docs/threat-model.md) for the rest.
