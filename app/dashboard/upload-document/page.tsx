"use client"

import { DocumentUploadAnalyzer } from "@/components/document-upload-analyzer"
import { useRouter } from "next/navigation"

export default function UploadDocumentPage() {
  const router = useRouter()

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-8 py-4">
        <h1 className="text-2xl font-bold text-foreground">Upload & Analyze Document</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload business documents and let AI extract and organize the information automatically
        </p>
      </div>

      <div className="p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <DocumentUploadAnalyzer
            onComplete={(recordId, recordType) => {
              // Navigate to the appropriate detail page
              const typeToPath: Record<string, string> = {
                driver: `/dashboard/drivers`,
                vehicle: `/dashboard/trucks`,
                load: `/dashboard/loads`,
                route: `/dashboard/routes`,
                maintenance: `/dashboard/maintenance`,
                invoice: `/dashboard/invoices`,
                expense: `/dashboard/expenses`
              }
              
              const path = typeToPath[recordType] || "/dashboard"
              router.push(path)
            }}
            onCancel={() => router.push("/dashboard")}
          />
        </div>
      </div>
    </div>
  )
}
