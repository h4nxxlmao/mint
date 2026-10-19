# Guard fixtures

No real secret shapes live in this directory: every value here is a placeholder, so
the repository's own `mint guard scan` stays clean and GitHub's secret scanning has
nothing to find.

The tests that need *detectable* fake secrets build them at run time from fragments
(see `test/guard-fixtures.ts`) inside temporary directories, so no complete token
pattern is ever committed.

`clean-project/` is scanned as-is by `test/guard-scan.test.ts` and must produce zero
findings.
