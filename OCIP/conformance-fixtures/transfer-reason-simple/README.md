# transfer-reason-simple (OCIP-0001)

Golden-style layout aligned with
[OCF-Composed-Schemas#312](https://github.com/Open-Cap-Table-Coalition/OCF-Composed-Schemas/issues/312).
Full suites live in that repository; this directory holds one worked example in-tree.

| Path             | Purpose                                                                   |
| ---------------- | ------------------------------------------------------------------------- |
| `base/`          | Plain OCF v1 package (no profile declarations)                            |
| `with-profiles/` | Same OCF `*.ocf.json` payloads plus `profiles/` and manifest declarations |
| `expected/`      | Cap-table snapshot from `base/` only (economic-effect check)              |
| `invalid/*/`     | One broken package per §7 error code; each has `expected.json`            |

Run: `npm test -- utils/conformance-fixtures.test.mjs`
