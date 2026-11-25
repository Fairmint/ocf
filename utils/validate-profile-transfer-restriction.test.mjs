import {
  TRANSFER_RESTRICTION_ERROR_CODES as C,
  TERMINAL_SECURITY_TX_BY_ISSUANCE,
} from "./transfer-restriction-error-codes.mjs";
import { validateTransferRestrictionProfileSemantics } from "./validate-profile-transfer-restriction.mjs";

const SAFE_ISSUANCE = {
  object_type: "TX_CONVERTIBLE_ISSUANCE",
  id: "tx-safe",
  security_id: "sec-safe-001",
  date: "2026-01-15",
};

const EMPTY_PROFILE_TAIL = {
  transfer_restriction_end_date_sets: [],
  transfer_permitted: [],
  transfer_restriction_cancellations: [],
};

function terminalTx(issuanceType, object_type) {
  const base = { object_type, id: `tx-${object_type}`, date: "2026-04-01" };
  switch (object_type) {
    case "TX_CONVERTIBLE_TRANSFER":
      return {
        ...base,
        security_id: "sec-safe-001",
        amount: { amount: "1", currency: "USD" },
      };
    case "TX_CONVERTIBLE_CANCELLATION":
      return {
        ...base,
        security_id: "sec-safe-001",
        amount: { amount: "1", currency: "USD" },
        reason_text: "done",
      };
    case "TX_CONVERTIBLE_CONVERSION":
      return {
        ...base,
        security_id: "sec-safe-001",
        reason_text: "convert",
        trigger_id: "T",
        resulting_security_ids: ["sec-new"],
      };
    case "TX_CONVERTIBLE_RETRACTION":
      return { ...base, security_id: "sec-safe-001", reason_text: "oops" };
    case "TX_STOCK_TRANSFER":
      return {
        ...base,
        security_id: "sec-sh",
        quantity: "1",
        resulting_security_ids: ["sec-sh-b"],
      };
    default:
      return { ...base, security_id: "sec-safe-001", reason_text: "x" };
  }
}

describe("transfer-restriction lifecycle closure", () => {
  const convertibleTerminals =
    TERMINAL_SECURITY_TX_BY_ISSUANCE.TX_CONVERTIBLE_ISSUANCE;

  test.each(
    convertibleTerminals.filter((t) => t !== "TX_CONVERTIBLE_TRANSFER")
  )("post-terminal EndDateSet on convertible %s is rejected", (object_type) => {
    const payload = {
      transfer_restrictions: [
        {
          object_type: "TX_TRANSFER_RESTRICTION",
          id: "tr-1",
          security_id: "sec-safe-001",
          date: "2026-01-15",
          restriction_type: "DISTRIBUTION_COMPLIANCE_PERIOD",
        },
      ],
      ...EMPTY_PROFILE_TAIL,
      transfer_restriction_end_date_sets: [
        {
          object_type: "TX_TRANSFER_RESTRICTION_END_DATE_SET",
          id: "eds-late",
          date: "2026-05-01",
          restriction_id: "tr-1",
          security_id: "sec-safe-001",
          end_date: "2027-06-15",
        },
      ],
    };
    const txs = [
      SAFE_ISSUANCE,
      terminalTx("TX_CONVERTIBLE_ISSUANCE", object_type),
    ];
    const issues = [];
    validateTransferRestrictionProfileSemantics(payload, txs, (level, code) => {
      if (level === "error") {
        issues.push(code);
      }
    });
    expect(issues).toContain(C.END_DATE_SET_ON_CLOSED_RESTRICTION);
  });
});
