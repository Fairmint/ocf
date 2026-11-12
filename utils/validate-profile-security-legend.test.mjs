import { SECURITY_LEGEND_ERROR_CODES as C } from "./security-legend-error-codes.mjs";
import { validateSecurityLegendProfileSemantics } from "./validate-profile-security-legend.mjs";

const LEGENDS = new Set(["legend-regs", "legend-contract"]);

const SAFE_ISSUANCE = {
  object_type: "TX_CONVERTIBLE_ISSUANCE",
  id: "tx-safe",
  security_id: "sec-safe",
  date: "2024-03-01",
};

function runSemantics(payload, transactions) {
  /** @type {import('./validate-extensions.mjs').ExtensionIssue[]} */
  const issues = [];
  const push = (level, code, message) => {
    issues.push({ level, code, message });
  };
  validateSecurityLegendProfileSemantics(payload, transactions, LEGENDS, push);
  return issues.filter((i) => i.level === "error");
}

const validPayload = {
  security_legend_assignments: [
    {
      object_type: "SECURITY_LEGEND_ASSIGNMENT",
      id: "sla-1",
      date: "2024-03-01",
      security_id: "sec-safe",
      legend_ids: ["legend-regs", "legend-contract"],
    },
  ],
};

describe("security-legend semantics", () => {
  test("valid assignment on convertible", () => {
    expect(runSemantics(validPayload, [SAFE_ISSUANCE])).toEqual([]);
  });

  test("unknown security", () => {
    const errors = runSemantics(
      {
        security_legend_assignments: [
          {
            ...validPayload.security_legend_assignments[0],
            security_id: "sec-missing",
          },
        ],
      },
      [SAFE_ISSUANCE]
    );
    expect(errors.map((e) => e.code)).toEqual([C.UNKNOWN_SECURITY]);
  });

  test("security closed after cancellation", () => {
    const errors = runSemantics(validPayload, [
      SAFE_ISSUANCE,
      {
        object_type: "TX_CONVERTIBLE_CANCELLATION",
        id: "tx-cancel",
        security_id: "sec-safe",
        date: "2024-02-15",
        reason_text: "void",
      },
    ]);
    expect(errors.map((e) => e.code)).toEqual([C.SECURITY_CLOSED]);
  });

  test("date before issuance", () => {
    const errors = runSemantics(
      {
        security_legend_assignments: [
          {
            ...validPayload.security_legend_assignments[0],
            date: "2024-02-01",
          },
        ],
      },
      [SAFE_ISSUANCE]
    );
    expect(errors.map((e) => e.code)).toEqual([C.DATE_BEFORE_ISSUANCE]);
  });

  test("stock issuance forbidden", () => {
    const errors = runSemantics(
      {
        security_legend_assignments: [
          {
            ...validPayload.security_legend_assignments[0],
            security_id: "sec-stock",
            date: "2024-03-01",
          },
        ],
      },
      [
        {
          object_type: "TX_STOCK_ISSUANCE",
          id: "tx-stock",
          security_id: "sec-stock",
          date: "2024-03-01",
        },
      ]
    );
    expect(errors.map((e) => e.code)).toEqual([C.STOCK_ISSUANCE_FORBIDDEN]);
  });

  test("duplicate assignment per security_id", () => {
    const errors = runSemantics(
      {
        security_legend_assignments: [
          validPayload.security_legend_assignments[0],
          {
            ...validPayload.security_legend_assignments[0],
            id: "sla-2",
          },
        ],
      },
      [SAFE_ISSUANCE]
    );
    expect(errors.map((e) => e.code)).toEqual([C.DUPLICATE_ASSIGNMENT]);
  });

  test("unknown legend template", () => {
    const errors = runSemantics(
      {
        security_legend_assignments: [
          {
            ...validPayload.security_legend_assignments[0],
            legend_ids: ["legend-regs", "no-such-legend"],
          },
        ],
      },
      [SAFE_ISSUANCE]
    );
    expect(errors.map((e) => e.code)).toEqual([C.UNKNOWN_LEGEND_TEMPLATE]);
  });
});
