# OCF Extensions (DRAFT)

Public registry of versioned **coalition profiles** (`ocf.*`) and **vendor extensions**
(`com.<vendor>.*`) for the [Open Cap Format](https://opencaptablecoalition.com). Each entry
ships a JSON Schema, human-readable spec, and conformance fixtures.

Normative architecture:
[OCIP-0001: OCF extension architecture](https://github.com/Open-Cap-Table-Coalition/Technical-Working-Group/blob/main/OCIP/proposals/0001-ocf-extension-architecture.md)
(the Technical-Working-Group repository is currently **private to working-group members**; use
that link if you have access).

## Purpose

- Let producers declare standardized, namespaced cap-table **annotations** that do not change
  computed ownership.
- Give consumers a predictable index (`registry.json`) and schema paths for validation.
- Gate quality through pull requests and a published checklist—not ad hoc sidecar JSON.

## Naming

| Kind | ID pattern | Example |
| ---- | ---------- | ------- |
| Coalition profile | `ocf.<name>` | `ocf.stock-hold` |
| Vendor extension | `com.<vendor>.<name>` | `com.example.transfer-tags` |

Coalition ids must use `ocf.*`. Vendor ids must use `com.<vendor>.*`.

## Repository layout

```
registry.json              # Index (profiles array per OCIP-0001)
registry.schema.json
profiles/<id>/<version>/schema.json
specs/<id>.md
conformance-fixtures/<id>/   # base, with-profile(s), compatible/, invalid/, warnings/
```

Packages declare extensions in the OCF manifest (`profiles`, `profile_files`, `vendor_extensions`,
`vendor_extension_files`) as defined in OCIP-0001.

**Fixture overlays (POC).** OCIP-0001 §6.1 names `with-profiles/`; this repository currently uses
`with-profile/` as the default profile overlay in several fixtures. The conformance runner accepts
either name. Prefer `with-profiles/` for new extensions.

## Approval and adoption

| Milestone | Meaning |
| --------- | ------- |
| **Merged PR in this repo** | Technical Working Group **approval by lazy consensus** after the [quality checklist](./CHECKLIST.md) passes. The registry row becomes the coalition’s published definition for that `(id, version)`. |
| **Coalition board adoption** | Separate decision to treat an extension as part of the **standard** (for example graduation into the core OCF schema via OCIP). Registry `accepted` does not by itself change the OCF specification. |

## Contract for validators

- A published **`(id, version)` row is immutable**. To change behavior, ship a **new version** (or
  supersede the row); do not rewrite history for an existing version.
- Validators and CI should load `registry.json` and schemas from a **pinned git tag or commit SHA**,
  not from a floating `main` ref.
- A profile schema’s **`$id` URI is a stable identifier**, not a live download URL. Reference
  validators resolve OCF type `$ref`s from the OCF schema bundle pinned for that run.

## Validator consumption

The OCF **reference validator** will support an optional flag (for example `--include-draft-extensions`)
to load `registry.json` from this repository over HTTPS, resolve schema paths, and validate profile
payloads. Default validator behavior remains unchanged when the flag is off.

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Every extension PR must satisfy [CHECKLIST.md](./CHECKLIST.md).

Extension conformance in this repo is enforced by `npm test`; each extension PR must wire
`validatePackage` in `tests/extension-conformance.test.mjs` (see PR 2 for an example).

## Tests

```bash
npm install
npm test
```

CI runs `registry.json` schema and invariant checks, then each registered extension’s fixtures via
`tests/extension-conformance.test.mjs`. OCF packages validate against a pinned
[Open-Cap-Format-OCF](https://github.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF) tree; see
[OCF_SCHEMA_PIN.md](./OCF_SCHEMA_PIN.md).