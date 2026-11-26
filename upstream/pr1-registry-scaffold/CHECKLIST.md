# Extension PR quality gate

Use this checklist for every pull request that adds or updates a registry row. Reviewers should
verify each item manually (human-checkable gates).

## Identity and design

-   [ ] Extension id matches namespace: `ocf.*` (coalition) or `com.<vendor>.*` (vendor).
-   [ ] No duplicate `(id, version)` in `registry.json`.
-   [ ] Scope is **small and composable** (single clear purpose; dependencies declared in
        `requires_profiles`).
-   [ ] Spec explains what is annotated and explicitly states **no economic effect** on the cap
        table.

## Schema

-   [ ] `profiles/<id>/<version>/schema.json` uses JSON Schema **draft-07**.
-   [ ] Record types use `additionalProperties: false` unless the spec documents otherwise.
-   [ ] `$ref` to OCF types use stable `$id` URIs; validators resolve them from the OCF bundle for
        `ocf_version`.

## Sample data and validation

-   [ ] At least one sample payload validates against the profile schema (included in fixtures).
-   [ ] Sample data runs through the OCF reference validator when the profile is declared on a
        package (schema + manifest + semantic rules).

## Conformance fixtures

Under `conformance-fixtures/<id>/`:

-   [ ] **`base/`** — minimal valid OCF package without the profile.
-   [ ] **`with-profiles/`** (OCIP-0001 §6.1) or **`with-profile/`** in this POC — manifest declares
        the profile and lists `profile_files` (or `expected.json` lists overlays explicitly).
-   [ ] **`compatible/`** — scenarios that **pass** validation; each includes `expected.json`
        (`error_codes`: `[]`).
-   [ ] **`invalid/`** — scenarios that **fail** with documented error codes in `expected.json`.
-   [ ] **`expected/`** (optional) — snapshots such as cap-table equivalence when applicable.

Fixture automation must pass in CI (`npm test` in this repository). The local harness is required
now; the coalition reference validator should load this registry once the optional
`--include-draft-extensions` flag ships.

## Registry row

-   [ ] `registry.json` row includes required fields: `id`, `version`, `status`, `schema`,
        `requires_ocf`, `min_ocf_version`, `requires_profiles`, `owner`.
-   [ ] `status` is appropriate (`draft` / `review` until TWG acceptance, then `accepted`).
-   [ ] `schema` and `spec` paths match files in the PR.

## Producer and consumer conformance

-   [ ] **Producer**: declaring the profile in the manifest with matching `profile_files` validates.
-   [ ] **Consumer**: compatible fixtures pass in `standard` mode; invalid fixtures emit the
        documented codes (including profile-specific semantic errors when defined).

## Non-goals

-   [ ] PR does **not** change core OCF schema or validator defaults.
-   [ ] PR does **not** relocate OCIP governance proposals into this repo.
