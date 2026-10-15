---
ocip: "0001"
title: OCF Extension Architecture — Profiles, Registry, and Conformance
status: Draft
author: Thibauld Favre (thibauld@fairmint.com)
created: "2026-09-22"
type: Standards Track
area: core
---

# OCIP-0001: OCF Extension Architecture — Profiles, Registry, and Conformance

## Abstract

This proposal defines the mechanism by which the Open Cap Format extends beyond its core: a registry
of named, versioned **profiles** and vendor **extensions**, declared in the package manifest,
validated against coalition-governed schemas, and discoverable by consumers. The goal is to keep
Core minimal and stable while allowing specialized facts that do not change the computed cap table
(holder identity, legal evidence, acceptance, and similar annotations) to be standardized without
fragmenting the standard.

## Motivation

The OCF Core proposal (in `OCF-Composed-Schemas`) and the TWG's own gap analysis raise a recurring
question: what happens to fields and transaction types that are not in Core? The current answer — an
undefined "OCF Extended" layer with no schema, no namespacing rules, and no governance — is where
standards fragment. Two vendors inevitably model the same concept differently, both call it an
extension, and interoperability ends at the Core boundary.

This proposal defines the extension mechanism so that:

-   Core stays minimal and stable (it does not grow indefinitely)
-   OCF v1 fields and facts that Core omits can live in named profiles without changing the computed
    cap table (see §5)
-   A consumer can determine what a document contains without parsing every record
-   A producer can claim conformance to a specific profile (e.g., "this document conforms to
    `ocf.transfer-lineage` 1.0.0")
-   The coalition can ratify profiles through the OCIP process and graduate mature ones into Core

The need is concrete: the TWG's own generated inventories (`docs/core-lossy-inventory.md`,
`docs/core-unmapped-inventory.md`) show that 185 OCF properties have no destination in the proposed
Core, and entire categories (acceptances, document references, exemptions, holder identity) land
nowhere. These are not exotic edge cases. They are the daily business of transfer agents, law firms,
and regulated issuers.

Not every gap belongs in a profile. An event that changes holdings, quantities, authorized amounts,
or ownership (an issuance, transfer, cancellation, split, conversion, or pool adjustment) must be
representable in Core. If Core cannot express it today, that is a Core gap, not an extension. A
profile may annotate such an event. It must not be the only record of it.

## Specification

### 1. Definitions

| Term                 | Meaning                                                                                                                                                                                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Core**             | The minimal set of OCF object types, transaction types, and fields that every conformant document must support. Defined and governed by the OCF specification proper.                                                                                                         |
| **Profile**          | A named, versioned, coalition-governed package of additional records that annotate Core without changing the cap table a Core-only consumer computes. Ratified through the OCIP process. Examples: `ocf.holder-identity`, `ocf.acceptance-events`, `ocf.document-references`. |
| **Vendor extension** | A vendor-namespaced set of fields/types produced by a single organization for its own use. Not coalition-governed. Must not collide with profile or Core namespaces.                                                                                                          |
| **Registry**         | The authoritative list of all profiles and their versions, maintained in the OCIP repository. Machine-readable (JSON) and human-readable (this repo's documentation).                                                                                                         |
| **Manifest**         | The top-level file in an OCF package that declares which profiles and vendor extensions the package uses, along with file checksums and schema version.                                                                                                                       |

### 2. Naming and namespacing

**Profile IDs** use a dotted convention:

-   Coalition profiles: `ocf.<name>` (e.g., `ocf.holder-identity`, `ocf.acceptance-events`,
    `ocf.document-references`, `ocf.securities-law-exemptions`)
-   Vendor extensions: `com.<vendor>.<name>` (e.g., `com.fairmint.spv-interests`,
    `com.carta.dividend-details`)

The `ocf.*` namespace is reserved for coalition profiles. An assigned OCIP reserves its `ocf.*` id
from Draft onward, so a registry entry may use that id while its status is `draft` or `review`.
Acceptance is what makes the id a conformance target, not what mints the name. The registry rejects
a coalition profile whose id does not begin with `ocf.`, and it rejects a vendor extension whose id
does not begin with `com.`. A vendor entry with status `vendor` and an id such as
`com.example.dividend-details` is valid. A validator running in standard mode treats a namespace
violation as an error (see §7).

Versioning follows semantic versioning: `MAJOR.MINOR.PATCH`. A profile version is independent of the
Core version, but each profile declares `requires_core` (a semver range) for the minimum Core
version it was authored against.

### 3. The registry

The registry is a single JSON file in the OCIP repository (`registry/profiles.json`) plus rendered
documentation. Top-level `version` is the **registry format version** (not a profile or Core
version). Its structure:

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
            "spec": "proposals/NNNN-holder-of-record-identity.md",
            "requires_core": ">=1.0.0",
            "requires_profiles": [],
            "owner": "coalition",
            "created": "2026-09-22",
            "superseded_by": null
        }
    ]
}
```

Each object in `profiles` has:

| Field               | Required | Description                                                                                                                 |
| ------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------- |
| `id`                | yes      | Dotted profile or vendor extension ID.                                                                                      |
| `version`           | yes      | Semver for this registry row.                                                                                               |
| `status`            | yes      | See lifecycle below.                                                                                                        |
| `schema`            | yes      | Path to this row's JSON Schema.                                                                                             |
| `requires_core`     | yes      | Semver range on Core (see §10).                                                                                             |
| `requires_profiles` | yes      | Array of `{ "id", "version" }` profile dependencies (`version` is a range); `[]` if none.                                   |
| `owner`             | yes      | `coalition` or vendor name.                                                                                                 |
| `title`             | no       | Short human title.                                                                                                          |
| `description`       | no       | One-line summary.                                                                                                           |
| `spec`              | no       | Path to the defining OCIP (`NNNN` in the example is a placeholder).                                                         |
| `created`           | no       | Date the registry row was first added (`YYYY-MM-DD`).                                                                       |
| `superseded_by`     | no       | `null`, or `{ "id", "version" }` of the replacement profile, or `{ "core": true, "version" }` when promoted into Core (§9). |

`status` is one of `draft`, `review`, `accepted`, `deprecated`, `superseded`, `rejected`, `vendor`.
Coalition profiles use the first six. A vendor extension that opts into the registry uses `vendor`
(that status is not an OCIP lifecycle state and is not a conformance target). `rejected` is
terminal: the OCIP was not adopted; the id remains reserved for citation.

A profile that depends on another declares that dependency only here. Example: a later profile that
needs holder identity would carry:

```json
"requires_profiles": [
  { "id": "ocf.holder-identity", "version": ">=1.0.0 <2.0.0" }
]
```

Each `(id, version)` pair is a unique key in the registry; duplicate rows are invalid. The validator
resolves each manifest declaration by looking up the registry row with that exact `id` and that
exact concrete `version` (for example `1.0.0`). It then reads that row's `requires_profiles`. There,
`version` is a semver range, not a registry key. For each dependency the validator finds a manifest
declaration with the same `id` whose concrete version satisfies the range, and confirms that
concrete version has its own registry row. A range such as `>=1.0.0 <2.0.0` is never used as a
lookup key. The validator builds a directed graph of profile ids and rejects a cycle. Dependencies
are frozen with the registry entry for that version.

Old profile versions are never removed from the registry. A profile that has been superseded keeps
its entry with `status: "superseded"` and a pointer to its replacement. This is the IETF property:
OCIP-0001 is always OCIP-0001, and `ocf.holder-identity` 1.0.0 is always `ocf.holder-identity`
1.0.0.

### 4. Package manifest declaration

An OCF package manifest declares which profiles it uses. A package with no profiles is pure Core and
is fully conformant.

This extends the existing manifest in `schema/files/OCFManifestFile.schema.json`. That schema uses
categorized `*_files` arrays whose entries are `{ "filepath", "md5" }`
(`schema/types/File.schema.json`) and sets `additionalProperties: false`. This proposal does not
replace that shape. It adds four optional properties:

-   `profiles` — coalition profiles this package uses
-   `vendor_extensions` — vendor extensions this package uses
-   `profile_files` — coalition profile data files, using the same `{ "filepath", "md5" }` entry as
    every other file array
-   `vendor_extension_files` — vendor extension data files, using that same entry

Core files stay in their existing arrays (`stakeholders_files`, `transactions_files`, and the rest).
Profile files are not mixed into those arrays.

```json
{
    "file_type": "OCF_MANIFEST_FILE",
    "ocf_version": "1.2.1-alpha+main",
    "stakeholders_files": [
        { "filepath": "stakeholders.ocf.json", "md5": "d41d8cd98f00b204e9800998ecf8427e" }
    ],
    "transactions_files": [
        { "filepath": "transactions.ocf.json", "md5": "d41d8cd98f00b204e9800998ecf8427e" }
    ],
    "profiles": [
        { "id": "ocf.holder-identity", "version": "1.0.0" },
        { "id": "ocf.acceptance-events", "version": "1.0.0" }
    ],
    "vendor_extensions": [{ "id": "com.fairmint.spv-interests", "version": "0.1.0" }],
    "profile_files": [
        {
            "filepath": "profiles/ocf.holder-identity/holders.ocf.json",
            "md5": "d41d8cd98f00b204e9800998ecf8427e"
        },
        {
            "filepath": "profiles/ocf.acceptance-events/acceptances.ocf.json",
            "md5": "d41d8cd98f00b204e9800998ecf8427e"
        }
    ],
    "vendor_extension_files": [
        {
            "filepath": "vendor/com.fairmint.spv-interests/interests.ocf.json",
            "md5": "d41d8cd98f00b204e9800998ecf8427e"
        }
    ]
}
```

The snippet omits issuer, timestamps, and the other required Core arrays. A real manifest still
includes them.

-   `profiles` is the list of coalition profiles a consumer should expect. An empty array, or the
    field's absence, means the document is pure Core.
-   `vendor_extensions` lists vendor-specific extensions by id and version.
-   `profile_files` lists only coalition profile data. Each file lives under
    `profiles/<profile-id>/`.
-   `vendor_extension_files` lists vendor payloads, using the same `{ "filepath", "md5" }` entry.
    Each file lives under `vendor/<extension-id>/`. A consumer that does not recognize an extension
    skips the files under that extension's directory. Inline extension data is not allowed, so this
    array is the only place those files are declared.
-   Each coalition profile id and each vendor extension id may appear at most once in its respective
    manifest list (one concrete version per id).
-   Every `filepath` must be relative, normalized (no `..`, no leading `/`), and under
    `profiles/<declared profile id>/` or `vendor/<declared extension id>/` for the id that owns the
    file.
-   Adopting the new properties requires a schema revision that adds them as optional and relaxes
    nothing else. Until that revision ships, a validator enforcing the current schema rejects a
    manifest that includes them. A manifest that omits them remains valid against the current
    schema.

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
    │   └── holders.ocf.json        # extension records referencing stakeholder_id
    └── ocf.acceptance-events/
        └── acceptances.ocf.json    # extension transactions referencing security_id
```

Vendor extension data lives under `vendor/<extension-id>/` and is listed in
`vendor_extension_files`. It is not listed in `profile_files`.

**Cross-reference rule:** extension records reference Core records by their Core ID
(`stakeholder_id`, `security_id`, `transaction_id`). Core records never reference extensions.

**Economic-effect rule.** Separate files and one-way references are necessary, and they are not
sufficient. A profile must not be the only record of a fact that changes holdings, quantities,
authorized amounts, or ownership. Replaying Core transactions alone must produce the same cap table
whether or not profile files are present.

Allowed in a profile:

-   holder identity (tax ids, addresses, structured names)
-   acceptance and other legal-fact events that do not change quantity or ownership
-   document references
-   annotations on an existing Core transaction (the exemption relied on, a transfer correlation id,
    structured consideration)

Not allowed as a profile-only event:

-   issuances, transfers, cancellations, exercises, splits, consolidations, conversions,
    repurchases, and authorized-share or pool adjustments

Those belong in Core. If Core cannot express one of them, that is a Core schema change, not a
profile. A profile may attach metadata to the Core event by id. It may not be the event.

The invariant is a review rule on the profile. A generic validator does not infer economic effect
from arbitrary JSON:

> **A Core-only consumer parsing a document that contains extensions produces the identical Core cap
> table as if the extensions were absent.**

File separation makes Core files byte-identical. The economic-effect rule makes the computed cap
table identical. The TWG does not accept a profile whose records can be the only statement of a
quantity or ownership change. A profile OCIP that needs a machine check states that check
explicitly. The validator runs stated checks. It does not invent them.

### 6. Conformance: producer and consumer

A profile's conformance spec defines two roles:

**Producer conformance.** A system claiming _producer_ conformance to `ocf.holder-identity` 1.0.0
must:

-   Emit all required fields defined by the profile's schema
-   Produce valid JSON against the profile's JSON Schema
-   Ensure all extension records that reference Core records point to IDs that exist in the Core
    files
-   Include the profile declaration in the manifest

**Consumer conformance.** A system claiming _consumer_ conformance to `ocf.holder-identity` 1.0.0
must:

-   Parse every field the profile schema defines
-   Accept a document that contains every producer-required field, without error
-   Not silently drop or misread a field it claims to understand

A system may be a conformant Core producer/consumer without claiming any profile. A system may be a
consumer of a profile without being a producer of it (e.g., a law-firm diligence tool reads
`ocf.document-references` but does not produce it).

A profile's OCIP may mark a field required for producers and optional for a consumer to act on. That
does not relax parsing. A consumer that does not implement the business meaning of such a field must
not drop or misinterpret it when re-exporting the document; read-only tools may ignore fields they
do not use and must not invent a different meaning. The producer claim is "this data is complete for
this profile." The consumer claim is "I accept this profile's documents, and I do not misread the
fields I use."

### 7. Validation levels

The OCF validator operates in three modes:

| Condition                                                                                                                                             | Lenient | **Standard** | Strict   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------------ | -------- |
| Unknown coalition profile in manifest (not in registry)                                                                                               | Warning | **Warning**  | Error    |
| Declared coalition profile, registry `status` not `accepted`                                                                                          | Warning | **Warning**  | Warning¹ |
| Known profile, missing required field                                                                                                                 | Error   | **Error**    | Error    |
| Known profile, schema-invalid extension record                                                                                                        | Error   | **Error**    | Error    |
| Namespace violation (id in `profiles` not starting with `ocf.`, or in `vendor_extensions` not starting with `com.`, including wrong or bare prefixes) | Warning | **Error**    | Error    |
| Unknown vendor extension in manifest (no namespace violation)                                                                                         | Ignored | **Ignored**  | Warning  |
| Declared profile or vendor id with no files in the matching `*_files` array                                                                           | Error   | **Error**    | Error    |
| Profile or vendor file for an id not declared in the manifest                                                                                         | Error   | **Error**    | Error    |
| Missing `requires_profiles` dependency or unmet `requires_core` (§10)                                                                                 | Error   | **Error**    | Error    |
| Circular `requires_profiles` dependency                                                                                                               | Error   | **Error**    | Error    |
| Extension record references a Core id not present in Core files                                                                                       | Error   | **Error**    | Error    |
| Core record references extension (dependency violation)                                                                                               | Error   | **Error**    | Error    |
| Record fails an economic-effect check defined by its profile OCIP                                                                                     | Error   | **Error**    | Error    |

¹ In strict mode, `rejected` is an error; `draft`, `review`, `deprecated`, and `superseded` stay
warnings. Unknown ids are covered by the first row. Namespace violation takes precedence over
unknown vendor when both apply.

The economic-effect rule in §5 is a review invariant on the profile OCIP. A generic validator does
not infer economic effect from arbitrary JSON. When a profile's OCIP defines an explicit semantic
check, the validator runs that check and reports an error in every mode.

**Standard mode is the default.** It is the mode the coalition's reference validator should ship in.
Lenient mode is for forward-compatible parsing (a 2028 document with profiles that don't exist yet
should still load). Strict mode is for regulatory or audit contexts. In strict mode, unknown
coalition profiles and registry rows with status `rejected` are errors; other declared profiles
whose registry status is not `accepted` remain warnings (see table footnote¹); unknown vendor
extensions are warnings, as the table says.

### 8. Profile lifecycle

Profiles follow the same lifecycle as OCIPs:

1. **Draft** — proposed in an OCIP, under review. The profile entry appears in the registry with
   `status: "draft"`. Producers may implement it; consumers should not rely on it for production.
2. **Review** (Last Call) — the OCIP author requests Last Call status. The TWG sets a review window
   (default: 4 weeks). Comments are collected via GitHub issues on the OCIP.
3. **Accepted** — the OCIP is ratified by the TWG. The profile version is marked
   `status: "accepted"` in the registry. Conformance claims against it are now meaningful.
4. **Deprecated** — a newer version or a Core inclusion makes this version obsolete but still
   citable. The registry entry stays; `superseded_by` points to the replacement if one exists.
5. **Superseded** — replaced by a specific newer version. The old version remains in the registry
   forever for citation purposes.
6. **Rejected** — the TWG does not adopt the OCIP. The registry entry keeps `status: "rejected"` so
   the reserved id is not reused. `Draft` or `Review` may end here; `Accepted` may not.

### 9. Graduation to Core

A profile field or type that gains broad adoption (multiple producers, multiple consumers) can be
promoted into Core via a new OCIP. The graduation process:

1. A new OCIP proposes moving specific fields/types from a profile into Core.
2. The OCIP specifies the migration path: how existing documents that declare the profile will still
   be valid (the profile becomes a no-op once its fields are in Core, or the profile version bumps
   with a `superseded_by` pointer).
3. Once accepted, the fields are in Core and the profile row is marked `superseded` with
   `superseded_by`: `{ "core": true, "version": "<core-semver>" }`.

This is the schema.org `pending` → `core` pattern: extensions are the farm system for Core, not a
permanent ghetto.

### 10. Dependency rules

Hard rules, enforced by the validator:

1. **Extensions reference Core by ID.** An extension record may reference `stakeholder_id`,
   `security_id`, or `transaction_id` from Core. Core never references an extension.
2. **Extensions are additive.** An extension may not redefine, override, subtract, or rename a Core
   field or type. It may only add new records that reference Core records.
3. **Profiles do not change the computed cap table.** See the economic-effect rule in §5. That rule
   is enforced when the profile is reviewed. A generic document validator enforces it only when the
   profile OCIP defines an explicit semantic check. A record that fails such a check is an error in
   every mode.
4. **Extensions may depend on other extensions.** Dependencies are declared on the registry entry as
   `requires_profiles` (see §3): an array of `{ "id", "version" }`, where `version` is a semver
   range. The validator checks that the manifest declares a satisfying version of each dependency.
5. **No circular dependencies.** The dependency graph of profile ids is a DAG. The validator rejects
   a cycle.
6. **Core version floor.** Each profile declares `requires_core` as a semver range on its registry
   entry. The validator compares that range to the numeric `MAJOR.MINOR.PATCH` of the document's
   `ocf_version` and ignores prerelease and build metadata. `1.2.1-alpha+main` satisfies `>=1.0.0`.
   If the numeric version does not satisfy the range, the validator reports an error.

### 11. Prerequisite: stable identifiers in Core

This architecture presupposes that Core transaction records carry stable identifiers (`id`) that
extensions can reference. If the proposed Core does not require `id` on transaction types (as is
currently the case in the `OCF-Composed-Schemas` bundle, where zero of the 16 transaction types
carry an `id`), the extension mechanism cannot function. Extension records would have nothing to
point at. That prerequisite is a separate proposal. It is not numbered yet, and this OCIP does not
reserve a number for it. The `requires` front-matter field stays unset until that proposal exists.

## Rationale

### Why separate files, not inline fields

The alternative to separate files is adding extension fields directly to Core records (e.g.,
`Stakeholder.tax_ids` restored inline but "owned" by a profile). This is simpler in the short term
but breaks the graceful-blindness invariant: a Core consumer would need to know which fields to
ignore, and the Core record shape would change as profiles evolve. Separate files with ID joins keep
Core files byte-identical. The economic-effect rule in §5 is what keeps the computed cap table
identical: a profile cannot smuggle a split, transfer, or other quantity-changing event into a file
a Core consumer skips.

This matches OCF v1's existing pattern: `Document` objects with `related_objects` use
`ObjectReference` (`object_type`, `object_id`) to point at Core records; they don't modify the Core
records they evidence.

### Why a registry, not just a convention

OpenAPI's `x-` vendor prefix is the cautionary tale: no registry, no namespacing, no governance.
Every vendor invents its own keys, collisions are common, and no consumer can discover what
`x-fairmint-something` means without reading that vendor's docs. A registry with a naming convention
and a validation rule (standard mode rejects namespace violations) prevents this from the start.

### Why producer/consumer split

Without the split, a vendor can claim "we support extensions" by writing them but not reading them,
or vice versa. The producer/consumer distinction makes conformance claims testable: a producer's
output is validated against the profile schema; a consumer's behavior is validated against a test
suite of profile-conformant documents. This is the IETF "MUST implement" vs. "MUST understand"
distinction.

### Why standard mode as default

Treating an unknown coalition profile as an error would make every new profile a breaking change for
existing validators — the first time anyone ships a document with `ocf.holder-identity`, every
validator that doesn't know it yet would reject the document. Standard mode (unknown profiles are
warnings, known profiles are strictly validated) is forward-compatible: a document from 2028 with
profiles that don't exist yet still loads, and the validator tells the consumer "here's a profile I
don't recognize — look it up in the registry."

### Precedent

| Project              | Mechanism                                                        | What OCF takes from it                                                     |
| -------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Kubernetes           | API groups + CRDs, reserved `k8s.io` namespace                   | Namespaced extensions with first-class validation; reserved core namespace |
| Schema.org           | core / hosted extensions / pending                               | Extensions as the pipeline through which core grows (graduation)           |
| IETF / IANA          | Tiered registries (Standards Action, Expert Review, Private Use) | Registry governance tiers; stable versioning                               |
| JSON Schema 2019-09+ | `$vocabulary`, unknown keywords ignored                          | Graceful blindness as a spec property                                      |
| Ethereum EIPs/ERCs   | Interface standards + `supportsInterface`, status lifecycle      | Composable interfaces, explicit declaration, lifecycle states              |
| OpenAPI `x-`         | Ungoverned vendor fields                                         | The anti-pattern to avoid                                                  |

## Backwards compatibility

A pure-Core OCF document that omits `profiles`, `vendor_extensions`, `profile_files`, and
`vendor_extension_files` stays valid against the current manifest schema. Documents that include
those fields require the schema revision in §4, because `OCFManifestFile` currently sets
`additionalProperties: false`. The revision adds the four properties as optional. It does not rename
`filepath` or `md5`, and it does not replace the categorized `*_files` arrays.

For the proposed OCF Core (the Carta proposal in `OCF-Composed-Schemas`): a gap is a profile
candidate only when ignoring it leaves the computed cap table unchanged (holder identity,
acceptances, document references, exemptions, and similar annotations). A gap that changes holdings
or ownership is a Core change, not a profile.

## Minimal worked example

To demonstrate the shape, here is a minimal profile — `ocf.document-references` — that adds
document-reference objects to an OCF package without touching Core records.

Each profile schema file defines one top-level definition (one JSON object shape per data file
name).

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
                "related_objects": {
                    "type": "array",
                    "items": {
                        "$ref": "https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/types/ObjectReference.schema.json"
                    }
                },
                "document_type": { "type": "string" },
                "description": { "type": "string" }
            },
            "required": ["id", "uri", "related_objects"]
        }
    }
}
```

The schema `$id` URL is illustrative; published profile schemas use the coalition's canonical host.

### Document file (`profiles/ocf.document-references/documents.json`)

```json
{
    "document_references": [
        {
            "id": "doc-001",
            "uri": "https://example.com/stock-purchase-agreement.pdf",
            "sha256": "a1b2c3...",
            "related_objects": [
                { "object_type": "TX_STOCK_ISSUANCE", "object_id": "tx-stock-001" },
                { "object_type": "TX_STOCK_ISSUANCE", "object_id": "tx-stock-002" }
            ],
            "document_type": "stock_purchase_agreement",
            "description": "Series A stock purchase agreement"
        }
    ]
}
```

`sha256` here is the checksum of the referenced legal document. It is not the package-file checksum.
Package files stay `{ "filepath", "md5" }`, as in §4.

### Manifest declaration

```json
{
    "file_type": "OCF_MANIFEST_FILE",
    "profiles": [{ "id": "ocf.document-references", "version": "1.0.0" }],
    "profile_files": [
        {
            "filepath": "profiles/ocf.document-references/documents.json",
            "md5": "d41d8cd98f00b204e9800998ecf8427e"
        }
    ]
}
```

The rest of the manifest (issuer, timestamps, and the required Core `*_files` arrays) is unchanged.
See §4.

A Core-only consumer parses `stakeholders.json`, `securities.json`, `transactions.json`, ignores the
`profiles/` directory, and computes the identical Core cap table. A consumer that declares
`ocf.document-references` conformance additionally loads `documents.json` and can resolve which
documents evidence which securities.

## Open questions for the TWG

1. **Registry governance.** Who approves profile ratification (TWG vote, board vote, lazy
   consensus)? The OCIP process itself should specify this, but it is out of scope for this
   proposal.
2. **Profile granularity.** This proposal defines the mechanism, not the initial set of profiles.
   Later OCIPs, numbered when they are opened, will propose specific profiles. The recommended
   granularity is narrow and composable (`ocf.holder-identity`, `ocf.acceptance-events`,
   `ocf.document-references` as separate profiles) rather than one large transfer-agent profile, so
   that a law firm can adopt document references without also adopting tax-ID fields. A profile that
   would change holdings is out of scope (see §5).
3. **Core version numbering.** Comparison of `requires_core` is defined in §10: numeric
   `MAJOR.MINOR.PATCH`, with prerelease and build metadata ignored. What a Core version number means
   still belongs in the Core specification.

## References

-   `OCF-Composed-Schemas/docs/core-lossy-inventory.md` — generated inventory of lossy mappings (46
    rows, 32 OCF-required)
-   `OCF-Composed-Schemas/docs/core-unmapped-inventory.md` — generated inventory of unmapped OCF
    properties (185 distinct, 166 OCF-required)
-   `OCF-Composed-Schemas/docs/carta-schema-refresh-2026-06-22.md` — refresh notes including the
    `lengthUnit: MONTH` constraint and missing rounding convention
-   `OCF-Composed-Schemas/target-schema/Explainer.md` — Carta's reader's guide, including §3.8 on
    materialized vesting quantities and the rounding selector the standard does not expose
-   `OCF-Composed-Schemas/core/core-ledger.md` — generated admissibility ledger showing which OCF
    types are currently admissible into strict Core
-   `schema/files/OCFManifestFile.schema.json` — current manifest (`additionalProperties: false`,
    categorized `*_files` arrays)
-   `schema/types/File.schema.json` — package file reference (`filepath`, `md5`)

## Status

This OCIP is in **Draft** status. It has not been ratified by the Technical Working Group. Comments
are welcome via GitHub issues on this proposal.
