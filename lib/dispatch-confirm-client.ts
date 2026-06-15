import { getDispatchWorkflowFlags } from "@/app/actions/operations-workflow"

/** Client-side confirmation when Settings → Dispatch requires it. */
export async function ensureDispatchConfirmed(): Promise<boolean> {
  const result = await getDispatchWorkflowFlags()
  if (result.error || !result.data?.require_confirmation_before_dispatch) {
    return true
  }
  return window.confirm(
    "Confirm dispatch? The driver and truck will be assigned and the load will move to scheduled when ready.",
  )
}
