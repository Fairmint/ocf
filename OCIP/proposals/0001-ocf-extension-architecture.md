---
ocip: 0001
title: OCF Extension Architecture — Profiles, Registry, and Conformance
status: Draft
author: Thibauld Favre (thibauld@fairmint.com)
created: 2026-09-22
type: Standards Track
area: core
requires: stable identifiers on transaction records (see "Prerequisite" section)
---

# OCIP-0001: OCF Extension Architecture — Profiles, Registry, and Conformance

## Abstract

This proposal defines the mechanism by which the Open Cap Format extends beyond its core: a registry of named, versioned **profiles** and vendor **extensions**, declared in the package manifest, validated against coalition-governed schemas, and discoverable by consumers. The goal is to keep Core minimal and stable while allowing specialized use cases (transfer agency, legal evidence, corporate actions, SPV interests, tokenized securities) to be standardized without fragmenting the standard.

## Motivation

The OCF Core proposal (in `OCF-Composed-Schemas`) and the TWG's own gap analysis raise a recurring question: what happens to fields and transaction types that are not in Core? The current answer — an undefined "OCF Extended" layer with no schema, no namespacing rules, and no governance — is where standards fragment. Two vendors inevitably model the same concept differently, both call it an extension, and interoperability ends at the Core boundary.

This proposal defines the extension mechanism so that:
- Core stays minimal and stable (it does not grow indefinitely)
- Everything OCF v1 carries that Core doesn't is preserved in a standardized home
- A consumer can determine what a document contains without parsing every record
- A producer can claim conformance to a specific profile (e.g., "this document conforms to `ocf.transfer-lineage` 1.0.0")
- The coalition can ratify profiles through the OCIP process and graduate mature ones into Core

The need is concrete: the TWG's own generated inventories (`docs/core-lossy-inventory.md`, `docs/core-unmapped-inventory.md`) show that 185 OCF properties have no destination in the proposed Core, and entire transaction categories (acceptances, splits, document references, exemptions) land nowhere. These are not exotic edge cases — they are the daily business of transfer agents, law firms, and regulated issuers.

## Specification

### 1. Definitions

| Term | Meaning |
|---|---|
| **Core** | The minimal set of OCF object types, transaction types, and fields that every conformant document must support. Defined and governed by the OCF specification proper. |
| **Profile** | A named, versioned, coalition-governed package of additional object types, transaction types, and/or fields that extend Core. Ratified through the OCIP process. Examples: `ocf.holder-identity`, `ocf.acceptance-events`, `ocf.transfer-lineage`. |
| **Vendor extension** | A reverse-DNS-namespaced set of fields/types produced by a single organization for its own use. Not coalition-governed. Must not collide with profile or Core namespaces. |
| **Registry** | The authoritative list of all profiles and their versions, maintained in the OCIP repository. Machine-readable (JSON) and human-readable (this repo's documentation). |
| **Manifest** | The top-level file in an OCF package that declares which profiles and vendor extensions the package uses, along with file checksums and schema version. |

### 2. Naming and namespacing

**Profile IDs** use a dotted convention:

- Coalition profiles: `ocf.<name>` (e.g., `ocf.holder-identity`, `ocf.acceptance-events`, `ocf.transfer-lineage`, `ocf.corporate-actions`, `ocf.document-references`, `ocf.securities-law-exemptions`)
- Vendor extensions: `com.<vendor>.<name>` (e.g., `com.fairmint.spv-interests`, `com.carta.dividend-details`)

The `ocf.*` namespace is reserved. The registry rejects any profile that begins with `com.` or that claims the `ocf.` prefix without ratification. Vendor extensions must not use the `ocf.` prefix under any circumstances; a validator running in standard mode treats a namespace violation as an error (see §7).

Versioning follows semantic versioning: `MAJOR.MINOR.PATCH`. A profile version is independent of the Core version, but each profile declares a `requires` field specifying the minimum Core version it was authored against.

### 3. The registry

The registry is a single JSON file in the OCIP repository (`registry/profiles.json`) plus rendered documentation. Its structure:

```json
{
  "version": "1.0.0",
  "profiles": [
    {
      "id": "ocf.holder-identity",
      "version": "1.0.0",
      "status": "accepted",
      "title": "Holder-of-Record Identity",
      "description": "Tax IDs, address history, structured names for regulated interchange.",
      "schema": "profiles/ocf.holder-identity/1.0.0/schema.json",
      "spec": "proposals/0002-holder-of-record-identity.md",
      "requires_core": ">=1.0.0",
      "owner": "coalition",
      "created": "2026-09-22",
      "superseded_by": null
    }
  ]
}
```

A profile entry in the registry contains:

- `id` — the dotted profile ID
- `version` — semver
- `status` — one of `draft`, `review`, `accepted`, `deprecated`, `superseded`
- `schema` — path to the JSON Schema for this profile's types
- `spec` — path to the OCIP that defines it
- `requires_core` — minimum Core version
- `owner` — `coalition` for ratified profiles; a vendor name for vendor extensions (vendor extensions appear in the registry with `status: "vendor"` and are not reviewed)
- `superseded_by` — if deprecated/superseded, the ID+version that replaces it (or `null`)

Old profile versions are never removed from the registry. A profile that has been superseded keeps its entry with `status: "superseded"` and a pointer to its replacement. This is the IETF property: OCIP-0001 is always OCIP-0001, and `ocf.holder-identity` 1.0.0 is always `ocf.holder-identity` 1.0.0.

### 4. Package manifest declaration

An OCF package manifest declares which profiles it uses. A package with no profiles is pure Core and is fully conformant.

```json
{
  "ocf_version": "1.0.0",
  "profiles": [
    { "id": "ocf.holder-identity", "version": "1.0.0" },
    { "id": "ocf.acceptance-events", "version": "1.0.0" }
  ],
  "vendor_extensions": [
    { "id": "com.fairmint.spv-interests", "version": "0.1.0" }
  ],
  "files": [
    { "path": "stakeholders.json", "sha256": "..." },
    { "path": "securities.json", "sha256": "..." },
    { "path": "transactions.json", "sha256": "..." },
    { "path": "profiles/ocf.holder-identity/holders.json", "sha256": "..." },
    { "path": "profiles/ocf.acceptance-events/acceptances.json", "sha256": "..." }
  ]
}
```

Key properties:

- `profiles` is an array of declared coalition profiles. A consumer reads this array to know what to expect.
- `vendor_extensions` is an array of vendor-specific extensions. Consumers who don't recognize a vendor extension skip it (graceful blindness).
- `files` includes Core files and profile-specific files. Profile files live under a `profiles/<profile-id>/` directory in the package.
- An empty `profiles` array (or the field's absence) means the document is pure Core.

### 5. File placement and cross-references

**Profile data lives in separate files, never inline in Core records.**

```
my-cap-table.ocf/
├── manifest.json
├── stakeholders.json          # Core — unchanged by any profile
├── stock_plans.json           # Core
├── securities.json            # Core
├── transactions.json          # Core
├── valuations.json            # Core
├── documents.json             # Core (if document-references profile is ratified into Core)
└── profiles/
    ├── ocf.holder-identity/
    │   └── holder_records.json   # extension records referencing stakeholder_id
    └── ocf.acceptance-events/
        └── acceptances.json      # extension transactions referencing security_id
```

**Cross-reference rule:** extension records reference Core records by their Core ID (`stakeholder_id`, `security_id`, `transaction_id`). Core records never reference extensions. This guarantees the invariant:

> **A Core-only consumer parsing a document that contains extensions produces the identical Core cap table as if the extensions were absent.**

This is the graceful-blindness property. It holds by construction (separate files, one-directional references), not by discipline.

### 6. Conformance: producer and consumer

A profile's conformance spec defines two roles:

**Producer conformance.** A system claiming *producer* conformance to `ocf.holder-identity` 1.0.0 must:
- Emit all required fields defined by the profile's schema
- Produce valid JSON against the profile's JSON Schema
- Ensure all extension records that reference Core records point to IDs that exist in the Core files
- Include the profile declaration in the manifest

**Consumer conformance.** A system claiming *consumer* conformance to `ocf.holder-identity` 1.0.0 must:
- Correctly parse and interpret all fields defined by the profile's schema
- Handle all required fields without error
- Not silently drop or misinterpret required extension fields

A system may be a conformant Core producer/consumer without claiming any profile. A system may be a consumer of a profile without being a producer of it (e.g., a law-firm diligence tool reads `ocf.document-references` but does not produce it).

A profile's OCIP specifies which fields are required for producer conformance vs. recommended for consumer conformance. This split exists because producing a document is a stronger claim than reading one: a producer asserts "this data is correct and complete for this profile," while a consumer asserts "I will not break if this data is present."

### 7. Validation levels

The OCF validator operates in three modes:

| Condition | Lenient | **Standard** | Strict |
|---|---|---|---|
| Unknown profile in manifest (not in registry) | Warning | **Warning** | Error |
| Known profile, missing required field | Error | **Error** | Error |
| Known profile, schema-invalid extension record | Error | **Error** | Error |
| Namespace violation (`ocf.*` used by vendor) | Warning | **Error** | Error |
| Unknown vendor extension in manifest | Ignored | **Ignored** | Warning |
| Core record references extension (dependency violation) | Error | **Error** | Error |

**Standard mode is the default.** It is the mode the coalition's reference validator should ship in. Lenient mode is for forward-compatible parsing (a 2028 document with profiles that don't exist yet should still load). Strict mode is for regulatory or audit contexts where any undeclared extension is a rejection.

### 8. Profile lifecycle

Profiles follow the same lifecycle as OCIPs:

1. **Draft** — proposed in an OCIP, under review. The profile entry appears in the registry with `status: "draft"`. Producers may implement it; consumers should not rely on it for production.
2. **Review** (Last Call) — the OCIP author requests Last Call status. The TWG sets a review window (default: 4 weeks). Comments are collected via GitHub issues on the OCIP.
3. **Accepted** — the OCIP is ratified by the TWG. The profile version is marked `status: "accepted"` in the registry. Conformance claims against it are now meaningful.
4. **Deprecated** — a newer version or a Core inclusion makes this version obsolete but still citable. The registry entry stays; `superseded_by` points to the replacement if one exists.
5. **Superseded** — replaced by a specific newer version. The old version remains in the registry forever for citation purposes.

### 9. Graduation to Core

A profile field or type that gains broad adoption (multiple producers, multiple consumers) can be promoted into Core via a new OCIP. The graduation process:

1. A new OCIP proposes moving specific fields/types from a profile into Core.
2. The OCIP specifies the migration path: how existing documents that declare the profile will still be valid (the profile becomes a no-op once its fields are in Core, or the profile version bumps with a `superseded_by` pointer).
3. Once accepted, the fields are in Core and the profile is marked `superseded` in the registry.

This is the schema.org `pending` → `core` pattern: extensions are the farm system for Core, not a permanent ghetto.

### 10. Dependency rules

Hard rules, enforced by the validator:

1. **Extensions reference Core by ID.** An extension record may reference `stakeholder_id`, `security_id`, or `transaction_id` from Core. Core never references an extension.
2. **Extensions are additive.** An extension may not redefine, override, subtract, or rename a Core field or type. It may only add new records that reference Core records.
3. **Extensions may depend on other extensions.** A profile may declare `requires_profiles` in its schema (e.g., `ocf.transfer-lineage` might require `ocf.holder-identity`). The validator checks that all declared dependencies are present in the manifest.
4. **No circular dependencies.** The dependency graph is a DAG; the validator rejects cycles.
5. **Core version floor.** Each profile declares `requires_core`. If the document's `ocf_version` is below the floor, the validator reports an error.

### 11. Prerequisite: stable identifiers in Core

This architecture presupposes that Core transaction records carry stable identifiers (`id`) that extensions can reference. If the proposed Core does not require `id` on transaction types (as is currently the case in the `OCF-Composed-Schemas` bundle, where zero of the 16 transaction types carry an `id`), the extension mechanism cannot function — extension records would have nothing to point at. This is addressed by the companion proposal for stable identifiers (OCIP-0002, draft).

## Rationale

### Why separate files, not inline fields

The alternative to separate files is adding extension fields directly to Core records (e.g., `Stakeholder.tax_ids` restored inline but "owned" by a profile). This is simpler in the short term but breaks the graceful-blindness invariant: a Core consumer would need to know which fields to ignore, and the Core record shape would change as profiles evolve. Separate files with ID joins guarantee that Core files are byte-identical with or without extensions — the invariant holds by construction, not by discipline.

This matches OCF v1's existing pattern: `Document` objects with `related_objects` reference Core records by ID; they don't modify the Core records they evidence.

### Why a registry, not just a convention

OpenAPI's `x-` vendor prefix is the cautionary tale: no registry, no namespacing, no governance. Every vendor invents its own keys, collisions are common, and no consumer can discover what `x-fairmint-something` means without reading that vendor's docs. A registry with a naming convention and a validation rule (standard mode rejects namespace violations) prevents this from the start.

### Why producer/consumer split

Without the split, a vendor can claim "we support extensions" by writing them but not reading them, or vice versa. The producer/consumer distinction makes conformance claims testable: a producer's output is validated against the profile schema; a consumer's behavior is validated against a test suite of profile-conformant documents. This is the IETF "MUST implement" vs. "MUST understand" distinction.

### Why standard mode as default

Strict mode (any undeclared extension is an error) would make every new profile a breaking change for existing validators — the first time anyone ships a document with `ocf.holder-identity`, every validator that doesn't know it yet would reject the document. Standard mode (unknown profiles are warnings, known profiles are strictly validated) is forward-compatible: a document from 2028 with profiles that don't exist yet still loads, and the validator tells the consumer "here's a profile I don't recognize — look it up in the registry."

### Precedent

| Project | Mechanism | What OCF takes from it |
|---|---|---|
| Kubernetes | API groups + CRDs, reserved `k8s.io` namespace | Namespaced extensions with first-class validation; reserved core namespace |
| Schema.org | core / hosted extensions / pending | Extensions as the pipeline through which core grows (graduation) |
| IETF / IANA | Tiered registries (Standards Action, Expert Review, Private Use) | Registry governance tiers; stable versioning |
| JSON Schema 2019-09+ | `$vocabulary`, unknown keywords ignored | Graceful blindness as a spec property |
| Ethereum EIPs/ERCs | Interface standards + `supportsInterface`, status lifecycle | Composable interfaces, explicit declaration, lifecycle states |
| OpenAPI `x-` | Ungoverned vendor fields | The anti-pattern to avoid |

## Backwards compatibility

This proposal is additive to OCF v1's existing manifest and file structure. A pure-Core OCF v1 document (no `profiles` array in the manifest, no `profiles/` directory) is fully conformant under this specification. The `profiles` and `vendor_extensions` fields in the manifest are optional; their absence means the document is Core-only.

For the proposed OCF Core v2 (the Carta proposal in `OCF-Composed-Schemas`): the extension mechanism is the designated home for everything the gap analysis shows as unmapped or lossy. Each gap in `docs/core-unmapped-inventory.md` and `docs/core-lossy-inventory.md` becomes a candidate for a profile, with the profile's OCIP documenting what it carries and why.

## Minimal worked example

To demonstrate the shape, here is a minimal profile — `ocf.document-references` — that adds document-reference objects to an OCF package without touching Core records.

### Profile schema (`profiles/ocf.document-references/1.0.0/schema.json`)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://opencaptablecoalition.com/profiles/ocf.document-references/1.0.0/schema.json",
  "title": "OCF Document References Profile 1.0.0",
  "type": "object",
  "properties": {
    "document_references": {
      "type": "array",
      "items": { "$ref": "#/$defs/DocumentReference" }
    }
  },
  "required": ["document_references"],
  "$defs": {
    "DocumentReference": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "uri": { "type": "string", "format": "uri" },
        "sha256": { "type": "string" },
        "related_object_ids": {
          "type": "array",
          "items": { "type": "string" }
        },
        "document_type": { "type": "string" },
        "description": { "type": "string" }
      },
      "required": ["id", "uri", "related_object_ids"]
    }
  }
}
```

### Document file (`profiles/ocf.document-references/documents.json`)

```json
{
  "document_references": [
    {
      "id": "doc-001",
      "uri": "https://example.com/stock-purchase-agreement.pdf",
      "sha256": "a1b2c3...",
      "related_object_ids": ["sec-001", "sec-002"],
      "document_type": "stock_purchase_agreement",
      "description": "Series A stock purchase agreement"
    }
  ]
}
```

### Manifest declaration

```json
{
  "ocf_version": "1.0.0",
  "profiles": [
    { "id": "ocf.document-references", "version": "1.0.0" }
  ]
}
```

A Core-only consumer parses `stakeholders.json`, `securities.json`, `transactions.json`, ignores the `profiles/` directory, and computes the identical Core cap table. A consumer that declares `ocf.document-references` conformance additionally loads `documents.json` and can resolve which documents evidence which securities.

## Open questions for the TWG

1. **Registry governance.** Who approves profile ratification (TWG vote, board vote, lazy consensus)? The OCIP process itself should specify this, but it is out of scope for this proposal.
2. **Profile granularity.** This proposal defines the mechanism, not the initial set of profiles. Companion OCIPs (OCIP-0002 onward) will propose specific profiles. The recommended granularity is narrow and composable (e.g., `ocf.holder-identity`, `ocf.acceptance-events`, `ocf.transfer-lineage` as separate profiles) rather than one large `ocf.transfer-agent` profile, so that a law firm can adopt `ocf.document-references` without also adopting tax-ID fields.
3. **Core version floor syntax.** This proposal uses `>=1.0.0` but does not define the Core versioning scheme (that belongs in the Core specification itself).
4. **Vendor extension registry.** Should vendor extensions be registered (discoverable but not reviewed) or entirely unregistered? Registration aids discovery; unregistered is simpler but risks collisions. Standard-mode validation treats unknown vendor extensions as ignored either way.

## References

- `OCF-Composed-Schemas/docs/core-lossy-inventory.md` — generated inventory of lossy mappings (46 rows, 32 OCF-required)
- `OCF-Composed-Schemas/docs/core-unmapped-inventory.md` — generated inventory of unmapped OCF properties (185 distinct, 166 OCF-required)
- `OCF-Composed-Schemas/docs/carta-schema-refresh-2026-06-22.md` — refresh notes including the `lengthUnit: MONTH` constraint and missing rounding convention
- `OCF-Composed-Schemas/target-schema/Explainer.md` — Carta's reader's guide, including §3.8 on materialized vesting quantities and the rounding selector the standard does not expose
- `OCF-Composed-Schemas/core/core-ledger.md` — generated admissibility ledger showing which OCF types are currently admissible into strict Core

## Status

This OCIP is in **Draft** status. It has not been ratified by the Technical Working Group. Comments are welcome via GitHub issues on this proposal.
