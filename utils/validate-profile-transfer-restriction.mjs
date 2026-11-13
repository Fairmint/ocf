import {
  TRANSFER_RESTRICTION_ERROR_CODES as C,
  ISSUANCE_OBJECT_TYPES,
  TRANSFER_OBJECT_TYPES,
  TERMINAL_SECURITY_TX_BY_ISSUANCE,
  NON_BLOCKING_WHILE_RESTRICTED,
  DCP_BASES,
  LOCKUP_BASES,
} from "./transfer-restriction-error-codes.mjs";

/**
 * @param {{ object_type: string, id: string, date?: string } & Record<string, unknown>} a
 * @param {{ object_type: string, id: string, date?: string } & Record<string, unknown>} b
 */
function cmpEvent(a, b) {
  const da = a.date ?? "";
  const db = b.date ?? "";
  if (da !== db) {
    return da < db ? -1 : 1;
  }
  return String(a.id).localeCompare(String(b.id));
}

/**
 * @param {unknown[]} transactions
 */
function indexIssuances(transactions) {
  /** @type {Map<string, { object_type: string, date: string, security_id: string }>} */
  const bySecurity = new Map();
  for (const tx of transactions) {
    if (ISSUANCE_OBJECT_TYPES.has(tx.object_type) && tx.security_id) {
      bySecurity.set(tx.security_id, {
        object_type: tx.object_type,
        date: tx.date ?? "",
        security_id: tx.security_id,
      });
    }
  }
  return bySecurity;
}

function issuanceTypeForSecurity(issuances, securityId) {
  return issuances.get(securityId)?.object_type;
}

function terminalTypesForSecurity(issuances, securityId) {
  const issuanceType = issuanceTypeForSecurity(issuances, securityId);
  if (!issuanceType) {
    return [];
  }
  return TERMINAL_SECURITY_TX_BY_ISSUANCE[issuanceType] ?? [];
}

function touchesSecurity(tx, securityId) {
  if (tx.security_id === securityId) {
    return true;
  }
  if (Array.isArray(tx.security_ids) && tx.security_ids.includes(securityId)) {
    return true;
  }
  return false;
}

/**
 * @param {object} restriction
 * @param {Map<string, string>} endDateSets restriction_id -> end_date from events
 * @param {Map<string, { cancelled?: boolean, cancelledDate?: string, closed?: boolean, closedDate?: string }>} state
 */
function effectiveEndDate(restriction, endDateSets) {
  if (restriction.end_date) {
    return restriction.end_date;
  }
  return endDateSets.get(restriction.id);
}

/**
 * @param {object} restriction
 * @param {string} asOf
 * @param {Map<string, string>} endDateSets
 * @param {Map<string, { cancelled?: boolean, cancelledDate?: string, closed?: boolean, closedDate?: string }>} state
 */
function isOpenAt(restriction, asOf, endDateSets, state) {
  const st = state.get(restriction.id) ?? {};
  if ((restriction.date ?? "") > asOf) {
    return false;
  }
  if (st.closed && st.closedDate && st.closedDate <= asOf) {
    return false;
  }
  if (
    st.cancelled &&
    st.cancelledDate &&
    st.cancelledDate <= asOf &&
    restriction.restriction_type !== "DISTRIBUTION_COMPLIANCE_PERIOD"
  ) {
    return false;
  }
  const end = effectiveEndDate(restriction, endDateSets);
  if (end && asOf > end) {
    return false;
  }
  return true;
}

function dcpBasesFor(type) {
  return type === "DISTRIBUTION_COMPLIANCE_PERIOD" ? DCP_BASES : LOCKUP_BASES;
}

function securityIdsFromTerminal(tx) {
  const ids = [];
  if (tx.security_id) {
    ids.push(tx.security_id);
  }
  if (Array.isArray(tx.security_ids)) {
    ids.push(...tx.security_ids);
  }
  return ids;
}

function resultingSecurityIds(tx) {
  if (!Array.isArray(tx.resulting_security_ids)) {
    return [];
  }
  return tx.resulting_security_ids;
}

/**
 * @param {object} payload
 * @param {unknown[]} transactions
 * @param {(level: 'error' | 'warning', code: string, message: string) => void} push
 */
export function validateTransferRestrictionProfileSemantics(
  payload,
  transactions,
  push
) {
  const issuances = indexIssuances(transactions);
  const restrictions = payload.transfer_restrictions ?? [];
  const restrictionById = new Map(restrictions.map((r) => [r.id, r]));

  /** @type {Map<string, { cancelled?: boolean, cancelledDate?: string, closed?: boolean, closedDate?: string }>} */
  const state = new Map();
  for (const r of restrictions) {
    state.set(r.id, { cancelled: false, closed: false });
  }

  /** restriction_id -> end_date applied by EndDateSet */
  const endDateSetsApplied = new Map();
  const endDateSetCountByRestriction = new Map();

  /** transfer_id -> permit basis */
  const permitsByTransferId = new Map();
  for (const p of payload.transfer_permitted ?? []) {
    permitsByTransferId.set(p.transfer_id, p);
  }

  for (const r of restrictions) {
    if (!issuances.has(r.security_id)) {
      push(
        "error",
        C.UNKNOWN_SECURITY,
        `Transfer restriction ${r.id} security_id ${r.security_id} has no issuance`
      );
      continue;
    }
    const issueDate = issuances.get(r.security_id).date;
    if ((r.date ?? "") < issueDate) {
      push(
        "error",
        C.DATE_BEFORE_ISSUANCE,
        `Transfer restriction ${r.id} date ${r.date} precedes issuance ${issueDate}`
      );
    }
    if (r.end_date && r.end_date < r.date) {
      push(
        "error",
        C.END_DATE_BEFORE_START,
        `Transfer restriction ${r.id} end_date ${r.end_date} is before start ${r.date}`
      );
    }
  }

  for (const s of payload.transfer_restriction_end_date_sets ?? []) {
    const restriction = restrictionById.get(s.restriction_id);
    if (!restriction) {
      push(
        "error",
        C.END_DATE_SET_UNKNOWN_RESTRICTION,
        `EndDateSet ${s.id} references unknown restriction ${s.restriction_id}`
      );
      continue;
    }
    if (s.security_id !== restriction.security_id) {
      push(
        "error",
        C.END_DATE_SET_UNKNOWN_RESTRICTION,
        `EndDateSet ${s.id} security_id does not match restriction ${s.restriction_id}`
      );
      continue;
    }
    const st = state.get(restriction.id);
    if (st?.closed) {
      push(
        "error",
        C.END_DATE_SET_ON_CLOSED_RESTRICTION,
        `EndDateSet ${s.id} targets closed restriction ${s.restriction_id}`
      );
      continue;
    }
    if (restriction.end_date) {
      push(
        "error",
        C.END_DATE_SET_WHEN_END_DATE_PRESENT,
        `EndDateSet ${s.id} but restriction ${s.restriction_id} already has end_date`
      );
    }
    const priorCount = endDateSetCountByRestriction.get(s.restriction_id) ?? 0;
    if (priorCount >= 1) {
      push(
        "error",
        C.DOUBLE_END_DATE_SET,
        `Restriction ${s.restriction_id} already has an EndDateSet in 1.0.0`
      );
    }
    endDateSetCountByRestriction.set(s.restriction_id, priorCount + 1);
  }

  for (const c of payload.transfer_restriction_cancellations ?? []) {
    const restriction = restrictionById.get(c.restriction_id);
    if (!restriction) {
      push(
        "error",
        C.CANCELLATION_UNKNOWN_RESTRICTION,
        `Cancellation ${c.id} references unknown restriction ${c.restriction_id}`
      );
      continue;
    }
    if (restriction.restriction_type === "DISTRIBUTION_COMPLIANCE_PERIOD") {
      push(
        "error",
        C.DCP_CANCELLATION_FORBIDDEN,
        `Cancellation ${c.id} is invalid for DISTRIBUTION_COMPLIANCE_PERIOD ${c.restriction_id}`
      );
    }
    if (c.security_id !== restriction.security_id) {
      push(
        "error",
        C.CANCELLATION_UNKNOWN_RESTRICTION,
        `Cancellation ${c.id} security_id mismatch for restriction ${c.restriction_id}`
      );
    }
  }

  for (const p of payload.transfer_permitted ?? []) {
    const restriction = restrictionById.get(p.restriction_id);
    if (!restriction) {
      push(
        "error",
        C.PERMIT_UNKNOWN_RESTRICTION,
        `TransferPermitted ${p.id} references unknown restriction ${p.restriction_id}`
      );
      continue;
    }
    const allowedBases = dcpBasesFor(restriction.restriction_type);
    if (!allowedBases.has(p.basis)) {
      push(
        "error",
        C.PERMIT_WRONG_BASIS,
        `TransferPermitted ${p.id} basis ${p.basis} invalid for restriction type ${restriction.restriction_type}`
      );
    }
    const transfer = transactions.find((t) => t.id === p.transfer_id);
    if (!transfer || !TRANSFER_OBJECT_TYPES.has(transfer.object_type)) {
      continue;
    }
    if (p.security_id !== restriction.security_id) {
      push(
        "error",
        C.PERMIT_UNKNOWN_RESTRICTION,
        `TransferPermitted ${p.id} security_id does not match restriction`
      );
    }
  }

  const events = [
    ...restrictions.map((r) => ({
      kind: "restriction",
      date: r.date,
      id: r.id,
      restriction: r,
    })),
    ...(payload.transfer_restriction_end_date_sets ?? []).map((s) => ({
      kind: "end_set",
      date: s.date,
      id: s.id,
      endSet: s,
    })),
    ...(payload.transfer_permitted ?? []).map((p) => ({
      kind: "permit",
      date: p.date,
      id: p.id,
      permit: p,
    })),
    ...(payload.transfer_restriction_cancellations ?? []).map((c) => ({
      kind: "cancel",
      date: c.date,
      id: c.id,
      cancel: c,
    })),
    ...transactions.map((tx) => ({
      kind: "ocf",
      date: tx.date ?? "",
      id: tx.id,
      tx,
    })),
  ];
  events.sort(cmpEvent);

  const endDateSetsLive = new Map();

  for (const event of events) {
    if (event.kind === "end_set") {
      const s = event.endSet;
      const restriction = restrictionById.get(s.restriction_id);
      if (!restriction) {
        continue;
      }
      const st = state.get(restriction.id);
      if (st?.closed) {
        push(
          "error",
          C.END_DATE_SET_ON_CLOSED_RESTRICTION,
          `EndDateSet ${s.id} on closed restriction ${s.restriction_id}`
        );
        continue;
      }
      if (!isOpenAt(restriction, s.date, endDateSetsLive, state)) {
        if (st?.closed) {
          push(
            "error",
            C.END_DATE_SET_ON_CLOSED_RESTRICTION,
            `EndDateSet ${s.id} on closed restriction ${s.restriction_id}`
          );
        }
        continue;
      }
      endDateSetsLive.set(s.restriction_id, s.end_date);
    }

    if (event.kind === "cancel") {
      const c = event.cancel;
      const restriction = restrictionById.get(c.restriction_id);
      if (
        !restriction ||
        restriction.restriction_type === "DISTRIBUTION_COMPLIANCE_PERIOD"
      ) {
        continue;
      }
      const st = state.get(restriction.id);
      if (!st || st.closed) {
        push(
          "error",
          C.CANCELLATION_ON_CLOSED_RESTRICTION,
          `Cancellation ${c.id} on closed or missing restriction ${c.restriction_id}`
        );
        continue;
      }
      if (!isOpenAt(restriction, c.date, endDateSetsLive, state)) {
        push(
          "error",
          C.CANCELLATION_ON_CLOSED_RESTRICTION,
          `Cancellation ${c.id} on closed restriction ${c.restriction_id}`
        );
        continue;
      }
      const end = effectiveEndDate(restriction, endDateSetsLive);
      if (end && c.date > end) {
        push(
          "error",
          C.CANCELLATION_AFTER_END,
          `Cancellation ${c.id} date ${c.date} is after restriction end ${end}`
        );
        continue;
      }
      st.cancelled = true;
      st.cancelledDate = c.date;
    }

    if (event.kind === "permit") {
      const p = event.permit;
      const restriction = restrictionById.get(p.restriction_id);
      if (!restriction) {
        continue;
      }
      if (!isOpenAt(restriction, p.date, endDateSetsLive, state)) {
        push(
          "error",
          C.PERMIT_ON_CLOSED_RESTRICTION,
          `TransferPermitted ${p.id} on closed restriction ${p.restriction_id}`
        );
      }
    }

    if (event.kind === "ocf") {
      const tx = event.tx;
      const txDate = tx.date ?? "";

      if (TRANSFER_OBJECT_TYPES.has(tx.object_type) && tx.security_id) {
        for (const restriction of restrictions) {
          if (restriction.security_id !== tx.security_id) {
            continue;
          }
          if (!isOpenAt(restriction, txDate, endDateSetsLive, state)) {
            continue;
          }
          const permit = permitsByTransferId.get(tx.id);
          if (
            restriction.restriction_type === "DISTRIBUTION_COMPLIANCE_PERIOD"
          ) {
            if (
              !permit ||
              !DCP_BASES.has(permit.basis) ||
              permit.restriction_id !== restriction.id ||
              permit.transfer_id !== tx.id
            ) {
              push(
                "error",
                C.DCP_TRANSFER_WITHOUT_PERMIT,
                `${tx.object_type} ${tx.id} on ${tx.security_id} without valid TransferPermitted for open DCP ${restriction.id}`
              );
            }
          } else if (
            restriction.restriction_type === "LOCKUP" ||
            restriction.restriction_type === "OTHER"
          ) {
            const st = state.get(restriction.id);
            const cancelledBefore =
              st?.cancelled && st.cancelledDate && st.cancelledDate <= txDate;
            const hasPermit =
              permit &&
              LOCKUP_BASES.has(permit.basis) &&
              permit.restriction_id === restriction.id &&
              permit.transfer_id === tx.id;
            if (!cancelledBefore && !hasPermit) {
              push(
                "error",
                C.LOCKUP_TRANSFER_WITHOUT_PERMIT,
                `${tx.object_type} ${tx.id} on ${tx.security_id} without permit or cancellation for open ${restriction.restriction_type} ${restriction.id}`
              );
            }
          }
        }
      }

      if (NON_BLOCKING_WHILE_RESTRICTED.has(tx.object_type)) {
        // Rule 5: do not emit transfer-block errors for these types.
      }

      const consumedIds = securityIdsFromTerminal(tx);
      const isConsumingTerminal = consumedIds.some((sid) => {
        const issuanceType = issuanceTypeForSecurity(issuances, sid);
        if (!issuanceType) {
          return false;
        }
        const terminals = TERMINAL_SECURITY_TX_BY_ISSUANCE[issuanceType] ?? [];
        return terminals.includes(tx.object_type);
      });

      const conversionLike = [
        "TX_CONVERTIBLE_CONVERSION",
        "TX_WARRANT_EXERCISE",
        "TX_EQUITY_COMPENSATION_EXERCISE",
        "TX_PLAN_SECURITY_EXERCISE",
      ].includes(tx.object_type);

      if (isConsumingTerminal && conversionLike) {
        const sourceId = tx.security_id;
        const openOnSource = restrictions.filter(
          (r) =>
            r.security_id === sourceId &&
            isOpenAt(r, txDate, endDateSetsLive, state)
        );
        const resultIds = resultingSecurityIds(tx);
        for (const r of openOnSource) {
          for (const resId of resultIds) {
            const succ = restrictions.find(
              (sr) =>
                sr.security_id === resId &&
                sr.restriction_type === r.restriction_type &&
                (sr.date ?? "") <= txDate
            );
            if (!succ) {
              push(
                "error",
                C.CONVERSION_MISSING_SUCCESSOR_RESTRICTION,
                `${tx.object_type} ${tx.id} requires successor restriction on ${resId} matching ${r.id}`
              );
            } else {
              const srcEnd = effectiveEndDate(r, endDateSetsLive);
              const succEnd = succ.end_date ?? endDateSetsLive.get(succ.id);
              if (srcEnd && succEnd && succEnd > srcEnd) {
                push(
                  "error",
                  C.CONVERSION_EXTENDED_END_DATE,
                  `Successor restriction ${succ.id} end_date ${succEnd} extends beyond source ${srcEnd}`
                );
              }
            }
          }
        }
      }

      if (isConsumingTerminal) {
        for (const sid of consumedIds) {
          for (const restriction of restrictions) {
            if (restriction.security_id !== sid) {
              continue;
            }
            const terminals = terminalTypesForSecurity(issuances, sid);
            if (!terminals.includes(tx.object_type)) {
              continue;
            }
            const st = state.get(restriction.id);
            if (st) {
              st.closed = true;
              st.closedDate = txDate;
            }
          }
        }
      }

      if (conversionLike) {
        const sourceId = tx.security_id;
        for (const restriction of restrictions) {
          if (
            restriction.security_id === sourceId &&
            isOpenAt(restriction, txDate, endDateSetsLive, state)
          ) {
            push(
              "error",
              C.CONVERSION_SOURCE_RESTRICTION_STILL_OPEN,
              `After ${tx.object_type} ${tx.id}, restriction ${restriction.id} on consumed security ${sourceId} is still open`
            );
          }
        }
      }
    }
  }

  for (const c of payload.transfer_restriction_cancellations ?? []) {
    const restriction = restrictionById.get(c.restriction_id);
    if (!restriction) {
      continue;
    }
    const st = state.get(restriction.id);
    if (st?.closed && !state.get(restriction.id)?.cancelled) {
      // handled in event loop
    }
  }
}
