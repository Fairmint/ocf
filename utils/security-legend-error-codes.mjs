/**
 * Semantic validation codes for profile `ocf.security-legend`.
 * @readonly
 */
export const SECURITY_LEGEND_ERROR_CODES = {
  UNKNOWN_SECURITY: "security_legend_unknown_security",
  SECURITY_CLOSED: "security_legend_security_closed",
  DISALLOWED_ISSUANCE_TYPE: "security_legend_disallowed_issuance_type",
  DATE_BEFORE_ISSUANCE: "security_legend_date_before_issuance",
  UNKNOWN_LEGEND_TEMPLATE: "security_legend_unknown_legend_template",
  DUPLICATE_ASSIGNMENT: "security_legend_duplicate_assignment",
  STOCK_ISSUANCE_FORBIDDEN: "security_legend_stock_issuance_forbidden",
};

/** @readonly */
export const ALLOWED_LEGEND_ISSUANCE_TYPES = new Set([
  "TX_CONVERTIBLE_ISSUANCE",
  "TX_WARRANT_ISSUANCE",
  "TX_EQUITY_COMPENSATION_ISSUANCE",
  "TX_PLAN_SECURITY_ISSUANCE",
]);

/** Terminal transactions that close a profile-eligible security before a later assignment. */
export const SECURITY_LEGEND_CLOSING_TX_TYPES = new Set([
  "TX_CONVERTIBLE_CANCELLATION",
  "TX_CONVERTIBLE_RETRACTION",
  "TX_CONVERTIBLE_CONVERSION",
  "TX_WARRANT_CANCELLATION",
  "TX_WARRANT_EXERCISE",
  "TX_EQUITY_COMPENSATION_CANCELLATION",
  "TX_EQUITY_COMPENSATION_RETRACTION",
  "TX_EQUITY_COMPENSATION_EXERCISE",
  "TX_PLAN_SECURITY_CANCELLATION",
  "TX_PLAN_SECURITY_RETRACTION",
  "TX_PLAN_SECURITY_EXERCISE",
]);
