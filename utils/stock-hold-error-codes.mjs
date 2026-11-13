/**
 * Semantic validation codes for profile `ocf.stock-hold` (OCIP stock-hold proposal).
 * @readonly
 */
export const STOCK_HOLD_ERROR_CODES = {
  STOP_QUANTITY_FORBIDDEN: "stock_hold_stop_quantity_forbidden",
  ORPHAN_CANCELLATION: "stock_hold_orphan_cancellation",
  DOUBLE_CANCELLATION: "stock_hold_double_cancellation",
  CANCELLATION_WRONG_SECURITY: "stock_hold_cancellation_wrong_security",
  SETTLEMENT_OVER_QUANTITY: "stock_hold_settlement_over_quantity",
  TERMINAL_DURING_STOP: "stock_hold_terminal_during_stop",
  CANCELLATION_OF_CLOSED_HOLD: "stock_hold_cancellation_of_closed_hold",
};

export const TERMINAL_STOCK_SECURITY_TX_TYPES = new Set([
  "TX_STOCK_TRANSFER",
  "TX_STOCK_CANCELLATION",
  "TX_STOCK_REPURCHASE",
  "TX_STOCK_RETRACTION",
  "TX_STOCK_CONVERSION",
  "TX_STOCK_REISSUANCE",
  "TX_STOCK_CONSOLIDATION",
]);
