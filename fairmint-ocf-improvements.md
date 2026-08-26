# Fairmint OCF improvements backlog

Internal staging list for gaps in the Open Cap Table Format (OCF). Items here are **not** Coalition
proposals until one is opened upstream.

This fork is not a competing specification. See [README](README.md).

**Write-ups live in**
[dev-docs `ocf-schema-gaps.md`](https://github.com/Fairmint/dev-docs/blob/main/docs/cap-table/ocf-schema-gaps.md).
Keep IDs and one-line summaries in sync with that page. Do not add a Coalition `TX_SCRIP_*`; scrip
mint/burn/swap and official projections are not OCF (see that page, section D).

Referenced from
[Transfer Agent Books of Record](https://kb.fairmint.work/id/transfer-agent-books-of-record), the
connected-record rail, and the OCP whitepaper.

| ID                                                                          | Cat | Status | Summary                                                                |
| --------------------------------------------------------------------------- | --- | ------ | ---------------------------------------------------------------------- |
| [OCF-IMP-001](#ocf-imp-001-treasury-disposition-on-repurchase)              | A   | Open   | No treasury disposition on `TX_STOCK_REPURCHASE`                       |
| [OCF-IMP-002](#ocf-imp-002-structured-consideration-on-secondary-transfers) | A   | Open   | No structured consideration on secondary transfers                     |
| [OCF-IMP-003](#ocf-imp-003-transaction-date-is-calendar-day-only)           | A   | Open   | Transaction `date` is calendar-day only                                |
| [OCF-IMP-004](#ocf-imp-004-position-reservation-and-release)                | B   | Open   | No reservation / release transactions for a hold on outstanding shares |
| [OCF-IMP-005](#ocf-imp-005-legend-restriction-change)                       | B   | Open   | No legend / restriction change without cancel-reissue                  |
| [OCF-IMP-006](#ocf-imp-006-nominee-omnibus-capacity)                        | C   | Open   | No nominee / omnibus capacity on `STAKEHOLDER`                         |
| [OCF-IMP-007](#ocf-imp-007-structured-transfer-reason)                      | A   | Open   | No structured transfer reason or capacity                              |

---

## OCF-IMP-001: Treasury disposition on repurchase

**Affects:** Share Control Book, Treasury column.

`TX_STOCK_REPURCHASE` retires quantity from a `security_id`. It does not say whether those shares
return to authorized-but-unissued, sit in treasury, or are cancelled.

**v1 workaround:** Control Book exports report Treasury = 0 and treat Issued = Outstanding, with an
explicit footnote.

**Direction:** An optional disposition enum on repurchase (and possibly cancellation), or a
follow-on adjustment object.

---

## OCF-IMP-002: Structured consideration on secondary transfers

**Affects:** Master Securityholder File, "Amount Paid Thereon."

Transfers expose `consideration_text` only. Secondary sales often have no structured price or
currency amount.

**v1 workaround:** Column may be blank.

**Direction:** Optional structured monetary consideration on transfer objects, without forcing every
historical transfer to invent a price.

---

## OCF-IMP-003: Transaction date is calendar-day only

**Affects:** Master Securityholder File, same-day ordering.

OCF `date` is a calendar day. Same-day issuances, reservations, and transfers have no mandated
intra-day order beyond file sequence.

**v1 workaround:** Preserve input order within a day; do not invent timestamps.

**Direction:** Optional time, sequence number, or batch id that extractors can sort on without
breaking existing files.

---

## OCF-IMP-004: Position reservation and release

**Affects:** Official projection (free vs reserved quantity). Needed so a hold is reconstructible
from the constitutive event log, not only painted on a committed view.

**Logged:** 2026-08-17. Architecture discussion: one home register, multi-chain views, no second
hold book. See [OCP whitepaper §3.4](https://kb.fairmint.work/id/ocp-whitepaper),
[Connected record](https://kb.fairmint.work/id/fairmint-connected-record-liquidity-rail),
[TAD brief](https://kb.fairmint.work/id/fairmint-tad-network-brief),
[TA books](https://kb.fairmint.work/id/transfer-agent-books-of-record).

### Why this is a schema gap

The liquidity rail reserves quantity on the official projection: free falls, reserved rises.
Reserved shares stay outstanding and stay on the Master Securityholder File. They are not pending
issuances and they are not a transfer.

Today that hold is a field on the official projection, committed in the same `UpdateCapTable` as the
OCF objects. Classic OCF issuances and transfers do not know about it. Anyone who replays only those
events will treat the shares as free. If the projection and the log disagree, the log wins. A
reservation that lives only on the projection is then a second ledger.

The hold must be an OCF (or OCF-compatible) transaction family so:

-   reserved quantity is reconstructible from the log;
-   two venues cannot lock the same free quantity;
-   a published view on another chain cannot invent a reserve the home register did not accept.

### What it is not

-   Not a transfer, cancellation, or repurchase. Legal owner does not change.
-   Not a legend. Legends are legal restrictions. This is a temporary operational hold
    (stop-transfer).
-   Not a lot split (cancel and reissue a "reserved" `security_id`). Ownership did not change.
-   Not `transaction.status = pending` and not a Subsidiary File row.
-   Not a cross-chain lock. One writing transfer agent, one home register. Foreign chains may
    publish a view or mint scrip only against a slice already reserved at home.

### Proposed transaction family

Names are illustrative. One family, not a single event.

| Object (proposed)              | Role                                                                                                                                                                                                                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `TX_STOCK_RESERVATION`         | Lock quantity. Free down, reserved up. Shares remain outstanding.                                                                                                                                                                                                                          |
| `TX_STOCK_RESERVATION_RELEASE` | Unlock some or all of a reservation (deal dies, expiry processed, TA voids the hold). Reserved down, free up.                                                                                                                                                                              |
| Consume-by-reference           | A later `TX_STOCK_TRANSFER` / issuance / cancellation that **settles** the hold points at `reservation_id`. That consume is not a fourth "unlock" type. The transfer (or issuance) is the consume. Reserved quantity is released because the lots moved, not because a release was posted. |

Expiry is either a TA-posted `TX_STOCK_RESERVATION_RELEASE` with reason `EXPIRED`, or a
deterministic rule that extractors apply when `expires_at` has passed and no consume has posted.
Prefer an explicit release event so the log does not depend on wall-clock interpretation.

Partial reserve, partial release, and multiple concurrent reservations on one position must be
allowed (1,000 for a Solana venue and 1,000 for an Avalanche venue against 10,000 free). Validation:
sum of active reserved quantity for a holder / class / restriction bucket cannot exceed that
position's outstanding quantity.

### Suggested fields

**Reservation**

-   `id` (this is `reservation_id` for later objects)
-   `date`
-   `stakeholder_id`
-   `stock_class_id`
-   restriction bucket (legend / transfer-restriction set that makes shares non-fungible for the
    move)
-   `quantity`
-   `security_ids` (optional; chosen by the transfer agent, not by the market partner)
-   `transaction_id` or other deal correlation
-   `purpose` (register settlement, venue slice, scrip mint, issuer program)
-   `expires_at` (optional)
-   `comments`

**Release**

-   `id`
-   `date`
-   `reservation_id`
-   `quantity` (full or partial)
-   `reason` (`CANCELLED`, `EXPIRED`, `SUPERSEDED`, `ERROR`)
-   `comments`

**Consume**

-   Existing transfer / issuance / cancellation objects gain an optional `reservation_id` (or list).
    Quantity consumed cannot exceed remaining reserved quantity on that reservation.

Warrants, convertibles, and equity compensation may need the same family later (`TX_*_RESERVATION`).
Start with stock.

### How extractors should compute the view

```text
outstanding = f(issuances, transfers, cancellations, …)
reserved    = sum(active reservations) − sum(releases) − sum(consumes)
free        = outstanding − reserved
```

The official projection commits that view in the same batch as the reservation (or release, or
consume). The projection is still official for readers. The log remains constitutive.

### Multi-chain

A transfer agent may publish the same official position on more than one chain (certificate, mirror,
later scrip). Reservation is decided only on the home OCP register. A foreign view that shows
reserved quantity is a publication of a home reservation, not a second lock.

### Status

Not a Coalition issue yet. Until this family exists, OCP may carry an extension object in
`UpdateCapTable` that extractors treat as part of the manifest. The long-term home is OCF so any
conformant engine can rebuild free vs reserved.

**Do not implement in Q3 as an upstream schema change.** Q3 can keep reserved quantity on the
official projection. This item is the path that makes "log wins" true for the hold.

Legal stop-transfer (lost certificate, levy, court) uses the same family with
`purpose = STOP_TRANSFER`. Do not invent a second lock book.

---

## OCF-IMP-005: Legend / restriction change

**Affects:** Official-projection restriction buckets; Rule 144 season; lockup expiry.

`stock_legend_ids` is write-once on `TX_STOCK_ISSUANCE`. Changing legends today means
cancel+reissue, which changes `security_id` and looks like a transfer of record.

**Direction:** A dated `TX_STOCK_LEGEND_CHANGE` (name illustrative) on the same `security_id`. Not a
reservation. Full write-up:
[dev-docs OCF-IMP-005](https://github.com/Fairmint/dev-docs/blob/main/docs/cap-table/ocf-schema-gaps.md#ocf-imp-005--legend--restriction-change-without-cancel-reissue).

---

## OCF-IMP-006: Nominee / omnibus capacity

**Affects:** Street-name inversion; 12(g) holders of record; broker-nominee scrip sequence.

`STAKEHOLDER.stakeholder_type` is only `INDIVIDUAL` | `INSTITUTION`. Alice → broker is already a
transfer; the missing fact is that the transferee is nominee, not beneficial owner.

**Direction:** Optional `capacity` on `STAKEHOLDER` (`BENEFICIAL`, `NOMINEE`, `OMNIBUS`, …). Full
write-up:
[dev-docs OCF-IMP-006](https://github.com/Fairmint/dev-docs/blob/main/docs/cap-table/ocf-schema-gaps.md#ocf-imp-006--no-nominee--omnibus-capacity-on-stakeholder).

---

## OCF-IMP-007: Structured transfer reason

**Affects:** Master Securityholder File disposition; nominee move vs sale; escheat; estate / gift.

Transfers have no reason enum. Gift, estate, escheat, DRS-to-nominee, and a priced secondary are all
`TX_STOCK_TRANSFER`.

**Direction:** Optional reason enum + text on the transfer primitive. Do not invent a `TX_*` per
reason. Full write-up:
[dev-docs OCF-IMP-007](https://github.com/Fairmint/dev-docs/blob/main/docs/cap-table/ocf-schema-gaps.md#ocf-imp-007--no-structured-transfer-reason-or-capacity).
