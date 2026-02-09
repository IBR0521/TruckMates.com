import Link from "next/link"
import { DollarSign, FileText, Receipt, Calculator, CheckCircle2, ArrowLeft } from "lucide-react"

export default function AccountingFeaturesPage() {
  const features = [
    {
      icon: FileText,
      title: "Invoicing",
      description: "Create, send, and track invoices with automatic generation from delivered loads and QuickBooks integration.",
      details: [
        "Automatic invoice generation",
        "Custom invoice templates",
        "Email delivery",
        "Payment tracking",
        "QuickBooks sync"
      ]
    },
    {
      icon: Receipt,
      title: "Expense Tracking",
      description: "Track all fleet expenses including fuel, maintenance, tolls, and other costs with receipt management.",
      details: [
        "Fuel expense tracking",
        "Maintenance cost tracking",
        "Receipt upload and storage",
        "Category management",
        "Driver expense tracking"
      ]
    },
    {
      icon: Calculator,
      title: "Driver Settlements",
      description: "Automated driver settlement calculations with gross pay, deductions, and net pay calculations.",
      details: [
        "Automatic gross pay calculation",
        "Fuel deduction tracking",
        "Advance deduction management",
        "Net pay calculation",
        "Settlement reports"
      ]
    },
    {
      icon: DollarSign,
      title: "Financial Reports",
      description: "Comprehensive financial reports including profit & loss, revenue analysis, and expense breakdowns.",
      details: [
        "Profit & Loss reports",
        "Revenue analysis",
        "Expense breakdowns",
        "Driver payment reports",
        "Export to Excel/CSV"
      ]
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-16">
          <Link href="/features" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Features
          </Link>
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-lg bg-primary/10">
                <DollarSign className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground">
                Accounting & Finance
              </h1>
            </div>
            <p className="text-xl text-muted-foreground">
              Complete financial management with invoicing, expense tracking, driver settlements, and QuickBooks integration.
            </p>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto space-y-12">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <div key={feature.title} className="p-8 rounded-lg border border-border bg-card">
                <div className="flex items-start gap-4 mb-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-2xl font-semibold text-foreground mb-2">
                      {feature.title}
                    </h2>
                    <p className="text-muted-foreground mb-4">
                      {feature.description}
                    </p>
                    <ul className="space-y-2">
                      {feature.details.map((detail) => (
                        <li key={detail} className="flex items-center gap-2 text-muted-foreground">
                          <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                          {detail}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Benefits */}
      <div className="border-t border-border bg-card/50">
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-foreground mb-8 text-center">
              Benefits
            </h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="p-6 rounded-lg border border-border bg-card">
                <h3 className="font-semibold text-foreground mb-2">Automation</h3>
                <p className="text-sm text-muted-foreground">
                  Automate invoice generation and settlement calculations
                </p>
              </div>
              <div className="p-6 rounded-lg border border-border bg-card">
                <h3 className="font-semibold text-foreground mb-2">Accuracy</h3>
                <p className="text-sm text-muted-foreground">
                  Reduce errors with automated calculations and tracking
                </p>
              </div>
              <div className="p-6 rounded-lg border border-border bg-card">
                <h3 className="font-semibold text-foreground mb-2">Integration</h3>
                <p className="text-sm text-muted-foreground">
                  Seamless integration with QuickBooks and accounting systems
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}





