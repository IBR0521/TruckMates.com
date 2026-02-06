"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  FileText,
  Upload,
  Trash2,
  Download,
  AlertCircle,
  Calendar,
  CheckCircle2,
} from "lucide-react"
import { toast } from "sonner"
import {
  getCRMDocuments,
  uploadCRMDocument,
  deleteCRMDocument,
  type CRMDocument,
} from "@/app/actions/crm-documents"
import { format } from "date-fns"

interface DocumentManagerProps {
  customerId?: string
  vendorId?: string
}

export function DocumentManager({ customerId, vendorId }: DocumentManagerProps) {
  const [documents, setDocuments] = useState<CRMDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadData, setUploadData] = useState({
    document_type: "other" as CRMDocument["document_type"],
    name: "",
    description: "",
    expiration_date: "",
  })

  useEffect(() => {
    loadDocuments()
  }, [customerId, vendorId])

  async function loadDocuments() {
    setIsLoading(true)
    try {
      const result = await getCRMDocuments({
        customer_id: customerId,
        vendor_id: vendorId,
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        setDocuments(result.data || [])
      }
    } catch (error) {
      toast.error("Failed to load documents")
    } finally {
      setIsLoading(false)
    }
  }

  async function handleUpload() {
    if (!uploadFile) {
      toast.error("Please select a file")
      return
    }

    if (!uploadData.name) {
      toast.error("Please enter a document name")
      return
    }

    try {
      const result = await uploadCRMDocument(uploadFile, {
        customer_id: customerId,
        vendor_id: vendorId,
        document_type: uploadData.document_type,
        name: uploadData.name,
        description: uploadData.description || undefined,
        expiration_date: uploadData.expiration_date || undefined,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Document uploaded successfully")
        setIsUploadDialogOpen(false)
        setUploadFile(null)
        setUploadData({
          document_type: "other",
          name: "",
          description: "",
          expiration_date: "",
        })
        loadDocuments()
      }
    } catch (error) {
      toast.error("Failed to upload document")
    }
  }

  async function handleDelete(documentId: string) {
    if (!confirm("Are you sure you want to delete this document?")) {
      return
    }

    try {
      const result = await deleteCRMDocument(documentId)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Document deleted successfully")
        loadDocuments()
      }
    } catch (error) {
      toast.error("Failed to delete document")
    }
  }

  function getDocumentTypeColor(type: string) {
    switch (type) {
      case "w9":
        return "bg-blue-500/20 text-blue-400 border-blue-500/50"
      case "coi":
        return "bg-green-500/20 text-green-400 border-green-500/50"
      case "mc_certificate":
        return "bg-purple-500/20 text-purple-400 border-purple-500/50"
      case "insurance_policy":
        return "bg-orange-500/20 text-orange-400 border-orange-500/50"
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/50"
    }
  }

  function isExpiringSoon(expirationDate: string | null) {
    if (!expirationDate) return false
    const daysUntilExpiration = Math.ceil(
      (new Date(expirationDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
    return daysUntilExpiration <= 30 && daysUntilExpiration > 0
  }

  function isExpired(expirationDate: string | null) {
    if (!expirationDate) return false
    return new Date(expirationDate).getTime() < Date.now()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Documents</h3>
        <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Upload className="w-4 h-4 mr-2" />
              Upload Document
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
              <DialogDescription>
                Upload W9, COI, MC certificate, insurance policy, or other documents
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Document Type</Label>
                <Select
                  value={uploadData.document_type}
                  onValueChange={(v) =>
                    setUploadData({ ...uploadData, document_type: v as any })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="w9">W9 Form</SelectItem>
                    <SelectItem value="coi">Certificate of Insurance (COI)</SelectItem>
                    <SelectItem value="mc_certificate">MC Certificate</SelectItem>
                    <SelectItem value="insurance_policy">Insurance Policy</SelectItem>
                    <SelectItem value="license">License</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Document Name</Label>
                <Input
                  value={uploadData.name}
                  onChange={(e) => setUploadData({ ...uploadData, name: e.target.value })}
                  placeholder="e.g., ABC Company W9 2024"
                />
              </div>
              <div>
                <Label>Description (Optional)</Label>
                <Textarea
                  value={uploadData.description}
                  onChange={(e) =>
                    setUploadData({ ...uploadData, description: e.target.value })
                  }
                  placeholder="Additional notes about this document"
                />
              </div>
              <div>
                <Label>Expiration Date (Optional)</Label>
                <Input
                  type="date"
                  value={uploadData.expiration_date}
                  onChange={(e) =>
                    setUploadData({ ...uploadData, expiration_date: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>File</Label>
                <Input
                  type="file"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                />
              </div>
              <Button onClick={handleUpload} className="w-full" disabled={!uploadFile}>
                Upload
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">Loading documents...</p>
        </Card>
      ) : documents.length === 0 ? (
        <Card className="p-8 text-center">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No documents uploaded yet</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => {
            const expiringSoon = isExpiringSoon(doc.expiration_date)
            const expired = isExpired(doc.expiration_date)

            return (
              <Card key={doc.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                      <h4 className="font-semibold">{doc.name}</h4>
                      <Badge className={getDocumentTypeColor(doc.document_type)}>
                        {doc.document_type.toUpperCase()}
                      </Badge>
                      {expiringSoon && (
                        <Badge variant="destructive" className="flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Expiring Soon
                        </Badge>
                      )}
                      {expired && (
                        <Badge variant="destructive" className="flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Expired
                        </Badge>
                      )}
                      {!expired && !expiringSoon && doc.expiration_date && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Valid
                        </Badge>
                      )}
                    </div>
                    {doc.description && (
                      <p className="text-sm text-muted-foreground mb-2">{doc.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {doc.expiration_date && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Expires: {format(new Date(doc.expiration_date), "MMM d, yyyy")}
                        </div>
                      )}
                      <div>
                        Uploaded: {format(new Date(doc.uploaded_at), "MMM d, yyyy")}
                      </div>
                      {doc.file_size && (
                        <div>{(doc.file_size / 1024).toFixed(1)} KB</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(doc.storage_url, "_blank")}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(doc.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}


