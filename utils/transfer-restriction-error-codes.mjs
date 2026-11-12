/**
 * Semantic validation codes for profile `ocf.transfer-restriction`.
 * @readonly
 */
export const TRANSFER_RESTRICTION_ERROR_CODES = {
  UNKNOWN_SECURITY: "transfer_restriction_unknown_security",
  DATE_BEFORE_ISSUANCE: "transfer_restriction_date_before_issuance",
  END_DATE_BEFORE_START: "transfer_restriction_end_date_before_start",
  DCP_TRANSFER_WITHOUT_PERMIT:
    "transfer_restriction_dcp_transfer_without_permit",
  LOCKUP_TRANSFER_WITHOUT_PERMIT:
    "transfer_restriction_lockup_transfer_without_permit",
  PERMIT_WRONG_BASIS: "transfer_restriction_permit_wrong_basis",
  DCP_CANCELLATION_FORBIDDEN: "transfer_restriction_dcp_cancellation_forbidden",
  END_DATE_SET_WHEN_END_DATE_PRESENT:
    "transfer_restriction_end_date_set_when_end_date_present",
  END_DATE_SET_UNKNOWN_RESTRICTION:
    "transfer_restriction_end_date_set_unknown_restriction",
  END_DATE_SET_ON_CLOSED_RESTRICTION:
    "transfer_restriction_end_date_set_on_closed_restriction",
  DOUBLE_END_DATE_SET: "transfer_restriction_double_end_date_set",
  CANCELLATION_UNKNOWN_RESTRICTION:
    "transfer_restriction_cancellation_unknown_restriction",
  CANCELLATION_ON_CLOSED_RESTRICTION:
    "transfer_restriction_cancellation_on_closed_restriction",
  CANCELLATION_AFTER_END: "transfer_restriction_cancellation_after_end",
  PERMIT_UNKNOWN_RESTRICTION: "transfer_restriction_permit_unknown_restriction",
  PERMIT_ON_CLOSED_RESTRICTION:
    "transfer_restriction_permit_on_closed_restriction",
  CONVERSION_SOURCE_RESTRICTION_STILL_OPEN:
    "transfer_restriction_conversion_source_restriction_still_open",
  CONVERSION_EXTENDED_END_DATE:
    "transfer_restriction_conversion_extended_end_date",
  CONVERSION_MISSING_SUCCESSOR_RESTRICTION:
    "transfer_restriction_conversion_missing_successor_restriction",
};

export const ISSUANCE_OBJECT_TYPES = new Set([
  "TX_STOCK_ISSUANCE",
  "TX_CONVERTIBLE_ISSUANCE",
  "TX_WARRANT_ISSUANCE",
  "TX_EQUITY_COMPENSATION_ISSUANCE",
  "TX_PLAN_SECURITY_ISSUANCE",
]);

export const TRANSFER_OBJECT_TYPES = new Set([
  "TX_STOCK_TRANSFER",
  "TX_CONVERTIBLE_TRANSFER",
  "TX_WARRANT_TRANSFER",
  "TX_EQUITY_COMPENSATION_TRANSFER",
  "TX_PLAN_SECURITY_TRANSFER",
]);

/** Terminals that consume a security (restriction closes). */
export const TERMINAL_SECURITY_TX_BY_ISSUANCE = {
  TX_STOCK_ISSUANCE: [
    "TX_STOCK_TRANSFER",
    "TX_STOCK_CANCELLATION",
    "TX_STOCK_REPURCHASE",
    "TX_STOCK_RETRACTION",
    "TX_STOCK_CONVERSION",
    "TX_STOCK_REISSUANCE",
    "TX_STOCK_CONSOLIDATION",
  ],
  TX_CONVERTIBLE_ISSUANCE: [
    "TX_CONVERTIBLE_TRANSFER",
    "TX_CONVERTIBLE_CANCELLATION",
    "TX_CONVERTIBLE_CONVERSION",
    "TX_CONVERTIBLE_RETRACTION",
  ],
  TX_WARRANT_ISSUANCE: [
    "TX_WARRANT_TRANSFER",
    "TX_WARRANT_CANCELLATION",
    "TX_WARRANT_EXERCISE",
    "TX_WARRANT_RETRACTION",
  ],
  TX_EQUITY_COMPENSATION_ISSUANCE: [
    "TX_EQUITY_COMPENSATION_TRANSFER",
    "TX_EQUITY_COMPENSATION_CANCELLATION",
    "TX_EQUITY_COMPENSATION_EXERCISE",
    "TX_EQUITY_COMPENSATION_RETRACTION",
  ],
  TX_PLAN_SECURITY_ISSUANCE: [
    "TX_PLAN_SECURITY_TRANSFER",
    "TX_PLAN_SECURITY_CANCELLATION",
    "TX_PLAN_SECURITY_EXERCISE",
    "TX_PLAN_SECURITY_RETRACTION",
  ],
};

export const NON_BLOCKING_WHILE_RESTRICTED = new Set([
  "TX_STOCK_CANCELLATION",
  "TX_STOCK_REPURCHASE",
  "TX_STOCK_RETRACTION",
  "TX_STOCK_CONVERSION",
  "TX_STOCK_REISSUANCE",
  "TX_STOCK_CONSOLIDATION",
  "TX_CONVERTIBLE_CANCELLATION",
  "TX_CONVERTIBLE_CONVERSION",
  "TX_CONVERTIBLE_RETRACTION",
  "TX_WARRANT_CANCELLATION",
  "TX_WARRANT_EXERCISE",
  "TX_WARRANT_RETRACTION",
  "TX_EQUITY_COMPENSATION_CANCELLATION",
  "TX_EQUITY_COMPENSATION_EXERCISE",
  "TX_EQUITY_COMPENSATION_RETRACTION",
  "TX_PLAN_SECURITY_CANCELLATION",
  "TX_PLAN_SECURITY_EXERCISE",
  "TX_PLAN_SECURITY_RETRACTION",
]);

export const DCP_BASES = new Set(["REGULATION_S", "REGISTRATION", "EXEMPTION"]);
export const LOCKUP_BASES = new Set(["CONTRACTUAL_EXCEPTION"]);
