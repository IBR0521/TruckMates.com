import Link from "next/link"
import { ArrowLeft, Wrench } from "lucide-react"

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="border-b border-border bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-16">
          <Link href="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">About TruckMates</h1>
            <p className="text-xl text-muted-foreground">Built small, on purpose.</p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto space-y-8">
          <div className="p-8 rounded-lg border border-border bg-card">
            <p className="text-lg text-muted-foreground leading-relaxed mb-6">
              TruckMates was built by <strong className="text-foreground">a single developer</strong> who watched small
              fleet operators drown in spreadsheets, paper BOLs, and tools that weren&apos;t built for how they actually
              work. The product launched in <strong className="text-foreground">2024</strong> — not from a venture-backed
              &quot;customer success team,&quot; but from one person shipping software for fleets that need professional
              operations without enterprise pricing or enterprise complexity.
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed mb-6">
              We focus on <strong className="text-foreground">fleets roughly 5–20 trucks</strong> — owner-operators and
              small carriers who run the business themselves and don&apos;t have time for inflated marketing or fake ROI
              numbers. If that sounds like you, the product is aimed at you.
            </p>
            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border border-border">
              <Wrench className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                We&apos;d rather say &quot;here&apos;s what works today&quot; than promise what isn&apos;t shipped. Check
                the <Link href="/integrations">integrations page</Link>, the <Link href="/pricing">pricing</Link> page, and
                the in-app demo — then decide.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
