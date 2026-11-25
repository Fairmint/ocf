# OCF extension registry (draft staging)

This tree is a **staging copy** of the Open Cap Table Coalition repository
[`Open-Cap-Table-Coalition/OCF-Extensions-DRAFT`](https://github.com/Open-Cap-Table-Coalition/OCF-Extensions-DRAFT)
(agreed at the OCF TWG). It lives temporarily in [Fairmint/ocf](https://github.com/Fairmint/ocf)
under `extensions-registry-draft/` so maintainers can review the layout before it is ported
upstream.

The registry holds **extensions only**. Normative governance text (for example
[OCIP-0001: OCF extension architecture](https://github.com/Fairmint/ocf/blob/main/OCIP/proposals/0001-ocf-extension-architecture.md))
stays in the OCIP / OCF specification repositories.

## Purpose

-   Publish versioned **coalition profiles** (`ocf.*`) and optional **vendor extensions**
    (`com.<vendor>.*`).
-   Give producers and consumers a single machine-readable index (`registry.json`) and JSON Schemas
    for each `(id, version)` pair.
-   Supply conformance fixtures so the OCF reference validator can test draft extensions without
    changing core OCF behavior.

## Naming

| Kind              | ID pattern            | Example                     | Governance                                        |
| ----------------- | --------------------- | --------------------------- | ------------------------------------------------- |
| Coalition profile | `ocf.<name>`          | `ocf.stock-hold`            | Coalition PR review + checklist                   |
| Vendor extension  | `com.<vendor>.<name>` | `com.example.internal-tags` | Vendor-maintained; registered for discoverability |

The `ocf.*` namespace is reserved for coalition profiles. Vendor IDs **must** use the `com.` prefix.
Validators treat namespace violations as errors in standard mode (OCIP-0001 §2).

## Repository layout

```
registry.json              # Index of all extensions (profiles array per OCIP-0001)
registry.schema.json       # JSON Schema for registry.json
profiles/<id>/<version>/schema.json
specs/<id>.md              # Human-readable specification (optional per row)
conformance-fixtures/<id>/ # base, with-profile, compatible/, invalid/
```

OCF packages declare extensions in the manifest using `profiles`, `profile_files`,
`vendor_extensions`, and `vendor_extension_files` (see OCIP-0001 §4). Profile payload files use a
`.json` suffix and live under `profiles/<profile-id>/` inside the **OCF package**, not inside this
registry repo.

## Lifecycle and approval

Registry row `status` follows OCIP-0001 §8:

| Status                                   | Meaning                                                                |
| ---------------------------------------- | ---------------------------------------------------------------------- |
| `draft`                                  | Under proposal; safe for experimentation                               |
| `review`                                 | Last call / TWG review window                                          |
| `accepted`                               | Merged PR met the quality checklist; conformance claims are meaningful |
| `deprecated` / `superseded` / `rejected` | As defined in OCIP-0001                                                |

**Approval of an extension** in this repository is a **merged pull request** that satisfies
[CHECKLIST.md](./CHECKLIST.md). That records coalition agreement on the schema and fixtures.

**Adoption into the OCF standard** (for example graduation of fields into the core schema) is a
separate decision for the coalition board and OCIP process—not implied by `accepted` here.

Vendor rows may use `status: "vendor"`; they are not OCIP lifecycle states and are not coalition
conformance targets.

## How to propose an extension

1. Open an issue (optional) describing the non-economic fact you need and the proposed `ocf.*` or
   `com.<vendor>.*` id.
2. Fork / branch, add:
    - `profiles/<id>/<version>/schema.json` (draft-07, `additionalProperties: false` on record
      types)
    - `specs/<id>.md` or link from your vendor docs
    - `conformance-fixtures/<id>/` with `base/`, `with-profile/` (or equivalent), `compatible/*`,
      `invalid/*`
    - A new row in `registry.json`
3. Open a pull request. The [PR template](./.github/pull_request_template.md) embeds the checklist.
4. Maintainers merge when the checklist passes and TWG/TSC review is complete for coalition
   profiles.

Keep extensions **small, composable, and Unix-style**: one clear job, explicit dependencies in
`requires_profiles`, no duplicate ids.

## How validators consume this registry

The coalition **reference validator** (today in `Open-Cap-Format-OCF` / Fairmint OCIP work) will
gain an **optional** flag (proposed name: `--include-draft-extensions`) to:

1. Fetch `registry.json` from this repository over HTTPS (default branch or release tag).
2. Resolve each manifest declaration to a registry row and load `schema` paths relative to the
   registry root.
3. Validate profile payloads and any profile-specific semantic rules defined in the spec.

Default behavior **without** the flag is unchanged: only the in-tree OCIP registry (accepted paths)
or no network access. See
[UPSTREAM_ISSUE_validator-draft-extensions.md](./UPSTREAM_ISSUE_validator-draft-extensions.md).

## Running conformance tests (Fairmint staging)

From the parent `ocf` repository root:

```bash
node extensions-registry-draft/scripts/run-conformance-fixtures.mjs
```

Or `npm test -- --testPathPattern=extensions-registry-draft-conformance`.
