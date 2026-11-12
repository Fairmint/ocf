# `profile_economic_violation` warning overlay

Exercises **`profile_economic_violation`** (§5 advisory) only — no schema errors.

Uses test-only profile **`ocf.fixtures.economic-heuristic`** (see
`profiles/ocf.fixtures.economic-heuristic/README.md`), **not** `ocf.transfer-reason`.

Materializes on **`base/` only** (see `expected.json` `overlays`) so undeclared profile files from
`with-profiles` do not appear on disk.
