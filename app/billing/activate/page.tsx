import Link from "next/link"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getCompanySubscriptionAccess } from "@/lib/subscription-access"
import { startBillingCheckoutSession } from "@/app/actions/subscription-onboarding"

export default async function BillingActivationPage({
  searchParams,
}: {
  searchParams?: Promise<{ step?: string; error?: string; canceled?: string; checkout?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const access = await getCompanySubscriptionAccess()
  if (access.allowed) {
    redirect("/dashboard")
  }

  const resolvedSearchParams = (await searchParams) || {}
  const isPaymentStep = resolvedSearchParams.step === "payment"
  const checkoutCanceled = resolvedSearchParams.canceled === "1"
  const checkoutError = resolvedSearchParams.error
  const checkoutSuccess = resolvedSearchParams.checkout === "success"

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-xl p-8">
        <h1 className="text-2xl font-bold text-foreground">Billing required</h1>
        <p className="mt-2 text-muted-foreground">
          {isPaymentStep
            ? "Plan selected. Complete payment setup to activate your account."
            : "Your account cannot access the platform until subscription billing is completed."}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Current status: <span className="font-medium text-foreground">{access.status || "inactive"}</span>
        </p>
        {checkoutCanceled && (
          <p className="mt-2 text-sm text-amber-500">Checkout was canceled. Please complete payment to continue.</p>
        )}
        {checkoutSuccess && (
          <p className="mt-2 text-sm text-primary">Payment submitted. We are activating your subscription now.</p>
        )}
        {checkoutError && (
          <p className="mt-2 text-sm text-destructive">Could not start checkout ({checkoutError}). Please try again.</p>
        )}

        <div className="mt-6 space-y-3">
          {isPaymentStep ? (
            <>
              <form action={startBillingCheckoutSession}>
                <Button type="submit" className="w-full">Complete payment setup</Button>
              </form>
              <Button asChild variant="outline" className="w-full">
                <Link href="/pricing?onboarding=1">Change plan</Link>
              </Button>
            </>
          ) : (
            <Button asChild className="w-full">
              <Link href="/pricing?onboarding=1">Choose plan to continue</Link>
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
