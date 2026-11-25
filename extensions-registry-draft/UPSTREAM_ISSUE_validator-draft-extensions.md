# GitHub issue (paste into Open-Cap-Table-Coalition/Open-Cap-Format-OCF)

**Title:** Optional validator flag to load draft extensions from OCF-Extensions-DRAFT

## Summary

The coalition is standing up **OCF-Extensions-DRAFT**, a public registry repository for versioned
coalition profiles (`ocf.*`) and vendor extensions (`com.<vendor>.*`). Each row points at JSON
Schemas and conformance fixtures; approval is a merged PR in that repo gated by a published
checklist.

Today the reference validator loads a small in-tree registry (OCIP). We need an **opt-in** path to
also load **draft and review** extensions from the new registry over HTTPS, without changing default
validation behavior for existing packages.

## Motivation

-   TWG wants producers to implement and test draft profiles (for example `ocf.stock-hold`) before
    acceptance.
-   The extension registry layout is predictable: root `registry.json`,
    `profiles/<id>/<version>/schema.json`.
-   Fetching schemas at validate time matches how consumers will discover extensions in the wild.

## Proposed behavior

1. Add a CLI / API flag, suggested name: **`--include-draft-extensions`** (bikeshed welcome).
2. When set, the validator:
    - Downloads `registry.json` from the configured registry URL (default: the public
      `OCF-Extensions-DRAFT` repo raw content on the default branch or a pinned tag).
    - Merges or overrides registry lookups for declared manifest profiles (exact `(id, version)`
      rows).
    - Resolves each row's `schema` path relative to the registry repository root (same as today for
      in-tree paths).
    - Runs existing profile validation: JSON Schema, manifest cross-checks, economic-effect
      advisory, and profile-specific semantic hooks where implemented.
3. **Default off** — without the flag, behavior is identical to current releases (in-tree registry
   only; no network requirement).

## Non-goals

-   No change to core OCF schema validation or cap-table computation.
-   No automatic trust of vendor extensions beyond today's vendor rules.
-   This issue does not propose merging draft rows into the OCIP `profiles.json` in the main repo.

## Requirements

-   Registry repository must be **public** (HTTPS raw URLs).
-   Support pinning via environment variable or CLI URL (for CI reproducibility).
-   Clear errors when the registry is unreachable or a declared `(id, version)` is missing.

## Open questions

1. **Manifest fields in core OCF** — OCIP-0001 adds `profiles`, `profile_files`,
   `vendor_extensions`, and `vendor_extension_files` to the manifest. Should the next minor OCF
   schema release include those properties formally, or should validators continue to treat them as
   extension-layer fields validated only when present? (This issue assumes validation hooks already
   exist in OCIP work; clarify target minor.)

2. **Registry format version** — `registry.json` includes a top-level `version` for the index format
   itself. Should the validator require an exact match, or tolerate newer index versions with a
   warning?

3. **Caching** — should CI cache registry downloads by ETag/sha, or always fetch fresh?

## References

-   OCIP-0001 extension architecture (profiles, manifest, conformance modes).
-   Staged registry layout and first profile `ocf.stock-hold` (Fairmint staging PR in
    `extensions-registry-draft/`).

Happy to help test an implementation against the draft fixtures once the flag exists.
