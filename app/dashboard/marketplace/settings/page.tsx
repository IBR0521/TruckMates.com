"use client"

import { MarketplaceComingSoon } from "@/components/marketplace-coming-soon"

export default function MarketplaceSettingsPage() {
  return <MarketplaceComingSoon />
  return (
    <div className="w-full bg-background">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/marketplace">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Marketplace Settings</h1>
            <p className="text-muted-foreground mt-2">
              Configure your marketplace preferences
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          <Card className="p-6">
            <p className="text-muted-foreground">
              Marketplace settings will be available soon. For now, you can post loads and accept loads from the marketplace.
            </p>
          </Card>
        </div>
      </div>
    </div>
  )
}
