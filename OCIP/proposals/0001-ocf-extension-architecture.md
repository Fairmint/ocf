---
ocip: "0001"
title: OCF Extension Architecture — Profiles, Registry, and Conformance
status: Draft
author: Thibauld Favre (thibauld@fairmint.com)
created: "2026-09-22"
type: Standards Track
area: governance
---

# OCIP-0001: OCF Extension Architecture — Profiles, Registry, and Conformance

## Abstract

This proposal defines the mechanism by which the Open Cap Format extends beyond **the OCF schema**
(see §1): a registry of named, versioned **profiles** and vendor **extensions**, declared in the
package manifest, validated against coalition-governed schemas, and discoverable by consumers. The
goal is to let the published OCF schema evolve in a controlled way while standardized, namespaced
facts that do not change the computed cap table can be declared, validated, and exchanged without
every vendor inventing ad hoc fields. The same mechanism also applies when the base is derived from
the OCF Core projection; see §11.

## Motivation

OCF v1 already gives issuers, stakeholders, transactions, documents with `related_objects`,
free-text `comments`, and open-ended types such as `CustomConversionMechanism`. Those escape hatches
are not enough for interoperable extensions: comments are unstructured and unvalidated; custom
mechanisms are unnamespaced and undeclared; ad hoc fields on otherwise valid objects are invisible
to consumers and validators. In practice, transfer agents and software vendors either overload
`comments` or add proprietary JSON beside the standard files — and nothing in the package tells a
consumer what to expect or how to validate it.

This proposal defines the extension mechanism so that:

-   The OCF schema can stay stable while specialized, non-economic facts live in named profiles
-   A consumer can determine what a document contains without parsing every record
-   A producer can claim conformance to a specific profile (e.g., "this document conforms to
    `ocf.transaction-annotations` 1.0.0")
-   The coalition can ratify profiles through the OCIP process and graduate mature ones into the OCF
    schema (see §9)

Not every gap belongs in a profile. An event that changes holdings, quantities, authorized amounts,
or ownership (an issuance, transfer, cancellation, split, conversion, or pool adjustment) must be
represented in the OCF schema. If the schema cannot express it today, that is a schema change, not
an extension. A profile may annotate such an event. It must not be the only record of it.

**Carta Core** is Carta's cap-table standard. **OCF Core** is the generated OCF-shaped schema bundle
in `OCF-Composed-Schemas`, derived from Carta Core. Neither is the same artifact as OCF v1.x; §11
states when this architecture applies to documents built on the OCF Core projection.

## Specification

### 1. Definitions

| Term                 | Meaning                                                                                                                                                                                                                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The OCF schema**   | The published Open Cap Format JSON Schema bundle identified by `ocf_version` in the package manifest (currently OCF v1.x). Governed by the OCF specification proper.                                                                                                                           |
| **Profile**          | A named, versioned, coalition-governed package of additional records that annotate OCF schema objects without changing the cap table a consumer of the OCF schema alone computes. Ratified through the OCIP process. Examples: `ocf.transaction-annotations`, `ocf.securities-law-exemptions`. |
| **Vendor extension** | A vendor-namespaced set of fields/types produced by a single organization for its own use. Not coalition-governed. Must not collide with profile or OCF schema namespaces.                                                                                                                     |
| **Registry**         | The authoritative list of all profiles and their versions, maintained in the OCIP repository. Machine-readable (JSON) and human-readable (this repo's documentation).                                                                                                                          |
| **Manifest**         | The top-level file in an OCF package that declares which profiles and vendor extensions the package uses, along with file checksums and schema version.                                                                                                                                        |

### 2. Naming and namespacing

**Profile IDs** use a dotted convention:

-   Coalition profiles: `ocf.<name>` (e.g., `ocf.transaction-annotations`,
    `ocf.securities-law-exemptions`)
-   Vendor extensions: `com.<vendor>.<name>` (e.g., `com.example.dividend-details`,
    `com.carta.internal-metadata`)

The `ocf.*` namespace is reserved for coalition profiles. An assigned OCIP reserves its `ocf.*` id
from Draft onward, so a registry entry may use that id while its status is `draft` or `review`.
Acceptance is what makes the id a conformance target, not what mints the name. The registry rejects
a coalition profile whose id does not begin with `ocf.`, and it rejects a vendor extension whose id
does not begin with `com.`. A vendor entry with status `vendor` and an id such as
`com.example.dividend-details` is valid. A validator running in standard mode treats a namespace
violation as an error (see §7).

Versioning follows semantic versioning: `MAJOR.MINOR.PATCH`. A profile version is independent of the
OCF schema release, but each profile declares `requires_ocf` (a semver range) for the minimum OCF
schema version it was authored against. The document's `ocf_version` is pinned to a specific schema
release; numeric `MAJOR.MINOR.PATCH` comparison still applies (see §10).

### 3. The registry

The registry is a single JSON file in the OCIP repository (`registry/profiles.json`) plus rendered
documentation. Top-level `version` is the **registry format version** (not a profile or OCF schema
version). Its structure:

```json
{
    "version": "1.0.0",
    "profiles": [
        {
            "id": "ocf.transaction-annotations",
            "version": "1.0.0",
            "status": "accepted",
            "title": "Transaction annotations",
            "description": "Structured, non-economic metadata attached to OCF transactions by id.",
            "schema": "profiles/ocf.transaction-annotations/1.0.0/schema.json",
            "spec": "proposals/NNNN-transaction-annotations.md",
            "requires_ocf": ">=1.0.0",
            "requires_profiles": [],
            "owner": "coalition",
            "created": "2026-09-22",
            "superseded_by": null
        }
    ]
}
```

Each object in `profiles` has:

| Field               | Required | Description                                                                                                                          |
| ------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `id`                | yes      | Dotted profile or vendor extension ID.                                                                                               |
| `version`           | yes      | Semver for this registry row.                                                                                                        |
| `status`            | yes      | See lifecycle below.                                                                                                                 |
| `schema`            | yes      | Path to this row's JSON Schema.                                                                                                      |
| `requires_ocf`      | yes      | Semver range on OCF schema releases only (`ocf_version`; see §10).                                                                   |
| `requires_profiles` | yes      | Array of `{ "id", "version" }` profile dependencies (`version` is a range); `[]` if none.                                            |
| `owner`             | yes      | `coalition` or vendor name.                                                                                                          |
| `title`             | no       | Short human title.                                                                                                                   |
| `description`       | no       | One-line summary.                                                                                                                    |
| `spec`              | no       | Path to the defining OCIP (`NNNN` in the example is a placeholder).                                                                  |
| `created`           | no       | Date the registry row was first added (`YYYY-MM-DD`).                                                                                |
| `superseded_by`     | no       | `null`, or `{ "id", "version" }` of the replacement profile, or `{ "ocf": true, "version" }` when promoted into the OCF schema (§9). |

`status` is one of `draft`, `review`, `accepted`, `deprecated`, `superseded`, `rejected`, `vendor`.
Coalition profiles use the first six. A vendor extension that opts into the registry uses `vendor`
(that status is not an OCIP lifecycle state and is not a conformance target). `rejected` is
terminal: the OCIP was not adopted; the id remains reserved for citation.

A profile that depends on another declares that dependency only here. Example: a later profile that
needs transaction annotations would carry:

```json
"requires_profiles": [
  { "id": "ocf.transaction-annotations", "version": ">=1.0.0 <2.0.0" }
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
OCIP-0001 is always OCIP-0001, and `ocf.transaction-annotations` 1.0.0 is always
`ocf.transaction-annotations` 1.0.0.

### 4. Package manifest declaration

An OCF package manifest declares which profiles it uses. A package with no profile declarations is
fully conformant to the OCF schema.

This extends the existing manifest in `schema/files/OCFManifestFile.schema.json`. That schema uses
categorized `*_files` arrays whose entries are `{ "filepath", "md5" }`
(`schema/types/File.schema.json`) and sets `additionalProperties: false`. This proposal does not
replace that shape. It adds four optional properties:

-   `profiles` — coalition profiles this package uses
-   `vendor_extensions` — vendor extensions this package uses
-   `profile_files` — coalition profile data files, using the same `{ "filepath", "md5" }` entry as
    every other file array
-   `vendor_extension_files` — vendor extension data files, using that same entry

OCF schema files stay in their existing arrays (`stakeholders_files`, `transactions_files`,
`documents_files`, and the rest). Profile and vendor extension files are not mixed into those
arrays.

The coalition reference validator (`utils/validate.mjs`) recursively validates every `*.ocf.json`
file in the package. Profile and vendor payload files must therefore use a plain `.json` suffix (not
`.ocf.json`), so they are discovered only via `profile_files` and `vendor_extension_files`.

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
    "profiles": [{ "id": "ocf.transaction-annotations", "version": "1.0.0" }],
    "vendor_extensions": [{ "id": "com.example.internal-tags", "version": "0.1.0" }],
    "profile_files": [
        {
            "filepath": "profiles/ocf.transaction-annotations/annotations.json",
            "md5": "d41d8cd98f00b204e9800998ecf8427e"
        }
    ],
    "vendor_extension_files": [
        {
            "filepath": "vendor/com.example.internal-tags/tags.json",
            "md5": "d41d8cd98f00b204e9800998ecf8427e"
        }
    ]
}
```

The snippet omits issuer, timestamps, and the other required OCF schema file arrays. A real manifest
still includes them.

-   `profiles` is the list of coalition profiles a consumer should expect. An empty array, or the
    field's absence, means the package uses only the OCF schema (no declared profiles).
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
-   Adopting the new properties requires a **minor** OCF v1.x schema revision that adds them as
    optional and relaxes nothing else. Until that revision ships, a validator enforcing the current
    schema rejects a manifest that includes them. A manifest that omits them remains valid against
    the current schema.

### 5. File placement and cross-references

**Profile data lives in separate files, never inline in OCF schema records.**

```
my-cap-table.ocf/
├── manifest.json
├── stakeholders.ocf.json          # OCF schema — unchanged by any profile
├── stock_plans.ocf.json           # OCF schema
├── stock_issuances.ocf.json       # OCF schema (example transaction file)
├── documents.ocf.json             # OCF schema — v1 documents_files
└── profiles/
    └── ocf.transaction-annotations/
        └── annotations.json       # extension records; .json not .ocf.json (see §4)
```

Vendor extension data lives under `vendor/<extension-id>/` and is listed in
`vendor_extension_files`. It is not listed in `profile_files`.

**Cross-reference rule:** extension records reference OCF schema objects by stable `id`, typically
via `ObjectReference` (`object_type`, `object_id`) as defined in v1. OCF schema records never
reference extensions.

**Economic-effect rule.** Separate files and one-way references are necessary, and they are not
sufficient. A profile must not be the only record of a fact that changes holdings, quantities,
authorized amounts, or ownership. A consumer of the OCF schema alone — replaying only OCF schema
transactions and objects — must produce the same cap table whether or not profile files are present.

Allowed in a profile:

-   structured metadata on an existing transaction (review notes, internal workflow tags,
    correlation ids) that does not change quantity or ownership
-   holder identity or legal-fact annotations where the base schema does not already model them
    structurally
-   document and evidence links that do not substitute for cap-table events
-   securities-law and similar annotations on an existing event

Not allowed as a profile-only event:

-   issuances, transfers, cancellations, exercises, splits, consolidations, conversions,
    repurchases, and authorized-share or pool adjustments

Those belong in the OCF schema. If the schema cannot express one of them, that is an OCF schema
change, not a profile. A profile may attach metadata to the schema event by id. It may not be the
event.

The invariant is a review rule on the profile. A generic validator does not infer economic effect
from arbitrary JSON:

> **A consumer of the OCF schema alone, parsing a document that contains extensions, produces the
> identical cap table as if the extensions were absent.**

File separation keeps OCF schema files byte-identical. The economic-effect rule keeps the computed
cap table identical. The TWG does not accept a profile whose records can be the only statement of a
quantity or ownership change. A profile OCIP that needs a machine check states that check
explicitly. The validator runs stated checks. It does not invent them.

### 6. Conformance: producer and consumer

A profile's conformance spec defines two roles:

**Producer conformance.** A system claiming _producer_ conformance to `ocf.transaction-annotations`
1.0.0 must:

-   Emit all required fields defined by the profile's schema
-   Produce valid JSON against the profile's JSON Schema
-   Ensure all extension records that reference OCF schema objects point to `id` values that exist
    in the OCF schema files
-   Include the profile declaration in the manifest

**Consumer conformance.** A system claiming _consumer_ conformance to `ocf.transaction-annotations`
1.0.0 must:

-   Parse every field the profile schema defines
-   Accept a document that contains every producer-required field, without error
-   Not silently drop or misread a field it claims to understand

A system may be a conformant OCF schema producer/consumer without claiming any profile. A system may
be a consumer of a profile without being a producer of it (e.g., a diligence tool reads
`ocf.transaction-annotations` but does not produce it).

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
| Missing `requires_profiles` dependency or unmet `requires_ocf` (§10)                                                                                  | Error   | **Error**    | Error    |
| Circular `requires_profiles` dependency                                                                                                               | Error   | **Error**    | Error    |
| Extension record references an `object_id` (or other id) with no matching `object_type` and id in OCF schema files (ids are unique per type)          | Error   | **Error**    | Error    |
| OCF schema record references extension (dependency violation)                                                                                         | Error   | **Error**    | Error    |
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
4. **Deprecated** — a newer version or inclusion in the OCF schema makes this version obsolete but
   still citable. The registry entry stays; `superseded_by` points to the replacement if one exists.
5. **Superseded** — replaced by a specific newer version. The old version remains in the registry
   forever for citation purposes.
6. **Rejected** — the TWG does not adopt the OCIP. The registry entry keeps `status: "rejected"` so
   the reserved id is not reused. `Draft` or `Review` may end here; `Accepted` may not.

### 9. Graduation into the OCF schema

A profile field or type that gains broad adoption (multiple producers, multiple consumers) can be
promoted into the OCF schema via a **later OCIP** (not numbered here). The graduation process:

1. That OCIP proposes moving specific fields/types from a profile into the OCF schema.
2. The OCIP specifies the migration path: how existing documents that declare the profile will still
   be valid (the profile becomes a no-op once its fields are in the schema, or the profile version
   bumps with a `superseded_by` pointer).
3. Once accepted, the fields are in the OCF schema and the profile row is marked `superseded` with
   `superseded_by`: `{ "ocf": true, "version": "<ocf-semver>" }`.

This is the schema.org `pending` → core pattern applied to the OCF schema: extensions are the farm
system for future schema releases, not a permanent ghetto.

### 10. Dependency rules

Hard rules, enforced by the validator:

1. **Extensions reference OCF schema objects by ID.** An extension record may reference objects via
   `ObjectReference` or other typed joins defined by the profile schema. OCF schema objects never
   reference an extension.
2. **Extensions are additive.** An extension may not redefine, override, subtract, or rename an OCF
   schema field or type. It may only add new records that reference OCF schema objects.
3. **Profiles do not change the computed cap table.** See the economic-effect rule in §5. That rule
   is enforced when the profile is reviewed. A generic document validator enforces it only when the
   profile OCIP defines an explicit semantic check. A record that fails such a check is an error in
   every mode.
4. **Extensions may depend on other extensions.** Dependencies are declared on the registry entry as
   `requires_profiles` (see §3): an array of `{ "id", "version" }`, where `version` is a semver
   range. The validator checks that the manifest declares a satisfying version of each dependency.
5. **No circular dependencies.** The dependency graph of profile ids is a DAG. The validator rejects
   a cycle.
6. **OCF schema version floor.** Each profile declares `requires_ocf` as a semver range scoped to
   **OCF schema releases only**. The validator compares that range to the numeric
   `MAJOR.MINOR.PATCH` of the document's `ocf_version` and ignores prerelease and build metadata.
   `1.2.1-alpha+main` satisfies `>=1.0.0`. If the numeric version does not satisfy the range, the
   validator reports an error.

### 11. Compatibility with the OCF Core projection

**Carta Core** is Carta's cap-table standard. **OCF Core** is the generated OCF-shaped JSON Schema
bundle in `OCF-Composed-Schemas`, derived from Carta Core. OCF v1.x is a separate published schema
(`ocf_version`). This extension architecture is **built for OCF v1** as it evolves; the same
mechanism also applies to packages whose base is the **OCF Core** projection when all of the
following hold:

(a) Every base record carries a required stable `id` that extensions can target. OCF v1 already
requires `id` on objects and transactions (`schema/primitives/objects/Object.schema.json`). The OCF
Core bundle currently omits `id` on its sixteen transaction types.

(b) The package manifest can carry the four declarations in §4 or an equivalent hook so consumers
know which profiles and vendor extensions are present.

(c) Extension records can reference base objects through a typed join (`ObjectReference` in v1, or
an equivalent in the base).

(d) `requires_ocf` applies only to OCF schema releases (`ocf_version`). A package whose base is the
OCF Core projection would need its own base identifier and version source for profile dependencies;
a later (unnumbered) proposal will define that mechanism. This OCIP does not add a base-family field
to the registry.

(e) Consumers that implement only the base ignore unrecognized files outside the base's declared
file arrays, as v1 consumers ignore undeclared paths.

(f) Every event that changes holdings, quantities, or ownership stays in the base, never only in a
profile. Cap-table-affecting fields that the OCF Core projection drops from OCF v1 would have to
return to the base — not move into profiles.

Non-economic data the OCF Core projection omits relative to OCF v1 (holder identity, acceptances,
document references, and similar annotations) are natural profile candidates when the base is OCF
Core.

## Rationale

### Why separate files, not inline fields

The alternative to separate files is adding extension fields directly to OCF schema records. This is
simpler in the short term but breaks the graceful-blindness invariant: a base-only consumer would
need to know which fields to ignore, and the record shape would change as profiles evolve. Separate
files with ID joins keep OCF schema files byte-identical. The economic-effect rule in §5 is what
keeps the computed cap table identical: a profile cannot smuggle a split, transfer, or other
quantity-changing event into a file a base-only consumer skips.

This matches OCF v1's existing pattern: `Document` objects with `related_objects` use
`ObjectReference` (`object_type`, `object_id`) to point at schema objects; they do not modify those
objects.

### Why `comments` and custom types are not enough

Free-text `comments` and open types such as `CustomConversionMechanism` let producers stash opaque
data without a coalition id, schema, or manifest declaration. They are useful for human notes and
one-off deals; they are not a substitute for namespaced, versioned, validatable extension records.

### Why a registry, not just a convention

OpenAPI's `x-` vendor prefix is the cautionary tale: no registry, no namespacing, no governance.
Every vendor invents its own keys, collisions are common, and no consumer can discover what
`x-example-something` means without reading that vendor's docs. A registry with a naming convention
and a validation rule (standard mode rejects namespace violations) prevents this from the start.

### Why producer/consumer split

Without the split, a vendor can claim "we support extensions" by writing them but not reading them,
or vice versa. The producer/consumer distinction makes conformance claims testable: a producer's
output is validated against the profile schema; a consumer's behavior is validated against a test
suite of profile-conformant documents. This is the IETF "MUST implement" vs. "MUST understand"
distinction.

### Why standard mode as default

Treating an unknown coalition profile as an error would make every new profile a breaking change for
existing validators — the first time anyone ships a document with `ocf.transaction-annotations`,
every validator that does not know it yet would reject the document. Standard mode (unknown profiles
are warnings, known profiles are strictly validated) is forward-compatible: a document from 2028
with profiles that do not exist yet still loads, and the validator tells the consumer "here's a
profile I don't recognize — look it up in the registry."

### Precedent

| Project              | Mechanism                                                        | What OCF takes from it                                                     |
| -------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Kubernetes           | API groups + CRDs, reserved `k8s.io` namespace                   | Namespaced extensions with first-class validation; reserved core namespace |
| Schema.org           | core / hosted extensions / pending                               | Extensions as the pipeline through which the schema grows (graduation)     |
| IETF / IANA          | Tiered registries (Standards Action, Expert Review, Private Use) | Registry governance tiers; stable versioning                               |
| JSON Schema 2019-09+ | `$vocabulary`, unknown keywords ignored                          | Graceful blindness as a spec property                                      |
| Ethereum EIPs/ERCs   | Interface standards + `supportsInterface`, status lifecycle      | Composable interfaces, explicit declaration, lifecycle states              |
| OpenAPI `x-`         | Ungoverned vendor fields                                         | The anti-pattern to avoid                                                  |

## Backwards compatibility

An OCF v1 document that omits `profiles`, `vendor_extensions`, `profile_files`, and
`vendor_extension_files` stays valid against the current manifest schema. Documents that include
those fields require the minor v1.x schema revision in §4, because `OCFManifestFile` currently sets
`additionalProperties: false`. The revision adds the four properties as optional. It does not rename
`filepath` or `md5`, and it does not replace the categorized `*_files` arrays.

## Minimal worked example

OCF v1 already models documents, stakeholder identity, and many transaction fields. To show a gap
profiles are for, here is a minimal coalition profile — `ocf.transaction-annotations` — that adds
structured, non-economic metadata on transactions via `ObjectReference`.

Each profile schema file defines one top-level definition (one JSON object shape per data file
name).

### Profile schema (`profiles/ocf.transaction-annotations/1.0.0/schema.json`)

```json
{
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://opencaptablecoalition.com/profiles/ocf.transaction-annotations/1.0.0/schema.json",
    "title": "OCF Transaction Annotations Profile 1.0.0",
    "type": "object",
    "properties": {
        "transaction_annotations": {
            "type": "array",
            "items": { "$ref": "#/$defs/TransactionAnnotation" }
        }
    },
    "required": ["transaction_annotations"],
    "$defs": {
        "TransactionAnnotation": {
            "type": "object",
            "properties": {
                "id": { "type": "string" },
                "target": {
                    "allOf": [
                        {
                            "$ref": "https://raw.githubusercontent.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/main/schema/types/ObjectReference.schema.json"
                        },
                        {
                            "type": "object",
                            "properties": {
                                "object_type": { "type": "string", "pattern": "^TX_" }
                            },
                            "required": ["object_type"]
                        }
                    ]
                },
                "annotation_type": { "type": "string" },
                "body": { "type": "string" }
            },
            "required": ["id", "target", "annotation_type"]
        }
    }
}
```

The schema `$id` URL is illustrative; published profile schemas use the coalition's canonical host.

### Profile data file (`profiles/ocf.transaction-annotations/annotations.json`)

```json
{
    "transaction_annotations": [
        {
            "id": "ann-001",
            "target": { "object_type": "TX_STOCK_ISSUANCE", "object_id": "tx-stock-001" },
            "annotation_type": "internal_review",
            "body": "Counsel sign-off recorded 2026-03-15; no cap-table effect."
        }
    ]
}
```

### Manifest declaration

```json
{
    "file_type": "OCF_MANIFEST_FILE",
    "profiles": [{ "id": "ocf.transaction-annotations", "version": "1.0.0" }],
    "profile_files": [
        {
            "filepath": "profiles/ocf.transaction-annotations/annotations.json",
            "md5": "d41d8cd98f00b204e9800998ecf8427e"
        }
    ]
}
```

The rest of the manifest (issuer, timestamps, and the required OCF schema `*_files` arrays) is
unchanged. See §4.

A consumer of the OCF schema alone parses the transaction files, ignores `profiles/`, and computes
the identical cap table. A consumer that declares `ocf.transaction-annotations` conformance
additionally loads `annotations.json` and can resolve structured metadata per transaction.

## Open questions for the TWG

1. **Registry governance.** Who approves profile ratification (TWG vote, board vote, lazy
   consensus)? The OCIP process itself should specify this, but it is out of scope for this
   proposal.
2. **Profile granularity.** This proposal defines the mechanism, not the initial set of profiles.
   Later OCIPs, numbered when they are opened, will propose specific profiles. The recommended
   granularity is narrow and composable rather than one large transfer-agent profile, so adopters
   can pick profiles independently. A profile that would change holdings is out of scope (see §5).
3. **OCF schema version numbering.** Comparison of `requires_ocf` is defined in §10: numeric
   `MAJOR.MINOR.PATCH`, with prerelease and build metadata ignored. What an `ocf_version` string
   denotes for a given release still belongs in the OCF specification.

## References

-   `Open-Cap-Format-OCF/schema/files/OCFManifestFile.schema.json` — current manifest
    (`additionalProperties: false`, categorized `*_files` arrays including `documents_files`)
-   `Open-Cap-Format-OCF/schema/types/File.schema.json` — package file reference (`filepath`, `md5`)
-   `Open-Cap-Format-OCF/schema/types/ObjectReference.schema.json` — typed reference to schema
    objects by `object_type` and `object_id`
-   `Open-Cap-Format-OCF/schema/primitives/objects/Object.schema.json` — required `id` on OCF
    objects
-   `OCF-Composed-Schemas/README.md` — **Carta Core** (Carta's standard) vs **OCF Core** (generated
    OCF-shaped schema bundle derived from Carta Core)
-   `OCF-Composed-Schemas/docs/core-lossy-inventory.md` — generated inventory of lossy mappings
-   `OCF-Composed-Schemas/docs/core-unmapped-inventory.md` — generated inventory of unmapped OCF
    properties

## Status

This OCIP is in **Draft** status. It has not been ratified by the Technical Working Group. Comments
are welcome via GitHub issues on this proposal.
