"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Logo } from "@/components/logo"

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
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
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Terms of Service</h1>
            <p className="text-muted-foreground mb-8">Last updated: December 2024</p>

            <Card className="bg-card border-border p-8 mb-8">
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">1. Acceptance of Terms</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  By accessing or using TruckMates ("the Service"), you agree to be bound by these Terms of Service 
                  and all applicable laws and regulations. If you do not agree with any of these terms, you are 
                  prohibited from using or accessing this Service.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  These terms apply to all users of the Service, including without limitation users who are browsers, 
                  vendors, customers, merchants, and/or contributors of content.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">2. Description of Service</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  TruckMates is a cloud-based fleet management platform that provides:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
                  <li>Fleet tracking and GPS monitoring</li>
                  <li>Electronic Logging Device (ELD) integration and compliance</li>
                  <li>Driver and employee management</li>
                  <li>Route planning and optimization</li>
                  <li>Load and delivery management</li>
                  <li>Accounting and financial management</li>
                  <li>Reporting and analytics</li>
                  <li>Maintenance scheduling and tracking</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed">
                  We reserve the right to modify, suspend, or discontinue any part of the Service at any time 
                  with or without notice.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">3. Account Registration</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  To use the Service, you must:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
                  <li>Create an account with accurate and complete information</li>
                  <li>Maintain and promptly update your account information</li>
                  <li>Maintain the security of your account credentials</li>
                  <li>Accept responsibility for all activities under your account</li>
                  <li>Be at least 18 years old or have legal authority to enter into contracts</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed">
                  You are responsible for all activities that occur under your account, whether or not you 
                  authorized such activities.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">4. Subscription and Payment</h2>
                
                <h3 className="text-xl font-semibold text-foreground mb-3">4.1 Subscription Plans</h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  The Service is offered on a subscription basis with different plan tiers. Subscription fees 
                  are billed monthly or annually based on your selected plan.
                </p>

                <h3 className="text-xl font-semibold text-foreground mb-3">4.2 Free Trial</h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  We offer a 7-day free trial period. No payment information is required to start the trial. 
                  At the end of the trial period, your subscription will automatically convert to a paid plan 
                  unless you cancel before the trial ends.
                </p>

                <h3 className="text-xl font-semibold text-foreground mb-3">4.3 Payment Terms</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
                  <li>All fees are non-refundable except as required by law</li>
                  <li>Subscription fees are charged in advance for the billing period</li>
                  <li>We reserve the right to change our pricing with 30 days' notice</li>
                  <li>Failed payments may result in suspension of service</li>
                  <li>You are responsible for any taxes applicable to your subscription</li>
                </ul>

                <h3 className="text-xl font-semibold text-foreground mb-3">4.4 Cancellation</h3>
                <p className="text-muted-foreground leading-relaxed">
                  You may cancel your subscription at any time through your account settings. Cancellation 
                  will take effect at the end of your current billing period. No refunds will be provided 
                  for partial billing periods.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">5. Use of Service</h2>
                
                <h3 className="text-xl font-semibold text-foreground mb-3">5.1 Permitted Use</h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  You may use the Service only for lawful purposes and in accordance with these Terms. You agree 
                  to use the Service for legitimate business purposes related to fleet management.
                </p>

                <h3 className="text-xl font-semibold text-foreground mb-3">5.2 Prohibited Activities</h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  You agree NOT to:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
                  <li>Violate any applicable laws or regulations</li>
                  <li>Infringe upon intellectual property rights</li>
                  <li>Upload malicious code, viruses, or harmful software</li>
                  <li>Attempt to gain unauthorized access to the Service or other accounts</li>
                  <li>Interfere with or disrupt the Service or servers</li>
                  <li>Use the Service to transmit spam or unsolicited communications</li>
                  <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
                  <li>Resell or redistribute the Service without authorization</li>
                  <li>Use automated systems to access the Service without permission</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">6. Data and Content</h2>
                
                <h3 className="text-xl font-semibold text-foreground mb-3">6.1 Your Data</h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  You retain ownership of all data you upload to the Service. You grant us a license to use, 
                  store, and process your data solely to provide and improve the Service. You are responsible 
                  for ensuring you have the right to upload all data you provide.
                </p>

                <h3 className="text-xl font-semibold text-foreground mb-3">6.2 Data Backup</h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  While we implement data backup and recovery systems, you are responsible for maintaining 
                  your own backups of critical data. We are not liable for data loss.
                </p>

                <h3 className="text-xl font-semibold text-foreground mb-3">6.3 Compliance Data</h3>
                <p className="text-muted-foreground leading-relaxed">
                  You are responsible for ensuring compliance with all applicable regulations (DOT, ELD, HOS, 
                  IFTA, etc.). While our Service provides tools to assist with compliance, we do not guarantee 
                  regulatory compliance and are not liable for violations.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">7. Intellectual Property</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  The Service, including its original content, features, functionality, design, and software, 
                  is owned by TruckMates and protected by international copyright, trademark, and other 
                  intellectual property laws.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  You may not copy, modify, distribute, sell, or lease any part of our Service without our 
                  express written permission.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">8. Service Availability</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  We strive to provide reliable service, but we do not guarantee:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
                  <li>Uninterrupted or error-free operation</li>
                  <li>100% uptime availability</li>
                  <li>Immediate resolution of all technical issues</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed">
                  We may perform scheduled maintenance that temporarily interrupts service. We will provide 
                  advance notice when possible.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">9. Limitation of Liability</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
                  <li>The Service is provided "AS IS" and "AS AVAILABLE" without warranties of any kind</li>
                  <li>We disclaim all warranties, express or implied, including merchantability and fitness 
                  for a particular purpose</li>
                  <li>We are not liable for any indirect, incidental, special, or consequential damages</li>
                  <li>Our total liability shall not exceed the amount you paid us in the 12 months preceding 
                  the claim</li>
                  <li>We are not responsible for compliance with transportation regulations or violations</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">10. Indemnification</h2>
                <p className="text-muted-foreground leading-relaxed">
                  You agree to indemnify and hold harmless TruckMates, its officers, employees, and agents from 
                  any claims, damages, losses, liabilities, and expenses (including legal fees) arising from 
                  your use of the Service, violation of these Terms, or infringement of any rights of another.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">11. Termination</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  We may suspend or terminate your account and access to the Service immediately, without prior 
                  notice, if you:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
                  <li>Violate these Terms of Service</li>
                  <li>Engage in fraudulent, illegal, or harmful activities</li>
                  <li>Fail to pay subscription fees</li>
                  <li>Use the Service in a manner that could harm our reputation or business</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed">
                  Upon termination, your right to use the Service will immediately cease. We may delete your 
                  account and data in accordance with our data retention policies.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">12. Changes to Terms</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We reserve the right to modify these Terms at any time. We will notify you of material changes 
                  by posting the updated Terms on this page and updating the "Last updated" date. Your continued 
                  use of the Service after changes become effective constitutes acceptance of the modified Terms.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">13. Governing Law</h2>
                <p className="text-muted-foreground leading-relaxed">
                  These Terms shall be governed by and construed in accordance with the laws of [Your Jurisdiction], 
                  without regard to its conflict of law provisions. Any disputes arising from these Terms shall be 
                  resolved in the courts of [Your Jurisdiction].
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-foreground mb-4">14. Contact Information</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  If you have questions about these Terms of Service, please contact us:
                </p>
                <div className="bg-secondary/50 p-4 rounded-lg">
                  <p className="text-foreground font-semibold mb-2">TruckMates Legal Team</p>
                  <p className="text-muted-foreground">Email: legal@truckmates.com</p>
                  <p className="text-muted-foreground mt-2">
                    Address: [Your Company Address]
                  </p>
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


