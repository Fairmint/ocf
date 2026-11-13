# Coalition profile proposal: `ocf.transfer-restriction` 1.0.0

**Status:** Draft (Fairmint internal; stacks on
[OCIP-0001](../proposals/0001-ocf-extension-architecture.md) PR #15)  
**Author:** Fairmint (Thibauld Favre)  
**Legal source:** Gary Lin's 2026-11-11 internal Regulation S analysis (not a formal opinion),
citing Rules 903(b)(3)(iii)(B)(4), 902(f), 903(b)(5), 904, and 905; OCP §11.6 (legends vs
transfer-agent enforcement).

## Problem

OCF v1 has no object for a **time-bounded transfer restriction**. Category 3 Regulation S issuances
need one: during the distribution compliance period the issuer must refuse to register a transfer
that is not made in accordance with Regulation S, a registration, or an available exemption (Rule
903(b)(3)(iii)(B)(4)). The duty attaches to the SAFE or note, not only to stock later issued on
conversion. After the period, securities stay restricted (legend plus transfer-agent decision on
Rule 144 or another exemption). The dated restriction expires; the legend does not.

Without a profile, dates live in legend prose or in one vendor's transfer-agent logic and cannot
travel with the cap table.

## Why not `ocf.stock-hold`

`ocf.stock-hold` (draft PR #19) models `STOP_TRANSFER` and `REGISTER_SETTLEMENT` on stock. A stop
stays open until cancelled, does not auto-expire, and is stock-only. A distribution compliance
period expires on a calendar date, must attach to convertibles (and to shares they convert into),
and can sit alongside an open stop. Do not overload the hold pair.

## Profile objects (1.0.0)

| Record                          | `object_type`                          | Role                                                                                         |
| ------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------- |
| TransferRestriction             | `TX_TRANSFER_RESTRICTION`              | Start date, optional `end_date`, `restriction_type`                                          |
| TransferRestrictionEndDateSet   | `TX_TRANSFER_RESTRICTION_END_DATE_SET` | Set `end_date` when unknown at first closing (Rule 902(f))                                   |
| TransferPermitted               | `TX_TRANSFER_PERMITTED`                | Lawful transfer while open; basis cannot live on v1 transfer (`additionalProperties: false`) |
| TransferRestrictionCancellation | `TX_TRANSFER_RESTRICTION_CANCELLATION` | Waiver of `LOCKUP` / `OTHER` only                                                            |

`restriction_type`: `DISTRIBUTION_COMPLIANCE_PERIOD`, `LOCKUP`, `OTHER`. **No**
`RULE_144_HOLDING_PERIOD` — Rule 144 is a resale safe harbor, not a prohibition.

Payload file: `profiles/ocf.transfer-restriction/transfer-restrictions.json` with four arrays (all
required, may be empty).

## Semantic rules (validator-enforced)

1. **No economic effect** — restrictions never change ownership or quantities.
2. **Valid issuance anchor** — `security_id` must reference a v1 issuance; `date` ≥ issuance date.
3. **DCP (Rule 903(b)(3)(iii)(B)(4))** — while open, transfers of that security are invalid unless a
   `TransferPermitted` exists for that `transfer_id` with basis `REGULATION_S`, `REGISTRATION`, or
   `EXEMPTION`.
4. **LOCKUP / OTHER** — while open, transfers are invalid unless `TransferPermitted` with basis
   `CONTRACTUAL_EXCEPTION` or the restriction is cancelled. DCP does not use this total block.
5. **Non-transfer events** — conversion, exercise, cancellation, repurchase, retraction, reissuance,
   and consolidation are not blocked (mapped to v1 `TX_*` types in the validator).
6. **No inheritance** — on conversion/exercise while open, producer writes a new restriction on each
   resulting `security_id` with the same `end_date` (or unset state); source restriction closes when
   the `security_id` is consumed.
7. **Cancellation** — valid only for `LOCKUP` / `OTHER`, only while open; DCP cancellation is
   invalid.
8. **Class split** — `TX_STOCK_CLASS_SPLIT` does not void a restriction on the `security_id`.
9. **No Rule 144 hard block** in this profile.
10. **Whole-security only** in 1.0.0 (no quantity field).

### `end_date` convention and producer guidance (Rule 902(f))

`end_date` is **inclusive** (last calendar day in force). Example: one-year period from 2026-06-15 →
`end_date` 2027-06-15 (medium-confidence anniversary convention; not a legal determination).

The profile **stores** dates; it does not calculate them. For a **continuous offering** (Rule
902(f)(2)), the period starts when the distribution completes (round close); every SAFE in the round
shares the same `end_date`. Leave `end_date` unset at first closings; write
`TransferRestrictionEndDateSet` when the round closes. Measuring from each investor's issuance date
is a compliance gap — do not do that.

## Stable error codes

| Code                                                            | Rule                                       |
| --------------------------------------------------------------- | ------------------------------------------ |
| `transfer_restriction_unknown_security`                         | Invalid `security_id`                      |
| `transfer_restriction_date_before_issuance`                     | Restriction starts before issuance         |
| `transfer_restriction_end_date_before_start`                    | `end_date` < `date`                        |
| `transfer_restriction_dcp_transfer_without_permit`              | Open DCP, no valid permit                  |
| `transfer_restriction_lockup_transfer_without_permit`           | Open LOCKUP/OTHER, no permit or cancel     |
| `transfer_restriction_permit_wrong_basis`                       | Basis incompatible with `restriction_type` |
| `transfer_restriction_dcp_cancellation_forbidden`               | DCP cannot be cancelled                    |
| `transfer_restriction_end_date_set_when_end_date_present`       | Second end date on restriction             |
| `transfer_restriction_end_date_set_unknown_restriction`         | Orphan EndDateSet                          |
| `transfer_restriction_end_date_set_on_closed_restriction`       | EndDateSet after terminal                  |
| `transfer_restriction_double_end_date_set`                      | More than one EndDateSet (1.0.0)           |
| `transfer_restriction_cancellation_unknown_restriction`         | Orphan cancellation                        |
| `transfer_restriction_cancellation_on_closed_restriction`       | Cancel after terminal                      |
| `transfer_restriction_cancellation_after_end`                   | Cancel after inclusive `end_date`          |
| `transfer_restriction_permit_unknown_restriction`               | Orphan permit                              |
| `transfer_restriction_permit_on_closed_restriction`             | Permit after terminal / expired            |
| `transfer_restriction_conversion_source_restriction_still_open` | Conversion left source open                |
| `transfer_restriction_conversion_extended_end_date`             | Successor `end_date` later than source     |
| `transfer_restriction_conversion_missing_successor_restriction` | No matching successor on conversion        |

## OCIP gap

OCIP-0001 §5 / §7 allow profile semantic checks but do not clearly state that a profile may
**invalidate a non-compliant base transfer** (not every transfer). Suggested coalition wording
belongs in the PR description, not in OCIP-0001 until TWG agrees.

## Extension rationale

Additive `ocf.*` profile, draft-07 schema, conformance fixtures under
`OCIP/conformance-fixtures/transfer-restriction/`. Composes with future `ocf.security-legend`
(legends after period ends) without dependency on `ocf.stock-hold`.

## Open questions

-   Quantity on `LOCKUP` for staged releases in a later minor?
-   Correcting `end_date` after a wrong Rule 902(f) certification (1.0.0 allows only one
    EndDateSet).
-   Inclusive-anniversary vs day-before if counsel specifies.

## Cross-references

-   Fairmint/ocf PR #15 (OCIP-0001 machinery), draft PR #19 (`ocf.stock-hold`), parallel
    `ocf.security-legend` work (sibling, not a dependency).
-   Coalition:
    [OCF-Composed-Schemas](https://github.com/Open-Cap-Table-Coalition/OCF-Composed-Schemas), OCP
    §11.6.
