# Fairmint fork of Open Cap Format (OCF)

This repository is [Fairmint](https://fairmint.com)'s working fork of the **Open Cap Format (OCF)**,
the open cap-table data standard maintained by the
[Open Cap Table Coalition](https://opencaptablecoalition.com).

**The canonical OCF specification lives upstream at
[Open-Cap-Table-Coalition/Open-Cap-Format-OCF](https://github.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF).
This fork is not an alternative or competing specification, and nothing in it should be relied upon
as a normative version of OCF.**

## Purpose of this fork

1. **Staging ground for upstream contributions.** Changes are prepared and validated here before
   being submitted to the Coalition — for example, the improved JSON-schema documentation merged
   upstream in [PR #546](https://github.com/Open-Cap-Table-Coalition/Open-Cap-Format-OCF/pull/546).
2. **Implementation tooling.** Agent-facing documentation (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`),
   sample and template OCF files, and utilities that support Fairmint's OCF-based products.

## Licensing

OCF schema and documentation files retain the Open Cap Table Coalition's copyright notices and are
used under the Coalition's [Schema and Documentation License](LICENSE.md). Modifications made in
this fork exist to facilitate implementation and to prepare contributions to the upstream
specification.

## Sync policy

The fork periodically merges upstream `main`. Divergence from upstream is limited to pending
contributions and the implementation tooling described above.
