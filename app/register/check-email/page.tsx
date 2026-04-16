import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Mail } from "lucide-react"

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams?: Promise<{ email?: string; next?: string }>
}) {
  const params = (await searchParams) || {}
  const email = params.email ? decodeURIComponent(params.email) : ""
  const decodedNext = params.next ? decodeURIComponent(params.next) : ""
  const next = decodedNext.startsWith("/") ? decodedNext : "/pricing?onboarding=1"

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Card className="w-full max-w-lg p-8">
        <div className="flex items-center gap-3">
          <Mail className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Check your email</h1>
        </div>
        <p className="mt-4 text-muted-foreground">
          We sent a confirmation link{email ? ` to ${email}` : ""}. Confirm your email first, then continue onboarding.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          After verification, you will be redirected to your next step automatically.
        </p>

        <div className="mt-6 space-y-3">
          <Button asChild className="w-full">
            <Link href="/login">Go to login</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href={next}>Continue after confirmation</Link>
          </Button>
        </div>
      </Card>
    </div>
  )
}
