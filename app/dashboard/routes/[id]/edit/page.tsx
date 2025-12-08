"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { use } from "react"
import { toast } from "sonner"

export default function EditRoutePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [formData, setFormData] = useState({
    name: "NY-PA Route",
    origin: "New York",
    destination: "Pennsylvania",
    distance: "180 mi",
    time: "3h 30m",
    driver: "John Smith",
    truck: "TR-001",
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    toast.success("Route updated successfully")
    window.location.href = `/dashboard/routes/${id}`
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="border-b border-border bg-card/50 backdrop-blur px-8 py-4 flex items-center gap-4">
        <Link href={`/dashboard/routes/${id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Edit Route</h1>
      </div>

      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-2xl mx-auto">
          <Card className="border-border p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-foreground">Route Name</label>
                  <Input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="mt-2 bg-input border-border text-foreground"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Origin</label>
                  <Input
                    type="text"
                    name="origin"
                    value={formData.origin}
                    onChange={handleChange}
                    className="mt-2 bg-input border-border text-foreground"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Destination</label>
                  <Input
                    type="text"
                    name="destination"
                    value={formData.destination}
                    onChange={handleChange}
                    className="mt-2 bg-input border-border text-foreground"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Distance</label>
                  <Input
                    type="text"
                    name="distance"
                    value={formData.distance}
                    onChange={handleChange}
                    className="mt-2 bg-input border-border text-foreground"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Time</label>
                  <Input
                    type="text"
                    name="time"
                    value={formData.time}
                    onChange={handleChange}
                    className="mt-2 bg-input border-border text-foreground"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Driver</label>
                  <Input
                    type="text"
                    name="driver"
                    value={formData.driver}
                    onChange={handleChange}
                    className="mt-2 bg-input border-border text-foreground"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Truck</label>
                  <Input
                    type="text"
                    name="truck"
                    value={formData.truck}
                    onChange={handleChange}
                    className="mt-2 bg-input border-border text-foreground"
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <Button type="submit" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  Save Changes
                </Button>
                <Link href={`/dashboard/routes/${id}`}>
                  <Button type="button" variant="outline" className="border-border bg-transparent">
                    Cancel
                  </Button>
                </Link>
              </div>
            </form>
          </Card>
        </div>
      </main>
    </div>
  )
}
