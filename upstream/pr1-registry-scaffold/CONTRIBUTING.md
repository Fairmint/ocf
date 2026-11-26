# Contributing to the OCF extension registry

This repository follows
[OCIP-0001](https://github.com/Open-Cap-Table-Coalition/Technical-Working-Group/blob/main/OCIP/proposals/0001-ocf-extension-architecture.md)
(profiles, manifest fields, producer/consumer conformance). The Technical-Working-Group repository is
**private to working-group members**; use the link above if you have access.

## Versioning (POC)

`specs/<id>.md` and `conformance-fixtures/<id>/` are keyed by **profile id**, not by semver folder
(yet). A **new semver** for the same id adds another row in `registry.json` and a new directory
`profiles/<id>/<version>/`. Spec and fixtures may gain version-specific paths in a later registry
format; today, document breaking changes in the spec and add fixtures that target the new version row.

## Before you open a PR

- Read [CHECKLIST.md](./CHECKLIST.md) and use the [pull request template](./.github/pull_request_template.md).
- Confirm your extension **does not change the computed cap table**.
- Use the correct namespace: `ocf.*` for coalition profiles, `com.<vendor>.*` for vendor extensions.
- Pick a **new** id; the registry must not duplicate an existing `(id, version)`.

## Pull request process

1. Branch from `main` with a descriptive name (for example `add-ocf.foo-1.0.0`).
2. Add `profiles/`, `specs/`, `conformance-fixtures/`, update `registry.json`, and wire
   `tests/extension-conformance.test.mjs` with a `validatePackage` hook for your extension.
3. Run `npm test` locally.
4. Open a PR. Address review comments from the Technical Working Group.
5. **Merge** when the checklist passes and lazy consensus is reached.

A merged PR is the coalition working group’s approval to publish that registry row. Adoption into the
core OCF standard is a separate coalition board process.

## Vendor extensions

Vendors may register `com.<vendor>.*` entries with `status: "vendor"`. You are responsible for
semver, backward compatibility, and the economic-effect rule.

## Code of conduct

Follow [Open Cap Table Coalition](https://opencaptablecoalition.com) community expectations in
review and discussion.