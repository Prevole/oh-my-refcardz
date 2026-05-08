---
description: Validate project (lint, tests, cheatsheets) and fix any issues
---

Run the full validation suite and fix any errors or warnings found.

## Validation Steps

1. **Cheatsheets** — Run `npm run validate:cheatsheets`
2. **Lint** — Run `npm run lint`
3. **Tests** — Run `npm run test`

## On Errors or Warnings

- Analyze each issue carefully
- Fix all errors and warnings — do not skip any
- Re-run the validation to confirm fixes work
- Repeat until all checks pass

## Important

- Fix issues in the order they appear
- If a fix could affect other files, check for side effects
- For lint warnings (not just errors), fix them too — the codebase should be warning-free
