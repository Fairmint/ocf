---
ocip: 0000
title: OCIP Template
status: Accepted (template — not a normative proposal)
author: Thibauld Favre (thibauld@fairmint.com)
created: 2026-09-22
type: Process
---

# OCIP-NNNN: <Title>

## Abstract

One-paragraph summary of what this proposal changes or adds.

## Motivation

Why this proposal is needed. What problem does it solve? Cite the TWG's generated artifacts
(`docs/core-lossy-inventory.md`, `docs/core-unmapped-inventory.md`, etc.) where relevant, or
reference existing OCIPs and issues.

## Specification

The normative content of the proposal. What changes, in enough detail that an implementer can
build against it and a validator can check conformance.

## Rationale

Why this approach over alternatives. What precedent exists in other standards (IETF, Schema.org,
Kubernetes, etc.).

## Backwards compatibility

What happens to existing OCF documents that don't use this proposal's features? Does it break
anything? Is it additive?

## Conformance

What does it mean for a producer or consumer to conform to this proposal? Define producer and
consumer obligations separately if relevant.

## Open questions for the TWG

Decisions that are deliberately deferred to the TWG's review of this proposal. Each should be a
question, not a statement.

## References

Links to OCF-Composed-Schemas artifacts, existing OCIPs, OCF v1 schema files, or external standards
that inform this proposal.

## Status

`Draft` — this proposal has not been ratified by the Technical Working Group. Comments are welcome
via GitHub issues on this proposal's pull request.

---

## Front-matter schema

Every OCIP file begins with a YAML front-matter block:

```yaml
---
ocip: NNNN
title: <title>
status: Draft | Review | Accepted | Deprecated | Superseded | Rejected
author: <name> (<email or GitHub handle>)
created: YYYY-MM-DD
type: Standards Track | Process | Meta
area: core | profile | governance | process
replaces: <OCIP number, if applicable>
superseded_by: <OCIP number, if applicable>
requires: <OCIP number, if this proposal depends on another>
---
```

### Fields

| Field | Required | Description |
|---|---|---|
| `ocip` | yes | Sequential number, never reused. `0000` is reserved for this template. |
| `title` | yes | Human-readable title. |
| `status` | yes | Lifecycle state (see below). |
| `author` | yes | Proposer's name and email or GitHub handle. |
| `created` | yes | Date of first draft (YYYY-MM-DD). |
| `type` | yes | `Standards Track` (changes the spec), `Process` (changes how the spec is governed), `Meta` (registry/admin). |
| `area` | yes | `core`, `profile`, `governance`, or `process`. |
| `replaces` | no | If this proposal supersedes an earlier one, its number. |
| `superseded_by` | no | If this proposal has been superseded, the replacing number. |
| `requires` | no | If this proposal depends on another (e.g., a profile that requires stable identifiers), its number. |

### Lifecycle

```
Draft → Review (Last Call) → Accepted → Deprecated → Superseded
                                      ↘ Rejected
```

1. **Draft** — author's initial proposal. Open for comment. The registry entry (if applicable) has
   `status: "draft"`.
2. **Review** — the author requests Last Call status. The TWG sets a review window (default: 4 weeks).
   Comments are collected via GitHub issues on the proposal's pull request.
3. **Accepted** — the TWG ratifies the proposal. The registry entry (if applicable) is updated to
   `status: "accepted"`. The proposal is now normative.
4. **Deprecated** — a newer version or a Core inclusion makes this version obsolete but still
   citable. The registry entry stays; `superseded_by` points to the replacement.
5. **Superseded** — replaced by a specific newer proposal. The old proposal remains for citation
   (OCIP-0001 is always OCIP-0001).
6. **Rejected** — the TWG decides not to adopt. The proposal stays in the repo for reference but is
   not normative.

### Naming conventions

- **OCIP numbers** are sequential, assigned at PR time, never reused.
- **Profile IDs** use a dotted convention: `ocf.<name>` for coalition profiles (e.g.,
  `ocf.holder-identity`, `ocf.transfer-lineage`), `com.<vendor>.<name>` for vendor extensions.
  The `ocf.*` namespace is reserved and may only be used by accepted OCIPs.
- **Profile versions** follow semantic versioning (`MAJOR.MINOR.PATCH`), independent of the Core
  version.
- **Old versions are never removed from the registry.** A superseded version keeps its entry with a
  `superseded_by` pointer to its replacement.
