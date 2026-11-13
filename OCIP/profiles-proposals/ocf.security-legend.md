# Coalition profile proposal: `ocf.security-legend` 1.0.0

**Status:** Draft (Fairmint internal)  
**Author:** Fairmint (Thibauld Favre, CTO — approved sketch for implementation)  
**Legal review:** Gary Cox (securities counsel), 2026-11-11 internal analysis (not a formal
opinion)  
**Related:** [OCIP-0001](../proposals/0001-ocf-extension-architecture.md),
[Open-Cap-Table-Coalition/OCF-Composed-Schemas#305](https://github.com/Open-Cap-Table-Coalition/OCF-Composed-Schemas/issues/305)
(exemptions, not legends), OCP §11.6

## Problem

OCF v1 stores legend _text_ in `STOCK_LEGEND_TEMPLATE` (`StockLegendTemplate.schema.json`) but only
attaches legends to stock via required `stock_legend_ids` on `TX_STOCK_ISSUANCE`
(`StockIssuance.schema.json`). Convertible, warrant, and equity-compensation issuances set
`additionalProperties: false` and expose no legend field, so a v1-only package cannot record that a
Regulation S SAFE (or Rule 701 option) is legend-bearing at issuance.

Counsel analysis (Gary, 2026-11-11): a Category 3 Regulation S SAFE must carry the legend when
issued; conversion shares need their own restricted legend under Rule 905, not an inherited copy
from the SAFE profile record.

## Profile object (1.0.0)

**`SECURITY_LEGEND_ASSIGNMENT`** — profile record in `security_legend_assignments[]`:

| Field         | Required | Notes                                         |
| ------------- | -------- | --------------------------------------------- |
| `id`          | yes      | Profile record id                             |
| `date`        | yes      | OCF date; normally issuance date              |
| `security_id` | yes      | Security from an allowed issuance (not stock) |
| `legend_ids`  | yes      | ≥1 id of v1 `STOCK_LEGEND_TEMPLATE` objects   |
| `comments`    | no       |                                               |

Allowed issuance types for `security_id`: `TX_CONVERTIBLE_ISSUANCE`, `TX_WARRANT_ISSUANCE`,
`TX_EQUITY_COMPENSATION_ISSUANCE`, and legacy `TX_PLAN_SECURITY_ISSUANCE`. At most one assignment
per `security_id` in 1.0.0.

Reuse v1 `STOCK_LEGEND_TEMPLATE` for text; do not add a parallel template type.

## Semantic rules (validator-enforced)

1. **No economic effect** — assignments never change ownership or quantities; cap-table readers that
   ignore the profile still compute the same table (OCIP-0001 §5).
2. **Valid security reference** — `security_id` must reference an existing issuance of an allowed
   type; `date` must not precede that issuance. Distinct codes for unknown `security_id`, disallowed
   issuance type, security closed by a terminal transaction before the assignment date, and date
   before issuance.
3. **Legend templates exist** — every `legend_ids` entry must match a `STOCK_LEGEND_TEMPLATE` id in
   the package.
4. **One assignment per security** — at most one row per `security_id` (amendment out of scope for
   1.0.0).
5. **Stock excluded** — reject assignments whose `security_id` is from `TX_STOCK_ISSUANCE` (use v1
   `stock_legend_ids` instead).
6. **No inheritance (producer rule)** — when a convertible or warrant is converted or exercised, the
   resulting `TX_STOCK_ISSUANCE` must include its own `stock_legend_ids`. Rule 905 restricted
   securities still need legends after a Regulation S distribution compliance period ends. The
   validator does not auto-copy legends; conformance fixtures demonstrate producer-valid packages.

## Extension rationale

-   **Additive:** no v1 schema or object edits; profile files reference v1 ids (OCIP-0001 §5).
-   **Portable:** `ocf.*` namespace, draft registry row, JSON Schema Draft-07, in-repo conformance
    fixtures.
-   **Graduation path:** a later v1 minor may add `legend_ids` to the shared `Issuance` primitive;
    until then this profile is the portable coalition-tier record.

## Stable error codes

| Code                                       | Rule                                                       |
| ------------------------------------------ | ---------------------------------------------------------- |
| `security_legend_unknown_security`         | 2 — no allowed issuance for `security_id`                  |
| `security_legend_security_closed`          | 2 — issuance existed but security closed before assignment |
| `security_legend_disallowed_issuance_type` | 2 — non-allowed issuance origin                            |
| `security_legend_date_before_issuance`     | 2 — assignment predates issuance                           |
| `security_legend_unknown_legend_template`  | 3                                                          |
| `security_legend_duplicate_assignment`     | 4                                                          |
| `security_legend_stock_issuance_forbidden` | 5                                                          |

## Legal sources (summary)

Gary Cox internal analysis (2026-11-11), citing Rule 903(b)(3)(iii)(B)(3), Rule 405, and Rule 905;
OCP §11.6 for operational legend expectations.

## Planned close follow (not 1.0.0)

**`SecurityLegendRemoval`** — structured removal (`date`, `security_id`, `legend_ids`, `basis` ∈
`OPINION` \| `REGISTRATION` \| `OTHER`, optional `reference`) so the official record does not
over-restrict after lawful sale or registration. Amendment of assignment text remains a later item.
v1 issuance field additions deferred to graduation.

## Open questions

None blocking 1.0.0. Historical `STOCK_LEGEND_TEMPLATE` naming is retained intentionally.
