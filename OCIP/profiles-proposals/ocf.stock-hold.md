# Coalition profile proposal: `ocf.stock-hold` 1.0.0

**Status:** Draft for OCF TWG (Nov 12, 2026)  
**Author:** Fairmint (Thibauld Favre)  
**Related:** [OCIP-0001](../proposals/0001-ocf-extension-architecture.md),
[OCF-Composed-Schemas#300](https://github.com/Open-Cap-Table-Coalition/OCF-Composed-Schemas/issues/300)
(transfer correlation)

## Problem

Transfer agents need to record **stop-transfer** orders and **register/settlement** holds on stock
securities without reallocating ownership. Canton v36 already models these events in TA workflows;
OCF today has no first-class object for them. Profile `ocf.stock-hold` adds non-economic annotations
keyed by `security_id`, aligned with Nick’s Canton spec (hold types, references, cancellation
semantics).

## Profile objects (1.0.0 — stock only)

Shared primitives in the JSON Schema bundle:

| Primitive          | Profile record type          | Purpose                                                                                                            |
| ------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `Hold`             | `TX_STOCK_HOLD`              | `hold_type` (`REGISTER_SETTLEMENT` \| `STOP_TRANSFER`), `reference`, `reason_text`; `quantity` only for settlement |
| `HoldCancellation` | `TX_STOCK_HOLD_CANCELLATION` | Whole-hold cancel via `hold_id`                                                                                    |

Payload shape: `stock_holds[]` and `stock_hold_cancellations[]`. Warrant and convertible variants
are expected to reuse the primitives in a later minor or sibling profile.

## Semantic rules (validator-enforced)

1. **No economic effect** — holds never change ownership; cap-table readers that ignore the profile
   still compute the same table.
2. **Valid cancellation** — `hold_id` must reference a hold on the same `security_id`, not already
   cancelled or closed by a terminal (a hold voided for quantity by split remains cancellable).
3. **Terminal closure** — any stock security terminal (`TX_STOCK_TRANSFER`, `TX_STOCK_CANCELLATION`,
   `TX_STOCK_REPURCHASE`, `TX_STOCK_RETRACTION`, `TX_STOCK_CONVERSION`, `TX_STOCK_REISSUANCE`,
   `TX_STOCK_CONSOLIDATION`) closes open holds on that `security_id` (partial terminals included).
   Cancelling a closed hold yields `stock_hold_cancellation_of_closed_hold`.
4. **Stop gates terminals** — while a `STOP_TRANSFER` is open, no terminal on that security is valid
   until cancelled (prevents silent lift).
5. **Settlement quantity cap** — open `REGISTER_SETTLEMENT` holds cannot exceed outstanding quantity
   on the security at the hold date (post-split units).
6. **Split behavior** — pre-split settlement holds count for **zero** shares after
   `TX_STOCK_CLASS_SPLIT` on the class; hold stays open until cancelled; stops unaffected; split
   does not auto-cancel holds.

## Extension rationale

-   **Additive:** no edits to OCF v1 objects or schema.
-   **Portable:** `ocf.*` namespace, registry-governed, draft-07 `schema.json`, conformance fixtures
    in-repo.
-   **Composable:** satisfies transfer-correlation work in #300 by anchoring holds to `security_id`
    and TA references.

## Stable error codes

| Code                                     | Rule                             |
| ---------------------------------------- | -------------------------------- |
| `stock_hold_stop_quantity_forbidden`     | `quantity` on `STOP_TRANSFER`    |
| `stock_hold_orphan_cancellation`         | Unknown `hold_id`                |
| `stock_hold_double_cancellation`         | Second cancellation of same hold |
| `stock_hold_cancellation_wrong_security` | `security_id` mismatch           |
| `stock_hold_settlement_over_quantity`    | Rule 5                           |
| `stock_hold_terminal_during_stop`        | Rule 4                           |
| `stock_hold_cancellation_of_closed_hold` | Rule 3 — cancel after terminal   |

## Open questions

-   Should consumers surface open holds in cap-table UIs, or only in TA/ops views?
-   Minimum metadata for `reference` (settlement ID vs court order number) — normalize in 1.1.0?
-   Canton parity: do we need profile hooks for post-split **new** `security_id` issuance patterns,
    or is class-level split sufficient?
-   Warrant/convertible hold profile: single `ocf.hold` umbrella vs `ocf.stock-hold` /
    `ocf.warrant-hold` siblings?
