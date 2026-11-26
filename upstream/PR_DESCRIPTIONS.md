# Upstream pull request descriptions (OCF-Extensions-DRAFT)

Paste each block into GitHub when opening PRs against
[`Open-Cap-Table-Coalition/OCF-Extensions-DRAFT`](https://github.com/Open-Cap-Table-Coalition/OCF-Extensions-DRAFT).

---

## PR 1 — Registry scaffold

**Title:** Establish extension registry layout, checklist, and CI

### Summary

This replaces the placeholder README with the **full root layout** for the coalition’s public extension
registry. The repository will hold versioned coalition profiles (`ocf.*`) and vendor extensions
(`com.<vendor>.*`)—not OCIP governance proposals (those remain in
[Technical-Working-Group/OCIP](https://github.com/Open-Cap-Table-Coalition/Technical-Working-Group)).

### What’s included

| Area | Purpose |
| ---- | ------- |
| `README.md` | Purpose, naming, TWG lazy-consensus approval via merged PR + checklist, board adoption separate, validator consumption via optional future flag |
| `CONTRIBUTING.md` / `CHECKLIST.md` | How to propose extensions and human-checkable quality gates |
| `.github/pull_request_template.md` | Embeds the checklist in every PR |
| `registry.json` + `registry.schema.json` | Machine-readable index (empty `profiles` array to start) |
| `lib/` + `tests/` | Validates the registry index and runs conformance for each registered extension (no-op with zero rows) |
| `.github/workflows/ci.yml` | `npm test` on every PR |

### Why this helps

- **Predictable layout** for validators to fetch over HTTPS (`registry.json`, `profiles/<id>/<version>/schema.json`, fixtures).
- **Clear approval model**: merged PR after the checklist = Technical Working Group approval by lazy consensus; coalition board still owns standard adoption.
- **CI from day one** so the first real extension PR cannot skip registry validation or fixture automation.

### Testing

```bash
npm install
npm test
```

All tests pass with an empty registry (schema self-check only).

### Follow-up

**PR 2** stacks on this branch and adds the first coalition profile, `ocf.stock-hold` 1.0.0.

---

## PR 2 — `ocf.stock-hold` 1.0.0

**Title:** Add coalition profile `ocf.stock-hold` 1.0.0 (stop-transfer and settlement holds)

**Base branch:** merge **PR 1** first, then open this PR against the updated `main`.

### Summary

Adds the first **real** registry row: `ocf.stock-hold`, for transfer-agent **stop-transfer** and
**register/settlement** holds on stock securities. The profile annotates existing `security_id` rows
without changing computed ownership—aligned with
[OCIP-0001](https://github.com/Open-Cap-Table-Coalition/Technical-Working-Group/blob/main/OCIP/proposals/0001-ocf-extension-architecture.md)
and discussed at the OCF TWG.

### What’s included

| Area | Location |
| ---- | -------- |
| Registry row (`status: draft`) | `registry.json` |
| JSON Schema (draft-07) | `profiles/ocf.stock-hold/1.0.0/schema.json` |
| Spec | `specs/ocf.stock-hold.md` |
| Conformance fixtures | `conformance-fixtures/ocf.stock-hold/` (`base`, `with-profile`, `compatible/`, `invalid/`) |
| Standalone semantic validator | `lib/validate-profile-stock-hold.mjs` (no external Fairmint dependencies) |
| OCF package validation | `lib/validate-ocf-package.mjs`, `lib/validate-extensions.mjs` |
| Pinned OCF schemas | `vendor/ocf-schema-pin.json`, `scripts/fetch-ocf-schemas.mjs`, [OCF_SCHEMA_PIN.md](./OCF_SCHEMA_PIN.md) |

### Semantic rules enforced

Stable error codes include `stock_hold_stop_quantity_forbidden`, `stock_hold_orphan_cancellation`,
`stock_hold_double_cancellation`, `stock_hold_cancellation_wrong_security`,
`stock_hold_settlement_over_quantity`, `stock_hold_terminal_during_stop`, and related closure rules
documented in the spec.

### OCF schema pin

Tests fetch
[Open-Cap-Table-Coalition/Open-Cap-Format-OCF](https://github.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF) at
a **pinned commit** and apply the small `vendor/ocip-pending/` overlay so manifests can declare
`profiles` and `profile_files` per OCIP-0001 until those fields ship in a tagged OCF release.

### Testing

```bash
npm install   # runs fetch-ocf-schemas via prepare
npm test
```

**9 tests:** registry index schema check; one compatible lifecycle fixture; seven invalid scenarios with expected error codes.

### Benefits

- Gives TA workflows a **standard, validatable** place for hold annotations instead of unstructured comments or proprietary sidecars.
- Supplies **golden fixtures** for the reference validator’s future `--include-draft-extensions` mode.
- Keeps core OCF behavior unchanged: ignoring the profile still yields the same cap table.

### Stack

Depends on **PR 1** (registry scaffold). Do not merge before the layout and CI from PR 1 are on `main`.