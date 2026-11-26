## Summary

<!-- What extension (id @ version) does this PR add or update, and why? -->

## Registry row

-   **Id:**
-   **Version:**
-   **Status:** draft | review | accepted | vendor
-   **Namespace:** ocf._ | com.&lt;vendor&gt;._

## Quality gate (CHECKLIST.md)

### Identity and design

-   [ ] Correct namespace (`ocf.*` or `com.<vendor>.*`)
-   [ ] No duplicate `(id, version)`
-   [ ] Small, composable scope; dependencies in `requires_profiles` if any
-   [ ] Spec documents **no economic effect** on the cap table

### Schema and data

-   [ ] draft-07 schema under `profiles/<id>/<version>/schema.json`
-   [ ] Sample payload validates; runs through reference validator with profile declared

### Conformance fixtures

-   [ ] `base/`, profile overlay, `compatible/*`, `invalid/*` with `expected.json`
-   [ ] Fixture tests pass (`extensions-registry-draft-conformance` or upstream equivalent)

### Registry

-   [ ] `registry.json` updated; paths match this PR
-   [ ] Producer/consumer behavior verified per CHECKLIST.md

## Testing

<!-- Commands run and results -->

## Notes for reviewers

<!-- Dependencies, open questions, links to OCIP issues -->
