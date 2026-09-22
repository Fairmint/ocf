# Open Cap-Table Improvement Proposals (OCIP)

This directory hosts improvement proposals for the Open Cap Format (OCF). It exists alongside the
[OCF-Composed-Schemas](https://github.com/Open-Cap-Table-Coalition/OCF-Composed-Schemas) gap-analysis
repository and the [Open-Cap-Format-OCF](https://github.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF)
specification.

## What is an OCIP?

An OCIP is a numbered, versioned document that proposes a change, addition, or clarification to the
OCF standard. It follows the same conventions as IETF RFCs, Python PEPs, and Ethereum EIPs:

- Each proposal has a number (assigned sequentially, never reused).
- Each proposal has a status (`Draft` → `Review` → `Accepted` → `Superseded` / `Rejected`).
- Once a proposal is `Accepted`, it is normative and may only be replaced by a new proposal that
  explicitly supersedes it (`replaces` / `superseded_by` in the front matter).
- Proposals are plain Markdown files in [`proposals/`](proposals/), named
  `NNNN-short-title.md`.

## Why a proposals process?

The [OCF-Composed-Schemas](https://github.com/Open-Cap-Table-Coalition/OCF-Composed-Schemas)
repository is the TWG's comment-and-analysis corpus: issues review the current gap analysis, but
there is no structured way to *propose* what should come next. An OCIP fills that gap:

- **Issues** = review comments on the current state (what's wrong, what's missing).
- **OCIPs** = constructive proposals for what to add or change (here is a mechanism, here is a
  profile, here is a new transaction family).

An OCIP can reference issues as supporting evidence, but an issue alone is not a proposal — it
doesn't have a specification, a conformance section, or a lifecycle.

## How to propose an OCIP

1. Copy [`proposals/0000-template.md`](proposals/0000-template.md) to `proposals/NNNN-short-title.md`.
2. Fill in the front matter and body.
3. Open a pull request. The TWG reviews it. On acceptance, the PR is merged and the status becomes
   `Accepted`.
4. The [`registry/`](registry/) directory tracks accepted profiles and their versions.

## Current proposals

| Number | Title | Status |
|---|---|---|
| [0001](proposals/0001-ocf-extension-architecture.md) | OCF Extension Architecture — Profiles, Registry, and Conformance | Draft |

## Process

See [`proposals/0000-template.md`](proposals/0000-template.md) for the front-matter schema and
lifecycle states.
