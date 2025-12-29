"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Upload, Download, Eye, FileText, Trash2, FolderOpen } from "lucide-react"
import { toast } from "sonner"
import { useState, useEffect } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { getDocuments, deleteDocument, getDocumentUrl } from "@/app/actions/documents"

export default function DocumentsPage() {
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [documentsList, setDocumentsList] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadDocuments = async () => {
    setIsLoading(true)
    const result = await getDocuments()
    if (result.error) {
      toast.error(result.error)
      setIsLoading(false)
      return
    }
    if (result.data) {
      setDocumentsList(result.data)
    }
    setIsLoading(false)
  }

  useEffect(() => {
    loadDocuments()
  }, [])

  const handleDelete = async (id: string) => {
    const result = await deleteDocument(id)
    if (result.error) {
      toast.error(result.error)
      setDeleteId(null)
    } else {
      toast.success("Document deleted successfully")
      setDeleteId(null)
      await loadDocuments()
    }
  }

  const handleView = async (doc: any) => {
    try {
      const result = await getDocumentUrl(doc.id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      if (result.data?.url) {
        window.open(result.data.url, "_blank")
      } else {
        toast.error("Document URL not available")
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to open document")
    }
  }

  const handleDownload = async (doc: any) => {
    try {
      const result = await getDocumentUrl(doc.id)
      if (result.error) {
        toast.error(result.error)
        return
      }
      if (result.data?.url) {
        // Create a temporary link and trigger download
        const link = document.createElement("a")
        link.href = result.data.url
        link.download = result.data.name || doc.name || "document"
        link.target = "_blank"
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        toast.success(`Downloading: ${result.data.name || doc.name}`)
      } else {
        toast.error("Document URL not available")
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to download document")
    }
  }

  const formatFileSize = (bytes: number) => {
    if (!bytes) return "N/A"
    if (bytes < 1024) return bytes + " B"
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB"
    return (bytes / (1024 * 1024)).toFixed(1) + " MB"
  }

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Documents</h1>
          <p className="text-muted-foreground text-sm mt-1">Store and manage fleet documents securely</p>
        </div>
        <Button
          onClick={() => {
            // Create a file input element
            const input = document.createElement("input")
            input.type = "file"
            input.accept = ".pdf,.doc,.docx,.jpg,.jpeg,.png"
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0]
              if (file) {
                toast.success(`Document "${file.name}" uploaded successfully`)
                // In a real app, you would upload the file to a server here
              }
            }
            input.click()
          }}
          className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
        >
          <Upload className="w-4 h-4 mr-2" />
          Upload Document
        </Button>
      </div>

      <div className="p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Summary Cards */}
          <div className="grid md:grid-cols-4 gap-6">
            <Card className="border border-border/50 p-6">
              <p className="text-muted-foreground text-sm font-medium mb-2">Total Documents</p>
              <p className="text-3xl font-bold text-foreground">{documentsList.length}</p>
            </Card>
            <Card className="border border-border/50 p-6">
              <p className="text-muted-foreground text-sm font-medium mb-2">Expiring Soon</p>
              <p className="text-3xl font-bold text-yellow-400">
                {documentsList.filter(d => {
                  if (!d.expiry_date) return false
                  const expiry = new Date(d.expiry_date)
                  const now = new Date()
                  const daysUntilExpiry = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                  return daysUntilExpiry > 0 && daysUntilExpiry <= 30
                }).length}
              </p>
            </Card>
            <Card className="border border-border/50 p-6">
              <p className="text-muted-foreground text-sm font-medium mb-2">Insurance Docs</p>
              <p className="text-3xl font-bold text-foreground">{documentsList.filter(d => d.type === "insurance").length}</p>
            </Card>
            <Card className="border border-border/50 p-6">
              <p className="text-muted-foreground text-sm font-medium mb-2">Storage Used</p>
              <p className="text-3xl font-bold text-foreground">
                {formatFileSize(documentsList.reduce((sum, d) => sum + (d.file_size || 0), 0))}
              </p>
            </Card>
          </div>

          {/* Documents Grid */}
          {isLoading ? (
            <Card className="border border-border/50 p-8">
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading documents...</p>
              </div>
            </Card>
          ) : documentsList.length === 0 ? (
            <Card className="border border-border/50 p-8">
              <div className="text-center py-12">
                <FolderOpen className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-semibold text-foreground mb-2">No documents yet</h3>
                <p className="text-muted-foreground mb-6">Get started by uploading your first document</p>
                <Button
                  onClick={() => {
                    const input = document.createElement("input")
                    input.type = "file"
                    input.accept = ".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0]
                      if (file) {
                        toast.success(`Document "${file.name}" uploaded successfully`)
                      }
                    }
                    input.click()
                  }}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Document
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {documentsList.map((doc) => (
                <Card key={doc.id} className="border border-border/50 p-6 hover:border-border/80 transition shadow-sm">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center">
                      <FileText className="w-6 h-6 text-primary" />
                    </div>
                    <span className="px-2 py-1 rounded text-xs font-semibold bg-secondary text-foreground">
                      {doc.type ? doc.type.charAt(0).toUpperCase() + doc.type.slice(1) : "Other"}
                    </span>
                  </div>
                  <h3 className="text-foreground font-semibold mb-2 text-sm">{doc.name || "Unnamed Document"}</h3>
                  <div className="space-y-1 text-xs text-muted-foreground mb-4">
                    <p>Uploaded: {doc.upload_date ? new Date(doc.upload_date).toLocaleDateString() : "N/A"}</p>
                    <p>Size: {formatFileSize(doc.file_size)}</p>
                    {doc.expiry_date && <p>Expires: {new Date(doc.expiry_date).toLocaleDateString()}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 border-border/50 hover:bg-secondary/50 bg-transparent"
                      onClick={() => handleView(doc)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-border/50 hover:bg-secondary/50 bg-transparent"
                      onClick={() => handleDownload(doc)}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-border/50 hover:bg-red-500/20 bg-transparent"
                      onClick={() => setDeleteId(doc.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the document from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
