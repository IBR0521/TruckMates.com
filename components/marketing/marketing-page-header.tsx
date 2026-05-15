import Link from "next/link"
import { ArrowLeft, type LucideIcon } from "lucide-react"

export function MarketingPageHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon?: LucideIcon
  title: string
  subtitle: string
}) {
  return (
    <div className="border-b border-border bg-card/50 backdrop-blur">
      <div className="container mx-auto px-4 py-16">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>
        <div className="max-w-3xl">
          {Icon ? (
            <div className="mb-4 flex items-center gap-3">
              <Icon className="h-8 w-8 text-primary" />
              <h1 className="text-4xl font-bold text-foreground md:text-5xl">{title}</h1>
            </div>
          ) : (
            <h1 className="mb-4 text-4xl font-bold text-foreground md:text-5xl">{title}</h1>
          )}
          <p className="text-xl text-muted-foreground">{subtitle}</p>
        </div>
      </div>
    </div>
  )
}
