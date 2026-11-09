# transfer-reason-simple (OCIP-0001)

Golden-style layout aligned with
[OCF-Composed-Schemas#312](https://github.com/Open-Cap-Table-Coalition/OCF-Composed-Schemas/issues/312).
Full suites live in that repository; this directory is one worked in-tree example.

## Layout (overlay model)

| Path                 | Contents                                                                                                             |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `base/`              | **Full** plain OCF v1 package (`*.ocf.json` only; no profiles)                                                       |
| `with-profiles/`     | **Overlay only:** `Manifest.ocf.json` + `profiles/` (merged onto `base/` by the harness)                             |
| `expected/`          | Hand-authored cap-table **fingerprint** derived from `base/` transactions (see below)                                |
| `compatible/<case>/` | **Overlay only** + `expected.json` (positive, e.g. manifest `ocf_version` `1.2.0` on `base/`)                        |
| `invalid/<case>/`    | **Overlay only** (files that differ from `with-profiles/` after merge) + `expected.json` (`error_codes`)             |
| `warnings/<case>/`   | **Overlay only** + `expected.json` (`warning_codes`; economic case uses test-only `ocf.fixtures.economic-heuristic`) |

The test harness (`utils/conformance-fixture-harness.mjs`) materializes a temp package:

1. Copy `base/`
2. Apply `with-profiles/` overlay (if testing profiles)
3. Apply `invalid/<case>/` or `warnings/<case>/` overlay

Only changed paths are stored under overlays — not a full copy of the eight-file package per case.

## Checks

1. **Economic effect (package level)** — Non-manifest `*.ocf.json` files in
   `materialize("with-profiles")` are byte-identical to `base/`. Profiles are additive on disk only.
2. **`expected/cap_table_snapshot.json`** — Jest extracts issuer id + `TX_STOCK_TRANSFER` quantities
   from OCF transaction files (not a cap-table engine) and asserts equality with this file and
   between `base` and `with-profiles`.
3. **Invalid / warning overlays** — Extension validator stable codes
   (`utils/conformance-fixtures.test.mjs`).

Run: `npm test -- utils/conformance-fixtures.test.mjs`

Report CLI: `node utils/report-package-validation.mjs <package-dir>`
