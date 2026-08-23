# Contributing to PrintMetric

Thanks for helping improve PrintMetric. The project intentionally stays dependency-light, framework-free, and easy to host on GitHub Pages.

## Before opening a change

1. Search existing issues and pull requests for related work.
2. Keep changes focused. Avoid adding frameworks, bundlers, backend services, or tracking without prior discussion.
3. For pricing changes, describe the intended formula and whether existing saved values or quotes change.
4. For G-code changes, include a small metadata fixture rather than a large generated G-code file.

## Local development

Serve the repository with any static HTTP server. For example:

```sh
python -m http.server 8000
```

Then open `http://localhost:8000/`.

The automated tests use Node's built-in test runner and require no package installation:

```sh
npm test
```

## Pull request checklist

* Run `npm test` and confirm all tests pass.
* Test the affected UI in a browser using keyboard navigation as well as a pointer.
* If quote output changes, print or save an A4 customer quote and check for clipping, unwanted internal costs, and page-break problems.
* Preserve existing localStorage field names unless a documented migration is included.
* Update README documentation and fixtures when formulas or supported slicer metadata change.
* Do not include customer data, private G-code, credentials, generated dependency folders, or large binary fixtures.

## Reporting issues

Include the browser and operating system, steps to reproduce, expected behavior, and actual behavior. For G-code parsing issues, share only the relevant comment metadata when possible and remove identifying information.

