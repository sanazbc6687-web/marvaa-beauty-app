export type GenerationRecoveryState = "safe_to_retry" | "manual_reconciliation_required";
/** Once provider invocation begins, its billing/result is unknown and only a human may reconcile it. */
export function recoveryStateForFailure(providerStarted: boolean): GenerationRecoveryState {
  return providerStarted ? "manual_reconciliation_required" : "safe_to_retry";
}
