"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, Download, Send, Mail, MessageSquare, Share2 } from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { exportToPDF } from "@/lib/export-utils"
import { toast } from "sonner"

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null)
  const [showShareMenu, setShowShareMenu] = useState(false)
  const router = useRouter()

  useEffect(() => {
    params.then((resolvedParams) => {
      if (resolvedParams.id === "add" || resolvedParams.id === "create") {
        router.push("/dashboard/accounting/invoices/create")
      } else {
        setId(resolvedParams.id)
      }
    })
  }, [params, router])

  if (!id) {
    return null
  }

  const invoice = {
    id: id,
    customer: "ABC Logistics",
    load: "LD-234",
    amount: "$2,450.00",
    status: "Paid",
    dueDate: "01/15/2025",
    issueDate: "12/20/2024",
    paymentTerms: "Net 30",
    description: "Freight delivery services from New York to Philadelphia",
    items: [
      { description: "Freight Charge", quantity: 1, rate: 2200, amount: 2200 },
      { description: "Fuel Surcharge", quantity: 1, rate: 250, amount: 250 },
    ],
  }

  const handleDownload = () => {
    try {
      const content = `
        <h1>Invoice ${invoice.id}</h1>
        <p>Customer: ${invoice.customer}</p>
        <p>Amount: ${invoice.amount}</p>
        <p>Due Date: ${invoice.dueDate}</p>
        <p>Status: ${invoice.status}</p>
      `
      exportToPDF(content, `invoice-${invoice.id}`)
      toast.success("Invoice downloaded successfully")
    } catch (error) {
      toast.error("Failed to download invoice")
    }
  }

  const handleShare = (method: string) => {
    const message = `Invoice ${invoice.id} - Amount: ${invoice.amount} - Due: ${invoice.dueDate}`
    const url = window.location.href

    switch (method) {
      case "email":
        window.location.href = `mailto:?subject=Invoice ${invoice.id}&body=${encodeURIComponent(message + "\n" + url)}`
        toast.success("Opening email client...")
        break
      case "whatsapp":
        window.open(`https://wa.me/?text=${encodeURIComponent(message + " " + url)}`, "_blank")
        toast.success("Opening WhatsApp...")
        break
      case "telegram":
        window.open(
          `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(message)}`,
          "_blank",
        )
        toast.success("Opening Telegram...")
        break
    }
    setShowShareMenu(false)
  }

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/30 backdrop-blur px-8 py-6">
        <Link href="/dashboard/accounting/invoices">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Invoices
          </Button>
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Invoice {invoice.id}</h1>
            <p className="text-muted-foreground text-sm mt-1">Issued on {invoice.issueDate}</p>
          </div>
          <div className="flex gap-2 relative">
            <Button onClick={handleDownload} variant="outline" className="border-border bg-transparent">
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
            <Button onClick={() => setShowShareMenu(!showShareMenu)} className="bg-primary hover:bg-primary/90">
              <Share2 className="w-4 h-4 mr-2" />
              Send Invoice
            </Button>
            {showShareMenu && (
              <Card className="absolute top-12 right-0 z-10 border-border p-2 min-w-[180px]">
                <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => handleShare("email")}>
                  <Mail className="w-4 h-4 mr-2" />
                  Email
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => handleShare("whatsapp")}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  WhatsApp
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => handleShare("telegram")}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Telegram
                </Button>
              </Card>
            )}
          </div>
        </div>
      </div>

      <div className="p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card className="border-border p-8">
            <div className="grid md:grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">BILL TO</h3>
                <p className="text-lg font-bold text-foreground">{invoice.customer}</p>
                <p className="text-sm text-muted-foreground">123 Customer Street</p>
                <p className="text-sm text-muted-foreground">New York, NY 10001</p>
              </div>
              <div className="text-right">
                <div className="mb-4">
                  <span
                    className={`px-4 py-2 rounded-full text-sm font-semibold ${
                      invoice.status === "Paid" ? "bg-green-500/20 text-green-400" : "bg-yellow-500/20 text-yellow-400"
                    }`}
                  >
                    {invoice.status}
                  </span>
                </div>
                <div className="space-y-1 text-sm">
                  <p className="text-muted-foreground">
                    Invoice Date: <span className="text-foreground font-medium">{invoice.issueDate}</span>
                  </p>
                  <p className="text-muted-foreground">
                    Due Date: <span className="text-foreground font-medium">{invoice.dueDate}</span>
                  </p>
                  <p className="text-muted-foreground">
                    Terms: <span className="text-foreground font-medium">{invoice.paymentTerms}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-6">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 text-sm font-semibold text-foreground">Description</th>
                    <th className="text-right py-3 text-sm font-semibold text-foreground">Qty</th>
                    <th className="text-right py-3 text-sm font-semibold text-foreground">Rate</th>
                    <th className="text-right py-3 text-sm font-semibold text-foreground">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="py-3 text-foreground">{item.description}</td>
                      <td className="text-right py-3 text-foreground">{item.quantity}</td>
                      <td className="text-right py-3 text-foreground">${item.rate}</td>
                      <td className="text-right py-3 text-foreground font-semibold">${item.amount}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="pt-6 text-right text-lg font-semibold text-foreground">
                      Total Amount:
                    </td>
                    <td className="pt-6 text-right text-2xl font-bold text-primary">{invoice.amount}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {invoice.description && (
              <div className="border-t border-border pt-6 mt-6">
                <h3 className="text-sm font-semibold text-foreground mb-2">Notes</h3>
                <p className="text-sm text-muted-foreground">{invoice.description}</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
