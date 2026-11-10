import {
  STOCK_HOLD_ERROR_CODES as C,
  TERMINAL_STOCK_SECURITY_TX_TYPES,
} from "./stock-hold-error-codes.mjs";

/**
 * @param {string | { numerator?: string, denominator?: string }} value
 * @returns {number}
 */
function parseNumeric(value) {
  if (value == null) {
    return NaN;
  }
  if (
    typeof value === "object" &&
    value.numerator != null &&
    value.denominator
  ) {
    const n = Number(value.numerator);
    const d = Number(value.denominator);
    if (!d) {
      return NaN;
    }
    return n / d;
  }
  return Number(value);
}

/**
 * @param {{ object_type: string, id: string, date?: string } & Record<string, unknown>} a
 * @param {{ object_type: string, id: string, date?: string } & Record<string, unknown>} b
 */
function cmpTxn(a, b) {
  const da = a.date ?? "";
  const db = b.date ?? "";
  if (da !== db) {
    return da < db ? -1 : 1;
  }
  return String(a.id).localeCompare(String(b.id));
}

/**
 * @param {import('./validate-extensions.mjs').ExtensionIssue[]} issues
 * @param {(level: 'error' | 'warning', code: string, message: string) => void} push
 */
function buildHoldState(payload) {
  /** @type {Map<string, { id: string, security_id: string, date: string, hold_type: string, quantity?: string, cancelled: boolean, closed: boolean }>} */
  const holds = new Map();
  for (const h of payload.stock_holds ?? []) {
    holds.set(h.id, {
      id: h.id,
      security_id: h.security_id,
      date: h.date,
      hold_type: h.hold_type,
      quantity: h.quantity,
      cancelled: false,
      closed: false,
    });
  }
  return holds;
}

/**
 * @param {unknown[]} transactions
 * @returns {Map<string, { stock_class_id: string, quantity: number, date: string }>}
 */
function indexIssuances(transactions) {
  const map = new Map();
  for (const tx of transactions) {
    if (tx.object_type === "TX_STOCK_ISSUANCE" && tx.security_id) {
      map.set(tx.security_id, {
        stock_class_id: tx.stock_class_id,
        quantity: parseNumeric(tx.quantity),
        date: tx.date ?? "",
      });
    }
  }
  return map;
}

/**
 * @param {unknown[]} transactions
 * @returns {Array<{ date: string, stock_class_id: string, ratio: number, id: string }>}
 */
function indexSplits(transactions) {
  const splits = [];
  for (const tx of transactions) {
    if (tx.object_type === "TX_STOCK_CLASS_SPLIT" && tx.stock_class_id) {
      splits.push({
        date: tx.date ?? "",
        stock_class_id: tx.stock_class_id,
        ratio: parseNumeric(tx.split_ratio),
        id: tx.id,
      });
    }
  }
  splits.sort(cmpTxn);
  return splits;
}

/**
 * @param {string} securityId
 * @param {string} asOfDate
 * @param {Map<string, { stock_class_id: string, quantity: number, date: string }>} issuances
 * @param {unknown[]} transactions
 * @param {ReturnType<typeof indexSplits>} splits
 */
function securityQuantityAtDate(
  securityId,
  asOfDate,
  issuances,
  transactions,
  splits
) {
  const issue = issuances.get(securityId);
  if (!issue || !Number.isFinite(issue.quantity)) {
    return NaN;
  }
  let qty = issue.quantity;
  const classSplits = splits.filter(
    (s) =>
      s.stock_class_id === issue.stock_class_id &&
      s.date <= asOfDate &&
      s.date >= issue.date
  );
  for (const s of classSplits) {
    if (Number.isFinite(s.ratio)) {
      qty *= s.ratio;
    }
  }
  for (const tx of transactions.sort(cmpTxn)) {
    if ((tx.date ?? "") > asOfDate) {
      break;
    }
    if (!touchesSecurity(tx, securityId)) {
      continue;
    }
    if (TERMINAL_STOCK_SECURITY_TX_TYPES.has(tx.object_type)) {
      if (tx.object_type === "TX_STOCK_TRANSFER" && tx.quantity != null) {
        qty -= parseNumeric(tx.quantity);
      } else if (
        tx.object_type === "TX_STOCK_CANCELLATION" &&
        tx.quantity != null
      ) {
        qty -= parseNumeric(tx.quantity);
      } else if (
        tx.object_type === "TX_STOCK_REPURCHASE" &&
        tx.quantity != null
      ) {
        qty -= parseNumeric(tx.quantity);
      } else if (
        tx.object_type === "TX_STOCK_CONSOLIDATION" &&
        Array.isArray(tx.security_ids)
      ) {
        if (tx.security_ids.includes(securityId)) {
          qty = 0;
        }
      } else if (
        [
          "TX_STOCK_RETRACTION",
          "TX_STOCK_CONVERSION",
          "TX_STOCK_REISSUANCE",
        ].includes(tx.object_type)
      ) {
        qty = 0;
      }
    }
  }
  return Math.max(0, qty);
}

/**
 * @param {Record<string, unknown>} tx
 * @param {string} securityId
 */
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
 * Settlement hold quantity that counts toward outstanding caps on security at asOfDate.
 */
function effectiveSettlementQuantity(hold, asOfDate, issuances, splits) {
  if (hold.hold_type !== "REGISTER_SETTLEMENT" || hold.closed) {
    return 0;
  }
  if (hold.cancelled && hold.cancelledDate && hold.cancelledDate <= asOfDate) {
    return 0;
  }
  const issue = issuances.get(hold.security_id);
  if (!issue) {
    return 0;
  }
  const voidedBySplit = splits.some(
    (s) =>
      s.stock_class_id === issue.stock_class_id &&
      s.date > hold.date &&
      s.date <= asOfDate
  );
  if (voidedBySplit) {
    return 0;
  }
  return parseNumeric(hold.quantity);
}

/**
 * @param {object} payload
 * @param {unknown[]} transactions
 * @param {(level: 'error' | 'warning', code: string, message: string) => void} push
 */
export function validateStockHoldProfileSemantics(payload, transactions, push) {
  const holds = buildHoldState(payload);
  const issuances = indexIssuances(transactions);
  const splits = indexSplits(transactions);
  const cancellationsByHold = new Map();

  for (const h of payload.stock_holds ?? []) {
    if (
      h.hold_type === "STOP_TRANSFER" &&
      h.quantity !== undefined &&
      h.quantity !== null
    ) {
      push(
        "error",
        C.STOP_QUANTITY_FORBIDDEN,
        `STOP_TRANSFER hold ${h.id} must not include quantity`
      );
    }
  }

  const events = [
    ...transactions.map((tx) => ({
      kind: "ocf",
      date: tx.date ?? "",
      id: tx.id,
      tx,
    })),
    ...(payload.stock_holds ?? []).map((h) => ({
      kind: "hold",
      date: h.date,
      id: h.id,
      hold: h,
    })),
    ...(payload.stock_hold_cancellations ?? []).map((c) => ({
      kind: "cancel",
      date: c.date,
      id: c.id,
      cancel: c,
    })),
  ];
  events.sort((a, b) => {
    if (a.date !== b.date) {
      return a.date < b.date ? -1 : 1;
    }
    const kindOrder = { hold: 0, cancel: 1, ocf: 2 };
    return kindOrder[a.kind] - kindOrder[b.kind];
  });

  for (const event of events) {
    if (event.kind === "cancel") {
      const cancel = event.cancel;
      const hold = holds.get(cancel.hold_id);
      if (!hold) {
        push(
          "error",
          C.ORPHAN_CANCELLATION,
          `Hold cancellation ${cancel.id} references unknown hold_id ${cancel.hold_id}`
        );
        continue;
      }
      if (cancel.security_id !== hold.security_id) {
        push(
          "error",
          C.CANCELLATION_WRONG_SECURITY,
          `Cancellation ${cancel.id} security_id ${cancel.security_id} does not match hold ${cancel.hold_id} security ${hold.security_id}`
        );
      }
      const seen = cancellationsByHold.get(cancel.hold_id) ?? 0;
      cancellationsByHold.set(cancel.hold_id, seen + 1);
      if (seen >= 1) {
        push(
          "error",
          C.DOUBLE_CANCELLATION,
          `Hold ${cancel.hold_id} has more than one cancellation`
        );
      }
      hold.cancelled = true;
      hold.cancelledDate = cancel.date;
    }

    if (
      event.kind === "hold" &&
      event.hold.hold_type === "REGISTER_SETTLEMENT"
    ) {
      const hold = holds.get(event.hold.id);
      if (!hold) {
        continue;
      }
      const outstanding = securityQuantityAtDate(
        hold.security_id,
        hold.date,
        issuances,
        transactions,
        splits
      );
      let sum = 0;
      for (const other of holds.values()) {
        if (other.security_id !== hold.security_id) {
          continue;
        }
        if (other.date > hold.date) {
          continue;
        }
        if (other.cancelled && other.cancelledDate <= hold.date) {
          continue;
        }
        sum += effectiveSettlementQuantity(other, hold.date, issuances, splits);
      }
      if (
        Number.isFinite(outstanding) &&
        Number.isFinite(sum) &&
        sum > outstanding + 1e-9
      ) {
        push(
          "error",
          C.SETTLEMENT_OVER_QUANTITY,
          `REGISTER_SETTLEMENT holds on ${hold.security_id} total ${sum} exceeds outstanding ${outstanding} on ${hold.date}`
        );
      }
    }

    if (
      event.kind === "ocf" &&
      TERMINAL_STOCK_SECURITY_TX_TYPES.has(event.tx.object_type)
    ) {
      const securityIds = [];
      if (event.tx.security_id) {
        securityIds.push(event.tx.security_id);
      }
      if (Array.isArray(event.tx.security_ids)) {
        securityIds.push(...event.tx.security_ids);
      }
      for (const sid of securityIds) {
        for (const hold of holds.values()) {
          if (
            hold.security_id === sid &&
            hold.hold_type === "STOP_TRANSFER" &&
            !hold.closed &&
            hold.date <= event.date &&
            (!hold.cancelled || hold.cancelledDate > event.date)
          ) {
            push(
              "error",
              C.TERMINAL_DURING_STOP,
              `${event.tx.object_type} ${event.tx.id} on ${sid} while STOP_TRANSFER hold ${hold.id} is open`
            );
          }
        }
        for (const hold of holds.values()) {
          if (hold.security_id === sid && !hold.cancelled) {
            hold.closed = true;
          }
        }
      }
    }
  }
}
