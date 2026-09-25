# test-failed-subjects.js

A standalone Node script from an earlier bug investigation. It checks the rules for failed subjects on a fixed set of sample subjects:

- A subject counts as failed when it is completed and its grade starts with `F`.
- Credits of failed subjects are not counted as earned.
- The credit-weighted average, with and without failed subjects.

Run it from the repository root:

```bash
node testing/test-failed-subjects.js
```

It prints PASS/FAIL lines and always exits with code 0.

The script tests its own copies of the functions, not the application code, and those copies are out of date:

- The real `isSubjectFailed` in `lib/status-utils.ts` also treats grades starting with `4` or `-` as failed.
- The script still reports that failed subjects are counted in the average. That was fixed: `lib/utils/statistics-utils.ts` excludes them now.

The maintained tests are the Vitest suites (`*.test.ts` under `lib/`), run with `pnpm test:run`.
