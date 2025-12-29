"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { Logo } from "@/components/logo"

export default function PrivacyPage() {
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
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">Privacy Policy</h1>
            <p className="text-muted-foreground mb-8">Last updated: December 2024</p>

            <Card className="bg-card border-border p-8 mb-8">
              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">1. Introduction</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  TruckMates ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy 
                  explains how we collect, use, disclose, and safeguard your information when you use our fleet 
                  management platform and services.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  By using TruckMates, you agree to the collection and use of information in accordance with this 
                  policy. If you do not agree with our policies and practices, please do not use our services.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">2. Information We Collect</h2>
                
                <h3 className="text-xl font-semibold text-foreground mb-3">2.1 Account Information</h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  When you create an account, we collect:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
                  <li>Company name and business information</li>
                  <li>Your name, email address, and phone number</li>
                  <li>Billing and payment information</li>
                  <li>Account credentials (encrypted passwords)</li>
                </ul>

                <h3 className="text-xl font-semibold text-foreground mb-3">2.2 Fleet Data</h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  To provide our services, we collect and store:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
                  <li>Vehicle information (make, model, VIN, registration)</li>
                  <li>Driver information and profiles</li>
                  <li>GPS location data and tracking information</li>
                  <li>Hours of Service (HOS) logs and ELD data</li>
                  <li>Route information and delivery data</li>
                  <li>Load and shipment information</li>
                  <li>Financial and accounting data</li>
                </ul>

                <h3 className="text-xl font-semibold text-foreground mb-3">2.3 Usage Data</h3>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  We automatically collect information about how you use our platform:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2">
                  <li>Log data and access times</li>
                  <li>Device information and IP addresses</li>
                  <li>Browser type and version</li>
                  <li>Features used and pages visited</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">3. How We Use Your Information</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  We use the collected information for the following purposes:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
                  <li>To provide, maintain, and improve our fleet management services</li>
                  <li>To process transactions and manage your subscription</li>
                  <li>To send you updates, notifications, and support communications</li>
                  <li>To monitor and analyze usage patterns and trends</li>
                  <li>To detect, prevent, and address technical issues and security threats</li>
                  <li>To comply with legal obligations and regulations</li>
                  <li>To personalize your experience and provide relevant content</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">4. Data Sharing and Disclosure</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  We do not sell your personal information. We may share your information only in the following 
                  circumstances:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
                  <li><strong>Service Providers:</strong> With trusted third-party service providers who assist in 
                  operating our platform (cloud hosting, payment processing, email services)</li>
                  <li><strong>ELD Providers:</strong> When you integrate ELD devices, we share necessary data with 
                  your ELD service provider</li>
                  <li><strong>Legal Requirements:</strong> When required by law, regulation, or legal process</li>
                  <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
                  <li><strong>With Your Consent:</strong> When you explicitly authorize us to share information</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">5. Data Security</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  We implement industry-standard security measures to protect your data:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
                  <li>End-to-end encryption for data in transit</li>
                  <li>Encryption at rest for stored data</li>
                  <li>Secure authentication and access controls</li>
                  <li>Regular security audits and updates</li>
                  <li>Secure cloud infrastructure with redundancy</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed">
                  However, no method of transmission over the internet or electronic storage is 100% secure. 
                  While we strive to protect your data, we cannot guarantee absolute security.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">6. Your Rights and Choices</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  You have the following rights regarding your personal information:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
                  <li><strong>Access:</strong> Request access to your personal data</li>
                  <li><strong>Correction:</strong> Update or correct inaccurate information</li>
                  <li><strong>Deletion:</strong> Request deletion of your account and data (subject to legal requirements)</li>
                  <li><strong>Data Portability:</strong> Request a copy of your data in a portable format</li>
                  <li><strong>Opt-Out:</strong> Unsubscribe from marketing communications</li>
                  <li><strong>Account Settings:</strong> Manage your privacy preferences through your account settings</li>
                </ul>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">7. Data Retention</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  We retain your information for as long as necessary to:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 mb-4">
                  <li>Provide our services to you</li>
                  <li>Comply with legal and regulatory obligations</li>
                  <li>Resolve disputes and enforce agreements</li>
                  <li>Maintain business records as required by law</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed">
                  When you cancel your account, we will delete or anonymize your data in accordance with our 
                  data retention policies, except where retention is required by law.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">8. Children's Privacy</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Our services are not intended for individuals under the age of 18. We do not knowingly collect 
                  personal information from children. If you believe we have collected information from a child, 
                  please contact us immediately.
                </p>
              </section>

              <section className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">9. Changes to This Policy</h2>
                <p className="text-muted-foreground leading-relaxed">
                  We may update this Privacy Policy from time to time. We will notify you of any material changes 
                  by posting the new policy on this page and updating the "Last updated" date. We encourage you 
                  to review this policy periodically.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-bold text-foreground mb-4">10. Contact Us</h2>
                <p className="text-muted-foreground leading-relaxed mb-4">
                  If you have questions or concerns about this Privacy Policy or our data practices, please contact us:
                </p>
                <div className="bg-secondary/50 p-4 rounded-lg">
                  <p className="text-foreground font-semibold mb-2">TruckMates Privacy Team</p>
                  <p className="text-muted-foreground">Email: privacy@truckmates.com</p>
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


