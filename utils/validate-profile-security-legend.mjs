import {
  ALLOWED_LEGEND_ISSUANCE_TYPES,
  SECURITY_LEGEND_CLOSING_TX_TYPES,
  SECURITY_LEGEND_ERROR_CODES as C,
} from "./security-legend-error-codes.mjs";

/**
 * @param {unknown[]} transactions
 * @returns {{ bySecurity: Map<string, { object_type: string, date: string, id: string }>, stockSecurities: Set<string>, otherIssuance: Map<string, string> }}
 */
function indexSecurities(transactions) {
  /** @type {Map<string, { object_type: string, date: string, id: string }>} */
  const bySecurity = new Map();
  /** @type {Set<string>} */
  const stockSecurities = new Set();
  /** @type {Map<string, string>} */
  const otherIssuance = new Map();

  for (const tx of transactions) {
    const sid = tx?.security_id;
    if (!sid || typeof sid !== "string") {
      continue;
    }
    if (tx.object_type === "TX_STOCK_ISSUANCE") {
      stockSecurities.add(sid);
      continue;
    }
    if (ALLOWED_LEGEND_ISSUANCE_TYPES.has(tx.object_type)) {
      if (!bySecurity.has(sid)) {
        bySecurity.set(sid, {
          object_type: tx.object_type,
          date: tx.date ?? "",
          id: tx.id,
        });
      }
      continue;
    }
    if (/_ISSUANCE$/.test(String(tx.object_type)) && !bySecurity.has(sid)) {
      otherIssuance.set(sid, tx.object_type);
    }
  }
  return { bySecurity, stockSecurities, otherIssuance };
}

/**
 * @param {unknown[]} transactions
 * @param {string} securityId
 * @param {string} beforeOrOnDate
 */
function securityClosedOnOrBefore(transactions, securityId, beforeOrOnDate) {
  for (const tx of transactions) {
    if (tx?.security_id !== securityId) {
      continue;
    }
    if (!SECURITY_LEGEND_CLOSING_TX_TYPES.has(tx.object_type)) {
      continue;
    }
    const closeDate = tx.date ?? "";
    if (closeDate && closeDate <= beforeOrOnDate) {
      return {
        closed: true,
        closeDate,
        txId: tx.id,
        objectType: tx.object_type,
      };
    }
  }
  return { closed: false };
}

/**
 * @param {object} payload
 * @param {unknown[]} transactions
 * @param {Set<string>} legendTemplateIds
 * @param {(level: 'error' | 'warning', code: string, message: string) => void} push
 */
export function validateSecurityLegendProfileSemantics(
  payload,
  transactions,
  legendTemplateIds,
  push
) {
  const assignments = payload.security_legend_assignments ?? [];
  const seenSecurity = new Map();

  for (const assignment of assignments) {
    const sid = assignment.security_id;
    const prior = seenSecurity.get(sid) ?? 0;
    seenSecurity.set(sid, prior + 1);
    if (prior >= 1) {
      push(
        "error",
        C.DUPLICATE_ASSIGNMENT,
        `More than one security_legend_assignment for security_id ${sid}`
      );
    }
  }

  const { bySecurity, stockSecurities, otherIssuance } =
    indexSecurities(transactions);

  for (const assignment of assignments) {
    const sid = assignment.security_id;
    const assignmentDate = assignment.date ?? "";

    if (stockSecurities.has(sid)) {
      push(
        "error",
        C.STOCK_ISSUANCE_FORBIDDEN,
        `security_id ${sid} is from TX_STOCK_ISSUANCE; use stock_legend_ids in v1`
      );
      continue;
    }

    const issuance = bySecurity.get(sid);
    if (!issuance) {
      if (otherIssuance.has(sid)) {
        push(
          "error",
          C.DISALLOWED_ISSUANCE_TYPE,
          `security_id ${sid} issuance type ${otherIssuance.get(
            sid
          )} is not allowed for this profile`
        );
      } else {
        push(
          "error",
          C.UNKNOWN_SECURITY,
          `security_id ${sid} does not refer to an allowed issuance transaction`
        );
      }
      continue;
    }

    const closed = securityClosedOnOrBefore(transactions, sid, assignmentDate);
    if (closed.closed) {
      push(
        "error",
        C.SECURITY_CLOSED,
        `security_id ${sid} was closed by ${closed.objectType} ${closed.txId} on ${closed.closeDate} before assignment ${assignment.id} on ${assignmentDate}`
      );
      continue;
    }

    if (assignmentDate < issuance.date) {
      push(
        "error",
        C.DATE_BEFORE_ISSUANCE,
        `Assignment ${assignment.id} date ${assignmentDate} precedes issuance ${issuance.id} date ${issuance.date}`
      );
    }

    for (const legendId of assignment.legend_ids ?? []) {
      if (!legendTemplateIds.has(legendId)) {
        push(
          "error",
          C.UNKNOWN_LEGEND_TEMPLATE,
          `legend_ids entry ${legendId} in assignment ${assignment.id} is not a STOCK_LEGEND_TEMPLATE id`
        );
      }
    }
  }
}
