"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, X, Edit2 } from "lucide-react"
import { toast } from "sonner"
import { analyzeDocumentFromUrl, createRecordFromExtractedData, type ExtractedData } from "@/app/actions/document-analysis"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

interface DocumentUploadAnalyzerProps {
  onComplete?: (recordId: string, recordType: string) => void
  onCancel?: () => void
}

export function DocumentUploadAnalyzer({ onComplete, onCancel }: DocumentUploadAnalyzerProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null)
  const [editedData, setEditedData] = useState<ExtractedData | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      // Validate file type
      const validTypes = [
        "application/pdf",
        "image/jpeg",
        "image/jpg",
        "image/png",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ]
      
      if (!validTypes.includes(selectedFile.type)) {
        toast.error("Please upload a PDF, image, or Word document")
        return
      }

      // Validate file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB")
        return
      }

      setFile(selectedFile)
      setExtractedData(null)
      setEditedData(null)
      setShowEditForm(false)
    }
  }

  const handleUploadAndAnalyze = async () => {
    if (!file) {
      toast.error("Please select a file first")
      return
    }

    setIsUploading(true)
    setIsAnalyzing(true)

    try {
      // Upload file directly to Supabase Storage from client
      const supabase = createClient()
      
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        toast.error("Not authenticated")
        setIsUploading(false)
        setIsAnalyzing(false)
        return
      }

      // Upload file to Supabase Storage
      const fileExt = file.name.split(".").pop()
      const fileName = `${user.id}/${Date.now()}.${fileExt}`
      const filePath = fileName

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("documents")
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        toast.error(`Upload failed: ${uploadError.message}`)
        setIsUploading(false)
        setIsAnalyzing(false)
        return
      }

      // Get the file URL
      const { data: urlData } = supabase.storage
        .from("documents")
        .getPublicUrl(filePath)

      setIsUploading(false)

      // Now analyze the document using the URL
      const result = await analyzeDocumentFromUrl(
        urlData.publicUrl,
        file.name,
        file.size
      )

      if (result.error) {
        toast.error(result.error)
        setIsAnalyzing(false)
        return
      }

      if (!result.data) {
        toast.error("Failed to process document")
        setIsAnalyzing(false)
        return
      }

      if (result.data.extractedData) {
        setExtractedData(result.data.extractedData)
        setEditedData({ ...result.data.extractedData })
        setShowEditForm(true)
        toast.success("Document analyzed successfully! Review and edit the extracted data below.")
      } else {
        toast.warning("Document uploaded but could not be analyzed. Please enter data manually.")
        setIsAnalyzing(false)
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to process document")
      setIsUploading(false)
      setIsAnalyzing(false)
    }
  }

  const handleCreateRecord = async () => {
    if (!editedData) {
      toast.error("No data to create record from")
      return
    }

    setIsCreating(true)

    try {
      const result = await createRecordFromExtractedData(editedData)

      if (result.error) {
        toast.error(result.error)
        setIsCreating(false)
        return
      }

      if (result.data) {
        if (editedData?.type === "route_and_load") {
          toast.success("Route and Load records created successfully! Both are now available in their respective lists.")
        } else {
          toast.success(`${result.data.type.charAt(0).toUpperCase() + result.data.type.slice(1)} record created successfully!`)
        }
        
        if (onComplete) {
          onComplete(result.data.id, result.data.type)
        } else {
          // Navigate to the appropriate page
          const typeToPath: Record<string, string> = {
            driver: "/dashboard/drivers",
            vehicle: "/dashboard/trucks",
            load: "/dashboard/loads",
            route: "/dashboard/routes",
            route_and_load: "/dashboard/loads", // Navigate to loads since that's usually what users care about
            maintenance: "/dashboard/maintenance",
            invoice: "/dashboard/invoices",
            expense: "/dashboard/expenses"
          }
          
          const path = typeToPath[editedData?.type || result.data.type] || "/dashboard"
          router.push(path)
        }

        // Reset form
        setFile(null)
        setExtractedData(null)
        setEditedData(null)
        setShowEditForm(false)
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to create record")
    } finally {
      setIsCreating(false)
    }
  }

  const updateField = (field: string, value: any) => {
    if (!editedData) return
    setEditedData({
      ...editedData,
      [field]: value
    })
  }

  const renderEditForm = () => {
    if (!editedData || !showEditForm) return null

    const type = editedData.type

    return (
      <Card className="border-border p-6 mt-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">
            Review & Edit Extracted Data
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowEditForm(false)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="space-y-4">
          {type === "driver" && (
            <>
              <div>
                <Label>Name *</Label>
                <Input
                  value={(editedData as any).name || ""}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="Driver name"
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={(editedData as any).email || ""}
                    onChange={(e) => updateField("email", e.target.value)}
                    placeholder="driver@example.com"
                  />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={(editedData as any).phone || ""}
                    onChange={(e) => updateField("phone", e.target.value)}
                    placeholder="+1234567890"
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>License Number</Label>
                  <Input
                    value={(editedData as any).license_number || ""}
                    onChange={(e) => updateField("license_number", e.target.value)}
                    placeholder="DL123456"
                  />
                </div>
                <div>
                  <Label>License Expiry</Label>
                  <Input
                    type="date"
                    value={(editedData as any).license_expiry || ""}
                    onChange={(e) => updateField("license_expiry", e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={(editedData as any).status || "active"}
                  onValueChange={(value) => updateField("status", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="on_route">On Route</SelectItem>
                    <SelectItem value="off_duty">Off Duty</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {type === "vehicle" && (
            <>
              <div>
                <Label>Truck Number *</Label>
                <Input
                  value={(editedData as any).truck_number || ""}
                  onChange={(e) => updateField("truck_number", e.target.value)}
                  placeholder="TRUCK-001"
                />
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label>Make</Label>
                  <Input
                    value={(editedData as any).make || ""}
                    onChange={(e) => updateField("make", e.target.value)}
                    placeholder="Freightliner"
                  />
                </div>
                <div>
                  <Label>Model</Label>
                  <Input
                    value={(editedData as any).model || ""}
                    onChange={(e) => updateField("model", e.target.value)}
                    placeholder="Cascadia"
                  />
                </div>
                <div>
                  <Label>Year</Label>
                  <Input
                    type="number"
                    value={(editedData as any).year || ""}
                    onChange={(e) => updateField("year", parseInt(e.target.value) || undefined)}
                    placeholder="2024"
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>VIN</Label>
                  <Input
                    value={(editedData as any).vin || ""}
                    onChange={(e) => updateField("vin", e.target.value)}
                    placeholder="1HGBH41JXMN109186"
                  />
                </div>
                <div>
                  <Label>License Plate</Label>
                  <Input
                    value={(editedData as any).license_plate || ""}
                    onChange={(e) => updateField("license_plate", e.target.value)}
                    placeholder="ABC-1234"
                  />
                </div>
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={(editedData as any).status || "available"}
                  onValueChange={(value) => updateField("status", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="in_use">In Use</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="out_of_service">Out of Service</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {type === "load" && (
            <>
              {(editedData as any).delivery_points && (editedData as any).delivery_points.length > 0 && (
                <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg mb-4">
                  <p className="text-sm font-semibold text-foreground">
                    ✅ Found {(editedData as any).delivery_points.length} delivery points - they will be created automatically
                  </p>
                </div>
              )}
              <div>
                <Label>Shipment Number *</Label>
                <Input
                  value={(editedData as any).shipment_number || ""}
                  onChange={(e) => updateField("shipment_number", e.target.value)}
                  placeholder="SHP-001"
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Origin *</Label>
                  <Input
                    value={(editedData as any).origin || ""}
                    onChange={(e) => updateField("origin", e.target.value)}
                    placeholder="New York, NY"
                  />
                </div>
                <div>
                  <Label>Destination *</Label>
                  <Input
                    value={(editedData as any).destination || ""}
                    onChange={(e) => updateField("destination", e.target.value)}
                    placeholder="Los Angeles, CA"
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Weight</Label>
                  <Input
                    value={(editedData as any).weight || ""}
                    onChange={(e) => updateField("weight", e.target.value)}
                    placeholder="22.5 tons"
                  />
                </div>
                <div>
                  <Label>Weight (kg)</Label>
                  <Input
                    type="number"
                    value={(editedData as any).weight_kg || ""}
                    onChange={(e) => updateField("weight_kg", parseFloat(e.target.value) || undefined)}
                    placeholder="22500"
                  />
                </div>
              </div>
              <div>
                <Label>Contents</Label>
                <Textarea
                  value={(editedData as any).contents || ""}
                  onChange={(e) => updateField("contents", e.target.value)}
                  placeholder="Cargo description"
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Value ($)</Label>
                  <Input
                    type="number"
                    value={(editedData as any).value || ""}
                    onChange={(e) => updateField("value", parseFloat(e.target.value) || undefined)}
                    placeholder="5000"
                  />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select
                    value={(editedData as any).status || "pending"}
                    onValueChange={(value) => updateField("status", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="in_transit">In Transit</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}

          {(type === "route" || type === "route_and_load") && (
            <>
              {(editedData as any).stops && (editedData as any).stops.length > 0 && (
                <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg mb-4">
                  <p className="text-sm font-semibold text-foreground">
                    ✅ Found {(editedData as any).stops.length} route stops - they will be created automatically
                  </p>
                </div>
              )}
              {type === "route_and_load" && (
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg mb-4">
                  <p className="text-sm font-semibold text-foreground">
                    📦 This document contains both ROUTE and LOAD information - both will be created!
                  </p>
                </div>
              )}
              <div>
                <Label>Route Name *</Label>
                <Input
                  value={(editedData as any).route_name || (editedData as any).name || ""}
                  onChange={(e) => updateField(type === "route_and_load" ? "route_name" : "name", e.target.value)}
                  placeholder="NY-PA Route"
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Route Origin *</Label>
                  <Input
                    value={(editedData as any).route_origin || (editedData as any).origin || ""}
                    onChange={(e) => updateField(type === "route_and_load" ? "route_origin" : "origin", e.target.value)}
                    placeholder="New York, NY"
                  />
                </div>
                <div>
                  <Label>Route Destination *</Label>
                  <Input
                    value={(editedData as any).route_destination || (editedData as any).destination || ""}
                    onChange={(e) => updateField(type === "route_and_load" ? "route_destination" : "destination", e.target.value)}
                    placeholder="Philadelphia, PA"
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Distance</Label>
                  <Input
                    value={(editedData as any).route_distance || (editedData as any).distance || ""}
                    onChange={(e) => updateField(type === "route_and_load" ? "route_distance" : "distance", e.target.value)}
                    placeholder="180 mi"
                  />
                </div>
                <div>
                  <Label>Estimated Time</Label>
                  <Input
                    value={(editedData as any).route_estimated_time || (editedData as any).estimated_time || ""}
                    onChange={(e) => updateField(type === "route_and_load" ? "route_estimated_time" : "estimated_time", e.target.value)}
                    placeholder="3h 30m"
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Priority</Label>
                  <Select
                    value={(editedData as any).route_priority || (editedData as any).priority || "normal"}
                    onValueChange={(value) => updateField(type === "route_and_load" ? "route_priority" : "priority", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Route Status</Label>
                  <Select
                    value={(editedData as any).route_status || (editedData as any).status || "pending"}
                    onValueChange={(value) => updateField(type === "route_and_load" ? "route_status" : "status", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Load Information Section (for route_and_load type) */}
              {type === "route_and_load" && (
                <>
                  <div className="border-t border-border pt-6 mt-6">
                    <h4 className="text-lg font-semibold text-foreground mb-4">Load Information</h4>
                  </div>
                  <div>
                    <Label>Shipment Number *</Label>
                    <Input
                      value={(editedData as any).shipment_number || ""}
                      onChange={(e) => updateField("shipment_number", e.target.value)}
                      placeholder="SHP-001"
                    />
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Load Origin *</Label>
                      <Input
                        value={(editedData as any).load_origin || ""}
                        onChange={(e) => updateField("load_origin", e.target.value)}
                        placeholder="New York, NY"
                      />
                    </div>
                    <div>
                      <Label>Load Destination *</Label>
                      <Input
                        value={(editedData as any).load_destination || ""}
                        onChange={(e) => updateField("load_destination", e.target.value)}
                        placeholder="Los Angeles, CA"
                      />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Weight</Label>
                      <Input
                        value={(editedData as any).weight || ""}
                        onChange={(e) => updateField("weight", e.target.value)}
                        placeholder="22.5 tons"
                      />
                    </div>
                    <div>
                      <Label>Weight (kg)</Label>
                      <Input
                        type="number"
                        value={(editedData as any).weight_kg || ""}
                        onChange={(e) => updateField("weight_kg", parseFloat(e.target.value) || undefined)}
                        placeholder="22500"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Contents</Label>
                    <Textarea
                      value={(editedData as any).contents || ""}
                      onChange={(e) => updateField("contents", e.target.value)}
                      placeholder="Cargo description"
                    />
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Value ($)</Label>
                      <Input
                        type="number"
                        value={(editedData as any).value || ""}
                        onChange={(e) => updateField("value", parseFloat(e.target.value) || undefined)}
                        placeholder="5000"
                      />
                    </div>
                    <div>
                      <Label>Load Status</Label>
                      <Select
                        value={(editedData as any).load_status || "pending"}
                        onValueChange={(value) => updateField("load_status", value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="scheduled">Scheduled</SelectItem>
                          <SelectItem value="in_transit">In Transit</SelectItem>
                          <SelectItem value="delivered">Delivered</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {(editedData as any).delivery_points && (editedData as any).delivery_points.length > 0 && (
                    <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg mt-4">
                      <p className="text-sm font-semibold text-foreground">
                        ✅ Found {(editedData as any).delivery_points.length} delivery points - they will be created automatically
                      </p>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {type === "maintenance" && (
            <>
              <div>
                <Label>Truck Number or ID *</Label>
                <Input
                  value={(editedData as any).truck_number || (editedData as any).truck_id || ""}
                  onChange={(e) => updateField("truck_number", e.target.value)}
                  placeholder="TRUCK-001 or UUID"
                />
              </div>
              <div>
                <Label>Service Type *</Label>
                <Input
                  value={(editedData as any).service_type || ""}
                  onChange={(e) => updateField("service_type", e.target.value)}
                  placeholder="Oil Change, Tire Replacement, etc."
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Scheduled Date</Label>
                  <Input
                    type="date"
                    value={(editedData as any).scheduled_date || ""}
                    onChange={(e) => updateField("scheduled_date", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Estimated Cost ($)</Label>
                  <Input
                    type="number"
                    value={(editedData as any).estimated_cost || ""}
                    onChange={(e) => updateField("estimated_cost", parseFloat(e.target.value) || undefined)}
                    placeholder="500"
                  />
                </div>
              </div>
              <div>
                <Label>Vendor</Label>
                <Input
                  value={(editedData as any).vendor || ""}
                  onChange={(e) => updateField("vendor", e.target.value)}
                  placeholder="Service provider name"
                />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={(editedData as any).notes || ""}
                  onChange={(e) => updateField("notes", e.target.value)}
                  placeholder="Additional notes"
                />
              </div>
            </>
          )}

          {type === "invoice" && (
            <>
              <div>
                <Label>Invoice Number *</Label>
                <Input
                  value={(editedData as any).invoice_number || ""}
                  onChange={(e) => updateField("invoice_number", e.target.value)}
                  placeholder="INV-001"
                />
              </div>
              <div>
                <Label>Customer Name *</Label>
                <Input
                  value={(editedData as any).customer_name || ""}
                  onChange={(e) => updateField("customer_name", e.target.value)}
                  placeholder="Customer name"
                />
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label>Amount ($) *</Label>
                  <Input
                    type="number"
                    value={(editedData as any).amount || ""}
                    onChange={(e) => updateField("amount", parseFloat(e.target.value) || 0)}
                    placeholder="1000"
                  />
                </div>
                <div>
                  <Label>Issue Date</Label>
                  <Input
                    type="date"
                    value={(editedData as any).issue_date || ""}
                    onChange={(e) => updateField("issue_date", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={(editedData as any).due_date || ""}
                    onChange={(e) => updateField("due_date", e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={(editedData as any).status || "pending"}
                  onValueChange={(value) => updateField("status", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {type === "expense" && (
            <>
              <div>
                <Label>Category *</Label>
                <Select
                  value={(editedData as any).category || "other"}
                  onValueChange={(value) => updateField("category", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fuel">Fuel</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="tolls">Tolls</SelectItem>
                    <SelectItem value="food">Food</SelectItem>
                    <SelectItem value="lodging">Lodging</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Description *</Label>
                <Textarea
                  value={(editedData as any).description || ""}
                  onChange={(e) => updateField("description", e.target.value)}
                  placeholder="Expense description"
                />
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label>Amount ($) *</Label>
                  <Input
                    type="number"
                    value={(editedData as any).amount || ""}
                    onChange={(e) => updateField("amount", parseFloat(e.target.value) || 0)}
                    placeholder="100"
                  />
                </div>
                <div>
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={(editedData as any).date || ""}
                    onChange={(e) => updateField("date", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Vendor</Label>
                  <Input
                    value={(editedData as any).vendor || ""}
                    onChange={(e) => updateField("vendor", e.target.value)}
                    placeholder="Vendor name"
                  />
                </div>
              </div>
            </>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleCreateRecord}
              disabled={isCreating}
              className="flex-1"
            >
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {type === "route_and_load" 
                  ? "Create Route & Load Records" 
                  : `Create ${type.charAt(0).toUpperCase() + type.slice(1)} Record`}
              </>
            )}
            </Button>
            {onCancel && (
              <Button
                variant="outline"
                onClick={onCancel}
                disabled={isCreating}
              >
                Cancel
              </Button>
            )}
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Upload & Analyze Document</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Upload a document and AI will automatically extract and categorize the information
          </p>
        </div>
        {onCancel && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <Label>Select Document</Label>
          <div className="mt-2 flex items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || isAnalyzing}
            >
              <Upload className="w-4 h-4 mr-2" />
              Choose File
            </Button>
            {file && (
              <div className="flex items-center gap-2 text-sm text-foreground">
                <FileText className="w-4 h-4" />
                <span>{file.name}</span>
                <span className="text-muted-foreground">
                  ({(file.size / 1024).toFixed(1)} KB)
                </span>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Supported formats: PDF, Word documents, Images (JPG, PNG). Max size: 10MB
          </p>
        </div>

        {file && !showEditForm && (
          <Button
            onClick={handleUploadAndAnalyze}
            disabled={isUploading || isAnalyzing}
            className="w-full"
          >
            {isUploading || isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {isUploading ? "Uploading..." : "Analyzing..."}
              </>
            ) : (
              <>
                <FileText className="w-4 h-4 mr-2" />
                Upload & Analyze Document
              </>
            )}
          </Button>
        )}

        {extractedData && !showEditForm && (
          <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              <span className="font-semibold text-foreground">
                Document analyzed as: {extractedData.type.charAt(0).toUpperCase() + extractedData.type.slice(1)}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEditForm(true)}
              className="mt-2"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Review & Edit Data
            </Button>
          </div>
        )}

        {renderEditForm()}
      </div>
    </Card>
  )
}
