"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
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
import { ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { GooglePlacesAutocomplete } from "@/components/google-places-autocomplete"
import { postLoadToMarketplace } from "@/app/actions/marketplace"

export default function PostLoadPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    origin: "",
    destination: "",
    rate: "",
    rate_type: "flat" as "flat" | "per_mile",
    weight: "",
    contents: "",
    pickup_date: "",
    delivery_date: "",
    equipment_type: "",
    notes: "",
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const result = await postLoadToMarketplace({
        origin: formData.origin,
        destination: formData.destination,
        rate: parseFloat(formData.rate) || 0,
        weight: formData.weight || undefined,
        contents: formData.contents || undefined,
        pickup_date: formData.pickup_date || undefined,
        delivery_date: formData.delivery_date || undefined,
        equipment_type: formData.equipment_type && formData.equipment_type !== "any" ? formData.equipment_type : undefined,
        notes: formData.notes || undefined,
      })

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Load posted to marketplace!")
        router.push("/dashboard/marketplace")
      }
    } catch (error: any) {
      toast.error("Failed to post load")
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full bg-background">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/marketplace">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Post Load to Marketplace</h1>
            <p className="text-muted-foreground mt-2">
              Post your load for carriers to see and accept
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          <Card className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label>Origin *</Label>
                  <GooglePlacesAutocomplete
                    value={formData.origin}
                    onChange={(value: string) => setFormData({ ...formData, origin: value })}
                    onPlaceSelect={(address: { address_line1?: string | null; [key: string]: any }) => {
                      setFormData({ ...formData, origin: address.address_line1?.trim() || formData.origin })
                    }}
                    placeholder="Enter origin address"
                    id="origin"
                  />
                </div>

                <div>
                  <Label>Destination *</Label>
                  <GooglePlacesAutocomplete
                    value={formData.destination}
                    onChange={(value: string) => setFormData({ ...formData, destination: value })}
                    onPlaceSelect={(address: { address_line1?: string | null; [key: string]: any }) => {
                      setFormData({ ...formData, destination: address.address_line1?.trim() || formData.destination })
                    }}
                    placeholder="Enter destination address"
                    id="destination"
                  />
                </div>

                <div>
                  <Label>Rate *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.rate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, rate: e.target.value })}
                    placeholder="0.00"
                    required
                  />
                </div>

                <div>
                  <Label>Rate Type</Label>
                  <Select
                    value={formData.rate_type}
                    onValueChange={(value: "flat" | "per_mile") =>
                      setFormData({ ...formData, rate_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flat">Flat Rate</SelectItem>
                      <SelectItem value="per_mile">Per Mile</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Weight (Optional)</Label>
                  <Input
                    value={formData.weight}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, weight: e.target.value })}
                    placeholder="e.g., 22,500 lbs"
                  />
                </div>

                <div>
                  <Label>Equipment Type (Optional)</Label>
                  <Select
                    value={formData.equipment_type || undefined}
                    onValueChange={(value) => setFormData({ ...formData, equipment_type: value === "any" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Any Equipment" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any Equipment</SelectItem>
                      <SelectItem value="dry_van">Dry Van</SelectItem>
                      <SelectItem value="reefer">Reefer</SelectItem>
                      <SelectItem value="flatbed">Flatbed</SelectItem>
                      <SelectItem value="box_truck">Box Truck</SelectItem>
                      <SelectItem value="step_deck">Step Deck</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Pickup Date (Optional)</Label>
                  <Input
                    type="date"
                    value={formData.pickup_date}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, pickup_date: e.target.value })}
                  />
                </div>

                <div>
                  <Label>Delivery Date (Optional)</Label>
                  <Input
                    type="date"
                    value={formData.delivery_date}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, delivery_date: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>Contents (Optional)</Label>
                <Input
                  value={formData.contents}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, contents: e.target.value })}
                  placeholder="Describe the freight"
                />
              </div>

              <div>
                <Label>Notes (Optional)</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes for carriers"
                  rows={4}
                />
              </div>

              <div className="flex items-center gap-4">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Posting..." : "Post Load"}
                </Button>
                <Link href="/dashboard/marketplace">
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </Link>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  )
}
