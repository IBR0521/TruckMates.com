"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowLeft, FileText, Building2, MapPin, CheckCircle, XCircle, Pen, Download } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { use } from "react"
import { getBOL, updateBOLSignature } from "@/app/actions/bol"
import { generateBOLPDF } from "@/app/actions/bol-pdf"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { SignatureCapture } from "@/components/signature-capture"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export default function BOLDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [bol, setBOL] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [signatureDialog, setSignatureDialog] = useState<{
    open: boolean
    type: "shipper" | "driver" | "consignee" | null
  }>({ open: false, type: null })

  useEffect(() => {
    loadBOL()
  }, [id])

  async function loadBOL() {
    setIsLoading(true)
    const result = await getBOL(id)
    if (result.error) {
      toast.error(result.error)
      router.push("/dashboard/bols")
      return
    }
    setBOL(result.data)
    setIsLoading(false)
  }

  const handleSignatureSave = async (signatureData: {
    signature_url: string
    signed_by: string
    signed_at: string
  }) => {
    if (!signatureDialog.type) return

    const result = await updateBOLSignature(id, signatureDialog.type, signatureData)

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Signature saved successfully")
      setSignatureDialog({ open: false, type: null })
      loadBOL() // Reload BOL to show updated signature
    }
  }

  const getSignerName = (type: "shipper" | "driver" | "consignee") => {
    if (!bol) return ""
    switch (type) {
      case "shipper":
        return bol.shipper_name || ""
      case "consignee":
        return bol.consignee_name || ""
      case "driver":
        return "" // Driver name would come from load/driver association
      default:
        return ""
    }
  }

  const getSignerLabel = (type: "shipper" | "driver" | "consignee") => {
    switch (type) {
      case "shipper":
        return "Shipper Name"
      case "driver":
        return "Driver Name"
      case "consignee":
        return "Consignee Name"
      default:
        return "Signer Name"
    }
  }

  const handleDownloadPDF = async () => {
    try {
      const result = await generateBOLPDF(id)
      if (result.error) {
        toast.error(result.error)
        return
      }

      // Create a new window with the PDF HTML and trigger print
      const printWindow = window.open("", "_blank")
      if (!printWindow) {
        toast.error("Please allow pop-ups to download PDF")
        return
      }

      printWindow.document.write(result.html)
      printWindow.document.close()

      // Wait for images to load, then trigger print/save as PDF
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print()
          toast.success("PDF ready to download")
        }, 500)
      }
    } catch (error: any) {
      toast.error("Failed to generate PDF: " + (error.message || "Unknown error"))
    }
  }

  if (isLoading) {
    return (
      <div className="w-full">
        <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6">
          <p className="text-muted-foreground">Loading BOL...</p>
        </div>
      </div>
    )
  }

  if (!bol) {
    return null
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "draft":
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/50">Draft</Badge>
      case "sent":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/50">Sent</Badge>
      case "signed":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/50">Signed</Badge>
      case "delivered":
        return <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/50">Delivered</Badge>
      case "completed":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/50">Completed</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/bols">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">{bol.bol_number}</h1>
            <p className="text-muted-foreground text-sm mt-1">Bill of Lading Details</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge(bol.status)}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadPDF}
            className="bg-primary/10 hover:bg-primary/20 border-primary/50"
          >
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
          {bol.load_id && typeof bol.load_id === 'string' && bol.load_id.trim() !== '' ? (
            <Link href={`/dashboard/loads/${bol.load_id}`}>
              <Button variant="outline" size="sm">
                View Load
              </Button>
            </Link>
          ) : null}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* BOL Information */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Shipper Information */}
            <Card className="border-border p-4 md:p-6">
              <div className="flex items-center gap-2 mb-6">
                <Building2 className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Shipper</h2>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Name</p>
                  <p className="text-foreground font-medium">{bol.shipper_name}</p>
                </div>
                {(bol.shipper_address || bol.shipper_city || bol.shipper_state || bol.shipper_zip) && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Address</p>
                    <p className="text-foreground">
                      {bol.shipper_address && <>{bol.shipper_address}<br /></>}
                      {bol.shipper_city && bol.shipper_state && (
                        <>{bol.shipper_city}, {bol.shipper_state} {bol.shipper_zip}</>
                      )}
                    </p>
                  </div>
                )}
                {bol.shipper_phone && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Phone</p>
                    <p className="text-foreground">{bol.shipper_phone}</p>
                  </div>
                )}
                {bol.shipper_email && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Email</p>
                    <p className="text-foreground">{bol.shipper_email}</p>
                  </div>
                )}
                {bol.shipper_signature && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-sm font-medium text-foreground">Signed</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {bol.shipper_signature.signed_by} • {new Date(bol.shipper_signature.signed_at).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* Consignee Information */}
            <Card className="border-border p-4 md:p-6">
              <div className="flex items-center gap-2 mb-6">
                <MapPin className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Consignee</h2>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Name</p>
                  <p className="text-foreground font-medium">{bol.consignee_name}</p>
                </div>
                {(bol.consignee_address || bol.consignee_city || bol.consignee_state || bol.consignee_zip) && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Address</p>
                    <p className="text-foreground">
                      {bol.consignee_address && <>{bol.consignee_address}<br /></>}
                      {bol.consignee_city && bol.consignee_state && (
                        <>{bol.consignee_city}, {bol.consignee_state} {bol.consignee_zip}</>
                      )}
                    </p>
                  </div>
                )}
                {bol.consignee_phone && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Phone</p>
                    <p className="text-foreground">{bol.consignee_phone}</p>
                  </div>
                )}
                {bol.consignee_email && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Email</p>
                    <p className="text-foreground">{bol.consignee_email}</p>
                  </div>
                )}
                {bol.consignee_signature && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-sm font-medium text-foreground">Signed</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {bol.consignee_signature.signed_by} • {new Date(bol.consignee_signature.signed_at).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Carrier & Load Details */}
          <Card className="border-border p-4 md:p-6">
            <div className="flex items-center gap-2 mb-6">
              <FileText className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold text-foreground">Carrier & Load Details</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {bol.carrier_name && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Carrier Name</p>
                  <p className="text-foreground font-medium">{bol.carrier_name}</p>
                </div>
              )}
              {bol.carrier_mc_number && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">MC Number</p>
                  <p className="text-foreground">{bol.carrier_mc_number}</p>
                </div>
              )}
              {bol.carrier_dot_number && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">DOT Number</p>
                  <p className="text-foreground">{bol.carrier_dot_number}</p>
                </div>
              )}
              {bol.pickup_date && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Pickup Date</p>
                  <p className="text-foreground">{new Date(bol.pickup_date).toLocaleDateString()}</p>
                </div>
              )}
              {bol.delivery_date && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Delivery Date</p>
                  <p className="text-foreground">{new Date(bol.delivery_date).toLocaleDateString()}</p>
                </div>
              )}
              {bol.freight_charges && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Freight Charges</p>
                  <p className="text-foreground font-medium">${bol.freight_charges.toFixed(2)}</p>
                </div>
              )}
              {bol.payment_terms && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Payment Terms</p>
                  <p className="text-foreground">{bol.payment_terms}</p>
                </div>
              )}
            </div>
            {bol.special_instructions && (
              <div className="mt-6 pt-6 border-t border-border">
                <p className="text-sm text-muted-foreground mb-2">Special Instructions</p>
                <p className="text-foreground whitespace-pre-wrap">{bol.special_instructions}</p>
              </div>
            )}
          </Card>

          {/* Signatures */}
          <Card className="border-border p-4 md:p-6">
            <h2 className="text-xl font-semibold text-foreground mb-6">Signatures</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-foreground">Shipper</p>
                  {!bol.shipper_signature && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSignatureDialog({ open: true, type: "shipper" })}
                      className="h-7 text-xs"
                    >
                      <Pen className="w-3 h-3 mr-1" />
                      Sign
                    </Button>
                  )}
                </div>
                {bol.shipper_signature ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                      <span className="text-sm text-foreground">Signed</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      By: {bol.shipper_signature.signed_by}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(bol.shipper_signature.signed_at).toLocaleString()}
                    </p>
                    {bol.shipper_signature.signature_url && (
                      <img
                        src={bol.shipper_signature.signature_url}
                        alt="Shipper signature"
                        className="border border-border rounded mt-2 max-w-full h-20 object-contain bg-white"
                      />
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <XCircle className="w-5 h-5" />
                    <span className="text-sm">Not signed</span>
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-foreground">Driver</p>
                  {!bol.driver_signature && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSignatureDialog({ open: true, type: "driver" })}
                      className="h-7 text-xs"
                    >
                      <Pen className="w-3 h-3 mr-1" />
                      Sign
                    </Button>
                  )}
                </div>
                {bol.driver_signature ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                      <span className="text-sm text-foreground">Signed</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      By: {bol.driver_signature.signed_by}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(bol.driver_signature.signed_at).toLocaleString()}
                    </p>
                    {bol.driver_signature.signature_url && (
                      <img
                        src={bol.driver_signature.signature_url}
                        alt="Driver signature"
                        className="border border-border rounded mt-2 max-w-full h-20 object-contain bg-white"
                      />
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <XCircle className="w-5 h-5" />
                    <span className="text-sm">Not signed</span>
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground mb-3">Consignee</p>
                {bol.consignee_signature ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                      <span className="text-sm text-foreground">Signed</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      By: {bol.consignee_signature.signed_by}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(bol.consignee_signature.signed_at).toLocaleString()}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <XCircle className="w-5 h-5" />
                    <span className="text-sm">Not signed</span>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Proof of Delivery */}
          {(bol.pod_received_date || bol.pod_received_by || bol.pod_delivery_condition) && (
            <Card className="border-border p-4 md:p-6">
              <h2 className="text-xl font-semibold text-foreground mb-6">Proof of Delivery</h2>
              <div className="grid md:grid-cols-2 gap-6">
                {bol.pod_received_date && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Received Date</p>
                    <p className="text-foreground">{new Date(bol.pod_received_date).toLocaleDateString()}</p>
                  </div>
                )}
                {bol.pod_received_by && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Received By</p>
                    <p className="text-foreground font-medium">{bol.pod_received_by}</p>
                  </div>
                )}
                {bol.pod_delivery_condition && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Delivery Condition</p>
                    <Badge>
                      {bol.pod_delivery_condition}
                    </Badge>
                  </div>
                )}
                {bol.pod_notes && (
                  <div className="md:col-span-2">
                    <p className="text-sm text-muted-foreground mb-1">Notes</p>
                    <p className="text-foreground whitespace-pre-wrap">{bol.pod_notes}</p>
                  </div>
                )}
                {bol.pod_photos && Array.isArray(bol.pod_photos) && bol.pod_photos.length > 0 && (
                  <div className="md:col-span-2">
                    <p className="text-sm text-muted-foreground mb-2">Photos</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {bol.pod_photos.map((photo: string, index: number) => (
                        <img
                          key={index}
                          src={photo}
                          alt={`POD Photo ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg border border-border"
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Signature Capture Dialog */}
      <Dialog
        open={signatureDialog.open}
        onOpenChange={(open) => setSignatureDialog({ open, type: signatureDialog.type })}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {signatureDialog.type === "shipper" && "Shipper Signature"}
              {signatureDialog.type === "driver" && "Driver Signature"}
              {signatureDialog.type === "consignee" && "Consignee Signature"}
            </DialogTitle>
          </DialogHeader>
          {signatureDialog.type && (
            <SignatureCapture
              onSave={handleSignatureSave}
              onCancel={() => setSignatureDialog({ open: false, type: null })}
              signerName={getSignerName(signatureDialog.type)}
              signerNameLabel={getSignerLabel(signatureDialog.type)}
              title={
                signatureDialog.type === "shipper"
                  ? "Shipper Signature"
                  : signatureDialog.type === "driver"
                  ? "Driver Signature"
                  : "Consignee Signature"
              }
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

