import {
  STOCK_HOLD_ERROR_CODES as C,
  TERMINAL_STOCK_SECURITY_TX_TYPES,
} from "./stock-hold-error-codes.mjs";
import { validateStockHoldProfileSemantics } from "./validate-profile-stock-hold.mjs";

const ISSUANCE = {
  object_type: "TX_STOCK_ISSUANCE",
  id: "tx-issue",
  security_id: "sec-1",
  date: "2024-01-01",
  stock_class_id: "sc-1",
  quantity: "100",
  stakeholder_id: "sh-1",
  security_law_exemptions: [],
  custom_id: "C",
  share_price: { amount: "1", currency: "USD" },
  cost_basis: { amount: "0", currency: "USD" },
  stock_legend_ids: [],
};

const BASE_HOLD_PAYLOAD = {
  stock_holds: [
    {
      object_type: "TX_STOCK_HOLD",
      id: "hold-1",
      security_id: "sec-1",
      date: "2024-02-01",
      hold_type: "REGISTER_SETTLEMENT",
      reference: "REF",
      reason_text: "test",
      quantity: "10",
    },
  ],
  stock_hold_cancellations: [],
};

function terminalTx(object_type) {
  const base = {
    object_type,
    id: `tx-${object_type}`,
    date: "2024-03-01",
  };
  switch (object_type) {
    case "TX_STOCK_TRANSFER":
      return {
        ...base,
        security_id: "sec-1",
        quantity: "5",
        resulting_security_ids: ["sec-1-b"],
      };
    case "TX_STOCK_CANCELLATION":
    case "TX_STOCK_REPURCHASE":
      return { ...base, security_id: "sec-1", quantity: "5" };
    case "TX_STOCK_RETRACTION":
    case "TX_STOCK_CONVERSION":
    case "TX_STOCK_REISSUANCE":
      return { ...base, security_id: "sec-1" };
    case "TX_STOCK_CONSOLIDATION":
      return {
        ...base,
        security_ids: ["sec-1", "sec-2"],
        resulting_security_id: "sec-new",
      };
    default:
      throw new Error(`unhandled ${object_type}`);
  }
}

describe("stock-hold terminal closure (rule 3)", () => {
  test.each([...TERMINAL_STOCK_SECURITY_TX_TYPES])(
    "%s closes hold; later cancellation is rejected",
    (object_type) => {
      const txs = [ISSUANCE, terminalTx(object_type)];
      if (object_type === "TX_STOCK_CONSOLIDATION") {
        txs.push({
          ...ISSUANCE,
          id: "tx-issue-2",
          security_id: "sec-2",
        });
      }
      const payload = {
        ...BASE_HOLD_PAYLOAD,
        stock_hold_cancellations: [
          {
            object_type: "TX_STOCK_HOLD_CANCELLATION",
            id: "cancel-late",
            date: "2024-04-01",
            hold_id: "hold-1",
            security_id: "sec-1",
            reason_text: "too late",
          },
        ],
      };
      /** @type {import('./validate-extensions.mjs').ExtensionIssue[]} */
      const issues = [];
      const push = (level, code, message) => {
        issues.push({ level, code, message });
      };
      validateStockHoldProfileSemantics(payload, txs, push);
      const errors = issues
        .filter((i) => i.level === "error")
        .map((i) => i.code);
      expect(errors).toEqual([C.CANCELLATION_OF_CLOSED_HOLD]);
    }
  );
});
