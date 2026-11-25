# Contributing to the OCF extension registry

Thank you for helping extend OCF in a controlled, interoperable way. This repository follows
[OCIP-0001](https://github.com/Fairmint/ocf/blob/main/OCIP/proposals/0001-ocf-extension-architecture.md)
(profiles, manifest fields, producer/consumer conformance).

## Before you open a PR

-   Read [CHECKLIST.md](./CHECKLIST.md) and copy its items into your PR description (the GitHub
    template does this automatically).
-   Confirm your extension **does not change the computed cap table** (no sole record of economic
    events; advisory economic-field checks must pass or be explicitly exempted in the spec with
    validator support).
-   Use the correct namespace: `ocf.*` for coalition profiles, `com.<vendor>.*` for vendor
    extensions.
-   Pick a **new** id; the registry must not duplicate an existing `(id, version)`.

## Pull request process

1. **Branch** from the default branch with a descriptive name (`add-ocf.foo-1.0.0`).
2. **Add artifacts** under `profiles/`, `specs/`, `conformance-fixtures/`, and one `registry.json`
   row.
3. **Run fixtures** locally (see [README.md](./README.md#running-conformance-tests-fairmint-staging)
   when staged in Fairmint/ocf).
4. **Open a PR** against the default branch. Address review comments.
5. **Merge** when maintainers confirm the checklist and coalition review (for `ocf.*`).

Merged PRs are the approval gate for registry rows. Board-level standard adoption is out of band.

## Vendor extensions

Vendors may register `com.<vendor>.*` entries with `status: "vendor"`. You are responsible for
semver, backward compatibility, and the economic-effect rule. Coalition validators may warn on
unknown vendor ids but need not implement your semantics unless documented in a shared spec.

## Code of conduct

Follow the [Open Cap Table Coalition](https://opencaptablecoalition.com) community expectations in
discussions and review.
