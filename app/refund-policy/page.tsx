"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Logo } from "@/components/logo"

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="fixed top-0 w-full z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/">
            <Logo size="sm" />
          </Link>
          <Link href="/login">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">Login</Button>
          </Link>
        </div>
      </nav>

      <div className="pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </Link>

          <div className="prose prose-invert max-w-none">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Refund Policy</h1>
            <p className="text-muted-foreground mb-8">Last updated: April 16, 2026</p>

            <Card className="bg-card border-border p-8 mb-8">
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">1. Overview</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  This Refund Policy explains when TruckMates subscription payments may be refunded. By subscribing to
                  a paid TruckMates plan, you agree to this policy.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">2. Subscription Charges</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  Paid subscriptions are billed in advance for each billing period (monthly or annual). Unless
                  otherwise required by law, payments are non-refundable after successful charge.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">3. Cancellation</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  You may cancel your subscription at any time from your account settings. Cancellation stops future
                  renewal charges. Access to paid features remains available until the end of your current billing
                  period.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">4. When Refunds May Be Issued</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">Refunds may be issued at our discretion for:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
                  <li>Duplicate charges caused by billing errors</li>
                  <li>Charges made after a confirmed cancellation due to system error</li>
                  <li>Other cases required by applicable law</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed">
                  We do not provide partial-period or prorated refunds for unused time unless required by law.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">5. Trial and Promotional Offers</h2>
                <p className="text-muted-foreground leading-relaxed">
                  If we offer a trial or promotional period, related billing and refund terms are shown at signup. Once
                  a paid charge is successfully processed, this refund policy applies.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-foreground mb-4">6. Contact</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  To request a refund review, contact us with your company name, billing email, and charge details.
                </p>
                <div className="bg-secondary/50 p-4 rounded-lg">
                  <p className="text-foreground font-semibold mb-2">TruckMates Billing Team</p>
                  <p className="text-muted-foreground">Email: billing@truckmates.com</p>
                </div>
              </section>
            </Card>

            <div className="flex justify-center mt-8">
              <Link href="/">
                <Button variant="outline" className="border-primary text-primary hover:bg-primary/10">
                  Back to Home
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
