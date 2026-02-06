import Link from "next/link"
import { ArrowLeft, Building2, MapPin, Phone, Mail, FileText } from "lucide-react"

export default function CompanyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-16">
          <Link href="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 mb-4">
              <Building2 className="w-8 h-8 text-primary" />
              <h1 className="text-4xl md:text-5xl font-bold text-foreground">
                Company Information
              </h1>
            </div>
            <p className="text-xl text-muted-foreground">
              Official company registration and contact information
            </p>
          </div>
        </div>
      </div>

      {/* Company Details */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Registration Info */}
            <div className="p-8 rounded-lg border border-border bg-card">
              <div className="flex items-center gap-3 mb-6">
                <FileText className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-semibold text-foreground">Registration</h2>
              </div>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">Legal Name</p>
                  <p className="text-foreground font-medium">TruckMates Logistics Solutions Inc.</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Registration Number</p>
                  <p className="text-foreground font-medium">Available upon request</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Tax ID</p>
                  <p className="text-foreground font-medium">Available upon request</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-1">Business Type</p>
                  <p className="text-foreground font-medium">SaaS Technology Company</p>
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div className="p-8 rounded-lg border border-border bg-card">
              <div className="flex items-center gap-3 mb-6">
                <MapPin className="w-6 h-6 text-primary" />
                <h2 className="text-2xl font-semibold text-foreground">Contact</h2>
              </div>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-muted-foreground text-sm mb-1">Address</p>
                    <p className="text-foreground">
                      United States<br />
                      (Full address available upon request)
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-muted-foreground text-sm mb-1">Phone</p>
                    <p className="text-foreground">Available through support portal</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="text-muted-foreground text-sm mb-1">Email</p>
                    <p className="text-foreground">support@truckmates.com</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Additional Info */}
          <div className="mt-8 p-8 rounded-lg border border-border bg-card">
            <h2 className="text-2xl font-semibold text-foreground mb-4">Additional Information</h2>
            <div className="space-y-4 text-muted-foreground">
              <p>
                For detailed company registration documents, tax information, or legal inquiries, please contact our support team.
              </p>
              <p>
                All official documentation is available upon request for business verification and compliance purposes.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}




